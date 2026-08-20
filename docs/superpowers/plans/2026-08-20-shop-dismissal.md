# Shop Offer and Student Dismissal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every rendered shop offer resolve through the canonical server catalog, and let players actively dismiss recruited students in exchange for a training material.

**Architecture:** Keep `src/data.js` as the shared catalog and add a small domain-level dismissal operation in `src/domain/progression.js`. The progression service will execute dismissal and shop purchases in the existing row-locked transaction, record inventory/audit ledger entries, and the existing server-rendered UI will expose the action for eligible recruited students.

**Tech Stack:** Native ES modules, Fastify routes, PostgreSQL JSONB profiles, existing Node assertion tests and Playwright fixtures.

---

### Task 1: Harden shop offer resolution

**Files:**
- Modify: `server/services/progression-service.js`
- Modify: `server/tests/progression.test.js`

- [x] **Step 1: Add canonical offer lookup and normalization**

  Resolve only IDs from `SHOP_OFFERS`, trimming the request value before lookup and returning the existing `INVALID_PROGRESSION_REQUEST` error for unknown IDs. Use the normalized ID for purchase-limit and ledger records so the UI and server cannot diverge on whitespace.

- [x] **Step 2: Test every catalog offer through the API**

  Add a focused request loop that purchases each non-daily offer once, verifies HTTP 200 and the returned offer ID, and keeps one explicit unknown-ID assertion returning `Unknown shop offer`.

- [x] **Step 3: Run the progression API test**

  Run `node server/tests/progression.test.js`; expect the existing training, purchase-limit, recruitment, ledger, and audit assertions plus the new catalog coverage to pass.

### Task 2: Add active student dismissal for training material

**Files:**
- Modify: `src/domain/progression.js`
- Modify: `server/services/progression-service.js`
- Modify: `server/routes/progression.js`
- Modify: `src/app/progression.js`
- Modify: `src/app/router.js`
- Modify: `src/tests/progression.test.js`
- Modify: `server/tests/progression.test.js`
- Modify: `e2e/single-player.spec.js`

- [x] **Step 1: Define the material and domain rules**

  Add `STUDENT_TRAINING_MATERIAL_ID = "student-training-material"`, a fixed one-material reward, and `dismissRecruitedStudent(profile, { studentId })`. The operation must reject unknown students, starter students, and students currently in the three-slot formation; otherwise clone the profile, remove the student, and increment the material inventory.

- [x] **Step 2: Add the authenticated dismissal transaction**

  Add `POST /api/v1/progression/students/:studentId/dismiss` with the same origin/session checks as other progression actions. Lock the profile, apply the domain operation, persist the updated profile, write one inventory ledger entry with source `student-dismissal`, and append `student_dismissal` audit data.

- [x] **Step 3: Expose the action in the UI**

  Render the material in the inventory and add a `劝退` button only for recruited students. Delegate the button in `router.js`, refresh the profile after success, and report the awarded material. Keep starter students and formation students protected in the UI as well as on the server.

- [x] **Step 4: Cover duplicate-style recruited students and dismissal errors**

  Extend domain/API tests to create a recruited student, dismiss it, assert it is removed and the material count/ledger/audit entry increase, and assert starter or formation dismissal returns a 400 without mutating the profile.

- [x] **Step 5: Run focused verification**

  Run `node src/tests/progression.test.js`, `node server/tests/progression.test.js`, `npm run test:e2e`, and `node --check` on the touched modules.
