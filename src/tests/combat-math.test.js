import assert from "node:assert/strict";
import {
  clamp,
  roundHalfUp,
  average,
  relevantAbilityKeys,
  calculateOverallPower,
  calculateAbilityGap,
  calculateBaselineProgress,
  topicRemainingProgress,
  calculateSkillProgress,
  calculateAverageAbilityShortfall,
  calculateEnergyDamage,
  calculateTopicSkillDamage,
  calculateSupportEffect,
} from "../combat/math.js";

// ── clamp ────────────────────────────────────────────────────────────────────

assert.equal(clamp(5, 0, 10), 5);
assert.equal(clamp(-1, 0, 10), 0);
assert.equal(clamp(15, 0, 10), 10);
assert.equal(clamp(0, 0, 10), 0);
assert.equal(clamp(10, 0, 10), 10);
assert.equal(clamp(3.7, 0, 10), 3.7);

assert.throws(() => clamp(NaN, 0, 10), /finite/);
assert.throws(() => clamp(Infinity, 0, 10), /finite/);
assert.throws(() => clamp(-Infinity, 0, 10), /finite/);
assert.throws(() => clamp(5, NaN, 10), /finite/);
assert.throws(() => clamp(5, 0, NaN), /finite/);
assert.throws(() => clamp(5, 10, 0), /min <= max/);

// ── roundHalfUp ──────────────────────────────────────────────────────────────

assert.equal(roundHalfUp(0), 0);
assert.equal(roundHalfUp(0.4), 0);
assert.equal(roundHalfUp(0.5), 1);
assert.equal(roundHalfUp(0.6), 1);
assert.equal(roundHalfUp(1.49), 1);
assert.equal(roundHalfUp(1.5), 2);
assert.equal(roundHalfUp(2.5), 3);
assert.equal(roundHalfUp(-0.5), 0);
assert.equal(roundHalfUp(-0.6), -1);
assert.equal(roundHalfUp(100), 100);

assert.throws(() => roundHalfUp(NaN), /finite/);
assert.throws(() => roundHalfUp(Infinity), /finite/);
assert.throws(() => roundHalfUp(-Infinity), /finite/);

// ── average ──────────────────────────────────────────────────────────────────

assert.equal(average([]), 0);
assert.equal(average([10]), 10);
assert.equal(average([10, 20]), 15);
assert.equal(average([10, 20, 30]), 20);
assert.equal(average([0, 0, 0]), 0);
assert.equal(average([100, 200, 300, 400, 500]), 300);

// ── relevantAbilityKeys ──────────────────────────────────────────────────────

const topicZero = { difficulties: { dynamicProgramming: 0, graphTheory: 0, dataStructures: 0, mathematics: 0, implementation: 0 } };
assert.deepEqual(relevantAbilityKeys(topicZero), []);

const topicAll = { difficulties: { dynamicProgramming: 800, graphTheory: 920, dataStructures: 300, mathematics: 0, implementation: 600 } };
assert.deepEqual(relevantAbilityKeys(topicAll), ["dynamicProgramming", "graphTheory", "dataStructures", "implementation"]);

const topicPartial = { difficulties: { dynamicProgramming: 0, graphTheory: 500, dataStructures: 0, mathematics: 800, implementation: 0 } };
assert.deepEqual(relevantAbilityKeys(topicPartial), ["graphTheory", "mathematics"]);

const topicMissing = { difficulties: {} };
assert.deepEqual(relevantAbilityKeys(topicMissing), []);

const topicNull = { difficulties: null };
assert.deepEqual(relevantAbilityKeys(topicNull), []);

const topicUndefined = {};
assert.deepEqual(relevantAbilityKeys(topicUndefined), []);

// ── calculateOverallPower ────────────────────────────────────────────────────

const studentFull = { abilities: { dynamicProgramming: 800, graphTheory: 600, dataStructures: 400, mathematics: 200, implementation: 1000 } };
assert.equal(calculateOverallPower(studentFull), 600);

const studentAllEqual = { abilities: { dynamicProgramming: 500, graphTheory: 500, dataStructures: 500, mathematics: 500, implementation: 500 } };
assert.equal(calculateOverallPower(studentAllEqual), 500);

const studentMissing = { abilities: { dynamicProgramming: 1000 } };
assert.equal(calculateOverallPower(studentMissing), 200);

