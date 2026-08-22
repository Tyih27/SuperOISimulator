import assert from "node:assert/strict";
import { SKILL_GROUPS } from "../data.js";
import { calculateTeamPower } from "../combat/math.js";
import { createBossLevel, withBossLevel, BOSS_MAX_ROUNDS, BOSS_MAX_PROGRESS, BOSS_ATTACK_DAMAGE_MULTIPLIER } from "../combat/boss-content.js";
import { runBoss } from "../combat/boss-engine.js";
import { createProfile } from "../domain/profile.js";
import { createBattleSnapshot } from "../domain/snapshot.js";

const profile = createProfile({ accountId: "boss-content", studentIds: ["planner", "graphist", "structurer"] });
const baseSnapshot = createBattleSnapshot(profile, {
  levelId: "chapter-1-1",
  teamIds: ["planner", "graphist", "structurer"],
  formation: { A1: "planner", A2: "graphist", A3: "structurer" },
  seed: "boss-fixture",
  timestamp: "2026-08-22T00:00:00.000Z",
});
const teamPower = calculateTeamPower(baseSnapshot.team);

const level = createBossLevel({ seed: "same", targetPower: teamPower });
assert.equal(level.maxRounds, BOSS_MAX_ROUNDS);
assert.equal(BOSS_MAX_ROUNDS, 30);
assert.equal(level.topics.length, 1, "boss fight must be a single giant problem");
assert.equal(level.topicIds.length, 1);
assert.ok(level.topics[0].maxProgress >= BOSS_MAX_PROGRESS, "boss health pool must be effectively infinite");
assert.ok(BOSS_MAX_PROGRESS >= 1_000_000_000);
for (const topic of level.topics) {
  const difficulty = Object.values(topic.difficulties).reduce((sum, value) => sum + value, 0);
  assert.ok(difficulty >= teamPower * 0.89 && difficulty <= teamPower * 1.11, "boss difficulty should track team power");
  assert.equal(topic.skill?.effectType, "energyDamage");
}
assert.equal(level.topics[0].skill.damageMultiplier, BOSS_ATTACK_DAMAGE_MULTIPLIER);
assert.ok(BOSS_ATTACK_DAMAGE_MULTIPLIER < 1, "boss attack must be tuned down");
assert.equal(level.objective.type, "all", "the boss can never be completed");
assert.equal(level.focusMax, 1000);
assert.equal(level.topics[0].skill.targetRule, "random", "the boss must strike a random living student");

const again = createBossLevel({ seed: "same", targetPower: teamPower });
assert.deepEqual(level, again, "boss content should be deterministic for a seed");
const different = createBossLevel({ seed: "different", targetPower: teamPower });
assert.notDeepEqual(level, different, "different seeds should vary the boss question");

assert.throws(() => createBossLevel({ seed: null, targetPower: teamPower }), /seed/);
assert.throws(() => createBossLevel({ seed: "bad", targetPower: -1 }), /power/);

const frozen = structuredClone(baseSnapshot);
withBossLevel(frozen, level, "boss:challenge-1");
assert.deepEqual(frozen, baseSnapshot, "withBossLevel must not mutate the input snapshot");
const applied = withBossLevel(baseSnapshot, level, "boss:challenge-1");
assert.equal(applied.level.id, "boss-rush");
assert.equal(applied.seed, "boss:challenge-1");
assert.deepEqual(applied.skillGroups, SKILL_GROUPS);

const firstRun = runBoss({ snapshot: applied, seed: "boss:challenge-1" });
const secondRun = runBoss({ snapshot: applied, seed: "boss:challenge-1" });
assert.deepEqual(firstRun, secondRun, "boss settlement must be deterministic");
assert.ok(firstRun.damage > 0, "a live team must deal damage to the boss");
const progressSum = Object.values(firstRun.state.problems).reduce((sum, problem) => sum + problem.progress, 0);
assert.equal(firstRun.damage, progressSum, "damage must equal accumulated boss progress");
assert.ok(firstRun.round <= BOSS_MAX_ROUNDS);
assert.ok(firstRun.eventsHash && firstRun.eventsHash.length === 64);
const bossId = level.topicIds[0];
const attackTargets = firstRun.events
  .filter((entry) => entry.type === "action" && entry.actor === bossId)
  .map((entry) => entry.targets[0]);
assert.ok(attackTargets.length > 0, "the boss must attack every round");
assert.ok(new Set(attackTargets).size >= 2, "boss attacks should spread across random students");

const soloProfile = createProfile({ accountId: "boss-wipe", studentIds: ["planner"] });
const soloSnapshot = createBattleSnapshot(soloProfile, {
  levelId: "chapter-1-1",
  teamIds: ["planner"],
  formation: { A1: "planner", A2: null, A3: null },
  seed: "boss:wipe",
  timestamp: "2026-08-22T00:00:00.000Z",
});
const wipedTeam = withBossLevel({ ...soloSnapshot, team: soloSnapshot.team.map((student) => ({ ...student, maxEnergy: 900 })) }, level, "boss:wipe");
const wipedRun = runBoss({ snapshot: wipedTeam, seed: "boss:wipe" });
assert.equal(wipedRun.result, "lose");
assert.ok(wipedRun.round < BOSS_MAX_ROUNDS, "a fragile team should fall before the round limit");
assert.ok(wipedRun.damage > 0, "damage dealt before wiping must still count");

console.log("boss combat tests passed");
