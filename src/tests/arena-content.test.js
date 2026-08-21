import assert from "node:assert/strict";
import { createArenaLevel } from "../combat/arena-content.js";
import { calculateOverallPower } from "../combat/math.js";
import { createProfile } from "../domain/profile.js";
import { createBattleSnapshot } from "../domain/snapshot.js";

const profile = createProfile({ accountId: "arena-content", studentIds: ["planner", "graphist", "structurer"] });
const snapshot = createBattleSnapshot(profile, {
  levelId: "chapter-1-1",
  teamIds: ["planner", "graphist", "structurer"],
  formation: { A1: "planner", A2: "graphist", A3: "structurer" },
  seed: "content-fixture",
  timestamp: "2026-08-22T00:00:00.000Z",
});
const teamPower = snapshot.team.reduce((sum, student) => sum + Math.round(calculateOverallPower(student)), 0);

const first = createArenaLevel({ seed: "same", targetPower: teamPower });
const second = createArenaLevel({ seed: "same", targetPower: teamPower });
assert.deepEqual(first, second, "arena content should be deterministic for a seed");
assert.equal(first.topics.length, 3);
assert.equal(new Set(first.topicIds).size, 3);
assert.equal(first.objective.requiredTopics, 2);
assert.ok(first.topics.every((topic) => Object.values(topic.difficulties).reduce((sum, value) => sum + value, 0) >= teamPower * 0.89));
assert.ok(first.topics.every((topic) => Object.values(topic.difficulties).reduce((sum, value) => sum + value, 0) <= teamPower * 1.11));

const different = createArenaLevel({ seed: "different", targetPower: teamPower });
assert.notDeepEqual(first, different, "different seeds should vary the random question set");
assert.throws(() => createArenaLevel({ seed: null, targetPower: teamPower }), /seed/);
assert.throws(() => createArenaLevel({ seed: "bad", targetPower: -1 }), /power/);

console.log("arena content tests passed");
