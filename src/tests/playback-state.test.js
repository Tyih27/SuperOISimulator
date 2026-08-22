import assert from 'node:assert/strict';
import { serializeEvents } from '../combat/events.js';
import { PlaybackController } from '../app/state.js';

class FakeScheduler {
  constructor() {
    this.nextId = 1;
    this.pending = new Map();
  }

  setTimeout(callback, delay) {
    const id = this.nextId++;
    this.pending.set(id, { callback, delay });
    return id;
  }

  clearTimeout(id) {
    this.pending.delete(id);
  }

  runNext() {
    const entry = this.pending.entries().next().value;
    if (!entry) return false;
    const [id, task] = entry;
    this.pending.delete(id);
    task.callback();
    return task.delay;
  }

  runAll(limit = 100) {
    let count = 0;
    while (this.pending.size > 0 && count < limit) {
      this.runNext();
      count += 1;
    }
    if (this.pending.size > 0) throw new Error('Scheduler did not become idle');
    return count;
  }
}

const scheduler = new FakeScheduler();
const playback = new PlaybackController({
  combatOptions: { seed: 91, maxRounds: 2, goal: { type: 'count', target: 99 } },
  scheduler,
  stepMs: 1000,
});

assert.equal(playback.getState().phase, 'formation');
playback.prepare();
assert.equal(playback.getState().phase, 'ready');
assert.ok(playback.step());
assert.equal(playback.getState().stepCount, 1);
assert.deepEqual(playback.getState().combat.events.filter((entry) => entry.type === 'stage_start').map((entry) => entry.stage), ['A1']);
const firstStepEvents = playback.getState().combat.events;

playback.start();
assert.equal(scheduler.pending.size, 1);
assert.equal(scheduler.pending.values().next().value.delay, 1000);
playback.setSpeed(2);
assert.equal(scheduler.pending.values().next().value.delay, 500);
const beforePause = playback.getState();
playback.pause();
assert.equal(scheduler.pending.size, 0);
assert.equal(playback.getState().eventCursor, beforePause.eventCursor);
assert.equal(playback.getState().stepCount, beforePause.stepCount);
playback.resume();
assert.equal(scheduler.pending.size, 1);
const cursorBeforeTimer = playback.getState().eventCursor;
scheduler.runNext();
assert.equal(playback.getState().stepCount, beforePause.stepCount + 1);
assert.ok(playback.getState().eventCursor > cursorBeforeTimer);
assert.equal(scheduler.pending.size, 1, 'automatic playback schedules the following stage');

playback.restart();
assert.equal(playback.getState().phase, 'ready');
assert.equal(playback.getState().eventCursor, 0);
playback.step();
assert.equal(serializeEvents(playback.getState().combat.events), serializeEvents(firstStepEvents));

const terminalScheduler = new FakeScheduler();
const terminalPlayback = new PlaybackController({
  combatOptions: { seed: 5, maxRounds: 1, goal: { type: 'count', target: 99 } },
  scheduler: terminalScheduler,
  stepMs: 10,
});
terminalPlayback.start();
assert.equal(terminalPlayback.getState().phase, 'battle');
assert.equal(terminalScheduler.runAll(), 6);
assert.equal(terminalPlayback.getState().phase, 'result');
assert.equal(terminalPlayback.getState().playing, false);
assert.equal(terminalPlayback.getState().result.reason, 'round-limit');
const terminalEvents = serializeEvents(terminalPlayback.getState().result.events);
terminalPlayback.restart();
terminalPlayback.start();
assert.equal(terminalScheduler.runAll(), 6);
assert.equal(serializeEvents(terminalPlayback.getState().result.events), terminalEvents, 'restart must preserve the initial configuration and seed');

const skipOptions = {
  combatOptions: { seed: 5, maxRounds: 1, goal: { type: 'count', target: 99 } },
  stepMs: 10,
};
const manualScheduler = new FakeScheduler();
const manualPlayback = new PlaybackController({ ...skipOptions, scheduler: manualScheduler });
manualPlayback.start();
manualScheduler.runAll();

const skipScheduler = new FakeScheduler();
const skipPlayback = new PlaybackController({ ...skipOptions, scheduler: skipScheduler });
skipPlayback.start();
let skipEmissions = 0;
skipPlayback.subscribe(() => { skipEmissions += 1; });
skipPlayback.skip();
const skippedState = skipPlayback.getState();
assert.equal(skippedState.phase, 'result');
assert.equal(skippedState.playing, false);
assert.equal(serializeEvents(skippedState.result.events), serializeEvents(manualPlayback.getState().result.events), 'skip must produce the identical deterministic result as full playback');
assert.equal(skippedState.eventCursor, skippedState.combat.events.length);
assert.equal(skippedState.stepCount, manualPlayback.getState().stepCount);
assert.equal(skipScheduler.pending.size, 0, 'skip must cancel pending timers');
assert.equal(skipEmissions, 1, 'skip must emit exactly once');
skipScheduler.runNext();
assert.equal(skipEmissions, 1, 'no further ticks may fire after skip');

const skippedAgainStateBefore = JSON.stringify(skipPlayback.getState());
let skippedAgainEmissions = 0;
skipPlayback.subscribe(() => { skippedAgainEmissions += 1; });
skipPlayback.skip();
assert.equal(JSON.stringify(skipPlayback.getState()), skippedAgainStateBefore, 'skip must be a no-op once the battle has ended');
assert.equal(skippedAgainEmissions, 0);

const formationScheduler = new FakeScheduler();
const formationSkipPlayback = new PlaybackController({ ...skipOptions, scheduler: formationScheduler });
formationSkipPlayback.skip();
assert.equal(formationSkipPlayback.getState().phase, 'result');
assert.ok(formationSkipPlayback.getState().result);

console.log('playback-state tests passed');
