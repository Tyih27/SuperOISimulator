import assert from "node:assert/strict";
import { CURRENT_PROFILE_SCHEMA_VERSION, migrateProfile } from "../services/profile-migration.js";
import { APTITUDE_ABILITY_RANGES } from "../../src/data.js";
import { generateInitialAbilities, generateStudentName } from "../../src/domain/student-identity.js";

const legacy = {
  schemaVersion: 1,
  version: 1,
  accountId: "migration-account",
  students: {
    planner: {
      id: "planner",
      name: "  自定义名  ",
      abilities: { dynamicProgramming: 820, graphTheory: 540, dataStructures: 610, mathematics: 420, implementation: 760 },
      maxEnergy: 5200,
      skillLevels: { normal: 3, burst: 2 },
    },
    graphist: { id: "graphist", maxEnergy: 5000 },
    structurer: { id: "structurer", maxEnergy: 5600 },
  },
};

const before = structuredClone(legacy);
const migrated = migrateProfile(legacy, { seed: "migration-seed" });
assert.equal(migrated.schemaVersion, CURRENT_PROFILE_SCHEMA_VERSION);
assert.deepEqual(migrated.recruitment, { attemptsSinceGenius: 0, templateIndex: 0 });
assert.deepEqual(migrated.formation, { A1: "planner", A2: "graphist", A3: "structurer" });
assert.equal(migrated.students.planner.name, "自定义名");
assert.equal(migrated.students.graphist.name, generateStudentName({ studentId: "graphist", seed: "migration-seed" }));
assert.equal(migrated.students.planner.id, "planner");
assert.deepEqual(migrated.students.planner.skillGroupLevels.planner, { normal: 3, burst: 2 });
assert.equal(migrated.students.graphist.aptitude, "普通");
assert.deepEqual(migrated.students.graphist.abilities, generateInitialAbilities({
  aptitude: "普通", seed: "migration-seed", studentId: "graphist",
}));
for (const [ability, value] of Object.entries(migrated.students.graphist.abilities)) {
  const [minimum, maximum] = APTITUDE_ABILITY_RANGES.普通[ability];
  assert.ok(value >= minimum && value <= maximum, `${ability} must use an ordinary aptitude default`);
}
assert.deepEqual(legacy, before, "migration must not mutate persisted input");

const v2 = structuredClone(legacy);
v2.schemaVersion = 2;
v2.recruitment = { attemptsSinceGenius: 12 };
v2.students.planner.name = "已有名称";
v2.students.planner.aptitude = "优秀";
v2.students.planner.skillLevels = { normal: 4, burst: 5 };
const v2Before = structuredClone(v2);
const migratedV2 = migrateProfile(v2, { seed: "v2-seed" });
assert.equal(migratedV2.schemaVersion, CURRENT_PROFILE_SCHEMA_VERSION);
assert.deepEqual(migratedV2.recruitment, { attemptsSinceGenius: 12, templateIndex: 0 });
assert.equal(migratedV2.students.planner.id, "planner");
assert.equal(migratedV2.students.planner.name, "已有名称");
assert.equal(migratedV2.students.planner.aptitude, "优秀");
assert.deepEqual(migratedV2.students.planner.skillGroupLevels.planner, { normal: 4, burst: 5 });
assert.equal(migratedV2.students.structurer.name, generateStudentName({ studentId: "structurer", seed: "v2-seed" }));
assert.deepEqual(migratedV2.formation, { A1: "planner", A2: "graphist", A3: "structurer" });
assert.deepEqual(v2, v2Before, "v2 migration must not mutate persisted input");
console.log("profile migration tests passed");