const studentEmpty = { abilities: {} };
assert.equal(calculateOverallPower(studentEmpty), 0);

// ── calculateAbilityGap ──────────────────────────────────────────────────────

const studentBalanced = { abilities: { dynamicProgramming: 800, graphTheory: 800, dataStructures: 800, mathematics: 800, implementation: 800 } };
const topicTwoAbilities = { difficulties: { dynamicProgramming: 600, graphTheory: 400, dataStructures: 0, mathematics: 0, implementation: 0 } };
assert.equal(calculateAbilityGap(studentBalanced, topicTwoAbilities), 300);

const studentWeak = { abilities: { dynamicProgramming: 100, graphTheory: 100, dataStructures: 100, mathematics: 100, implementation: 100 } };
assert.equal(calculateAbilityGap(studentWeak, topicTwoAbilities), -400);

const studentExact = { abilities: { dynamicProgramming: 600, graphTheory: 400, dataStructures: 500, mathematics: 500, implementation: 500 } };
assert.equal(calculateAbilityGap(studentExact, topicTwoAbilities), 0);

const topicEmptyDiff = { difficulties: { dynamicProgramming: 0, graphTheory: 0, dataStructures: 0, mathematics: 0, implementation: 0 } };
assert.equal(calculateAbilityGap(studentBalanced, topicEmptyDiff), 0);

// ── calculateBaselineProgress ────────────────────────────────────────────────

assert.equal(calculateBaselineProgress(studentBalanced, topicTwoAbilities, { min: 0, max: 5000 }), 1600);
assert.equal(calculateBaselineProgress(studentWeak, topicTwoAbilities, { min: 0, max: 5000 }), 200);
assert.equal(calculateBaselineProgress(studentExact, topicTwoAbilities, { min: 0, max: 5000 }), 1000);

const topicHighDiff = { difficulties: { dynamicProgramming: 2000, graphTheory: 2000, dataStructures: 0, mathematics: 0, implementation: 0 } };
assert.equal(calculateBaselineProgress(studentBalanced, topicHighDiff, { min: 100, max: 2000 }), 100);
assert.equal(calculateBaselineProgress(studentBalanced, topicHighDiff, { min: 0, max: 2000 }), 0);

assert.equal(calculateBaselineProgress(studentBalanced, topicTwoAbilities), 1600);

// ── topicRemainingProgress ───────────────────────────────────────────────────

assert.equal(topicRemainingProgress({ maxProgress: 10000, progress: 0 }), 10000);
assert.equal(topicRemainingProgress({ maxProgress: 10000, progress: 5000 }), 5000);
assert.equal(topicRemainingProgress({ maxProgress: 10000, progress: 10000 }), 0);
assert.equal(topicRemainingProgress({ maxProgress: 10000, progress: 12000 }), 0);
assert.equal(topicRemainingProgress({ maxProgress: 0, progress: 0 }), 0);
assert.equal(topicRemainingProgress({ progress: 0 }), 0);
assert.equal(topicRemainingProgress({}), 0);
assert.equal(topicRemainingProgress({ maxProgress: 10000 }), 10000);
assert.equal(topicRemainingProgress({ maxProgress: 10000, progress: undefined }), 10000);

// ── calculateSkillProgress ───────────────────────────────────────────────────

const topicDefault = { maxProgress: 10000, progress: 0, difficulties: { dynamicProgramming: 600, graphTheory: 400, dataStructures: 0, mathematics: 0, implementation: 0 } };
const skillDefault = { skillMultiplier: 1, targetMultiplier: 1, flatBonus: 0 };
assert.equal(calculateSkillProgress({ student: studentBalanced, topic: topicDefault, skill: skillDefault }), 1600);

const skillHighMult = { skillMultiplier: 2, targetMultiplier: 1, flatBonus: 0 };
assert.equal(calculateSkillProgress({ student: studentBalanced, topic: topicDefault, skill: skillHighMult, remainingProgress: 10000 }), 3200);

const skillWithBonus = { skillMultiplier: 1, targetMultiplier: 1, flatBonus: 500 };
assert.equal(calculateSkillProgress({ student: studentBalanced, topic: topicDefault, skill: skillWithBonus, remainingProgress: 10000 }), 2100);

