import assert from "node:assert/strict";
import { serializeEvents } from "../combat/events.js";
import { PlaybackController } from "../app/state.js";

// ── Fake scheduler ───────────────────────────────────────────────────────────

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
    return count;
  }
}

// ── Invalid constructor options ───────────────────────────────────────────────

assert.throws(
  () => new PlaybackController({ stepMs: -1 }),
  /stepMs must be positive/,
);
assert.throws(
  () => new PlaybackController({ stepMs: 0 }),
  /stepMs must be positive/,
);
assert.throws(
  () => new PlaybackController({ stepMs: "fast" }),
  /stepMs must be positive/,
);

// ── Invalid speed ────────────────────────────────────────────────────────────

const scheduler = new FakeScheduler();
const playback = new PlaybackController({
  combatOptions: { seed: 1, maxRounds: 1, goal: { type: "count", target: 99 } },
  scheduler,
  stepMs: 100,
});

assert.throws(() => playback.setSpeed(3), /Unsupported playback speed/);
assert.throws(() => playback.setSpeed(0), /Unsupported playback speed/);
assert.throws(() => playback.setSpeed(-1), /Unsupported playback speed/);
assert.throws(() => playback.setSpeed("fast"), /Unsupported playback speed/);

// ── setFormation in wrong phase ──────────────────────────────────────────────

playback.prepare();
assert.throws(() => playback.setFormation(), /Formation can only change before preparation/);
playback.restart();

// ── subscribe returns unsubscribe ────────────────────────────────────────────

let callCount = 0;
const unsub = playback.subscribe(() => { callCount += 1; });
playback.step();
assert.ok(callCount > 0, "listener should be called");
const countBeforeUnsub = callCount;
unsub();
playback.step();
assert.equal(callCount, countBeforeUnsub, "unsubscribed listener should not be called");

// ── Invalid listener ─────────────────────────────────────────────────────────

assert.throws(() => playback.subscribe("not a function"), /listener must be a function/);

// ── Operations in wrong phases ───────────────────────────────────────────────

const earlyScheduler = new FakeScheduler();
const early = new PlaybackController({
  combatOptions: { seed: 2, maxRounds: 1, goal: { type: "count", target: 99 } },
  scheduler: earlyScheduler,
});

assert.equal(early.getState().phase, "formation");
assert.equal(early.pause().phase, "formation", "pause in formation is no-op");
assert.equal(early.resume().phase, "formation", "resume in formation is no-op");

early.prepare();
assert.equal(early.getState().phase, "ready");
assert.equal(early.pause().phase, "ready", "pause in ready is no-op");
assert.equal(early.resume().phase, "ready", "resume in ready is no-op");

// ── restart during battle ────────────────────────────────────────────────────

const restartScheduler = new FakeScheduler();
const restartPlayback = new PlaybackController({
  combatOptions: { seed: 3, maxRounds: 1, goal: { type: "count", target: 99 } },
  scheduler: restartScheduler,
  stepMs: 10,
});
restartPlayback.start();
assert.equal(restartPlayback.getState().phase, "battle");
restartScheduler.runAll();
assert.equal(restartPlayback.getState().phase, "result");
const eventsBefore = serializeEvents(restartPlayback.getState().combat.events);
restartPlayback.restart();
assert.equal(restartPlayback.getState().phase, "ready");
assert.equal(restartPlayback.getState().stepCount, 0);
assert.equal(restartPlayback.getState().eventCursor, 0);
restartPlayback.start();
restartScheduler.runAll();
const eventsAfter = serializeEvents(restartPlayback.getState().combat.events);
assert.equal(eventsAfter, eventsBefore, "restart must produce identical events");

// ── speed change during pause ────────────────────────────────────────────────

const speedScheduler = new FakeScheduler();
const speedPlayback = new PlaybackController({
  combatOptions: { seed: 4, maxRounds: 2, goal: { type: "count", target: 99 } },
  scheduler: speedScheduler,
  stepMs: 1000,
});
speedPlayback.start();
assert.equal(speedScheduler.pending.size, 1);
speedPlayback.pause();
assert.equal(speedScheduler.pending.size, 0);
speedPlayback.setSpeed(4);
assert.equal(speedPlayback.getState().speed, 4);
speedPlayback.resume();
assert.equal(speedScheduler.pending.size, 1);
assert.equal(speedScheduler.pending.values().next().value.delay, 250);

// ── prepare after restart ────────────────────────────────────────────────────

const prepareScheduler = new FakeScheduler();
const preparePlayback = new PlaybackController({
  combatOptions: { seed: 5, maxRounds: 1, goal: { type: "count", target: 99 } },
  scheduler: prepareScheduler,
});
preparePlayback.prepare();
assert.equal(preparePlayback.getState().phase, "ready");
preparePlayback.restart();
assert.equal(preparePlayback.getState().phase, "ready");
preparePlayback.prepare();
assert.equal(preparePlayback.getState().phase, "ready");

console.log("playback-edge tests passed");
