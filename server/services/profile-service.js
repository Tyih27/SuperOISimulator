import {
  ABILITY_KEYS,
  APTITUDE_ABILITY_RANGES,
  LEVELS,
  SKILL_GROUPS,
} from "../../src/data.js";
import {
  createProfile,
  DEFAULT_CURRENCIES,
  DEFAULT_RECRUITMENT_STATE,
  DEFAULT_UNLOCKED_LEVEL_IDS,
  PROFILE_SCHEMA_VERSION,
  selectStarterStudentIds,
} from "../../src/domain/profile.js";
import { normalizeStudentName } from "../../src/domain/student-identity.js";
import { ProfileRepository } from "../repositories/profile-repository.js";
import { AuditRepository } from "../repositories/audit-repository.js";
import { migrateProfile } from "./profile-migration.js";

const FORMATION_SLOTS = ["A1", "A2", "A3"];
const knownLevelIds = new Set(LEVELS.map(({ id }) => id));

export class ProfileError extends Error {
  constructor(code, statusCode, message) {
    super(message);
    this.name = "ProfileError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function invalid(message) {
  return new ProfileError("INVALID_PROFILE", 400, message);
}

function requireObject(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid(message);
  return value;
}

function requireNonNegativeIntegers(value, message) {
  requireObject(value, message);
  for (const amount of Object.values(value)) {
    if (!Number.isInteger(amount) || amount < 0) throw invalid(message);
  }
}

function validateStudent(studentId, student, ownedStudent) {
  requireObject(student, `Student ${studentId} must be an object`);
  if (!ownedStudent || student.id !== studentId) throw invalid("Students must already be owned by the profile");
  try {
    student.name = normalizeStudentName(student.name);
  } catch {
    throw invalid("Student names must contain 1 to 12 visible characters");
  }
  const ranges = APTITUDE_ABILITY_RANGES[student.aptitude];
  if (!ranges) throw invalid("Student aptitude is invalid");
  requireObject(student.abilities, "Student abilities are invalid");
  const abilityKeys = Object.keys(student.abilities);
  if (abilityKeys.length !== ABILITY_KEYS.length || abilityKeys.some((key) => !ABILITY_KEYS.includes(key))) {
    throw invalid("Student abilities must contain every ability type");
  }
  // Aptitude ranges only govern initial generation; training and legacy
  // profiles may hold any non-negative integer ability value.
  for (const key of ABILITY_KEYS) {
    const value = student.abilities[key];
    if (!Number.isInteger(value) || value < 0) {
      throw invalid("Student abilities must be non-negative integers");
    }
  }
  if (!Number.isInteger(student.maxEnergy) || student.maxEnergy < 1) {
    throw invalid("Student max energy must be positive");
  }
  if (Object.hasOwn(student, "skills") || Object.hasOwn(student, "skillLevels")) {
    throw invalid("Inline student skills are no longer supported");
  }
  if (typeof student.skillGroupId !== "string" || !SKILL_GROUPS[student.skillGroupId]) {
    throw invalid("Student skill group is invalid");
  }
  requireObject(student.skillGroupLevels, "Student skill group levels are invalid");
  if (Object.keys(student.skillGroupLevels).length !== 1 || !Object.hasOwn(student.skillGroupLevels, student.skillGroupId)) {
    throw invalid("Student skill group levels must contain the selected group");
  }
  const levels = student.skillGroupLevels[student.skillGroupId];
  if (!levels || typeof levels !== "object" || Array.isArray(levels)
    || Object.keys(levels).length !== 2
    || !Number.isInteger(levels.normal) || levels.normal < 1
    || !Number.isInteger(levels.burst) || levels.burst < 1) {
    throw invalid("Student skill group levels are invalid");
  }
}

function validateFormation(formation, students) {
  requireObject(formation, "Formation is invalid");
  if (FORMATION_SLOTS.some((slot) => !(slot in formation))) {
    throw invalid("Formation must include every slot");
  }
  const ids = FORMATION_SLOTS.map((slot) => formation[slot]);
  if (ids.some((id) => id !== null && typeof id !== "string")) {
    throw invalid("Formation slots must be a student id or null");
  }
  const placed = ids.filter(Boolean);
  if (placed.some((id) => !students[id])) throw invalid("Formation students must be owned by the profile");
  if (new Set(placed).size !== placed.length) throw invalid("Formation must contain different students");
}

function validateProfile(profile, accountId) {
  requireObject(profile, "Profile is invalid");
  if (profile.schemaVersion !== PROFILE_SCHEMA_VERSION || profile.accountId !== accountId) {
    throw invalid("Profile identity is invalid");
  }
  if (!Number.isInteger(profile.version) || profile.version < 1) throw invalid("Profile version is invalid");
  if (typeof profile.identitySeed !== "string" && typeof profile.identitySeed !== "number") {
    throw invalid("Profile identity seed is invalid");
  }
  if (!Number.isInteger(profile.namePoolVersion) || profile.namePoolVersion < 1) {
    throw invalid("Profile name pool version is invalid");
  }
  requireObject(profile.students, "Profile students are invalid");
  for (const [studentId, student] of Object.entries(profile.students)) {
    validateStudent(studentId, student, profile.students[studentId]);
  }
  validateFormation(profile.formation, profile.students);
  requireNonNegativeIntegers(profile.inventory, "Inventory amounts must be non-negative integers");
  requireObject(profile.currencies, "Currencies are invalid");
  if (!Number.isInteger(profile.currencies.trainingCoins) || profile.currencies.trainingCoins < 0
    || !Number.isInteger(profile.currencies.recruitmentTickets) || profile.currencies.recruitmentTickets < 0
    || Object.keys(profile.currencies).length !== 2) {
    throw invalid("Currencies are invalid");
  }
  requireObject(profile.recruitment, "Recruitment state is invalid");
  if (Object.keys(profile.recruitment).some((key) => !["attemptsSinceGenius", "templateIndex"].includes(key))
    || !Number.isInteger(profile.recruitment.attemptsSinceGenius)
    || profile.recruitment.attemptsSinceGenius < 0
    || profile.recruitment.attemptsSinceGenius > 29
    || !Number.isInteger(profile.recruitment.templateIndex)
    || profile.recruitment.templateIndex < 0) {
    throw invalid("Recruitment state is invalid");
  }
  if (!Array.isArray(profile.unlockedLevelIds) || profile.unlockedLevelIds.length < 1
    || new Set(profile.unlockedLevelIds).size !== profile.unlockedLevelIds.length
    || profile.unlockedLevelIds.some((levelId) => !knownLevelIds.has(levelId))) {
    throw invalid("Unlocked campaign levels are invalid");
  }
}

export function profileFromRow(row, accountId) {
  const profile = migrateProfile(structuredClone(row.payload), { accountId });
  if (profile.version !== row.version) {
    throw new Error(`Stored profile version mismatch for account ${accountId}`);
  }
  validateProfile(profile, accountId);
  return profile;
}

function mergeUpdate(profile, update) {
  if (update.inventory !== undefined || update.currencies !== undefined || update.recruitment !== undefined || update.unlockedLevelIds !== undefined) {
    throw invalid("Inventory, currencies, recruitment, and campaign progress are managed by progression actions");
  }
  const next = structuredClone(profile);
  for (const key of ["formation"]) {
    if (update[key] !== undefined) next[key] = structuredClone(update[key]);
  }
  if (update.students !== undefined) {
    requireObject(update.students, "Students are invalid");
    for (const [studentId, student] of Object.entries(update.students)) {
      if (!next.students[studentId]) throw invalid("Students must already be owned by the profile");
      const current = next.students[studentId];
      for (const key of ["id", "aptitude", "abilities", "maxEnergy", "skillGroupId", "skillGroupLevels"]) {
        if (student[key] !== undefined && JSON.stringify(student[key]) !== JSON.stringify(current[key])) {
          throw invalid("Student stats are managed by progression actions");
        }
      }
      next.students[studentId] = {
        ...next.students[studentId],
        ...structuredClone(student),
        abilities: structuredClone(current.abilities),
        skillGroupId: current.skillGroupId,
        skillGroupLevels: structuredClone(current.skillGroupLevels),
      };
    }
  }
  return next;
}

export class ProfileService {
  constructor(pool, { starterStudentIds = null } = {}) {
    this.pool = pool;
    this.repository = new ProfileRepository(pool);
    this.audit = new AuditRepository();
    this.starterStudentIds = starterStudentIds;
  }

