import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { LEVELS } from "../../src/data.js";
import { createBattleSnapshot } from "../../src/domain/snapshot.js";
import { runArena } from "../../src/combat/arena-engine.js";
import { LedgerRepository } from "../repositories/ledger-repository.js";
import { ArenaRepository } from "../repositories/arena-repository.js";
import { ProfileRepository } from "../repositories/profile-repository.js";
import { ProfileService, profileFromRow } from "./profile-service.js";
import { AuditRepository } from "../repositories/audit-repository.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const level = LEVELS[0];
const ARENA_DAILY_BATTLE_LIMIT = 40;

export class ArenaError extends Error {
  constructor(code, statusCode, message) { super(message); this.name = "ArenaError"; this.code = code; this.statusCode = statusCode; }
}
const invalid = (message) => new ArenaError("INVALID_ARENA_REQUEST", 400, message);
const notFound = () => new ArenaError("ARENA_NOT_FOUND", 404, "Arena record does not exist");
const conflict = (message) => new ArenaError("ARENA_CONFLICT", 409, message);
const dailyLimitReached = () => new ArenaError("ARENA_DAILY_LIMIT_REACHED", 409, "Arena daily battle limit reached");
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const resetTimeZone = () => process.env.RESET_TIME_ZONE || "Asia/Shanghai";

function requireAccount(accountId) { if (typeof accountId !== "string" || !accountId.trim()) throw invalid("Account is required"); }
function ratingDelta(winner) { return winner === "attacker" ? 25 : winner === "defender" ? -25 : 0; }

function publicDefense(row) {
  return { accountId: row.account_id, username: row.username, rating: row.rating, battlesWon: row.battles_won, battlesLost: row.battles_lost, updatedAt: row.updated_at };
}

export class ArenaService {
  constructor(pool, { now = () => new Date(), idFactory = randomUUID } = {}) {
    this.pool = pool; this.now = now; this.idFactory = idFactory;
    this.arena = new ArenaRepository(); this.profiles = new ProfileRepository(pool);
    this.defaults = new ProfileService(pool); this.ledger = new LedgerRepository(); this.audit = new AuditRepository();
  }

