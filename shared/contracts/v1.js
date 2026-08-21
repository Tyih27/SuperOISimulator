export const CONTRACT_VERSION = 1;

// The original v1/v2 payload schemas below are retained for archived clients.
// Current API payloads use the v3 schemas exported at the end of this module.

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
    password: { type: "string", minLength: 8, maxLength: 1024 },
  },
  additionalProperties: false,
});
export const PASSWORD_CHANGE_DTO_SCHEMA = deepFreeze({
  $id: "super-oi/password-change-v1",
  type: "object",
  required: ["currentPassword", "newPassword"],
  properties: {
    currentPassword: { type: "string", minLength: 8, maxLength: 1024 },
    newPassword: { type: "string", minLength: 8, maxLength: 1024 },
  },
  additionalProperties: false,
});
export const ACCOUNT_DELETE_DTO_SCHEMA = deepFreeze({
  $id: "super-oi/account-delete-v1",
  type: "object",
  required: ["password"],
  properties: { password: { type: "string", minLength: 8, maxLength: 1024 } },
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
const skillGroupLevels = {
  type: "object",
  minProperties: 1,
  additionalProperties: skillLevelMap,
};
const formation = {
  type: "object",
  required: ["A1", "A2", "A3"],
  properties: {
    A1: { type: ["string", "null"], minLength: 1 },
    A2: { type: ["string", "null"], minLength: 1 },
    A3: { type: ["string", "null"], minLength: 1 },
  },
  additionalProperties: false,
};
const aptitude = { enum: ["普通", "优秀", "稀有", "天才", "顶尖"] };
const nonNegativeInteger = { type: "integer", minimum: 0 };
const inventory = {
  type: "object",
  additionalProperties: nonNegativeInteger,
};
const currencies = {
  type: "object",
  required: ["trainingCoins", "recruitmentTickets"],
  properties: {
    trainingCoins: nonNegativeInteger,
    recruitmentTickets: nonNegativeInteger,
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
    aptitude,
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
  required: [
    "schemaVersion",
    "version",
    "accountId",
    "identitySeed",
    "namePoolVersion",
    "students",
    "formation",
    "inventory",
    "currencies",
    "unlockedLevelIds",
  ],
  properties: {
    schemaVersion: { type: "integer", const: CONTRACT_V2_VERSION },
    version: positiveInteger,
    accountId: { type: "string", minLength: 1 },
    identitySeed: { type: ["string", "number"] },
    namePoolVersion: positiveInteger,
    formation,
    students: { type: "object", additionalProperties: identityStudent },
    inventory,
    currencies,
    unlockedLevelIds: {
      type: "array",
      items: { type: "string", minLength: 1 },
      minItems: 1,
      uniqueItems: true,
    },
  },
  additionalProperties: false,
});

export const PROFILE_UPDATE_DTO_SCHEMA = deepFreeze({
  $id: "super-oi/profile-update-v1",
  type: "object",
  required: ["version"],
  properties: {
    version: positiveInteger,
    formation,
    students: {
      type: "object",
      additionalProperties: {
        type: "object",
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1, maxLength: 12 },
          aptitude,
          abilities: abilityMap,
          maxEnergy: positiveInteger,
          skillGroupId: { type: "string", minLength: 1 },
          skillGroupLevels,
        },
        additionalProperties: false,
      },
    },
    inventory,
    currencies,
    unlockedLevelIds: {
      type: "array",
      items: { type: "string", minLength: 1 },
      minItems: 1,
      uniqueItems: true,
    },
  },
  additionalProperties: false,
});

export const CAMPAIGN_SETTLEMENT_DTO_SCHEMA = deepFreeze({
  $id: "super-oi/campaign-settlement-v1",
  type: "object",
  required: ["settlementId", "levelId", "result"],
  properties: {
    settlementId: { type: "string", minLength: 1, maxLength: 128 },
    levelId: { type: "string", minLength: 1, maxLength: 128 },
    result: { const: "win" },
  },
  additionalProperties: false,
});

export const EMPTY_DTO_SCHEMA = deepFreeze({
  $id: "super-oi/empty-v1",
  type: "object",
  additionalProperties: false,
});

export const BATTLE_START_DTO_SCHEMA = deepFreeze({
  $id: "super-oi/battle-start-v1",
  type: "object",
  required: ["levelId", "teamIds", "formation"],
  properties: {
    levelId: { type: "string", minLength: 1, maxLength: 128 },
    teamIds: { type: "array", minItems: 1, maxItems: 3, uniqueItems: true, items: { type: "string", minLength: 1, maxLength: 128 } },
    formation,
  },
  additionalProperties: false,
});