  defaultProfile(accountId) {
    const studentIds = this.starterStudentIds ?? selectStarterStudentIds(accountId);
    return createProfile({
      accountId,
      identitySeed: accountId,
      studentIds,
      formation: Object.fromEntries(FORMATION_SLOTS.map((slot, index) => [slot, studentIds[index] ?? null])),
      inventory: {},
      currencies: DEFAULT_CURRENCIES,
      recruitment: DEFAULT_RECRUITMENT_STATE,
      unlockedLevelIds: DEFAULT_UNLOCKED_LEVEL_IDS,
    });
  }

  async get(accountId) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const row = await this.repository.findOrCreateForUpdate(client, {
        accountId,
        profile: this.defaultProfile(accountId),
      });
      const profile = profileFromRow(row, accountId);
      if (JSON.stringify(profile) !== JSON.stringify(row.payload)) {
        await this.repository.update(client, { accountId, version: profile.version, profile });
      }
      await client.query("COMMIT");
      return profile;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async update(accountId, update) {
    if (!update || !Number.isInteger(update.version) || update.version < 1) {
      throw invalid("A positive profile version is required");
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const row = await this.repository.findOrCreateForUpdate(client, {
        accountId,
        profile: this.defaultProfile(accountId),
      });
      const current = profileFromRow(row, accountId);
      if (update.version !== current.version) {
        throw new ProfileError("PROFILE_VERSION_CONFLICT", 409, "Profile has changed; reload and try again");
      }
      const next = mergeUpdate(current, update);
      next.version = current.version + 1;
      validateProfile(next, accountId);
      const saved = await this.repository.update(client, {
        accountId,
        version: next.version,
        profile: next,
      });
      const renamed = Object.entries(update.students ?? {}).some(([studentId, student]) =>
        student.name !== undefined && student.name !== current.students[studentId]?.name);
      await this.audit.append(client, {
        accountId,
        actionType: renamed ? "student_rename" : "profile_update",
        payload: renamed ? { studentIds: Object.keys(update.students ?? {}).filter((id) => update.students[id]?.name !== undefined) } : { fields: Object.keys(update).filter((key) => key !== "version") },
      });
      await client.query("COMMIT");
      return profileFromRow(saved, accountId);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
