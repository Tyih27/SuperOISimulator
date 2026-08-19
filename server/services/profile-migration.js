import { migrateProfile as migrateDomainProfile, PROFILE_SCHEMA_VERSION } from "../../src/domain/profile.js";

export const CURRENT_PROFILE_SCHEMA_VERSION = PROFILE_SCHEMA_VERSION;

/**
 * Convert persisted legacy payloads without mutating the JSON value read from
 * PostgreSQL. The account id is supplied by the authenticated owner because
 * older exports did not always include it.
 */
export function migrateProfile(profile, { accountId, seed, namePoolVersion } = {}) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    throw new Error("A profile object is required for migration");
  }
  const candidate = structuredClone(profile);
  candidate.accountId = candidate.accountId ?? accountId ?? "legacy-account";
  candidate.version = Number.isInteger(candidate.version) && candidate.version > 0 ? candidate.version : 1;
  candidate.schemaVersion = candidate.schemaVersion ?? 1;
  candidate.identitySeed = candidate.identitySeed ?? seed ?? candidate.accountId;
  const migrated = migrateDomainProfile(candidate, {
    seed: seed ?? candidate.identitySeed,
    namePoolVersion: namePoolVersion ?? candidate.namePoolVersion,
  });
  if (!migrated.formation) migrated.formation = { A1: "planner", A2: "graphist", A3: "structurer" };
  return migrated;
}
