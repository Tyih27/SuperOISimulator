import { DEFAULT_FORMATION, LEVELS, SKILL_GROUPS, STUDENTS, TOPICS } from '../data.js';
import { clamp, calculateSkillProgress, calculateSupportEffect, calculateTopicSkillDamage } from './math.js';
import { event } from './events.js';
import { createRng } from '../rng.js';

const POSITIONS = ['A1', 'A2', 'A3'];
const STAGE_ORDER = ['A1', 'B1', 'A2', 'B2', 'A3', 'B3'];
const POSITION_ORDER = Object.fromEntries([...POSITIONS, 'B1', 'B2', 'B3'].map((id, index) => [id, index]));
const clone = (value) => JSON.parse(JSON.stringify(value));

function sortedByPosition(items) {
  return [...items].sort((a, b) => (POSITION_ORDER[a.position] ?? 99) - (POSITION_ORDER[b.position] ?? 99) || a.id.localeCompare(b.id));
}

export class CombatEngine {
  constructor(options = {}) {
    const level = clone(options.level ?? LEVELS[0]);
    this.seed = options.seed ?? level.seed;
    this.rng = createRng(this.seed);
    this.maxRounds = options.maxRounds ?? level.maxRounds;
    this.goal = clone(options.goal ?? { type: level.objective.type, target: level.objective.requiredTopics });
    this.studentData = clone(options.students ?? STUDENTS);
    this.skillGroups = clone(options.skillGroups ?? SKILL_GROUPS);
    this.focusMax = options.focusMax ?? level.focusMax ?? 1000;
    this.problemData = clone(options.topics ?? options.problems ?? TOPICS);
    this.studentById = Object.fromEntries(this.studentData.map((student) => [student.id, student]));
    this.problemById = Object.fromEntries(this.problemData.map((problem) => [problem.id, problem]));
    this.teamIds = [...(options.teamIds ?? this.studentData.slice(0, 3).map((student) => student.id))];
    if (this.teamIds.length !== 3 || new Set(this.teamIds).size !== 3 || this.teamIds.some((id) => !this.studentById[id])) {
      throw new Error('A team must contain exactly three known students');
    }
    const defaultFormation = this.teamIds.every((id) => Object.values(DEFAULT_FORMATION).includes(id))
      ? DEFAULT_FORMATION
      : { A1: this.teamIds[0], A2: this.teamIds[1], A3: this.teamIds[2] };
    const configuredPositions = options.positions ?? defaultFormation;
    this.positions = Object.fromEntries(POSITIONS.map((position) => [position, configuredPositions[position] ?? null]));
    if (new Set(Object.values(this.positions).filter(Boolean)).size !== 3) throw new Error('A1, A2 and A3 must contain different students');

    const initialIds = options.initialActiveTopicIds ?? options.initialActiveProblemIds ?? level.topicIds.slice(0, 3);
    this.activeProblems = { B1: initialIds[0] ?? null, B2: initialIds[1] ?? null, B3: initialIds[2] ?? null };
    if (Object.values(this.activeProblems).some((id) => id && !this.problemById[id])) throw new Error('Active problem ids must refer to known problems');
    const activeSet = new Set(Object.values(this.activeProblems).filter(Boolean));
    this.queue = this.problemData.map((problem) => problem.id).filter((id) => !activeSet.has(id));
    this.students = Object.fromEntries(this.teamIds.map((id) => {
      const data = this.studentById[id];
      return [id, { id, energy: data.maxEnergy, focus: 0, alive: true, abilityBonuses: [], position: Object.keys(this.positions).find((key) => this.positions[key] === id) }];
    }));
    this.problems = Object.fromEntries(this.problemData.map((problem) => [problem.id, {
      ...clone(problem),
      difficulties: clone(problem.difficulties ?? problem.difficulty ?? {}),
      maxProgress: problem.maxProgress ?? 10000,
      progress: clamp(problem.progress ?? 0, 0, problem.maxProgress ?? 10000),
      passed: (problem.progress ?? 0) >= (problem.maxProgress ?? 10000),
    }]));
    this.round = 0;
    this.stageIndex = -1;
    this.status = 'ready';
    this.events = [];
  }

  start() {
    if (this.status === 'ready') this.status = 'battle';
    return this;
  }

  step() {
    if (this.status === 'ready') this.start();
    if (this.status === 'ended') return null;
    if (this.stageIndex === -1) this.beginRound();
    this.stageIndex += 1;
    this.processStage(STAGE_ORDER[this.stageIndex]);
    if (this.status === 'ended') return this.events[this.events.length - 1];
    if (this.stageIndex === STAGE_ORDER.length - 1) {
      this.endRound();
      if (this.status !== 'ended') this.stageIndex = -1;
    }
    return this.events[this.events.length - 1];
  }

