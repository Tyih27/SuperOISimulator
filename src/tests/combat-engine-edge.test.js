import assert from "node:assert/strict";
import { CombatEngine } from "../combat/engine.js";
import { serializeEvents } from "../combat/events.js";
import { createBattleSnapshot } from "../domain/snapshot.js";
import { createProfile } from "../domain/profile.js";
import { SKILL_GROUPS } from "../data.js";

// ── Helper ───────────────────────────────────────────────────────────────────

function makeEngine(options = {}) {
  return new CombatEngine({
    seed: 17,
    teamIds: ["planner", "graphist", "structurer"],
    positions: { A1: "planner", A2: "graphist", A3: "structurer" },
    maxRounds: 8,
    goal: { type: "count", target: 99 },
    ...options,
  });
}

// ── fromSnapshot static method ───────────────────────────────────────────────

const profile = createProfile({
  accountId: "edge-test",
  studentIds: ["planner", "graphist", "structurer"],
});
const snapshot = createBattleSnapshot(profile, {
  teamIds: ["planner", "graphist", "structurer"],
  formation: { A1: "planner", A2: "graphist", A3: "structurer" },
  timestamp: "2026-08-21T00:00:00.000Z",
  seed: "from-snapshot-test",
});
const fromSnap = CombatEngine.fromSnapshot(snapshot);
assert.equal(fromSnap.status, "ready");
const snapResult = fromSnap.run();
assert.ok(["win", "lose"].includes(snapResult.result));

// fromSnapshot rejects invalid snapshots
assert.throws(() => CombatEngine.fromSnapshot(null), /versioned battle snapshot/);
assert.throws(() => CombatEngine.fromSnapshot({ snapshotVersion: 2 }), /versioned battle snapshot/);
assert.throws(() => CombatEngine.fromSnapshot({ snapshotVersion: 3 }), /versioned battle snapshot/);

// ── selectProblemTargets ─────────────────────────────────────────────────────

const topicPool = [
  { id: "t1", name: "T1", difficulties: { dynamicProgramming: 500, graphTheory: 0, dataStructures: 0, mathematics: 0, implementation: 0 }, maxProgress: 10000, skill: { id: "t1-atk", name: "T1攻击", category: "problem", effectType: "energyDamage", targetRule: "matchingPosition", damageMultiplier: 1, flatBonus: 0, maxDamage: 2000 } },
  { id: "t2", name: "T2", difficulties: { dynamicProgramming: 0, graphTheory: 800, dataStructures: 0, mathematics: 0, implementation: 0 }, maxProgress: 10000, skill: { id: "t2-atk", name: "T2攻击", category: "problem", effectType: "energyDamage", targetRule: "matchingPosition", damageMultiplier: 1, flatBonus: 0, maxDamage: 2000 } },
  { id: "t3", name: "T3", difficulties: { dynamicProgramming: 0, graphTheory: 0, dataStructures: 300, mathematics: 0, implementation: 0 }, maxProgress: 10000, skill: { id: "t3-atk", name: "T3攻击", category: "problem", effectType: "energyDamage", targetRule: "matchingPosition", damageMultiplier: 1, flatBonus: 0, maxDamage: 2000 } },
  { id: "t4", name: "T4", difficulties: { dynamicProgramming: 200, graphTheory: 0, dataStructures: 0, mathematics: 0, implementation: 0 }, maxProgress: 10000, skill: { id: "t4-atk", name: "T4攻击", category: "problem", effectType: "energyDamage", targetRule: "matchingPosition", damageMultiplier: 1, flatBonus: 0, maxDamage: 2000 } },
];

const allProblemsEngine = makeEngine({
  problems: topicPool,
  initialActiveProblemIds: ["t1", "t2", "t3"],
});
const snap = allProblemsEngine.snapshot();
const allTargets = allProblemsEngine.selectProblemTargets("allProblems", "planner", "A1", snap);
assert.equal(allTargets.length, 3, "allProblems should return all active non-passed problems");

const lowestTargets = allProblemsEngine.selectProblemTargets("lowestRemaining", "planner", "A1", snap);
assert.equal(lowestTargets.length, 1);
assert.equal(lowestTargets[0].id, "t1");

const highestTargets = allProblemsEngine.selectProblemTargets("highestDifficulty", "planner", "A1", snap);
assert.equal(highestTargets.length, 1);

const bestMatchTargets = allProblemsEngine.selectProblemTargets("bestMatch", "planner", "A1", snap);
assert.equal(bestMatchTargets.length, 1);

const alignedTargets = allProblemsEngine.selectProblemTargets("alignedFirst", "planner", "A1", snap);
assert.equal(alignedTargets.length, 1);
assert.equal(alignedTargets[0].position, "B1", "alignedFirst should prefer the problem in the same column");