export const SPECIALIST_TRAINING_DTO_SCHEMA = deepFreeze({
  $id: "super-oi/specialist-training-v1",
  type: "object",
  required: ["studentId", "ability"],
  properties: {
    studentId: { type: "string", minLength: 1, maxLength: 128 },
    ability: { enum: ["dynamicProgramming", "graphTheory", "dataStructures", "mathematics", "implementation"] },
  },
  additionalProperties: false,
});

export const DISMISS_STUDENTS_DTO_SCHEMA = deepFreeze({
  $id: "super-oi/dismiss-students-v1",
  type: "object",
  required: ["studentIds"],
  properties: {
    studentIds: {
      type: "array",
      minItems: 1,
      maxItems: 50,
      uniqueItems: true,
      items: { type: "string", minLength: 1, maxLength: 128 },
    },
  },
  additionalProperties: false,
});

export const SHOP_PURCHASE_DTO_SCHEMA = deepFreeze({
  $id: "super-oi/shop-purchase-v1",
  type: "object",
  required: ["offerId"],
  properties: { offerId: { type: "string", minLength: 1, maxLength: 128 } },
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

// v3 moves immutable skill definitions into a battle catalogue. Player
// profiles retain only the selected group and its progression record.
export const CONTRACT_V3_VERSION = 3;

const skillGroupStudent = {
  type: "object",
  required: ["id", "name", "aptitude", "abilities", "maxEnergy", "skillGroupId", "skillGroupLevels"],
  properties: {
    id: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1, maxLength: 12 },
    aptitude,
    abilities: abilityMap,
    maxEnergy: positiveInteger,
    skillGroupId: { type: "string", minLength: 1 },
    skillGroupLevels,
  },
  additionalProperties: false,
};

export const PROFILE_V3_DTO_SCHEMA = deepFreeze({
  $id: "super-oi/profile-v3",
  type: "object",
  required: [
    "schemaVersion",
    "version",
    "accountId",
    "identitySeed",
    "namePoolVersion",
    "students",
    "formation",
    "inventory",
    "currencies",
    "recruitment",
    "unlockedLevelIds",
  ],
  properties: {
    schemaVersion: { type: "integer", const: CONTRACT_V3_VERSION },
    version: positiveInteger,
    accountId: { type: "string", minLength: 1 },
    identitySeed: { type: ["string", "number"] },
    namePoolVersion: positiveInteger,
    formation,
    students: { type: "object", additionalProperties: skillGroupStudent },
    inventory,
    currencies,
    recruitment: {
      type: "object",
      required: ["attemptsSinceGenius"],
      properties: {
        attemptsSinceGenius: { type: "integer", minimum: 0, maximum: 29 },
        templateIndex: { type: "integer", minimum: 0 },
      },
      additionalProperties: false,
    },
    unlockedLevelIds: {
      type: "array",
      items: { type: "string", minLength: 1 },
      minItems: 1,
      uniqueItems: true,
    },
  },
  additionalProperties: false,
});

export const BATTLE_SNAPSHOT_V3_DTO_SCHEMA = deepFreeze({
  $id: "super-oi/battle-snapshot-v3",
  type: "object",
  required: [
    "snapshotVersion",
    "engineVersion",
    "rulesetVersion",
    "profileVersion",
    "namePoolVersion",
    "team",
    "skillGroups",
    "level",
    "formation",
    "seed",
    "timestamp",
  ],
  properties: {
    snapshotVersion: { type: "integer", const: CONTRACT_V3_VERSION },
    engineVersion: versionString,
    rulesetVersion: versionString,
    profileVersion: positiveInteger,
    namePoolVersion: positiveInteger,
    team: { type: "array", items: skillGroupStudent, minItems: 3, maxItems: 3 },
    skillGroups: { type: "object", minProperties: 1, additionalProperties: { type: "object" } },
    level,
    formation,
    seed: { type: ["string", "number"] },
    timestamp: { type: "string", format: "date-time" },
  },
  additionalProperties: false,
});

export const ARENA_DEFENSE_DTO_SCHEMA = deepFreeze({
  $id: "super-oi/arena-defense-v1",
  type: "object",
  required: ["version", "teamIds", "formation"],
  properties: {
    version: positiveInteger,
    teamIds: { type: "array", minItems: 1, maxItems: 3, uniqueItems: true, items: { type: "string", minLength: 1, maxLength: 128 } },
    formation,
  },
  additionalProperties: false,
});

export const ARENA_MATCH_DTO_SCHEMA = deepFreeze({
  $id: "super-oi/arena-match-v1",
  type: "object",
  required: ["opponentId"],
  properties: { opponentId: { type: "string", minLength: 1, maxLength: 128 } },
  additionalProperties: false,
});