  run(maxSteps = this.maxRounds * STAGE_ORDER.length + 2) {
    let steps = 0;
    while (this.status !== 'ended' && steps < maxSteps) {
      this.step();
      steps += 1;
    }
    if (this.status !== 'ended') throw new Error('Combat did not reach a terminal state within the step budget');
    return this.getResult();
  }

  beginRound() {
    this.round += 1;
    for (const student of Object.values(this.students)) {
      student.abilityBonuses = student.abilityBonuses.filter((bonus) => bonus.expiresRound >= this.round);
    }
    for (const slot of ['B1', 'B2', 'B3']) {
      const currentId = this.activeProblems[slot];
      if (currentId && this.problems[currentId].passed) this.activeProblems[slot] = null;
      if (!this.activeProblems[slot] && this.queue.length > 0) this.activeProblems[slot] = this.queue.shift();
    }
    this.push(event('round_start', {
      round: this.round,
      seed: this.seed,
      activeProblems: { ...this.activeProblems },
      queue: [...this.queue],
    }));
  }

  processStage(stage) {
    const snapshot = this.snapshot();
    const side = stage[0];
    const position = side === 'A' ? stage : `A${stage[1]}`;
    const actorId = side === 'A' ? this.positions[position] : this.activeProblems[stage];
    this.push(event('stage_start', {
      round: this.round,
      stage,
      actor: actorId,
      position,
      snapshot: {
        studentEnergy: Object.fromEntries(this.teamIds.map((id) => [id, snapshot.students[id].energy])),
        problemProgress: Object.fromEntries(Object.keys(snapshot.problems).map((id) => [id, snapshot.problems[id].progress])),
      },
    }));

    if (side === 'A') {
      const student = snapshot.students[actorId];
      if (!student || !student.alive || student.energy <= 0) {
        this.push(event('skip', { round: this.round, stage, actor: actorId, reason: !student ? 'empty-position' : 'energy-zero' }));
        return;
      }
      const data = this.studentById[actorId];
      const burst = student.focus >= this.focusMax;
      const skill = this.studentSkill(data, burst ? 'burst' : 'normal');
      const targets = this.selectProblemTargets(skill.targetRule, actorId, position, snapshot);
      const intent = { actorId, skill, burst, problemDeltas: {}, energyDeltas: {}, focusDelta: burst ? -student.focus : (skill.focusGain ?? 0), focusReset: burst, buffs: [], targets };
      let targetIds = targets.map((target) => target.id);
      if (skill.category === 'problem') {
        for (const target of targets) {
          const targetMultiplier = targets.length > 1 ? 1 : 1;
          intent.problemDeltas[target.id] = (intent.problemDeltas[target.id] ?? 0) + calculateSkillProgress({
            student: this.effectiveStudent(snapshot, actorId),
            topic: target,
            skill,
            remainingProgress: target.maxProgress - target.progress,
          }) * targetMultiplier;
        }
      } else {
        const amount = calculateSupportEffect(this.effectiveStudent(snapshot, actorId), skill);
        const supportTargets = this.selectStudentTargets(skill.targetRule, position, snapshot);
        targetIds = supportTargets.map((target) => target.id);
        for (const target of supportTargets) {
          if (skill.effectType === 'energyRestore') {
            intent.energyDeltas[target.id] = (intent.energyDeltas[target.id] ?? 0) + amount;
          } else if (skill.effectType === 'focusGain') {
            intent.focusDeltas = { ...(intent.focusDeltas ?? {}), [target.id]: amount };
          } else {
            throw new Error(`Unsupported support skill effect type: ${skill.effectType}`);
          }
        }
      }
      this.push(event('action', {
        round: this.round,
        stage,
        actor: actorId,
        skill: skill.id,
        skillName: skill.name,
        category: skill.category,
        burst,
        targets: targetIds,
      }));
      this.applyIntent(intent, stage);
      return;
    }

    const problem = snapshot.problems[actorId];
    if (!problem || problem.passed) {
      this.push(event('skip', { round: this.round, stage, actor: actorId, reason: 'problem-completed-or-empty' }));
      return;
    }
    // Custom fixtures predating topic skills retain the original plain attack.
    const skill = problem.skill ?? { id: 'problem-attack', name: '题目攻击', category: 'problem', effectType: 'energyDamage', targetRule: 'matching-position' };
    if (skill.effectType !== 'energyDamage') throw new Error(`Unsupported topic skill effect type: ${skill.effectType}`);
    const targets = this.selectStudentTargets(skill.targetRule, position, snapshot);
    const target = targets[0];
    if (!target) {
      this.push(event('skip', { round: this.round, stage, actor: actorId, reason: 'no-living-student' }));
      return;
    }
    const damage = calculateTopicSkillDamage(this.effectiveStudent(snapshot, target.id), problem, skill);
    this.push(event('action', { round: this.round, stage, actor: actorId, skill: skill.id, skillName: skill.name, category: skill.category, burst: false, targets: [target.id], damage }));
    this.applyIntent({ actorId, problemDeltas: {}, energyDeltas: { [target.id]: -damage }, focusDelta: 0, focusReset: false, buffs: [] }, stage);
  }

