import assert from "node:assert/strict";
import { createRng } from "../rng.js";

// ── Determinism ──────────────────────────────────────────────────────────────

const rng1 = createRng(42);
const rng2 = createRng(42);
const values1 = Array.from({ length: 20 }, () => rng1.next());
const values2 = Array.from({ length: 20 }, () => rng2.next());
assert.deepEqual(values1, values2, "same numeric seed must produce identical sequences");

const rng3 = createRng("hello");
const rng4 = createRng("hello");
const values3 = Array.from({ length: 20 }, () => rng3.next());
const values4 = Array.from({ length: 20 }, () => rng4.next());
assert.deepEqual(values3, values4, "same string seed must produce identical sequences");

// ── Range ────────────────────────────────────────────────────────────────────

const rngRange = createRng(1);
for (let i = 0; i < 1000; i += 1) {
  const value = rngRange.next();
  assert.ok(value >= 0, `value ${value} must be >= 0`);
  assert.ok(value < 1, `value ${value} must be < 1`);
}

// ── Different seeds produce different sequences ──────────────────────────────

const rngA = createRng(1);
const rngB = createRng(999);
const valuesA = Array.from({ length: 10 }, () => rngA.next());
const valuesB = Array.from({ length: 10 }, () => rngB.next());
assert.notDeepEqual(valuesA, valuesB, "different seeds must produce different sequences");

// ── Default seed ─────────────────────────────────────────────────────────────

const rngDefault1 = createRng();
const rngDefault2 = createRng();
const defaultValues1 = Array.from({ length: 5 }, () => rngDefault1.next());
const defaultValues2 = Array.from({ length: 5 }, () => rngDefault2.next());
assert.deepEqual(defaultValues1, defaultValues2, "default seed must be deterministic");

// ── pick ─────────────────────────────────────────────────────────────────────

const rngPick = createRng(7);
assert.equal(rngPick.pick([]), undefined, "pick on empty array returns undefined");
assert.equal(rngPick.pick(["only"]), "only", "pick on single-element array returns that element");

const rngPickMulti = createRng(100);
const items = ["a", "b", "c"];
const picks = Array.from({ length: 100 }, () => rngPickMulti.pick(items));
assert.ok(picks.every((item) => items.includes(item)), "all picks must be from the input array");
assert.ok(picks.includes("a"), "picks should include all items over many iterations");
assert.ok(picks.includes("b"));
assert.ok(picks.includes("c"));

// ── pick determinism ─────────────────────────────────────────────────────────

const rngPickA = createRng(55);
const rngPickB = createRng(55);
const picksA = Array.from({ length: 10 }, () => rngPickA.pick([1, 2, 3, 4, 5]));
const picksB = Array.from({ length: 10 }, () => rngPickB.pick([1, 2, 3, 4, 5]));
assert.deepEqual(picksA, picksB, "pick must be deterministic with same seed");

// ── String seed hashing ──────────────────────────────────────────────────────

const rngStr1 = createRng("test-seed-1");
const rngStr2 = createRng("test-seed-2");
const strValues1 = Array.from({ length: 5 }, () => rngStr1.next());
const strValues2 = Array.from({ length: 5 }, () => rngStr2.next());
assert.notDeepEqual(strValues1, strValues2, "different string seeds must differ");

// ── Large number of calls ────────────────────────────────────────────────────

const rngStress = createRng(12345);
for (let i = 0; i < 10000; i += 1) {
  const v = rngStress.next();
  assert.ok(Number.isFinite(v), `call ${i} produced non-finite value`);
}

console.log("rng tests passed");
