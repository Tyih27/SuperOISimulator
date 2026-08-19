import assert from "node:assert/strict";
import { ABILITY_KEYS, APTITUDE_ABILITY_RANGES, NAME_POOL_VERSION } from "../data.js";
import { createProfile, migrateProfile } from "../domain/profile.js";
import {
  createStudentIdentity,
  generateStudentName,
  normalizeStudentName,
  renameStudent,
} from "../domain/student-identity.js";

const studentIds = ["planner", "graphist", "structurer"];
const firstIdentity = createStudentIdentity({ studentId: "planner", seed: "identity-seed" });
assert.deepEqual(
  firstIdentity,
  createStudentIdentity({ studentId: "planner", seed: "identity-seed" }),
  "a versioned name pool and seed must produce the same identity",
);
assert.equal(generateStudentName({ studentId: "planner", seed: "identity-seed", namePoolVersion: NAME_POOL_VERSION }), firstIdentity.name);
for (const key of ABILITY_KEYS) {
  const [minimum, maximum] = APTITUDE_ABILITY_RANGES[firstIdentity.aptitude][key];
  assert.ok(firstIdentity.abilities[key] >= minimum && firstIdentity.abilities[key] <= maximum, `${key} must use its aptitude range`);
}

assert.equal(normalizeStudentName("  林 澈  "), "林 澈");
assert.throws(() => normalizeStudentName(" "), /1 to 12 visible characters/);
assert.throws(() => normalizeStudentName("1234567890123"), /1 to 12 visible characters/);
assert.throws(() => normalizeStudentName("林\n澈"), /1 to 12 visible characters/);

const formation = { A1: "planner", A2: "graphist", A3: "structurer" };
const profile = createProfile({ accountId: "identity-account", studentIds, identitySeed: "identity-seed", formation });
assert.ok(Object.values(profile.students).every(({ aptitude }) => aptitude === "普通"), "new students must start with ordinary aptitude");
const beforeRename = structuredClone(profile);
assert.strictEqual(renameStudent(profile, "planner", "  林澈  "), profile, "rename updates the owned profile");
assert.equal(profile.students.planner.name, "林澈");
assert.equal(profile.students.planner.id, beforeRename.students.planner.id);
assert.equal(profile.students.planner.aptitude, beforeRename.students.planner.aptitude);
assert.deepEqual(profile.students.planner.abilities, beforeRename.students.planner.abilities);
assert.deepEqual(profile.students.planner.skills, beforeRename.students.planner.skills);
assert.deepEqual(profile.formation, beforeRename.formation);
assert.equal(profile.accountId, beforeRename.accountId);
assert.deepEqual(profile.students.graphist, beforeRename.students.graphist);
assert.throws(() => renameStudent(profile, "unknown", "林澈"), /owned by the profile/);

const legacyProfile = {
  schemaVersion: 1,
  version: 4,
  accountId: "legacy-account",
  students: {
    planner: {
      id: "planner",
      name: "  自定义名  ",
      abilities: { dynamicProgramming: 820, graphTheory: 540, dataStructures: 610, mathematics: 420, implementation: 760 },
      maxEnergy: 5200,
      skillLevels: { normal: 3, burst: 2 },
    },
    graphist: {
      id: "graphist",
      abilities: { dynamicProgramming: 520, graphTheory: 860, dataStructures: 640, mathematics: 580, implementation: 700 },
      maxEnergy: 5000,
      skillLevels: { normal: 1, burst: 1 },
    },
  },
};
const migrated = migrateProfile(legacyProfile, { seed: "legacy-seed" });
assert.equal(migrated.schemaVersion, 2);
assert.equal(migrated.identitySeed, "legacy-seed");
assert.equal(migrated.students.planner.name, "自定义名");
assert.equal(migrated.students.graphist.name, generateStudentName({ studentId: "graphist", seed: "legacy-seed" }));
assert.deepEqual(migrated.students.planner.abilities, legacyProfile.students.planner.abilities);
assert.deepEqual(migrated.students.planner.skillLevels, legacyProfile.students.planner.skillLevels);
assert.equal(migrated.students.planner.id, "planner");
assert.deepEqual(migrateProfile(legacyProfile, { seed: "legacy-seed" }), migrated, "migration must be deterministic");

console.log("student identity tests passed");
