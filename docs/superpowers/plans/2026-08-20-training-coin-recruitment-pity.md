# 训练币招募与天才保底 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow training coins to purchase recruitment rights, roll recruited student aptitudes by configured probabilities, and guarantee at least a genius student on the 30th attempt after the last genius-or-better result.

**Architecture:** Keep recruitment economics and aptitude selection in the existing data/domain/progression layers. Persist a small recruitment pity counter in the profile so the server transaction is authoritative and legacy profiles migrate safely. Expose the configured rates and pity progress in the progression UI without changing battle snapshots.

**Tech Stack:** ES modules, Node.js, Fastify, PostgreSQL JSONB profiles, existing seeded RNG, Node assert tests, Playwright UI tests.

---

### Task 1: Add recruitment configuration and domain selection

**Files:**
- Modify: `src/data.js`
- Modify: `src/domain/progression.js`
- Test: `src/tests/progression.test.js`

- [x] Add immutable aptitude weights, a 30-attempt pity limit, and a training-coin recruitment-right shop offer.
- [x] Add seeded weighted selection with pity forcing `天才` and resetting the counter when `天才` or `顶尖` is drawn.
- [x] Test deterministic selection, different aptitude outcomes, and the pity boundary.

### Task 2: Persist and validate pity state

**Files:**
- Modify: `src/domain/profile.js`
- Modify: `server/services/profile-service.js`
- Modify: `shared/contracts/v1.js`
- Test: `src/tests/domain-profile.test.js`
- Test: `server/tests/profile-migration.test.js`

- [x] Add `recruitment: { attemptsSinceGenius }` to new profiles and default missing legacy state to zero.
- [x] Validate the counter as a bounded non-negative integer and preserve it through migrations.
- [x] Extend the profile contract with the persisted state.

### Task 3: Make server recruitment spend rights and apply pity

**Files:**
- Modify: `server/services/progression-service.js`
- Modify: `server/tests/progression.test.js`

- [x] Select aptitude from the current pity state, create the student with that aptitude, update the counter, and continue recording the ticket ledger/audit event.
- [x] Test buying the recruitment-right offer with training coins, recruitment consumption, aptitude persistence, and the 30th-attempt guarantee.

### Task 4: Surface recruitment state in the UI

**Files:**
- Modify: `src/app/progression.js`
- Modify: `src/app/router.js`
- Modify: `e2e/single-player.spec.js`

- [x] Show recruitment rights, pity progress, and the configured rate labels on the progression screen.
- [x] Include the recruited aptitude and next pity progress in the success message.
- [x] Extend the mocked UI flow to cover purchasing a recruitment right and recruiting.

### Task 5: Verify all affected checks

- [x] Run focused domain, progression, migration, and UI tests.
- [x] Run the full project test suite and syntax checks; fix any contract or fixture regressions.