  async setDefense(accountId, { version, teamIds, formation } = {}) {
    requireAccount(accountId);
    if (!Number.isInteger(version) || version < 1) throw invalid("A profile version is required");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const row = await this.profiles.findOrCreateForUpdate(client, { accountId, profile: this.defaults.defaultProfile(accountId) });
      const profile = profileFromRow(row, accountId);
      if (profile.version !== version) throw conflict("Profile has changed; reload and try again");
      let snapshot;
      try { snapshot = createBattleSnapshot(profile, { levelId: level.id, teamIds, formation, timestamp: this.now().toISOString(), seed: `defense:${accountId}` }); }
      catch (error) { throw invalid(error.message); }
      const saved = await this.arena.saveDefense(client, { accountId, profileVersion: version, snapshot });
      await this.audit.append(client, { accountId, actionType: "arena_defense_update", payload: { snapshotHash: hash(snapshot) } });
      await client.query("COMMIT");
      return { defense: publicDefense(saved), snapshot };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  async opponents(accountId) {
    requireAccount(accountId); const client = await this.pool.connect();
    try { return (await this.arena.listOpponents(client, accountId)).map(publicDefense); } finally { client.release(); }
  }

  async dailyQuota(client, accountId) {
    const battlesToday = await this.arena.countAttackerMatchesOnDay(client, accountId, resetTimeZone());
    return { battlesToday, dailyLimit: ARENA_DAILY_BATTLE_LIMIT };
  }

  async history(accountId, limit) {
    requireAccount(accountId);
    const client = await this.pool.connect();
    try {
      return (await this.arena.listMatches(client, accountId, limit)).map((row) => ({
        id: row.id, attackerId: row.attacker_id, defenderId: row.defender_id, seed: row.seed,
        status: row.status, result: row.result, rating: {
          attackerBefore: row.attacker_rating_before, defenderBefore: row.defender_rating_before,
          attackerAfter: row.attacker_rating_after, defenderAfter: row.defender_rating_after,
        }, createdAt: row.created_at, settledAt: row.settled_at,
      }));
    } finally { client.release(); }
  }

  async start(accountId, { opponentId } = {}) {
    requireAccount(accountId);
    if (!UUID_PATTERN.test(opponentId ?? "")) throw invalid("Opponent id is invalid");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const attacker = await this.arena.getDefense(client, accountId, true);
      const defender = await this.arena.getDefense(client, opponentId, true);
      if (!attacker) throw invalid("Set a defensive formation before attacking");
      if (!defender || defender.account_id === accountId) throw notFound();
      const battlesToday = await this.arena.countAttackerMatchesOnDay(client, accountId, resetTimeZone());
      if (battlesToday >= ARENA_DAILY_BATTLE_LIMIT) throw dailyLimitReached();
      const matchId = this.idFactory();
      const match = await this.arena.createMatch(client, { id: matchId, attackerId: accountId, defenderId: opponentId, seed: `arena:${matchId}`, attackerSnapshot: attacker.snapshot, defenderSnapshot: defender.snapshot, attackerRatingBefore: attacker.rating, defenderRatingBefore: defender.rating });
      await client.query("COMMIT");
      return { id: match.id, seed: match.seed, attacker: { accountId }, defender: { accountId: opponentId, rating: defender.rating }, snapshots: { attacker: match.attacker_snapshot, defender: match.defender_snapshot } };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  async settle(accountId, matchId) {
    requireAccount(accountId); if (!UUID_PATTERN.test(matchId ?? "")) throw invalid("Match id is invalid");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const match = await this.arena.getMatch(client, matchId, true);
      if (!match || match.attacker_id !== accountId) throw notFound();
      if (match.status === "settled") throw conflict("Arena match has already been settled");
      const result = runArena({ attackerSnapshot: match.attacker_snapshot, defenderSnapshot: match.defender_snapshot, seed: match.seed });
      const delta = ratingDelta(result.winner);
      const attackerAfter = Math.max(0, match.attacker_rating_before + delta);
      const defenderAfter = Math.max(0, match.defender_rating_before - delta);
      let rewardLedgerId = null;
      let savedProfile = null;
      if (result.winner === "attacker") {
        const profileRow = await this.profiles.findOrCreateForUpdate(client, {
          accountId,
          profile: this.defaults.defaultProfile(accountId),
        });
        const profile = profileFromRow(profileRow, accountId);
        profile.currencies.trainingCoins += 25;
        profile.version = profileRow.version + 1;
        savedProfile = await this.profiles.update(client, { accountId, version: profile.version, profile });
      }
      await this.arena.updateRatings(client, { attackerId: match.attacker_id, defenderId: match.defender_id, attackerRating: attackerAfter, defenderRating: defenderAfter, winner: result.winner });
      if (result.winner === "attacker") {
        const ledger = await client.query(`INSERT INTO currency_ledger (account_id, currency, delta, source_type, source_id) VALUES ($1, 'trainingCoins', 25, 'arena', $2) RETURNING id`, [accountId, matchId]);
        rewardLedgerId = ledger.rows[0]?.id ?? null;
      }
      const saved = await this.arena.settleMatch(client, { id: matchId, result, attackerEvents: result.attacker.events, defenderEvents: result.defender.events, attackerEventsHash: result.attacker.eventsHash, defenderEventsHash: result.defender.eventsHash, attackerRatingAfter: attackerAfter, defenderRatingAfter: defenderAfter, rewardLedgerId });
      if (!saved) throw conflict("Arena match has already been settled");
      await this.audit.append(client, { accountId, actionType: "arena_settlement", payload: { matchId, winner: result.winner } });
      await client.query("COMMIT");
      return { id: matchId, result, rating: { before: match.attacker_rating_before, after: attackerAfter }, reward: result.winner === "attacker" ? { trainingCoins: 25 } : {}, profile: savedProfile ? structuredClone(savedProfile.payload) : undefined, replay: { attackerEventsHash: result.attacker.eventsHash, defenderEventsHash: result.defender.eventsHash } };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  async replay(accountId, matchId) {
    requireAccount(accountId); if (!UUID_PATTERN.test(matchId ?? "")) throw invalid("Match id is invalid");
    const client = await this.pool.connect();
    try {
      const match = await this.arena.getMatch(client, matchId);
      if (!match || (match.attacker_id !== accountId && match.defender_id !== accountId)) throw notFound();
      if (match.status !== "settled") throw conflict("Arena match is not settled");
      return { id: match.id, seed: match.seed, result: match.result, snapshots: { attacker: match.attacker_snapshot, defender: match.defender_snapshot }, events: { attacker: match.attacker_events, defender: match.defender_events }, hashes: { attacker: match.attacker_events_hash.trim(), defender: match.defender_events_hash.trim() }, rating: { attackerBefore: match.attacker_rating_before, defenderBefore: match.defender_rating_before, attackerAfter: match.attacker_rating_after, defenderAfter: match.defender_rating_after } };
    } finally { client.release(); }
  }
}
