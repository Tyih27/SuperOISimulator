export const CONTRACT_VERSION = 1;

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const positiveInteger = { type: "integer", minimum: 1 };
export const AUTH_CREDENTIALS_DTO_SCHEMA = deepFreeze({
  $id: "super-oi/auth-credentials-v1",
  type: "object",
  required: ["username", "password"],
  properties: {
    username: { type: "string", pattern: "^[a-zA-Z0-9_]{3,24}$" },
    password: { type: "string", minLength: 12, maxLength: 1024 },
  },
  additionalProperties: false,
});
const versionString = { type: "string", const: "1" };
const abilityMap = {
  type: "object",
  additionalProperties: { type: "integer", minimum: 0 },
};
const skillLevelMap = {
  type: "object",
  required: ["normal", "burst"],
  properties: {
    normal: positiveInteger,
    burst: positiveInteger,
  },
  additionalProperties: false,
};
const formation = {
  type: "object",
  required: ["A1", "A2", "A3"],
  properties: {
    A1: { type: "string", minLength: 1 },
    A2: { type: "string", minLength: 1 },
    A3: { type: "string", minLength: 1 },
  },
  additionalProperties: false,
};
const ownedStudent = {
  type: "object",
  required: ["id", "abilities", "maxEnergy", "skillLevels"],
  properties: {
    id: { type: "string", minLength: 1 },
    abilities: abilityMap,
    maxEnergy: positiveInteger,
    skillLevels: skillLevelMap,
  },
  additionalProperties: false,
};

export const PROFILE_DTO_SCHEMA = deepFreeze({
  $id: "super-oi/profile-v1",
  type: "object",
  required: ["schemaVersion", "version", "accountId", "students"],
  properties: {
    schemaVersion: { type: "integer", const: CONTRACT_VERSION },
    version: positiveInteger,
    accountId: { type: "string", minLength: 1 },
    students: {
      type: "object",
      additionalProperties: ownedStudent,
    },
  },
  additionalProperties: false,
});

const battleStudent = {
  type: "object",
  required: ["id", "name", "aptitude", "role", "abilities", "maxEnergy", "skillLevels", "skills"],
  properties: {
    ...ownedStudent.properties,
    name: { type: "string", minLength: 1 },
    aptitude: { type: "string", minLength: 1 },
    role: { type: "string", minLength: 1 },
    skills: {
      type: "object",
      required: ["normal", "burst"],
      properties: {
        normal: { type: "object" },
        burst: { type: "object" },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};
const topic = {
  type: "object",
  required: ["id", "name", "difficulties", "maxProgress"],
  properties: {
    id: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    difficulties: abilityMap,
    maxProgress: positiveInteger,
  },
  additionalProperties: false,
};
const level = {
  type: "object",
  required: [
    "id",
    "name",
    "maxRounds",
    "objective",
    "topicIds",
    "activeTopicSlots",
    "studentSlots",
    "focusMax",
    "focusGain",
    "seed",
    "topics",
  ],
  properties: {
    id: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    maxRounds: positiveInteger,
    objective: { type: "object" },
    topicIds: { type: "array", items: { type: "string" }, minItems: 1, uniqueItems: true },
    activeTopicSlots: { type: "array", items: { type: "string" }, minItems: 1, uniqueItems: true },
    studentSlots: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3, uniqueItems: true },
    focusMax: positiveInteger,
    focusGain: positiveInteger,
    seed: { type: ["string", "number"] },
    topics: { type: "array", items: topic, minItems: 1 },
  },
  additionalProperties: false,
};

export const BATTLE_SNAPSHOT_DTO_SCHEMA = deepFreeze({
  $id: "super-oi/battle-snapshot-v1",
  type: "object",
  required: [
    "snapshotVersion",
    "engineVersion",
    "rulesetVersion",
    "profileVersion",
    "team",
    "level",
    "formation",
    "seed",
    "timestamp",
  ],
  properties: {
    snapshotVersion: { type: "integer", const: CONTRACT_VERSION },
    engineVersion: versionString,
    rulesetVersion: versionString,
    profileVersion: positiveInteger,
    team: { type: "array", items: battleStudent, minItems: 3, maxItems: 3 },
    level,
    formation,
    seed: { type: ["string", "number"] },
    timestamp: { type: "string", format: "date-time" },
  },
  additionalProperties: false,
});

export const BATTLE_RESULT_DTO_SCHEMA = deepFreeze({
  $id: "super-oi/battle-result-v1",
  type: "object",
  required: ["engineVersion", "rulesetVersion", "result", "events"],
  properties: {
    engineVersion: versionString,
    rulesetVersion: versionString,
    result: { enum: ["win", "lose"] },
    reason: { type: ["string", "null"] },
    round: { type: "integer", minimum: 0 },
    completedCount: { type: "integer", minimum: 0 },
    remainingEnergy: { type: "integer", minimum: 0 },
    events: { type: "array", items: { type: "object" } },
    state: { type: "object" },
  },
  additionalProperties: false,
});

// v1 remains available for historical snapshots. New player identities use a
// separate schema because v1 battle students required a static `role` field.
export const CONTRACT_V2_VERSION = 2;

const identityStudent = {
  type: "object",
  required: ["id", "name", "aptitude", "abilities", "maxEnergy", "skillLevels", "skills"],
  properties: {
    id: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1, maxLength: 12 },
    aptitude: { enum: ["普通", "优秀", "稀有", "天才", "顶尖"] },
    abilities: abilityMap,
    maxEnergy: positiveInteger,
    skillLevels: skillLevelMap,
    skills: {
      type: "object",
      required: ["normal", "burst"],
      properties: { normal: { type: "object" }, burst: { type: "object" } },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

export const PROFILE_V2_DTO_SCHEMA = deepFreeze({
  $id: "super-oi/profile-v2",
  type: "object",
  required: ["schemaVersion", "version", "accountId", "identitySeed", "namePoolVersion", "students"],
  properties: {
    schemaVersion: { type: "integer", const: CONTRACT_V2_VERSION },
    version: positiveInteger,
    accountId: { type: "string", minLength: 1 },
    identitySeed: { type: ["string", "number"] },
    namePoolVersion: positiveInteger,
    formation,
    students: { type: "object", additionalProperties: identityStudent },
  },
  additionalProperties: false,
});

export const BATTLE_SNAPSHOT_V2_DTO_SCHEMA = deepFreeze({
  $id: "super-oi/battle-snapshot-v2",
  type: "object",
  required: [
    "snapshotVersion",
    "engineVersion",
    "rulesetVersion",
    "profileVersion",
    "namePoolVersion",
    "team",
    "level",
    "formation",
    "seed",
    "timestamp",
  ],
  properties: {
    snapshotVersion: { type: "integer", const: CONTRACT_V2_VERSION },
    engineVersion: versionString,
    rulesetVersion: versionString,
    profileVersion: positiveInteger,
    namePoolVersion: positiveInteger,
    team: { type: "array", items: identityStudent, minItems: 3, maxItems: 3 },
    level,
    formation,
    seed: { type: ["string", "number"] },
    timestamp: { type: "string", format: "date-time" },
  },
  additionalProperties: false,
});
