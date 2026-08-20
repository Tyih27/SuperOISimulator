# Arena Reward Profile Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure an arena training-coin reward is reflected in the visible player profile even when settlement responses contain only the reward payload.

**Architecture:** Keep the server transaction authoritative and make the browser refresh the canonical `/profile` after every arena settlement. This supports both current responses that include a profile and older/minimal responses that return only result and reward.

**Tech Stack:** Native ES modules, browser ESM router, Playwright E2E fixtures, Markdown documentation.

---

### Task 1: Refresh the canonical profile after arena settlement

**Files:**
- Modify: `src/app/router.js`
- Modify: `e2e/arena.spec.js`

- [x] After settling, use the returned profile when present; otherwise call `GET /profile` before rendering. Assert the visible profile reflects the 25-coin victory reward.

### Task 2: Synchronize documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/GAME_DESIGN.md`

- [x] Document that the reward is persisted server-side and the client refreshes the profile after settlement.

### Task 3: Verify

- [x] Run the arena E2E test, local unit tests, syntax checks, and `git diff --check`.
