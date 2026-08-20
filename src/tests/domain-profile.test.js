import assert from "node:assert/strict";
import { serializeBattleResult, serializeEvents } from "../combat/events.js";
import { CombatEngine } from "../combat/engine.js";
import { ENGINE_VERSION, RULESET_VERSION, SKILL_GROUPS } from "../data.js";
import { createProfile, migrateProfile, PROFILE_SCHEMA_VERSION } from "../domain/profile.js";
import { BATTLE_SNAPSHOT_VERSION, createBattleSnapshot } from "../domain/snapshot.js";
import { renameStudent } from "../domain/student-identity.js";
import {
  BATTLE_SNAPSHOT_V2_DTO_SCHEMA,
  BATTLE_RESULT_DTO_SCHEMA,
  BATTLE_SNAPSHOT_DTO_SCHEMA,
  CONTRACT_VERSION,
  PROFILE_DTO_SCHEMA,
  PROFILE_V2_DTO_SCHEMA,
  PROFILE_V3_DTO_SCHEMA,
  BATTLE_SNAPSHOT_V3_DTO_SCHEMA,
} from "../../shared/contracts/v1.js";

const studentIds = ["planner", "graphist", "structurer", "mathematician"];
const profile = createProfile({ accountId: "acc-1", studentIds });

assert.equal(profile.schemaVersion, PROFILE_SCHEMA_VERSION);
assert.equal(profile.version, 1);
assert.equal(profile.accountId, "acc-1");
assert.equal(typeof profile.identitySeed, "string");
assert.equal(profile.namePoolVersion, 1);
assert.deepEqual(profile.recruitment, { attemptsSinceGenius: 0 });
assert.deepEqual(Object.keys(profile.students), studentIds);
assert.ok(Object.values(profile.students).every(({ aptitude }) => aptitude === "普通"));
assert.equal(Object.keys(profile.students).length, 4, "the profile must not impose the three-student battle limit on the roster");
assert.equal(profile.students.planner.skillGroupId, "planner");
assert.deepEqual(profile.students.planner.skillGroupLevels, { planner: { normal: 1, burst: 1 } });
assert.notEqual(profile.students.planner.abilities, profile.students.graphist.abilities);
assert.ok(profile.students.planner.name);
assert.ok(profile.students.planner.aptitude);
assert.ok(!Object.hasOwn(profile.students.planner, "skills"));

assert.throws(
  () => createProfile({ accountId: "acc-2", studentIds: ["planner", "planner"] }),
  /different students/,
);
assert.throws(
  () => createProfile({ accountId: "acc-2", studentIds: ["unknown-student"] }),
  /Unknown student/,
);

const timestamp = "2026-08-19T00:00:00.000Z";
const snapshot = createBattleSnapshot(profile, {
  levelId: "chapter-1-1",
  teamIds: ["planner", "graphist", "structurer"],
  timestamp,
});

assert.equal(snapshot.snapshotVersion, BATTLE_SNAPSHOT_VERSION);
assert.equal(snapshot.engineVersion, ENGINE_VERSION);
assert.equal(snapshot.rulesetVersion, RULESET_VERSION);
assert.equal(snapshot.profileVersion, profile.version);
assert.equal(snapshot.namePoolVersion, profile.namePoolVersion);
assert.equal(snapshot.timestamp, timestamp);
assert.equal(snapshot.level.id, "chapter-1-1");
assert.equal(snapshot.team.length, 3);
assert.deepEqual(snapshot.team.map(({ id }) => id), ["planner", "graphist", "structurer"]);
assert.deepEqual(snapshot.formation, { A1: "planner", A2: "graphist", A3: "structurer" });
assert.equal(snapshot.seed, snapshot.level.seed);
assert.ok(snapshot.level.topics.length > 3);
assert.ok(!snapshot.team.some(({ id }) => id === "mathematician"), "unselected students must not leak into battle input");
assert.notEqual(snapshot.team[0].abilities, profile.students.planner.abilities);
assert.notEqual(snapshot.team[0].skillGroupLevels, profile.students.planner.skillGroupLevels);
assert.equal(snapshot.team[0].skillGroupId, profile.students.planner.skillGroupId);
assert.notEqual(snapshot.skillGroups, SKILL_GROUPS);
assert.deepEqual(snapshot.skillGroups, SKILL_GROUPS);
assert.ok(!Object.hasOwn(snapshot.team[0], "skills"));
assert.ok(!Object.hasOwn(snapshot.team[0], "skillLevels"));
assert.equal(snapshot.team[0].name, profile.students.planner.name);
assert.equal(snapshot.team[0].aptitude, profile.students.planner.aptitude);
assert.ok(!Object.hasOwn(snapshot.team[0], "role"), "v2 snapshots must not expose legacy role labels");
assert.ok(Object.isFrozen(snapshot));
assert.ok(Object.isFrozen(snapshot.team[0].abilities));

const plannerAbility = snapshot.team[0].abilities.dynamicProgramming;
profile.students.planner.abilities.dynamicProgramming += 100;
assert.equal(snapshot.team[0].abilities.dynamicProgramming, plannerAbility, "persistent changes after matchmaking must not alter battle input");

