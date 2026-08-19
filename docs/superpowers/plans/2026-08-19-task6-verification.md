# Task 6 Combat Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the task6 verification gate with focused automated tests, deterministic replay checks, and a unified check command for the playable prototype.

**Architecture:** Extend the existing Node test suite without changing the combat API. Exercise formulas and engine behavior through public results/events, use the existing playback fake scheduler for control-state coverage, and add a small static page audit for required controls and accessibility hooks.

**Tech Stack:** Node.js ESM, `node:assert/strict`, existing combat engine and playback controller, shell-level syntax checks.

---

### Task 1: Add focused combat-rule tests

**Files:**
- Create: `src/tests/task6-verification.test.js`
- Test: `src/tests/task6-verification.test.js`

- [x] **Step 1: Cover formulas and deterministic target tie-breaking**

Assert integer clamping/rounding, lowest-remaining and aligned target rules, and stable position ordering when values tie.

- [x] **Step 2: Cover replenishment, burst, status duration, and terminal outcomes**

Use small injected fixtures to assert queued topics only enter on the next round, focus reaches the burst threshold and resets after burst, temporary ability bonuses expire at the documented round boundary, and win takes precedence over elimination when both happen in one stage.

- [x] **Step 3: Cover replay serialization across multiple configurations**

Run the same seed and formation twice and compare serialized events; run a changed formation/seed and assert the event log changes.

### Task 2: Add unified verification command

**Files:**
- Modify: `package.json`

- [x] **Step 1: Add `check` script**

Run all existing and new tests, then syntax-check every JavaScript module with `node --check`.

- [x] **Step 2: Run the command and fix failures**

Expected output ends with all test suites passing and no syntax errors.

### Task 3: Static browser/accessibility audit

**Files:**
- Create: `src/tests/page-audit.test.js`

- [x] **Step 1: Verify the page contract from source**

Read `index.html` and `styles/base.css`; assert viewport metadata, skip link, labeled controls, disabled playback state, focus-visible styles, responsive breakpoints, and reduced-motion media query.

- [x] **Step 2: Run the audit and report runtime limitation**

Run the audit as part of `npm run check`. Preserve the static contract checks for CI and use Playwright with Chromium for a real desktop/mobile click-through when available.