  applyIntent(intent, stage) {
    const effects = [];
    for (const [problemId, delta] of Object.entries(intent.problemDeltas ?? {})) {
      const problem = this.problems[problemId];
      if (!problem || problem.passed) continue;
      const before = problem.progress;
      problem.progress = clamp(problem.progress + delta, 0, problem.maxProgress);
      effects.push({ kind: 'problem-progress', target: problemId, before, after: problem.progress, delta: problem.progress - before });
      if (problem.progress >= problem.maxProgress) {
        problem.passed = true;
        this.push(event('problem_completed', { round: this.round, stage, problem: problemId, completedCount: this.completedCount() }));
      }
    }
    for (const [studentId, delta] of Object.entries(intent.energyDeltas ?? {})) {
      const student = this.students[studentId];
      if (!student) continue;
      const before = student.energy;
      student.energy = clamp(student.energy + delta, 0, this.studentById[studentId].maxEnergy);
      effects.push({ kind: 'energy', target: studentId, before, after: student.energy, delta: student.energy - before });
      if (student.energy === 0 && student.alive) {
        student.alive = false;
        this.push(event('student_exit', { round: this.round, stage, student: studentId }));
      }
    }
    if (intent.actorId && this.students[intent.actorId] && (intent.focusDelta || intent.focusReset)) {
      const student = this.students[intent.actorId];
      const before = student.focus;
      student.focus = intent.focusReset ? 0 : clamp(student.focus + intent.focusDelta, 0, this.focusMax);
      effects.push({ kind: 'focus', target: intent.actorId, before, after: student.focus, delta: student.focus - before });
    }
    for (const [studentId, delta] of Object.entries(intent.focusDeltas ?? {})) {
      const student = this.students[studentId];
      if (!student) continue;
      const before = student.focus;
      student.focus = clamp(student.focus + delta, 0, this.focusMax);
      effects.push({ kind: 'focus', target: studentId, before, after: student.focus, delta: student.focus - before });
    }
    for (const buff of intent.buffs ?? []) {
      const student = this.students[buff.studentId];
      if (!student || !buff.ability) continue;
      student.abilityBonuses = student.abilityBonuses.filter((item) => item.ability !== buff.ability);
      student.abilityBonuses.push({ ability: buff.ability, amount: buff.amount, expiresRound: buff.expiresRound });
      effects.push({ kind: 'ability-buff', target: buff.studentId, ability: buff.ability, amount: buff.amount, expiresRound: buff.expiresRound });
    }
    if (effects.length > 0) this.push(event('effect', { round: this.round, stage, effects }));
    this.checkTerminal(stage);
  }

  endRound() {
    this.push(event('round_end', { round: this.round, completedCount: this.completedCount(), remainingEnergy: this.remainingEnergy() }));
    this.checkTerminal('round-end');
    if (this.status !== 'ended' && this.round >= this.maxRounds) this.finish('lose', 'round-limit');
  }

  studentSkill(studentData, focus) {
    const groupId = studentData.skillGroupId;
    if (groupId) {
      const group = this.skillGroups[groupId];
      if (!group) throw new Error(`Unknown skill group: ${groupId}`);
      const skill = group.skills?.[focus];
      if (!skill) throw new Error(`Skill group ${groupId} is missing its ${focus} skill`);
      return skill;
    }

    // Existing external fixtures may still provide inline skills. Content data
    // and all new students must use a skill-group reference.
    const skill = studentData.skills?.[focus];
    if (!skill) throw new Error(`Student ${studentData.id} has no ${focus} skill group or legacy skill`);
    return skill;
  }

  checkTerminal(stage) {
    const completed = this.completedCount();
    const goalMet = this.goal.type === 'all' ? completed === this.problemData.length : completed >= (this.goal.target ?? 0);
    if (goalMet) return this.finish('win', 'goal-met', stage);
    if (this.teamIds.every((id) => !this.students[id].alive)) return this.finish('lose', 'all-students-exited', stage);
  }

  finish(result, reason, stage = null) {
    if (this.status === 'ended') return;
    this.status = 'ended';
    this.push(event('battle_end', {
      round: this.round,
      stage,
      result,
      reason,
      completedCount: this.completedCount(),
      remainingEnergy: this.remainingEnergy(),
    }));
  }