const twoBestTargets = allProblemsEngine.selectProblemTargets("twoBestMatch", "planner", "A1", snap);
assert.ok(twoBestTargets.length <= 2, "twoBestMatch should return at most 2");

const randomTargets = allProblemsEngine.selectProblemTargets("random", "planner", "A1", snap);
assert.ok(randomTargets.length >= 1, "random should return at least 1");

// ── selectStudentTargets ─────────────────────────────────────────────────────

const allStudentTargets = allProblemsEngine.selectStudentTargets("allStudents", "B1", snap);
assert.equal(allStudentTargets.length, 3, "allStudents should return all alive students");

const lowestEnergyTargets = allProblemsEngine.selectStudentTargets("lowestEnergy", "B1", snap);
assert.equal(lowestEnergyTargets.length, 1);

const lowestFocusTargets = allProblemsEngine.selectStudentTargets("lowestFocus", "B1", snap);
assert.equal(lowestFocusTargets.length, 1);

const matchingStudentTargets = allProblemsEngine.selectStudentTargets("matchingPosition", "B1", snap);
assert.equal(matchingStudentTargets.length, 1);
assert.equal(matchingStudentTargets[0].position, "A1");

// ── matchScore ───────────────────────────────────────────────────────────────

const score = allProblemsEngine.matchScore("planner", snap.problems.t1);
assert.ok(typeof score === "number", "matchScore must return a number");
assert.ok(score >= 0, "matchScore must be non-negative");

// ── totalDifficulty ──────────────────────────────────────────────────────────

const totalDiff = allProblemsEngine.totalDifficulty(snap.problems.t1);
assert.equal(totalDiff, 500, "totalDifficulty sums all difficulty values");

const totalDiffAll = allProblemsEngine.totalDifficulty(snap.problems.t2);
assert.equal(totalDiffAll, 800);

// ── step returns null on ended ───────────────────────────────────────────────

const endedEngine = makeEngine({ maxRounds: 1, goal: { type: "count", target: 99 } });
endedEngine.run();
assert.equal(endedEngine.status, "ended");
assert.equal(endedEngine.step(), null, "step after ended must return null");

// ── All students exit simultaneously ─────────────────────────────────────────

const massExit = makeEngine({
  maxRounds: 1,
  goal: { type: "count", target: 99 },
  problems: [{ id: "impossible", name: "Impossible", difficulties: { dynamicProgramming: 100000 }, maxProgress: 100000, skill: { id: "imp-atk", name: "超强攻击", category: "problem", effectType: "energyDamage", targetRule: "matchingPosition", damageMultiplier: 10, flatBonus: 0, maxDamage: 2000 } }],
  initialActiveProblemIds: ["impossible"],
  students: [
    { id: "weak1", abilities: { dynamicProgramming: 1, graphTheory: 1, dataStructures: 1, mathematics: 1, implementation: 1 }, maxEnergy: 1, skillGroupId: "planner", skillGroupLevels: { planner: { normal: 1, burst: 1 } } },
    { id: "weak2", abilities: { dynamicProgramming: 1, graphTheory: 1, dataStructures: 1, mathematics: 1, implementation: 1 }, maxEnergy: 1, skillGroupId: "planner", skillGroupLevels: { planner: { normal: 1, burst: 1 } } },
    { id: "weak3", abilities: { dynamicProgramming: 1, graphTheory: 1, dataStructures: 1, mathematics: 1, implementation: 1 }, maxEnergy: 1, skillGroupId: "planner", skillGroupLevels: { planner: { normal: 1, burst: 1 } } },
  ],
  teamIds: ["weak1", "weak2", "weak3"],
  positions: { A1: "weak1", A2: "weak2", A3: "weak3" },
});
const massResult = massExit.run();
assert.equal(massResult.result, "lose");

// ── Queue exhaustion ─────────────────────────────────────────────────────────

const queueEngine = makeEngine({
  maxRounds: 3,
  goal: { type: "count", target: 99 },
  problems: [{ id: "solo", name: "Solo", difficulties: { dynamicProgramming: 1 }, maxProgress: 100000 }],
  initialActiveProblemIds: ["solo"],
});
queueEngine.run();
assert.ok(queueEngine.status === "ended");

// ── Constructor validation ───────────────────────────────────────────────────

assert.throws(
  () => new CombatEngine({ teamIds: ["planner", "planner", "graphist"], maxRounds: 1, goal: { type: "count", target: 99 } }),
  /three known students/,
);

assert.throws(
  () => new CombatEngine({ teamIds: ["planner", "graphist", "unknown"], maxRounds: 1, goal: { type: "count", target: 99 } }),
  /three known students/,
);

