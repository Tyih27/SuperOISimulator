import { NAME_POOL_VERSION, SKILL_GROUPS, STUDENTS } from "../data.js";
import {
  aptitudeForAbilities,
  createStudentIdentity,
  generateInitialAbilities,
  generateStudentName,
  normalizeStudentName,
} from "./student-identity.js";

export { renameStudent } from "./student-identity.js";

export const LEGACY_PROFILE_SCHEMA_VERSION = 1;
export const PROFILE_SCHEMA_VERSION = 3;
export const STARTER_STUDENT_IDS = Object.freeze(STUDENTS.map(({ id }) => id));
export const DEFAULT_CURRENCIES = Object.freeze({
  trainingCoins: 1_000,
  recruitmentTickets: 1,
});
export const DEFAULT_RECRUITMENT_STATE = Object.freeze({ attemptsSinceGenius: 0 });
export const DEFAULT_UNLOCKED_LEVEL_IDS = Object.freeze(["chapter-1-1"]);

const studentById = new Map(STUDENTS.map((student) => [student.id, student]));

function requireAccountId(accountId) {
  if (typeof accountId !== "string" || accountId.trim() === "") {
    throw new Error("Profile accountId must be a non-empty string");
  }
  return accountId;
}

function requireVersion(version) {
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("Profile version must be a positive integer");
  }
  return version;
}

function requireStudentIds(studentIds) {
  if (!Array.isArray(studentIds)) throw new Error("Profile studentIds must be an array");
  if (new Set(studentIds).size !== studentIds.length) {
    throw new Error("A profile must contain different students");
  }
  for (const studentId of studentIds) {
    if (!studentById.has(studentId)) throw new Error(`Unknown student: ${studentId}`);
  }
  return studentIds;
}

function createOwnedStudent(studentId, identitySeed, namePoolVersion) {
  const content = studentById.get(studentId);
  if (!SKILL_GROUPS[content.skillGroupId]) {
    throw new Error(`Unknown skill group: ${content.skillGroupId}`);
  }
  const identity = createStudentIdentity({
    studentId,
    seed: identitySeed,
    namePoolVersion,
    aptitude: content.defaultAptitude,
  });
  return {
    ...identity,
    maxEnergy: content.maxEnergy,
    skillGroupId: content.skillGroupId,
    skillGroupLevels: { [content.skillGroupId]: { normal: 1, burst: 1 } },
  };
}

function requireSkillGroup(student, studentId) {
  if (typeof student?.skillGroupId !== "string" || !SKILL_GROUPS[student.skillGroupId]) {
    throw new Error(`Unknown skill group for student ${studentId}: ${student?.skillGroupId}`);
  }
}

export function createProfile({
  accountId,
  studentIds = [],
  version = 1,
  identitySeed = accountId,
  namePoolVersion = NAME_POOL_VERSION,
  formation,
  inventory = {},
  currencies = DEFAULT_CURRENCIES,
  recruitment = DEFAULT_RECRUITMENT_STATE,
  unlockedLevelIds = DEFAULT_UNLOCKED_LEVEL_IDS,
} = {}) {
  requireAccountId(accountId);
  requireVersion(version);
  requireStudentIds(studentIds);
  if (typeof identitySeed !== "string" && typeof identitySeed !== "number") {
    throw new Error("Profile identitySeed must be a string or number");
  }
  const students = Object.fromEntries(studentIds.map((studentId) => [
    studentId,
    createOwnedStudent(studentId, identitySeed, namePoolVersion),
  ]));
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    version,
    accountId,
    identitySeed,
    namePoolVersion,
    students,
    ...(formation === undefined ? {} : { formation: structuredClone(formation) }),
    inventory: structuredClone(inventory),
    currencies: structuredClone(currencies),
    recruitment: structuredClone(recruitment),
    unlockedLevelIds: structuredClone(unlockedLevelIds),
  };
}

export function migrateProfile(profile, { seed = profile?.identitySeed ?? profile?.accountId, namePoolVersion = NAME_POOL_VERSION } = {}) {
  if (!profile || typeof profile !== "object") throw new Error("A profile is required for migration");
  requireAccountId(profile.accountId);
  requireVersion(profile.version);
  if (profile.schemaVersion === PROFILE_SCHEMA_VERSION) {
    for (const [studentId, student] of Object.entries(profile.students ?? {})) {
      requireSkillGroup(student, studentId);
    }
    return {
      ...structuredClone(profile),
      formation: structuredClone(profile.formation ?? { A1: "planner", A2: "graphist", A3: "structurer" }),
      inventory: structuredClone(profile.inventory ?? {}),
      currencies: structuredClone(profile.currencies ?? DEFAULT_CURRENCIES),
      recruitment: { ...DEFAULT_RECRUITMENT_STATE, templateIndex: 0, ...structuredClone(profile.recruitment ?? {}) },
      unlockedLevelIds: structuredClone(profile.unlockedLevelIds ?? DEFAULT_UNLOCKED_LEVEL_IDS),
    };
  }
  if (profile.schemaVersion !== LEGACY_PROFILE_SCHEMA_VERSION && profile.schemaVersion !== 2) {
    throw new Error(`Unsupported profile schema version: ${profile.schemaVersion}`);
  }
  if (typeof seed !== "string" && typeof seed !== "number") {
    throw new Error("Profile migration seed must be a string or number");
  }
  const students = Object.fromEntries(Object.entries(profile.students ?? {}).map(([studentId, legacyStudent]) => {
    const content = studentById.get(studentId);
    if (!content) throw new Error(`Unknown student: ${studentId}`);
    if (!SKILL_GROUPS[content.skillGroupId]) {
      throw new Error(`Unknown skill group: ${content.skillGroupId}`);
    }
    const preferredAptitude = legacyStudent.aptitude ?? content.defaultAptitude;
    const abilities = legacyStudent.abilities
      ? structuredClone(legacyStudent.abilities)
      : generateInitialAbilities({ aptitude: preferredAptitude, seed, studentId });
    const aptitude = aptitudeForAbilities(abilities, preferredAptitude);
    const name = legacyStudent.name === undefined
      ? generateStudentName({ studentId, seed, namePoolVersion })
      : normalizeStudentName(legacyStudent.name);
    return [studentId, {
      id: legacyStudent.id ?? studentId,
      name,
      aptitude,
      abilities,
      maxEnergy: legacyStudent.maxEnergy ?? content.maxEnergy,
      skillGroupId: content.skillGroupId,
      skillGroupLevels: {
        [content.skillGroupId]: {
          normal: legacyStudent.skillLevels?.normal
            ?? legacyStudent.skillGroupLevels?.[content.skillGroupId]?.normal
            ?? 1,
          burst: legacyStudent.skillLevels?.burst
            ?? legacyStudent.skillGroupLevels?.[content.skillGroupId]?.burst
            ?? 1,
        },
      },
    }];
  }));
  return {
    ...structuredClone(profile),
    schemaVersion: PROFILE_SCHEMA_VERSION,
    identitySeed: seed,
    namePoolVersion,
    students,
    formation: structuredClone(profile.formation ?? { A1: "planner", A2: "graphist", A3: "structurer" }),
    inventory: structuredClone(profile.inventory ?? {}),
    currencies: structuredClone(profile.currencies ?? DEFAULT_CURRENCIES),
    recruitment: { ...DEFAULT_RECRUITMENT_STATE, templateIndex: 0, ...structuredClone(profile.recruitment ?? {}) },
    unlockedLevelIds: structuredClone(profile.unlockedLevelIds ?? DEFAULT_UNLOCKED_LEVEL_IDS),
  };
}
