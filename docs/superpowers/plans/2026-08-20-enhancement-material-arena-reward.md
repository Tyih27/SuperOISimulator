# Enhancement Material and Arena Reward Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the student training material usable for enhancement, preserve explicit enhancement failure rules, and credit arena victory coins to the player's profile.

**Architecture:** Reuse the existing specialist-training transaction and domain function. A matching specialist book remains the preferred cost; when it is unavailable, one generic student-training material can fund the same fixed ability increase. Arena settlement will lock and version the attacker profile in the same transaction that settles the match, so the ledger and visible balance cannot diverge.

**Tech Stack:** Native ES modules, Fastify, PostgreSQL JSONB profiles, existing Node assertion tests.

---

### Task 1: Allow student training material to fund enhancement

**Files:**
- Modify: `src/domain/progression.js`
- Modify: `server/services/progression-service.js`
- Modify: `src/app/progression.js`
- Modify: `src/app/router.js`
- Test: `src/tests/progression.test.js`
- Test: `server/tests/progression.test.js`

- [x] **Step 1: Add a domain regression test**

Create a profile with one `student-training-material`, no specialist book, and enough training coins. Call `applySpecialistTraining` and assert the selected ability increases by `SPECIALIST_TRAINING_INCREMENT`, the generic material decreases to zero, and the input profile is unchanged. Also assert a profile with neither resource throws the existing matching-book/resource error.

- [x] **Step 2: Implement resource selection**

In `applySpecialistTraining`, prefer `specialistTrainingBookId(ability)` when its quantity is positive. Otherwise consume one `STUDENT_TRAINING_MATERIAL_ID`; if neither exists, throw a clear resource error. Keep the training coin check and `MAX_TRAINED_ABILITY` check before cloning/mutating. Return the cloned profile as before so existing callers remain compatible.

- [x] **Step 3: Update the transaction response and UI copy**

Have `trainSpecialist` determine which item changed between the original and next profile and return that item ID in `training.itemId`. Change the progression action copy to describe enhancement and show the generic material in the inventory label. Keep the existing error path so failed requests leave the profile/version/ledger unchanged.

- [x] **Step 4: Run focused domain and syntax checks**

Run `node src/tests/progression.test.js`, `node --check src/domain/progression.js`, `node --check server/services/progression-service.js`, `node --check src/app/progression.js`, and `node --check src/app/router.js`.

### Task 2: Credit arena victory coins to the profile

**Files:**
- Modify: `server/services/arena-service.js`
- Modify: `src/app/router.js`
- Modify: `server/tests/arena-api.test.js`

- [x] **Step 1: Add an API regression assertion**

After settling an arena match, fetch the attacker's profile and assert its training coin balance increased by 25. Assert the match can still be settled only once and that exactly one positive `arena` ledger row exists for that match.

- [x] **Step 2: Update settlement transaction**

When the attacker wins, lock the attacker profile row, add 25 `trainingCoins`, increment its profile version exactly once, persist it, and keep the existing ledger insert in the same transaction. Return the saved profile in the settlement response. Do not award coins for defender wins or draws.

- [x] **Step 3: Refresh client state after arena settlement**

When the arena settlement response contains a profile, replace `this.profile` and refresh the formation draft before rendering, matching campaign settlement behavior. Display the returned reward without relying on stale client currency state.

- [x] **Step 4: Run arena verification**

Run `node server/tests/arena.test.js`, `node --check server/services/arena-service.js`, `node --check src/app/router.js`, and, when `DATABASE_URL` is configured, `node server/tests/arena-api.test.js`.

### Task 3: Full regression verification

- [x] Run `npm test` and `npm run test:arena`.
- [ ] Run `npm run test:api` when PostgreSQL is available; current environment has no `DATABASE_URL`.
