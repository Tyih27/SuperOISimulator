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
import { AuditRepository } from "../repositories/audit-repository.js";

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

function rewardForAttempt(level, firstClear) {
  if (firstClear) return structuredClone(level.reward);
  const reward = structuredClone(level.reward);
  reward.trainingCoins = Math.floor((reward.trainingCoins ?? 0) * 0.2);
  delete reward.unlockLevelId;
  return reward;
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
    this.audit = new AuditRepository();
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
      const battleId = this.idFactory();
      let snapshot;
      try {
        snapshot = createBattleSnapshot(profile, {
          levelId: level.id,
          teamIds: selection.teamIds,
          formation: selection.formation,
          timestamp: this.now().toISOString(),
          // A level's seed is only a content default. Every persisted battle
          // gets its own seed so repeated attempts are different, while
          // settlement/replay can deterministically reuse this snapshot.
          seed: `campaign:${battleId}`,
        });
      } catch (error) {
        throw invalid(error.message);
      }
      const battle = await this.battles.create(client, {
        id: battleId, accountId, levelId: level.id, snapshot,
      });
      await this.audit.append(client, {
        accountId,
        actionType: "battle_started",
        payload: { battleId: battle.id, levelId: level.id },
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
        const firstClear = await this.battles.claimFirstClear(client, { accountId, levelId: battle.level_id });
        Object.assign(reward, rewardForAttempt(levelById.get(battle.level_id), firstClear));
        addReward(profile, reward);
        profile.version = profileRow.version + 1;
        const saved = await this.profiles.update(client, { accountId, version: profile.version, profile });
        profile = profileFromRow(saved, accountId);
        await recordReward(this.ledger, client, accountId, reward, battleId);
      }
      const savedBattle = await this.battles.settle(client, { id: battleId, result, events: result.events, eventLogHash: hash });
      if (!savedBattle) throw conflict("Battle has already been settled");
      await this.audit.append(client, {
        accountId,
        actionType: "battle_settlement",
        payload: { battleId, result: result.result, eventLogHash: hash },
      });
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

  async history(accountId, { id, limit } = {}) {
    requireAccountId(accountId);
    const client = await this.pool.connect();
    try {
      const rows = id
        ? [await this.battles.findForAccount(client, accountId, id)].filter(Boolean)
        : await this.battles.listForAccount(client, accountId, limit);
      return rows.map((row) => ({
        id: row.id, levelId: row.level_id, status: row.status, snapshot: row.snapshot,
        result: row.result, events: row.event_log, eventLogHash: row.event_log_hash?.trim?.() ?? row.event_log_hash,
        createdAt: row.created_at, settledAt: row.settled_at,
      }));
    } finally { client.release(); }
  }
}