const nameBeforeRename = snapshot.team[0].name;
renameStudent(profile, "planner", "新名字");
assert.equal(snapshot.team[0].name, nameBeforeRename, "rename must not mutate an existing battle snapshot");
assert.equal(profile.students.planner.name, "新名字");

assert.throws(
  () => createBattleSnapshot(profile, { teamIds: studentIds }),
  /exactly three/,
);
assert.throws(
  () => createBattleSnapshot(profile, { teamIds: ["planner", "planner", "graphist"] }),
  /exactly three different students/,
);
assert.throws(
  () => createBattleSnapshot(profile, { teamIds: ["planner", "graphist", "implementer"] }),
  /owned by the profile/,
);
assert.throws(
  () => createBattleSnapshot(profile, {
    teamIds: ["planner", "graphist", "structurer"],
    formation: { A1: "planner", A2: "graphist", A3: "mathematician" },
  }),
  /selected team/,
);
assert.throws(
  () => createBattleSnapshot(profile, {
    teamIds: ["planner", "graphist", "structurer"],
    timestamp: "not-a-date",
  }),
  /canonical ISO/,
);
assert.throws(
  () => createBattleSnapshot(profile, {
    teamIds: ["planner", "graphist", "structurer"],
    seed: { unsafe: true },
  }),
  /string or number/,
);

const orderedEvents = [{ type: "round_start", round: 1 }, { type: "battle_end", round: 1 }];
const serializedEvents = JSON.parse(serializeEvents(orderedEvents));
assert.equal(serializedEvents.engineVersion, ENGINE_VERSION);
assert.equal(serializedEvents.rulesetVersion, RULESET_VERSION);
assert.deepEqual(serializedEvents.events, orderedEvents, "serialization must preserve event order");

const serializedResult = JSON.parse(serializeBattleResult({ result: "win", events: orderedEvents }));
assert.equal(serializedResult.engineVersion, ENGINE_VERSION);
assert.equal(serializedResult.rulesetVersion, RULESET_VERSION);
assert.deepEqual(serializedResult.events, orderedEvents);

assert.equal(CONTRACT_VERSION, 1);
assert.ok(Object.isFrozen(PROFILE_DTO_SCHEMA));
assert.ok(Object.isFrozen(BATTLE_SNAPSHOT_DTO_SCHEMA));
assert.ok(Object.isFrozen(BATTLE_RESULT_DTO_SCHEMA));
assert.ok(Object.isFrozen(PROFILE_V2_DTO_SCHEMA));
assert.ok(Object.isFrozen(BATTLE_SNAPSHOT_V2_DTO_SCHEMA));
assert.ok(Object.isFrozen(PROFILE_V3_DTO_SCHEMA));
assert.ok(Object.isFrozen(BATTLE_SNAPSHOT_V3_DTO_SCHEMA));
assert.ok(PROFILE_DTO_SCHEMA.required.includes("schemaVersion"));
assert.ok(BATTLE_SNAPSHOT_DTO_SCHEMA.required.includes("rulesetVersion"));
assert.ok(BATTLE_RESULT_DTO_SCHEMA.required.includes("engineVersion"));
assert.ok(BATTLE_SNAPSHOT_DTO_SCHEMA.required.includes("team"), "v1 contract remains available");
assert.ok(!BATTLE_SNAPSHOT_V2_DTO_SCHEMA.properties.team.items.required.includes("role"));

const legacy = {
  schemaVersion: 1,
  version: 1,
  accountId: "migration-account",
  students: Object.fromEntries(studentIds.map((id) => [id, {
    id,
    abilities: structuredClone(profile.students[id].abilities),
    maxEnergy: profile.students[id].maxEnergy,
    skillLevels: { normal: 3, burst: 2 },
  }])),
};
const migrated = migrateProfile(legacy, { seed: "migration-seed" });
assert.equal(migrated.schemaVersion, PROFILE_SCHEMA_VERSION);
assert.deepEqual(migrated.students.graphist.abilities, legacy.students.graphist.abilities);
assert.deepEqual(migrated.students.planner.skillGroupLevels.planner, { normal: 3, burst: 2 });

function runSnapshot(snapshotToRun) {
  return new CombatEngine({
    level: snapshotToRun.level,
    students: snapshotToRun.team,
    topics: snapshotToRun.level.topics,
    teamIds: snapshotToRun.team.map(({ id }) => id),
    positions: snapshotToRun.formation,
    skillGroups: snapshotToRun.skillGroups,
    seed: snapshotToRun.seed,
  }).run();
}

const replayProfile = createProfile({ accountId: "replay", studentIds: ["planner", "graphist", "structurer"], identitySeed: "replay-identity" });
const replaySelection = { teamIds: ["planner", "graphist", "structurer"], timestamp, seed: "replay-seed" };
const replaySnapshot = createBattleSnapshot(replayProfile, replaySelection);
const firstReplay = runSnapshot(replaySnapshot);
renameStudent(replayProfile, "planner", "改名后");
const secondReplay = runSnapshot(replaySnapshot);
assert.deepEqual(secondReplay, firstReplay, "renaming after matchmaking must not affect combat outcome");
assert.equal(serializeEvents(secondReplay.events), serializeEvents(firstReplay.events), "the same snapshot and seed must serialize byte-identically");

console.log("domain profile tests passed");
