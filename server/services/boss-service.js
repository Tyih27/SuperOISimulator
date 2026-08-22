import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { LEVELS } from "../../src/data.js";
import { createBattleSnapshot } from "../../src/domain/snapshot.js";
import { runBoss } from "../../src/combat/boss-engine.js";
import { calculateTeamPower } from "../../src/combat/math.js";
import { createBossLevel, withBossLevel } from "../../src/combat/boss-content.js";
import { LedgerRepository } from "../repositories/ledger-repository.js";
import { BossRepository } from "../repositories/boss-repository.js";
import { ProfileRepository } from "../repositories/profile-repository.js";
import { ProfileService, profileFromRow } from "./profile-service.js";
import { AuditRepository } from "../repositories/audit-repository.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const level = LEVELS[0];
export const BOSS_DAILY_BATTLE_LIMIT = 10;
export const BOSS_COIN_DIVISOR = 200;

export class BossError extends Error {
  constructor(code, statusCode, message) { super(message); this.name = "BossError"; this.code = code; this.statusCode = statusCode; }
}
const invalid = (message) => new BossError("INVALID_BOSS_REQUEST", 400, message);
const notFound = () => new BossError("BOSS_NOT_FOUND", 404, "Boss challenge does not exist");
const conflict = (message) => new BossError("BOSS_CONFLICT", 409, message);
const dailyLimitReached = () => new BossError("BOSS_DAILY_LIMIT_REACHED", 409, "Boss daily challenge limit reached");
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const resetTimeZone = () => process.env.RESET_TIME_ZONE || "Asia/Shanghai";

function requireAccount(accountId) { if (typeof accountId !== "string" || !accountId.trim()) throw invalid("Account is required"); }

function snapshotPower(snapshot) {
  return calculateTeamPower(snapshot?.team ?? []);
}

export function coinsForDamage(damage) {
  return Math.floor(Math.max(0, Number(damage) || 0) / BOSS_COIN_DIVISOR);
}

export class BossService {
  constructor(pool, { now = () => new Date(), idFactory = randomUUID, starterStudentIds = null } = {}) {
    this.pool = pool; this.now = now; this.idFactory = idFactory;
    this.boss = new BossRepository(); this.profiles = new ProfileRepository(pool);
    this.defaults = new ProfileService(pool, { starterStudentIds }); this.ledger = new LedgerRepository(); this.audit = new AuditRepository();
  }

  async dailyQuota(client, accountId) {
    const battlesToday = await this.boss.countChallengesOnDay(client, accountId, resetTimeZone());
    return { battlesToday, dailyLimit: BOSS_DAILY_BATTLE_LIMIT };
  }

  async history(accountId, limit) {
    requireAccount(accountId);
    const client = await this.pool.connect();
    try {
      return (await this.boss.listChallenges(client, accountId, limit)).map((row) => ({
        id: row.id,
        status: row.status,
        damage: row.damage ?? null,
        rewardCoins: row.reward_coins ?? null,
        createdAt: row.created_at,
        settledAt: row.settled_at,
      }));
    } finally { client.release(); }
  }

  async start(accountId, { version, teamIds, formation } = {}) {
    requireAccount(accountId);
    if (!Number.isInteger(version) || version < 1) throw invalid("A profile version is required");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const profileRow = await this.profiles.findOrCreateForUpdate(client, { accountId, profile: this.defaults.defaultProfile(accountId) });
      const profile = profileFromRow(profileRow, accountId);
      if (profile.version !== version) throw conflict("Profile has changed; reload and try again");
      const battlesToday = await this.boss.countChallengesOnDay(client, accountId, resetTimeZone());
      if (battlesToday >= BOSS_DAILY_BATTLE_LIMIT) throw dailyLimitReached();
      const challengeId = this.idFactory();
      const seed = `boss:${challengeId}`;
      let baseSnapshot;
      try { baseSnapshot = createBattleSnapshot(profile, { levelId: level.id, teamIds, formation, timestamp: this.now().toISOString(), seed: `defense:${accountId}` }); }
      catch (error) { throw invalid(error.message); }
      const bossLevel = createBossLevel({ seed, targetPower: snapshotPower(baseSnapshot) });
      const snapshot = withBossLevel(baseSnapshot, bossLevel, seed);
      const saved = await this.boss.createChallenge(client, { id: challengeId, accountId, seed, snapshot });
      await this.audit.append(client, { accountId, actionType: "boss_challenge_start", payload: { challengeId, snapshotHash: hash(snapshot) } });
      await client.query("COMMIT");
      return { id: saved.id, seed: saved.seed, snapshot };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  async settle(accountId, challengeId) {
    requireAccount(accountId); if (!UUID_PATTERN.test(challengeId ?? "")) throw invalid("Challenge id is invalid");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const challenge = await this.boss.getChallenge(client, challengeId, true);
      if (!challenge || challenge.account_id !== accountId) throw notFound();
      if (challenge.status === "settled") throw conflict("Boss challenge has already been settled");
      const result = runBoss({ snapshot: challenge.snapshot, seed: challenge.seed });
      const rewardCoins = coinsForDamage(result.damage);
      let rewardLedgerId = null;
      let savedProfile = null;
      if (rewardCoins > 0) {
        const profileRow = await this.profiles.findOrCreateForUpdate(client, { accountId, profile: this.defaults.defaultProfile(accountId) });
        const profile = profileFromRow(profileRow, accountId);
        profile.currencies.trainingCoins += rewardCoins;
        profile.version = profileRow.version + 1;
        savedProfile = await this.profiles.update(client, { accountId, version: profile.version, profile });
        const ledger = await client.query(`INSERT INTO currency_ledger (account_id, currency, delta, source_type, source_id) VALUES ($1, 'trainingCoins', $2, 'boss', $3) RETURNING id`, [accountId, rewardCoins, challengeId]);
        rewardLedgerId = ledger.rows[0]?.id ?? null;
      }
      const saved = await this.boss.settleChallenge(client, {
        id: challengeId, result, events: result.events, eventsHash: result.eventsHash,
        damage: result.damage, rewardCoins, rewardLedgerId,
      });
      if (!saved) throw conflict("Boss challenge has already been settled");
      await this.audit.append(client, { accountId, actionType: "boss_settlement", payload: { challengeId, damage: result.damage, rewardCoins } });
      await client.query("COMMIT");
      return {
        id: challengeId,
        result: result.result,
        reason: result.reason,
        round: result.round,
        damage: result.damage,
        reward: rewardCoins > 0 ? { trainingCoins: rewardCoins } : {},
        profile: savedProfile ? structuredClone(savedProfile.payload) : undefined,
        replay: { eventsHash: result.eventsHash },
      };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
}