assert.throws(
  () => new CombatEngine({
    teamIds: ["planner", "graphist", "structurer"],
    positions: { A1: "planner", A2: "planner", A3: "structurer" },
    maxRounds: 1,
    goal: { type: "count", target: 99 },
  }),
  /different students/,
);

assert.throws(
  () => new CombatEngine({
    teamIds: ["planner", "graphist", "structurer"],
    initialActiveProblemIds: ["nonexistent"],
    maxRounds: 1,
    goal: { type: "count", target: 99 },
  }),
  /Active problem ids must refer to known problems/,
);

// ── studentSkill fallback to inline skills ───────────────────────────────────

const legacyEngine = new CombatEngine({
  students: [
    { id: "legacy", skills: { normal: { id: "legacy-normal", name: "Legacy", category: "problem", targetRule: "lowestRemaining", skillMultiplier: 1, targetMultiplier: 1, flatBonus: 0, focusGain: 200 }, burst: { id: "legacy-burst", name: "Legacy Burst", category: "problem", targetRule: "highestDifficulty", skillMultiplier: 1.5, targetMultiplier: 1, flatBonus: 0, focusGain: 200 } }, abilities: { dynamicProgramming: 800, graphTheory: 600, dataStructures: 500, mathematics: 400, implementation: 700 }, maxEnergy: 5000 },
    { id: "g2", abilities: { dynamicProgramming: 600, graphTheory: 700, dataStructures: 500, mathematics: 400, implementation: 600 }, maxEnergy: 5000, skillGroupId: "graphist", skillGroupLevels: { graphist: { normal: 1, burst: 1 } } },
    { id: "s2", abilities: { dynamicProgramming: 500, graphTheory: 500, dataStructures: 800, mathematics: 500, implementation: 600 }, maxEnergy: 5000, skillGroupId: "structurer", skillGroupLevels: { structurer: { normal: 1, burst: 1 } } },
  ],
  teamIds: ["legacy", "g2", "s2"],
  positions: { A1: "legacy", A2: "g2", A3: "s2" },
  maxRounds: 1,
  goal: { type: "count", target: 99 },
});
const legacyResult = legacyEngine.run();
assert.ok(["win", "lose"].includes(legacyResult.result), "legacy inline skills must run to terminal state");

// ── Completion priority over elimination ─────────────────────────────────────

const priorityEngine = makeEngine({
  maxRounds: 1,
  goal: { type: "count", target: 1 },
  problems: [{ id: "last", name: "Last", difficulties: { dynamicProgramming: 1 }, maxProgress: 100 }],
  initialActiveProblemIds: ["last"],
});
priorityEngine.students.graphist.energy = 0;
priorityEngine.students.graphist.alive = false;
priorityEngine.students.structurer.energy = 0;
priorityEngine.students.structurer.alive = false;
priorityEngine.problems.last.progress = 99;
priorityEngine.applyIntent(
  {
    actorId: "planner",
    problemDeltas: { last: 1 },
    energyDeltas: { planner: -priorityEngine.students.planner.energy },
    focusDelta: 0,
    focusReset: false,
    buffs: [],
  },
  "A1",
);
assert.equal(priorityEngine.getResult().result, "win", "goal completion must beat elimination in same atomic step");

// ── Identical config produces byte-identical logs ────────────────────────────

const first = makeEngine({ seed: "replay-verify" }).run();
const second = makeEngine({ seed: "replay-verify" }).run();
assert.equal(serializeEvents(first.events), serializeEvents(second.events));

const different = makeEngine({ seed: "other-seed" }).run();
assert.notEqual(serializeEvents(first.events), serializeEvents(different.events));

// ── All 20 three-person rosters run to terminal ──────────────────────────────

const allIds = ["planner", "graphist", "structurer", "mathematician", "implementer", "supporter"];
const combos = [];
for (let i = 0; i < allIds.length - 2; i += 1) {
  for (let j = i + 1; j < allIds.length - 1; j += 1) {
    for (let k = j + 1; k < allIds.length; k += 1) {
      combos.push([allIds[i], allIds[j], allIds[k]]);
    }
  }
}
assert.equal(combos.length, 20);
for (const teamIds of combos) {
  const result = new CombatEngine({
    seed: "sweep",
    teamIds,
    maxRounds: 3,
    goal: { type: "count", target: 99 },
  }).run();
  assert.ok(["win", "lose"].includes(result.result), `${teamIds} must reach terminal state`);
  const stages = result.events.filter((e) => e.type === "stage_start").slice(0, 6).map((e) => e.stage);
  assert.deepEqual(stages, ["A1", "B1", "A2", "B2", "A3", "B3"], `${teamIds} must follow stage order`);
}

console.log("combat-engine-edge tests passed");