const topicAlmostDone = { maxProgress: 10000, progress: 9990, difficulties: { dynamicProgramming: 600, graphTheory: 400, dataStructures: 0, mathematics: 0, implementation: 0 } };
assert.equal(calculateSkillProgress({ student: studentBalanced, topic: topicAlmostDone, skill: skillDefault }), 10);

const topicDone = { maxProgress: 10000, progress: 10000, difficulties: { dynamicProgramming: 600, graphTheory: 400, dataStructures: 0, mathematics: 0, implementation: 0 } };
assert.equal(calculateSkillProgress({ student: studentBalanced, topic: topicDone, skill: skillDefault }), 0);

const skillMissing = {};
assert.equal(calculateSkillProgress({ student: studentBalanced, topic: topicDefault, skill: skillMissing }), 1600);

const skillCustomRemaining = { skillMultiplier: 1, targetMultiplier: 1, flatBonus: 0 };
assert.equal(calculateSkillProgress({ student: studentBalanced, topic: topicDefault, skill: skillCustomRemaining, remainingProgress: 500 }), 500);
assert.equal(calculateSkillProgress({ student: studentBalanced, topic: topicDefault, skill: skillCustomRemaining, remainingProgress: 0 }), 0);

// ── calculateAverageAbilityShortfall ─────────────────────────────────────────

assert.equal(calculateAverageAbilityShortfall(studentBalanced, topicTwoAbilities), 0);
assert.equal(calculateAverageAbilityShortfall(studentWeak, topicTwoAbilities), 400);

const topicHighReq = { difficulties: { dynamicProgramming: 1000, graphTheory: 1000, dataStructures: 0, mathematics: 0, implementation: 0 } };
assert.equal(calculateAverageAbilityShortfall(studentBalanced, topicHighReq), 200);
assert.equal(calculateAverageAbilityShortfall(studentWeak, topicHighReq), 900);

assert.equal(calculateAverageAbilityShortfall(studentBalanced, topicZero), 0);

// ── calculateEnergyDamage ────────────────────────────────────────────────────

assert.equal(calculateEnergyDamage(studentBalanced, topicTwoAbilities, { min: 0, max: 5000 }), 500);
assert.equal(calculateEnergyDamage(studentWeak, topicTwoAbilities, { min: 0, max: 5000 }), 1300);
assert.equal(calculateEnergyDamage(studentBalanced, topicZero, { min: 0, max: 5000 }), 500);

assert.equal(calculateEnergyDamage(studentWeak, topicTwoAbilities, { min: 100, max: 500 }), 500);
assert.equal(calculateEnergyDamage(studentBalanced, topicTwoAbilities, { min: 600, max: 1000 }), 600);

assert.equal(calculateEnergyDamage(studentBalanced, topicTwoAbilities), 500);

// ── calculateTopicSkillDamage ────────────────────────────────────────────────

assert.equal(calculateTopicSkillDamage(studentBalanced, topicTwoAbilities, {}), 500);
assert.equal(calculateTopicSkillDamage(studentBalanced, topicTwoAbilities, { damageMultiplier: 1.5, flatBonus: 0 }), 750);
assert.equal(calculateTopicSkillDamage(studentBalanced, topicTwoAbilities, { damageMultiplier: 1, flatBonus: 100 }), 600);
assert.equal(calculateTopicSkillDamage(studentBalanced, topicTwoAbilities, { damageMultiplier: 1, flatBonus: 0, maxDamage: 400 }), 400);
assert.equal(calculateTopicSkillDamage(studentWeak, topicTwoAbilities, {}), 1300);
assert.equal(calculateTopicSkillDamage(studentWeak, topicTwoAbilities, { damageMultiplier: 2, flatBonus: 200, maxDamage: 2000 }), 2000);

const skillNoArgs = undefined;
assert.equal(calculateTopicSkillDamage(studentBalanced, topicTwoAbilities, skillNoArgs), 500);

// ── calculateSupportEffect ───────────────────────────────────────────────────

assert.equal(calculateSupportEffect({ amount: 200 }), 200);
assert.equal(calculateSupportEffect({ amount: 99.5 }), 100);
assert.equal(calculateSupportEffect({ amount: 99.4 }), 99);
assert.equal(calculateSupportEffect({}), 0);
assert.equal(calculateSupportEffect(undefined), 0);

console.log("combat-math tests passed");
