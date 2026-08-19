import assert from 'node:assert/strict';
import { CombatEngine } from '../combat/engine.js';
import { serializeEvents } from '../combat/events.js';

function run(options = {}) {
  const engine = new CombatEngine({ ...options });
  return engine.run();
}

const first = run({ seed: 7 });
const second = run({ seed: 7 });
assert.equal(serializeEvents(first.events), serializeEvents(second.events), 'same configuration must produce the same event log');
assert.equal(first.events.filter((entry) => entry.type === 'stage_start')[0].stage, 'A1');
assert.deepEqual(first.events.filter((entry) => entry.type === 'stage_start').slice(0, 6).map((entry) => entry.stage), ['A1', 'B1', 'A2', 'B2', 'A3', 'B3']);
assert.ok(first.events.some((entry) => entry.type === 'round_start' && entry.round === 1));
assert.ok(first.events.some((entry) => entry.type === 'problem_completed') || first.reason === 'round-limit');

const replenishment = new CombatEngine({
  maxRounds: 2,
  goal: { type: 'count', target: 99 },
  problems: [
    { id: 'a', name: 'A', difficulties: { dynamicProgramming: 1 }, maxProgress: 100, progress: 0 },
    { id: 'b', name: 'B', difficulties: { dynamicProgramming: 1 }, maxProgress: 100, progress: 0 },
    { id: 'c', name: 'C', difficulties: { dynamicProgramming: 1 }, maxProgress: 100, progress: 0 },
    { id: 'd', name: 'D', difficulties: { dynamicProgramming: 1 }, maxProgress: 100, progress: 0 },
  ],
  initialActiveProblemIds: ['a', 'b', 'c'],
  teamIds: ['planner', 'graphist', 'structurer'],
});
replenishment.step();
assert.equal(replenishment.activeProblems.B1, 'a');
for (let i = 0; i < 5; i += 1) replenishment.step();
replenishment.step();
assert.equal(replenishment.round, 2);
assert.equal(replenishment.activeProblems.B1, 'd', 'a completed in round 1 is replaced only at round 2 start');

const zeroEnergy = new CombatEngine({
  teamIds: ['planner', 'graphist', 'structurer'],
  positions: { A1: 'planner', A2: 'graphist', A3: 'structurer' },
  problems: [{ id: 'hard', name: 'Hard', difficulties: { dynamicProgramming: 100000 }, maxProgress: 10000, progress: 0 }],
  initialActiveProblemIds: ['hard'],
  goal: { type: 'count', target: 99 },
  maxRounds: 1,
});
zeroEnergy.students.planner.energy = 0;
zeroEnergy.students.planner.alive = false;
zeroEnergy.step();
assert.ok(zeroEnergy.events.some((entry) => entry.type === 'skip' && entry.reason === 'energy-zero'));

console.log(`combat-engine tests passed: ${first.events.length} deterministic events`);
