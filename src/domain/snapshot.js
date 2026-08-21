import {
  ENGINE_VERSION,
  LEVELS,
  RULESET_VERSION,
  SKILL_GROUPS,
  TOPICS,
} from "../data.js";
import { PROFILE_SCHEMA_VERSION } from "./profile.js";

export const BATTLE_SNAPSHOT_VERSION = 3;

const FORMATION_SLOTS = Object.freeze(["A1", "A2", "A3"]);
const topicContentById = new Map(TOPICS.map((topic) => [topic.id, topic]));
const levelContentById = new Map(LEVELS.map((level) => [level.id, level]));

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function validateTeam(profile, teamIds) {
  if (!Array.isArray(teamIds) || teamIds.length < 1 || teamIds.length > FORMATION_SLOTS.length
    || new Set(teamIds).size !== teamIds.length) {
    throw new Error("Battle team must contain one to three different students");
  }
  if (teamIds.some((studentId) => !profile.students?.[studentId])) {
    throw new Error("Every selected student must be owned by the profile");
  }
}

function createFormation(teamIds, configuredFormation) {
  const formation = configuredFormation
    ? structuredClone(configuredFormation)
    : Object.fromEntries(FORMATION_SLOTS.map((slot, index) => [slot, teamIds[index] ?? null]));
  if (FORMATION_SLOTS.some((slot) => !(slot in formation))) {
    throw new Error("Battle formation must include every slot");
  }
  const formationIds = FORMATION_SLOTS.map((slot) => formation[slot] ?? null);
  const placed = formationIds.filter(Boolean);

  if (
    placed.some((studentId) => !teamIds.includes(studentId))
    || new Set(placed).size !== placed.length
    || placed.length !== teamIds.length
  ) {
    throw new Error("Battle formation must place every selected student in a distinct slot");
  }
  return formation;
}

function createTeamStudent(profile, studentId) {
  const persistentStudent = profile.students[studentId];
  const skillGroupId = persistentStudent?.skillGroupId;
  if (!SKILL_GROUPS[skillGroupId]) {
    throw new Error(`Owned student ${studentId} has an unknown skill group`);
  }
  const skillGroupLevels = persistentStudent?.skillGroupLevels;
  const selectedLevels = skillGroupLevels?.[skillGroupId];
  if (!selectedLevels || !Number.isInteger(selectedLevels.normal) || selectedLevels.normal < 1
    || !Number.isInteger(selectedLevels.burst) || selectedLevels.burst < 1) {
    throw new Error(`Owned student ${studentId} is missing skill group levels`);
  }

  return {
    id: studentId,
    name: persistentStudent.name,
    aptitude: persistentStudent.aptitude,
    abilities: structuredClone(persistentStudent.abilities),
    maxEnergy: persistentStudent.maxEnergy,
    skillGroupId,
    skillGroupLevels: structuredClone(skillGroupLevels),
  };
}

function createLevel(levelId) {
  const level = levelContentById.get(levelId);
  if (!level) throw new Error(`Unknown level: ${levelId}`);

  return {
    id: level.id,
    name: level.name,
    maxRounds: level.maxRounds,
    objective: structuredClone(level.objective),
    topicIds: [...level.topicIds],
    activeTopicSlots: [...level.activeTopicSlots],
    studentSlots: [...level.studentSlots],
    focusMax: level.focusMax,
    focusGain: level.focusGain,
    seed: level.seed,
    topics: level.topicIds.map((topicId) => {
      const topic = topicContentById.get(topicId);
      if (!topic) throw new Error(`Unknown topic content: ${topicId}`);
      return structuredClone(topic);
    }),
  };
}

export function createBattleSnapshot(profile, selection = {}) {
  if (
    !profile
    || profile.schemaVersion !== PROFILE_SCHEMA_VERSION
    || !Number.isInteger(profile.version)
    || !Number.isInteger(profile.namePoolVersion)
    || profile.namePoolVersion < 1
  ) {
    throw new Error("A versioned profile is required");
  }

  const { teamIds, formation: configuredFormation } = selection;
  validateTeam(profile, teamIds);
  const level = createLevel(selection.levelId ?? LEVELS[0].id);
  const formation = createFormation(teamIds, configuredFormation);
  const timestamp = selection.timestamp ?? new Date().toISOString();
  const parsedTimestamp = typeof timestamp === "string" ? Date.parse(timestamp) : Number.NaN;
  if (!Number.isFinite(parsedTimestamp) || new Date(parsedTimestamp).toISOString() !== timestamp) {
    throw new Error("Battle timestamp must be a canonical ISO date-time string");
  }
  const seed = selection.seed ?? level.seed;
  if (typeof seed !== "string" && typeof seed !== "number") {
    throw new Error("Battle seed must be a string or number");
  }

  return deepFreeze({
    snapshotVersion: BATTLE_SNAPSHOT_VERSION,
    engineVersion: ENGINE_VERSION,
    rulesetVersion: RULESET_VERSION,
    profileVersion: profile.version,
    namePoolVersion: profile.namePoolVersion,
    team: teamIds.map((studentId) => createTeamStudent(profile, studentId)),
    skillGroups: structuredClone(SKILL_GROUPS),
    level,
    formation,
    seed,
    timestamp,
  });
}
