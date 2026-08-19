import { STUDENTS } from '../data.js';
import { createCombat } from '../combat/engine.js';

export const PLAYBACK_PHASES = Object.freeze(['formation', 'ready', 'battle', 'result']);
export const PLAYBACK_SPEEDS = Object.freeze([0.5, 1, 2, 4]);

const DEFAULT_STEP_MS = 800;
const POSITIONS = ['A1', 'A2', 'A3'];
const clone = (value) => JSON.parse(JSON.stringify(value));

function defaultPositions(teamIds) {
  return Object.fromEntries(POSITIONS.map((position, index) => [position, teamIds[index] ?? null]));
}

function copyPositions(positions, teamIds) {
  const source = positions ?? defaultPositions(teamIds);
  return Object.fromEntries(POSITIONS.map((position) => [position, source[position] ?? null]));
}

function validateFormation(teamIds, positions, studentData = STUDENTS) {
  if (teamIds.length !== 3 || new Set(teamIds).size !== 3) {
    throw new Error('A team must contain exactly three different students');
  }
  const known = new Set(studentData.map((student) => student.id));
  if (teamIds.some((id) => !known.has(id))) throw new Error('Team contains an unknown student');
  const placed = POSITIONS.map((position) => positions[position]);
  if (placed.some((id) => !id) || new Set(placed).size !== 3 || placed.some((id) => !teamIds.includes(id))) {
    throw new Error('A1, A2 and A3 must contain the selected students');
  }
}

/** Owns playback only; CombatEngine remains the sole owner of combat state. */
export class PlaybackController {
  constructor(options = {}) {
    this.combatOptions = clone(options.combatOptions ?? {});
    const studentPool = this.combatOptions.students ?? STUDENTS;
    const initialTeam = [...(options.teamIds ?? studentPool.slice(0, 3).map((student) => student.id))];
    this.teamIds = initialTeam;
    this.positions = copyPositions(options.positions, initialTeam);
    this.stepMs = options.stepMs ?? DEFAULT_STEP_MS;
    if (!Number.isFinite(this.stepMs) || this.stepMs <= 0) throw new Error('stepMs must be positive');
    this.scheduler = options.scheduler ?? globalThis;
    if (!this.scheduler || typeof this.scheduler.setTimeout !== 'function' || typeof this.scheduler.clearTimeout !== 'function') {
      throw new Error('scheduler must provide setTimeout and clearTimeout');
    }
    this.engineFactory = options.engineFactory ?? createCombat;
    this.listeners = new Set();
    this.timer = null;
    this.engine = null;
    this.phase = 'formation';
    this.playing = false;
    this.speed = 1;
    this.stepCount = 0;
    this.eventCursor = 0;
    this.lastEvent = null;
    this.result = null;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new Error('listener must be a function');
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setFormation(options = {}) {
    if (this.phase !== 'formation') throw new Error('Formation can only change before preparation');
    const nextTeam = [...(options.teamIds ?? this.teamIds)];
    const positionSource = options.positions ?? (options.teamIds ? null : this.positions);
    const nextPositions = copyPositions(positionSource, nextTeam);
    validateFormation(nextTeam, nextPositions, this.combatOptions.students ?? STUDENTS);
    this.teamIds = nextTeam;
    this.positions = nextPositions;
    this.emit();
    return this.getState();
  }

  prepare() {
    if (this.phase === 'result') this.restart();
    if (this.phase !== 'formation') return this.getState();
    validateFormation(this.teamIds, this.positions, this.combatOptions.students ?? STUDENTS);
    this.engine = this.createEngine();
    this.phase = 'ready';
    this.playing = false;
    this.resetPlaybackCursor();
    this.emit();
    return this.getState();
  }

  start() {
    if (this.phase === 'formation') this.prepare();
    if (this.phase === 'result') return this.getState();
    if (this.phase !== 'battle') {
      this.engine.start();
      this.phase = 'battle';
    }
    this.playing = true;
    this.scheduleNext();
    this.emit();
    return this.getState();
  }

  pause() {
    if (this.phase !== 'battle') return this.getState();
    this.playing = false;
    this.cancelTimer();
    this.emit();
    return this.getState();
  }

  resume() {
    if (this.phase !== 'battle') return this.getState();
    this.playing = true;
    this.scheduleNext();
    this.emit();
    return this.getState();
  }

  setSpeed(speed) {
    const numericSpeed = Number(speed);
    if (!PLAYBACK_SPEEDS.includes(numericSpeed)) throw new Error(`Unsupported playback speed: ${speed}`);
    this.speed = numericSpeed;
    if (this.playing) this.scheduleNext();
    this.emit();
    return this.getState();
  }

  /** Advance one engine stage. It never schedules another stage by itself. */
  step() {
    return this.advanceOne(false);
  }

  advanceOne(keepPlaying) {
    if (this.phase === 'formation') this.prepare();
    if (this.phase === 'result') return null;
    if (this.phase === 'ready') {
      this.engine.start();
      this.phase = 'battle';
    }
    if (!keepPlaying) {
      this.playing = false;
      this.cancelTimer();
    }
    const before = this.engine.events.length;
    const event = this.engine.step();
    const appended = this.engine.events.slice(before);
    this.eventCursor = this.engine.events.length;
    this.lastEvent = event ?? appended.at(-1) ?? null;
    this.stepCount += 1;
    if (this.engine.status === 'ended') {
      this.phase = 'result';
      this.playing = false;
      this.result = this.engine.getResult();
    }
    this.emit();
    return this.lastEvent;
  }

  restart() {
    this.cancelTimer();
    this.engine = this.createEngine();
    this.phase = 'ready';
    this.playing = false;
    this.resetPlaybackCursor();
    this.emit();
    return this.getState();
  }

  getState() {
    return {
      phase: this.phase,
      playing: this.playing,
      speed: this.speed,
      stepCount: this.stepCount,
      eventCursor: this.eventCursor,
      lastEvent: clone(this.lastEvent),
      result: clone(this.result),
      teamIds: [...this.teamIds],
      positions: { ...this.positions },
      combat: this.engine?.getResult() ?? null,
    };
  }

  createEngine() {
    return this.engineFactory({ ...clone(this.combatOptions), teamIds: [...this.teamIds], positions: { ...this.positions } });
  }

  resetPlaybackCursor() {
    this.stepCount = 0;
    this.eventCursor = 0;
    this.lastEvent = null;
    this.result = null;
  }

  scheduleNext() {
    this.cancelTimer();
    if (!this.playing || this.phase !== 'battle') return;
    this.timer = this.scheduler.setTimeout(() => {
      this.timer = null;
      if (!this.playing || this.phase !== 'battle') return;
      this.advanceOne(true);
      if (this.playing && this.phase === 'battle') this.scheduleNext();
    }, this.stepMs / this.speed);
  }

  cancelTimer() {
    if (this.timer !== null) {
      this.scheduler.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  emit() {
    const snapshot = this.getState();
    for (const listener of this.listeners) listener(snapshot);
  }
}

export function createPlayback(options = {}) {
  return new PlaybackController(options);
}
