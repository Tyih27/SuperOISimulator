import assert from "node:assert/strict";
import {
  EVENT_TYPES,
  event,
  serializeEvents,
  serializeBattleResult,
} from "../combat/events.js";
import { ENGINE_VERSION, RULESET_VERSION } from "../data.js";

// ── EVENT_TYPES completeness ─────────────────────────────────────────────────

assert.ok(Array.isArray(EVENT_TYPES));
assert.ok(EVENT_TYPES.includes("round_start"));
assert.ok(EVENT_TYPES.includes("stage_start"));
assert.ok(EVENT_TYPES.includes("action"));
assert.ok(EVENT_TYPES.includes("skip"));
assert.ok(EVENT_TYPES.includes("effect"));
assert.ok(EVENT_TYPES.includes("problem_completed"));
assert.ok(EVENT_TYPES.includes("student_exit"));
assert.ok(EVENT_TYPES.includes("round_end"));
assert.ok(EVENT_TYPES.includes("battle_end"));
assert.equal(EVENT_TYPES.length, 9);

// ── event() valid types ──────────────────────────────────────────────────────

for (const type of EVENT_TYPES) {
  const e = event(type);
  assert.equal(e.type, type);
}

// ── event() with payload ─────────────────────────────────────────────────────

const actionEvent = event("action", { round: 1, stage: "A1", actor: "planner" });
assert.equal(actionEvent.type, "action");
assert.equal(actionEvent.round, 1);
assert.equal(actionEvent.stage, "A1");
assert.equal(actionEvent.actor, "planner");

const skipEvent = event("skip", { reason: "energy-zero" });
assert.equal(skipEvent.type, "skip");
assert.equal(skipEvent.reason, "energy-zero");

// ── event() with empty payload ───────────────────────────────────────────────

const bareEvent = event("round_start");
assert.equal(bareEvent.type, "round_start");
assert.deepEqual(Object.keys(bareEvent), ["type"]);

// ── event() rejects unknown type ─────────────────────────────────────────────

assert.throws(() => event("unknown_type"), /Unknown combat event/);
assert.throws(() => event(""), /Unknown combat event/);
assert.throws(() => event("ROUND_START"), /Unknown combat event/);
assert.throws(() => event("action_extra"), /Unknown combat event/);

// ── serializeEvents ──────────────────────────────────────────────────────────

const events = [
  { type: "round_start", round: 1 },
  { type: "action", round: 1, stage: "A1", actor: "planner" },
  { type: "battle_end", round: 3, result: "win" },
];
const serialized = JSON.parse(serializeEvents(events));
assert.equal(serialized.engineVersion, ENGINE_VERSION);
assert.equal(serialized.rulesetVersion, RULESET_VERSION);
assert.deepEqual(serialized.events, events);
assert.equal(serialized.events.length, 3);

// ── serializeEvents preserves order ──────────────────────────────────────────

const ordered = [
  { type: "round_start", round: 1 },
  { type: "stage_start", stage: "A1" },
  { type: "action", actor: "planner" },
  { type: "effect", effects: [] },
  { type: "stage_start", stage: "B1" },
  { type: "round_end", round: 1 },
];
const orderedSerialized = JSON.parse(serializeEvents(ordered));
assert.deepEqual(
  orderedSerialized.events.map((e) => e.type),
  ["round_start", "stage_start", "action", "effect", "stage_start", "round_end"],
);

// ── serializeEvents empty array ──────────────────────────────────────────────

const emptySerialized = JSON.parse(serializeEvents([]));
assert.deepEqual(emptySerialized.events, []);
assert.equal(emptySerialized.engineVersion, ENGINE_VERSION);

// ── serializeBattleResult ────────────────────────────────────────────────────

const result = {
  result: "win",
  reason: "goal-met",
  round: 5,
  completedCount: 3,
  remainingEnergy: 8000,
  events: [{ type: "battle_end", round: 5, result: "win" }],
};
const serializedResult = JSON.parse(serializeBattleResult(result));
assert.equal(serializedResult.engineVersion, ENGINE_VERSION);
assert.equal(serializedResult.rulesetVersion, RULESET_VERSION);
assert.equal(serializedResult.result, "win");
assert.equal(serializedResult.reason, "goal-met");
assert.equal(serializedResult.round, 5);
assert.equal(serializedResult.completedCount, 3);
assert.equal(serializedResult.remainingEnergy, 8000);
assert.equal(serializedResult.events.length, 1);

// ── serializeBattleResult with minimal fields ────────────────────────────────

const minimalResult = JSON.parse(serializeBattleResult({ result: "lose", events: [] }));
assert.equal(minimalResult.result, "lose");
assert.deepEqual(minimalResult.events, []);

// ── serializeEvents immutability ─────────────────────────────────────────────

const originalEvents = [{ type: "round_start", round: 1 }];
serializeEvents(originalEvents);
assert.deepEqual(originalEvents, [{ type: "round_start", round: 1 }], "serialization must not mutate input");

console.log("events tests passed");