  selectProblemTargets(rule, actorId, position, snapshot) {
    const active = sortedByPosition(Object.entries(snapshot.problems)
      .map(([id, problem]) => ({ ...problem, id, position: Object.keys(snapshot.activeProblems).find((slot) => snapshot.activeProblems[slot] === id) }))
      .filter((problem) => problem.position && !problem.passed));
    if (rule === 'all-problems' || rule === 'allProblems') return active;
    if (rule === 'random') return [this.rng.pick(active)].filter(Boolean);
    if (rule === 'two-best-match' || rule === 'twoBestMatch') return active.sort((a, b) => this.matchScore(actorId, b) - this.matchScore(actorId, a) || POSITION_ORDER[a.position] - POSITION_ORDER[b.position] || a.id.localeCompare(b.id)).slice(0, 2);
    if (rule === 'highest-difficulty' || rule === 'highestDifficulty') return active.sort((a, b) => this.totalDifficulty(b) - this.totalDifficulty(a) || POSITION_ORDER[a.position] - POSITION_ORDER[b.position] || a.id.localeCompare(b.id)).slice(0, 1);
    if (rule === 'best-match' || rule === 'bestMatch') return active.sort((a, b) => this.matchScore(actorId, b) - this.matchScore(actorId, a) || POSITION_ORDER[a.position] - POSITION_ORDER[b.position] || a.id.localeCompare(b.id)).slice(0, 1);
    if (rule === 'matching-position' || rule === 'alignedFirst') {
      const matching = active.find((problem) => problem.position === `B${position[1]}`);
      return matching ? [matching] : active.slice(0, 1);
    }
    if (rule === 'lowestRemaining') return active.sort((a, b) => (a.maxProgress - a.progress) - (b.maxProgress - b.progress) || POSITION_ORDER[a.position] - POSITION_ORDER[b.position] || a.id.localeCompare(b.id)).slice(0, 1);
    return active.sort((a, b) => a.progress - b.progress || POSITION_ORDER[a.position] - POSITION_ORDER[b.position] || a.id.localeCompare(b.id)).slice(0, 1);
  }

  selectStudentTargets(rule, problemPosition, snapshot) {
    const students = sortedByPosition(this.teamIds.map((id) => ({ ...snapshot.students[id], id })).filter((student) => student.alive && student.energy > 0));
    if (rule === 'all-students' || rule === 'allStudents') return students;
    if (rule === 'lowest-energy' || rule === 'lowestEnergy') return students.sort((a, b) => a.energy - b.energy || POSITION_ORDER[a.position] - POSITION_ORDER[b.position] || a.id.localeCompare(b.id)).slice(0, 1);
    if (rule === 'lowestFocus') return students.sort((a, b) => a.focus - b.focus || POSITION_ORDER[a.position] - POSITION_ORDER[b.position] || a.id.localeCompare(b.id)).slice(0, 1);
    const matching = students.find((student) => student.position === `A${problemPosition[1]}`);
    return matching ? [matching] : students.slice(0, 1);
  }

  matchScore(studentId, problem) {
    const student = this.effectiveStudent(this.snapshot(), studentId);
    const keys = Object.keys(problem.difficulties).filter((key) => problem.difficulties[key] > 0);
    return keys.reduce((sum, key) => sum + Math.min(student.abilities[key], problem.difficulties[key]), 0);
  }

  totalDifficulty(problem) {
    return Object.values(problem.difficulties).reduce((sum, value) => sum + value, 0);
  }

  effectiveStudent(snapshot, studentId) {
    const source = snapshot.students[studentId] ?? this.students[studentId];
    const data = clone(this.studentById[studentId]);
    data.abilities = { ...data.abilities };
    for (const bonus of source.abilityBonuses ?? []) data.abilities[bonus.ability] = (data.abilities[bonus.ability] ?? 0) + bonus.amount;
    return data;
  }

  snapshot() {
    return {
      students: clone(this.students),
      problems: clone(this.problems),
      activeProblems: { ...this.activeProblems },
      round: this.round,
    };
  }

  completedCount() {
    return Object.values(this.problems).filter((problem) => problem.passed).length;
  }

  remainingEnergy() {
    return this.teamIds.reduce((sum, id) => sum + this.students[id].energy, 0);
  }

  push(entry) {
    this.events.push(entry);
  }

  getResult() {
    const terminal = [...this.events].reverse().find((entry) => entry.type === 'battle_end');
    return {
      result: terminal?.result ?? null,
      reason: terminal?.reason ?? null,
      round: this.round,
      completedCount: this.completedCount(),
      remainingEnergy: this.remainingEnergy(),
      events: clone(this.events),
      state: {
        status: this.status,
        students: clone(this.students),
        problems: clone(this.problems),
        activeProblems: { ...this.activeProblems },
        queue: [...this.queue],
      },
    };
  }
}

export function createCombat(options = {}) {
  return new CombatEngine(options);
}
