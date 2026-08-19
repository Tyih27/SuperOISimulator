import {
  ENGINE_VERSION,
  LEVELS,
  RULESET_VERSION,
  STUDENTS,
  TOPICS,
} from "../data.js";
import { PROFILE_SCHEMA_VERSION } from "./profile.js";

export const BATTLE_SNAPSHOT_VERSION = 2;

const FORMATION_SLOTS = Object.freeze(["A1", "A2", "A3"]);
const studentContentById = new Map(STUDENTS.map((student) => [student.id, student]));
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
  if (!Array.isArray(teamIds) || teamIds.length !== 3 || new Set(teamIds).size !== 3) {
    throw new Error("Battle team must contain exactly three different students");
  }
  if (teamIds.some((studentId) => !profile.students?.[studentId])) {
    throw new Error("Every selected student must be owned by the profile");
  }
}

function createFormation(teamIds, configuredFormation) {
  const formation = configuredFormation
    ? structuredClone(configuredFormation)
    : Object.fromEntries(FORMATION_SLOTS.map((slot, index) => [slot, teamIds[index]]));
  const formationIds = FORMATION_SLOTS.map((slot) => formation[slot]);

  if (
    Object.keys(formation).length !== FORMATION_SLOTS.length
    || new Set(formationIds).size !== 3
    || formationIds.some((studentId) => !teamIds.includes(studentId))
  ) {
    throw new Error("Battle formation must place the selected team in A1, A2 and A3");
  }
  return formation;
}

function createTeamStudent(profile, studentId) {
  const persistentStudent = profile.students[studentId];
  const content = studentContentById.get(studentId);
  if (!content) throw new Error(`Unknown student content: ${studentId}`);

  return {
    id: studentId,
    name: persistentStudent.name,
    aptitude: persistentStudent.aptitude,
    abilities: structuredClone(persistentStudent.abilities),
    maxEnergy: persistentStudent.maxEnergy,
    skillLevels: structuredClone(persistentStudent.skillLevels),
    skills: structuredClone(persistentStudent.skills ?? content.skills),
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
    level,
    formation,
    seed,
    timestamp,
  });
}
