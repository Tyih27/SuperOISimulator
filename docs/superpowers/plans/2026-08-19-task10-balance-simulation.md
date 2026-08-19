# Task 10 Balance Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic formation simulator, committed campaign baselines, and an automated 10-percentage-point balance review gate.

**Architecture:** `scripts/simulate-formations.js` is both an importable pure simulation module and a Node CLI. It enumerates each three-student combination and six A1/A2/A3 permutations, runs the shared `CombatEngine` for fixed seeds, then returns stable aggregate rows. Content-owned baseline metadata lives in `src/data.js`; the test compares its recorded win rates with actual reports, while `docs/BALANCE_BASELINE.md` presents the same approved figures for review.

**Tech Stack:** Node.js ESM, `node:assert/strict`, native `fs`, shared deterministic combat engine.

---

### Task 1: Specify deterministic aggregate behavior

**Files:**
- Create: `src/tests/balance-simulation.test.js`
- Modify: `package.json`

- [x] **Step 1: Add tests that import `simulate`, run all 20 starter trios for three fixed seeds, and assert deterministic reports, six permutations per formation, bounded rates, and populated aggregate metrics.**

```js
const report = simulate({ levelId: "chapter-1-1", seeds: [1, 2, 3], rosterIds: STARTER_STUDENT_IDS });
assert.equal(report.formations, 20);
assert.equal(report.permutationsPerFormation, 6);
assert.equal(report.seeds, 3);
assert.ok(report.rows.every((row) => row.averageRounds > 0 && row.winRate >= 0 && row.winRate <= 1));
```

- [x] **Step 2: Run `node src/tests/balance-simulation.test.js`.**

Run: `node src/tests/balance-simulation.test.js`

Expected: failure because `scripts/simulate-formations.js` does not exist.

### Task 2: Implement simulation and CLI output

**Files:**
- Create: `scripts/simulate-formations.js`

- [x] **Step 1: Implement stable trio combination generation, slot permutations, seed-qualified battle construction, aggregate metric collection, JSON serialization, CSV serialization, and CLI flag parsing.**

```js
export function simulate({ levelId, seeds, rosterIds }) {
  // Sort roster IDs, enumerate unique trios and the six A-slot permutations.
  // Run CombatEngine once per seed and aggregate results per formation/permutation row.
}
```

- [x] **Step 2: Run the focused test and CLI twice, then compare emitted JSON.**

Run: `node src/tests/balance-simulation.test.js && node scripts/simulate-formations.js --level chapter-1-1 --seeds 1,2,3 --out reports/chapter-1-1.json && node scripts/simulate-formations.js --level chapter-1-1 --seeds 1,2,3 --out reports/chapter-1-1-repeat.json && cmp reports/chapter-1-1.json reports/chapter-1-1-repeat.json`

Expected: test passes and `cmp` produces no output.

### Task 3: Set approved baseline thresholds

**Files:**
- Create: `docs/BALANCE_BASELINE.md`
- Modify: `src/data.js`, `src/tests/balance-simulation.test.js`, `package.json`

- [x] **Step 1: Add an immutable `BALANCE_BASELINES` record keyed by every campaign level, each holding its fixed seeds and approved aggregate win rate.**

```js
export const BALANCE_BASELINES = Object.freeze({
  "chapter-1-1": Object.freeze({ seeds: Object.freeze([1, 2, 3, 4, 5]), winRate: 0 }),
  "chapter-1-2": Object.freeze({ seeds: Object.freeze([1, 2, 3, 4, 5]), winRate: 0.058333333333333334 }),
  "chapter-1-3": Object.freeze({ seeds: Object.freeze([1, 2, 3, 4, 5]), winRate: 0 }),
  "chapter-1-4": Object.freeze({ seeds: Object.freeze([1, 2, 3, 4, 5]), winRate: 0 }),
});
```

- [x] **Step 2: Extend the test to simulate each configured level and fail with a review message when its actual win rate differs from its approved baseline by more than `0.10`.**

```js
assert.ok(Math.abs(actual.winRate - baseline.winRate) <= 0.10,
  `${levelId} win rate moved by more than 10 percentage points; review and update the approved baseline`);
```

- [x] **Step 3: Generate actual figures and document each level's approved rate, seeds, aggregation method, and review rule in `docs/BALANCE_BASELINE.md`.**

- [x] **Step 4: Add `test:balance` and `simulate:balance` package scripts, include the test and CLI in `npm test`/`npm run check`, then run both commands.**

Run: `npm run simulate:balance && npm run check`

Expected: JSON and CSV reports are written under `reports/`; all tests and syntax checks pass.

- [x] **Step 5: Review the final diff and mark Task 10 complete in the project completion plan and README.**

Run: `git diff --check && git diff -- docs/superpowers/plans/2026-08-19-project-completion.md README.md src/data.js scripts/simulate-formations.js src/tests/balance-simulation.test.js docs/BALANCE_BASELINE.md package.json`

Expected: no whitespace errors; Task 10 is checked off and Task 11 is identified as next.
