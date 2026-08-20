# Enhancement Material Value Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure consuming a student training material increases the selected student's ability value and document the actual enhancement rules.

**Architecture:** Keep the existing server-authoritative specialist-training transaction. Add an explicit response/test assertion for the ability delta, then make the client render the returned profile and value change from the same response. Update the game design and README so the documented material behavior matches the implementation.

**Tech Stack:** Native ES modules, Fastify, PostgreSQL JSONB profiles, Node assertion tests, Markdown docs.

---

### Task 1: Lock the value-change contract

**Files:**
- Modify: `server/tests/progression.test.js`
- Modify: `src/tests/progression.test.js`

- [x] Assert that material-funded training changes the selected ability by `SPECIALIST_TRAINING_INCREMENT`, consumes exactly one material, and returns a profile containing that changed value.

### Task 2: Fix the training response/client state if the regression fails

**Files:**
- Modify: `server/services/progression-service.js`
- Modify: `src/app/router.js`

- [x] Preserve the returned profile as the single source of truth and expose the before/after ability values in the training result/message so the UI cannot report success while showing stale data.

### Task 3: Synchronize documentation

**Files:**
- Modify: `docs/GAME_DESIGN.md`
- Modify: `README.md`

- [x] Document that one student training material replaces a matching specialist book for one enhancement, costs 100 training coins, and increases the selected ability by 40; document failure conditions and the 25-coin arena victory reward.

### Task 4: Verify

- [x] Run `npm test`, `npm run test:arena`, and syntax checks. API tests remain pending because `DATABASE_URL` is not configured.
