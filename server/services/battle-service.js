import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import { CombatEngine } from "../../src/combat/engine.js";
import { serializeEvents } from "../../src/combat/events.js";
import { LEVELS } from "../../src/data.js";
import { createBattleSnapshot } from "../../src/domain/snapshot.js";
import { LedgerRepository } from "../repositories/ledger-repository.js";
import { BattleRepository } from "../repositories/battle-repository.js";
import { ProfileRepository } from "../repositories/profile-repository.js";
import { ProfileService, profileFromRow } from "./profile-service.js";

const levelById = new Map(LEVELS.map((level) => [level.id, level]));
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class BattleError extends Error {
  constructor(code, statusCode, message) {
    super(message);
    this.name = "BattleError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function invalid(message) {
  return new BattleError("INVALID_BATTLE_REQUEST", 400, message);
}

function notFound() {
  return new BattleError("BATTLE_NOT_FOUND", 404, "Battle does not exist");
}

function conflict(message) {
  return new BattleError("BATTLE_ALREADY_SETTLED", 409, message);
}

function requireAccountId(accountId) {
  if (typeof accountId !== "string" || accountId.trim() === "") throw invalid("Account is required");
}

function eventLogHash(events) {
  return createHash("sha256").update(serializeEvents(events)).digest("hex");
}

function addReward(profile, reward) {
  for (const currency of ["trainingCoins", "recruitmentTickets"]) {
    profile.currencies[currency] += reward[currency] ?? 0;
  }
  for (const [itemId, quantity] of Object.entries(reward.inventory ?? {})) {
    profile.inventory[itemId] = (profile.inventory[itemId] ?? 0) + quantity;
  }
  if (reward.unlockLevelId && !profile.unlockedLevelIds.includes(reward.unlockLevelId)) {
    profile.unlockedLevelIds.push(reward.unlockLevelId);
  }
}

async function recordReward(ledger, client, accountId, reward, battleId) {
  for (const currency of ["trainingCoins", "recruitmentTickets"]) {
    const delta = reward[currency] ?? 0;
    if (delta > 0) {
      await ledger.recordCurrency(client, { accountId, currency, delta, sourceType: "campaign", sourceId: battleId });
    }
  }
  for (const [itemId, quantity] of Object.entries(reward.inventory ?? {})) {
    await ledger.recordInventoryGrant(client, { accountId, itemId, quantity, sourceType: "campaign", sourceId: battleId });
  }
}

export function runBattleSnapshot(snapshot) {
  const engine = CombatEngine.fromSnapshot(snapshot);
  return engine.run();
}

export class BattleService {
  constructor(pool, { now = () => new Date(), idFactory = randomUUID } = {}) {
    this.pool = pool;
    this.now = now;
    this.idFactory = idFactory;
    this.battles = new BattleRepository();
    this.profiles = new ProfileRepository(pool);
    this.profileDefaults = new ProfileService(pool);
    this.ledger = new LedgerRepository();
  }

  async start(accountId, selection = {}) {
    requireAccountId(accountId);
    if (Object.keys(selection).some((key) => !["levelId", "teamIds", "formation"].includes(key))) {
      throw invalid("Battle start contains unsupported fields");
    }
    const level = levelById.get(selection.levelId);
    if (!level) throw invalid("Unknown campaign level");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const row = await this.profiles.findOrCreateForUpdate(client, {
        accountId,
        profile: this.profileDefaults.defaultProfile(accountId),
      });
      const profile = profileFromRow(row, accountId);
      if (!profile.unlockedLevelIds.includes(level.id)) throw invalid("Campaign level is locked");
      let snapshot;
      try {
        snapshot = createBattleSnapshot(profile, {
          levelId: level.id,
          teamIds: selection.teamIds,
          formation: selection.formation,
          timestamp: this.now().toISOString(),
        });
      } catch (error) {
        throw invalid(error.message);
      }
      const battle = await this.battles.create(client, {
        id: this.idFactory(), accountId, levelId: level.id, snapshot,
      });
      await client.query("COMMIT");
      return { id: battle.id, snapshot };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async settle(accountId, battleId) {
    requireAccountId(accountId);
    if (typeof battleId !== "string" || !UUID_PATTERN.test(battleId)) throw invalid("Battle id is invalid");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const battle = await this.battles.findForUpdate(client, battleId);
      if (!battle || battle.account_id !== accountId) throw notFound();
      if (battle.status === "settled") throw conflict("Battle has already been settled");

      const snapshot = structuredClone(battle.snapshot);
      const result = runBattleSnapshot(snapshot);
      const hash = eventLogHash(result.events);
      const reward = result.result === "win" ? structuredClone(levelById.get(battle.level_id).reward) : {};
      let profile;
      const profileRow = await this.profiles.findOrCreateForUpdate(client, {
        accountId,
        profile: this.profileDefaults.defaultProfile(accountId),
      });
      profile = profileFromRow(profileRow, accountId);
      if (result.result === "win") {
        addReward(profile, reward);
        profile.version = profileRow.version + 1;
        const saved = await this.profiles.update(client, { accountId, version: profile.version, profile });
        profile = profileFromRow(saved, accountId);
        await recordReward(this.ledger, client, accountId, reward, battleId);
      }
      const savedBattle = await this.battles.settle(client, { id: battleId, result, events: result.events, eventLogHash: hash });
      if (!savedBattle) throw conflict("Battle has already been settled");
      await client.query("COMMIT");
      return {
        id: battleId,
        result,
        eventLogHash: hash,
        recomputedEventLogHash: eventLogHash(result.events),
        reward,
        profile,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
