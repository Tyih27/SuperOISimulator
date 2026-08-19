import assert from "node:assert/strict";
import { CombatEngine } from "../combat/engine.js";
import { serializeEvents } from "../combat/events.js";
import {
  calculateBaselineProgress,
  calculateSkillProgress,
  calculateTopicSkillDamage,
  clamp,
  roundHalfUp,
} from "../combat/math.js";

const fixtureTopics = [
  { id: "one", name: "一道题", difficulties: { dynamicProgramming: 1 }, maxProgress: 100000 },
  { id: "two", name: "第二题", difficulties: { dynamicProgramming: 1 }, maxProgress: 100000 },
  { id: "three", name: "第三题", difficulties: { dynamicProgramming: 1 }, maxProgress: 100000 },
  { id: "queued", name: "候补题", difficulties: { dynamicProgramming: 1 }, maxProgress: 100000 },
];

function makeEngine(options = {}) {
  return new CombatEngine({
    seed: 17,
    teamIds: ["planner", "graphist", "structurer"],
    positions: { A1: "planner", A2: "graphist", A3: "structurer" },
    problems: fixtureTopics,
    initialActiveProblemIds: ["one", "two", "three"],
    maxRounds: 8,
    goal: { type: "count", target: 99 },
    ...options,
  });
}

// Formula behavior is integer-safe and always clamps to the declared bounds.
assert.equal(roundHalfUp(1.5), 2);
assert.equal(roundHalfUp(1.49), 1);
assert.equal(clamp(12, 0, 10), 10);
const student = makeEngine().studentById.planner;
const topic = makeEngine().problems.one;
assert.equal(calculateBaselineProgress(student, topic, { min: 100, max: 2000 }), 2000);
assert.equal(calculateSkillProgress({
  student,
  topic: { ...topic, progress: 99990 },
  skill: { skillMultiplier: 2, targetMultiplier: 1, flatBonus: 999 },
}), 10, "skill progress cannot exceed remaining progress");
assert.equal(calculateTopicSkillDamage(student, topic, { damageMultiplier: 1.5, flatBonus: 5 }), 755);

// Equal target scores use slot order, making target selection replay-safe.
const targeting = makeEngine();
const targetSnapshot = targeting.snapshot();
const lowest = targeting.selectProblemTargets("lowestRemaining", "planner", "A1", targetSnapshot);
assert.equal(lowest[0].id, "one");
const aligned = targeting.selectProblemTargets("alignedFirst", "planner", "A1", targetSnapshot);
assert.equal(aligned[0].id, "one", "aligned target should prefer B1");

// A completed active topic is replaced only at the next round boundary.
const replenishment = makeEngine({ maxRounds: 2 });
replenishment.problems.one.progress = replenishment.problems.one.maxProgress;
replenishment.problems.one.passed = true;
replenishment.beginRound();
assert.equal(replenishment.activeProblems.B1, "queued");
assert.equal(replenishment.queue.length, 0);

// Five normal actions fill focus; the following action is a burst and resets focus.
const burst = makeEngine({ maxRounds: 6 });
const burstResult = burst.run();
const plannerActions = burstResult.events.filter((entry) => entry.type === "action" && entry.actor === "planner");
assert.ok(plannerActions.some((entry) => entry.burst), "planner must eventually use burst skill");
const burstEffect = burstResult.events.find((entry) => entry.type === "effect" && entry.effects.some((effect) => effect.kind === "focus" && effect.target === "planner" && effect.before === 1000 && effect.after === 0));
assert.ok(burstEffect, "burst must clear focus after use");

// A two-round bonus is active through round 2 and removed at round 3 start.
const status = makeEngine();
status.applyIntent({ actorId: "planner", problemDeltas: {}, energyDeltas: {}, focusDelta: 0, focusReset: false, buffs: [{ studentId: "planner", ability: "dynamicProgramming", amount: 100, expiresRound: 2 }] }, "A1");
assert.equal(status.students.planner.abilityBonuses.length, 1);
status.beginRound();
assert.equal(status.students.planner.abilityBonuses.length, 1);
status.beginRound();
assert.equal(status.students.planner.abilityBonuses.length, 1);
status.beginRound();
assert.equal(status.students.planner.abilityBonuses.length, 0);

// Completion has priority over elimination when one atomic application triggers both.
const terminal = makeEngine({ goal: { type: "count", target: 1 } });
for (const id of ["graphist", "structurer"]) {
  terminal.students[id].alive = false;
  terminal.students[id].energy = 0;
}
terminal.applyIntent({
  actorId: "planner",
  problemDeltas: { one: 100000 },
  energyDeltas: { planner: -terminal.students.planner.energy },
  focusDelta: 0,
  focusReset: false,
  buffs: [],
}, "A1");
assert.equal(terminal.getResult().result, "win");
assert.equal(terminal.getResult().reason, "goal-met");

// Identical configuration and seed produce byte-for-byte identical event logs.
const first = makeEngine({ seed: "replay-seed" }).run();
const second = makeEngine({ seed: "replay-seed" }).run();
assert.equal(serializeEvents(first.events), serializeEvents(second.events));
const changed = makeEngine({ seed: "different-seed", positions: { A1: "graphist", A2: "planner", A3: "structurer" } }).run();
assert.notEqual(serializeEvents(first.events), serializeEvents(changed.events));

// The 20 possible three-person rosters all run to a terminal state with ordered logs.
const rosterIds = ["planner", "graphist", "structurer", "mathematician", "implementer", "supporter"];
const formations = [];
for (let firstIndex = 0; firstIndex < rosterIds.length - 2; firstIndex += 1) {
  for (let secondIndex = firstIndex + 1; secondIndex < rosterIds.length - 1; secondIndex += 1) {
    for (let thirdIndex = secondIndex + 1; thirdIndex < rosterIds.length; thirdIndex += 1) {
      formations.push([rosterIds[firstIndex], rosterIds[secondIndex], rosterIds[thirdIndex]]);
    }
  }
}
assert.equal(formations.length, 20);
for (const teamIds of formations) {
  const result = new CombatEngine({ seed: "formation-sweep", teamIds, maxRounds: 3, goal: { type: "count", target: 99 } }).run();
  assert.ok(["win", "lose"].includes(result.result));
  assert.deepEqual(result.events.filter((entry) => entry.type === "stage_start").slice(0, 6).map((entry) => entry.stage), ["A1", "B1", "A2", "B2", "A3", "B3"]);
}

console.log("task6 verification tests passed");
