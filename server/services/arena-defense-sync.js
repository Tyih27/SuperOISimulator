import { LEVELS } from "../../src/data.js";
import { createBattleSnapshot } from "../../src/domain/snapshot.js";
import { ArenaRepository } from "../repositories/arena-repository.js";

const FORMATION_SLOTS = ["A1", "A2", "A3"];
const sharedRepository = new ArenaRepository();

/** Build the immutable defense snapshot a formation currently implies. */
export function buildDefenseSnapshot(profile, { timestamp } = {}) {
  const teamIds = FORMATION_SLOTS.map((slot) => profile?.formation?.[slot]).filter(Boolean);
  if (!teamIds.length) throw new Error("Defense formation has no placed students");
  return createBattleSnapshot(profile, {
    levelId: LEVELS[0].id,
    teamIds,
    formation: structuredClone(profile.formation),
    timestamp: timestamp ?? new Date().toISOString(),
    seed: `defense:${profile.accountId}`,
  });
}

/**
 * Rebuild and persist an account's arena defense snapshot from its current
 * profile inside the caller's transaction. Keeps any stored snapshot untouched
 * when the account never opted into arena defense or the current formation
 * cannot produce a valid snapshot, so progression actions never fail because
 * of arena bookkeeping.
 */
export async function syncArenaDefenseSnapshot(client, { accountId, profile, now = () => new Date(), repository = sharedRepository } = {}) {
  const existing = await repository.getDefense(client, accountId);
  if (!existing) return false;
  try {
    const snapshot = buildDefenseSnapshot(profile, { timestamp: now().toISOString() });
    await repository.saveDefense(client, { accountId, profileVersion: profile.version, snapshot });
    return true;
  } catch {
    return false;
  }
}
