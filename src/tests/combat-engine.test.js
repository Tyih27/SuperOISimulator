import assert from 'node:assert/strict';
import { createInitialBattleConfig, SKILL_GROUPS, STUDENTS, TOPICS } from '../data.js';
import { CombatEngine } from '../combat/engine.js';
import { serializeEvents } from '../combat/events.js';

function run(options = {}) {
  const engine = new CombatEngine({ ...options });
  return engine.run();
}

assert.ok(SKILL_GROUPS.planner);
assert.deepEqual(Object.keys(SKILL_GROUPS.planner.skills), ['normal', 'burst']);
assert.ok(STUDENTS.every(({ skillGroupId }) => SKILL_GROUPS[skillGroupId]));
assert.ok(TOPICS.every(({ skill }) => skill?.id && skill.effectType === 'energyDamage'));

const initialConfig = createInitialBattleConfig();
assert.deepEqual(initialConfig.skillGroups, SKILL_GROUPS);
assert.notEqual(initialConfig.skillGroups, SKILL_GROUPS, 'battle config must own its skill-group catalogue');
assert.equal(initialConfig.roster[0].skillGroupId, STUDENTS[0].skillGroupId);
assert.deepEqual(initialConfig.roster[0].skillGroupLevels, STUDENTS[0].skillGroupLevels);
assert.notEqual(initialConfig.roster[0].skillGroupLevels, STUDENTS[0].skillGroupLevels);
assert.deepEqual(initialConfig.topics[0].skill, TOPICS[0].skill);
assert.notEqual(initialConfig.topics[0].skill, TOPICS[0].skill, 'battle config must own topic skill data');

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

const groupedStudent = new CombatEngine({
  students: [{ ...STUDENTS[0], skillGroupId: 'structurer' }, ...STUDENTS.slice(1)],
  maxRounds: 1,
  goal: { type: 'count', target: 99 },
});
groupedStudent.step();
assert.equal(groupedStudent.events.find((entry) => entry.type === 'action').skill, 'structurer-normal');

const topicSkill = new CombatEngine({ maxRounds: 1, goal: { type: 'count', target: 99 } });
topicSkill.step();
topicSkill.step();
const topicAction = topicSkill.events.find((entry) => entry.type === 'action' && entry.actor === 'treeKnapsack');
assert.equal(topicAction.skill, 'treeKnapsack-attack');
assert.equal(topicAction.skillName, '递归压力');
assert.deepEqual(topicAction.targets, ['planner']);

const recoveryGroups = structuredClone(SKILL_GROUPS);
recoveryGroups.recoveryTest = structuredClone(SKILL_GROUPS.structurer);
recoveryGroups.recoveryTest.id = 'recoveryTest';
recoveryGroups.recoveryTest.skills.normal.id = 'neutral-repair';
const recovery = new CombatEngine({
  students: [{ ...STUDENTS[0], skillGroupId: 'recoveryTest' }, ...STUDENTS.slice(1)],
  skillGroups: recoveryGroups,
  maxRounds: 1,
  goal: { type: 'count', target: 99 },
});
recovery.students.planner.energy = 1;
recovery.step();
assert.ok(recovery.students.planner.energy > 1, 'energy recovery is selected by effect type, not skill id');

console.log(`combat-engine tests passed: ${first.events.length} deterministic events`);
