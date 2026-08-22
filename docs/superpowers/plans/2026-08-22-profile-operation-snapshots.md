# Profile Operation Snapshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically append a complete profile snapshot after every successful profile or student mutation, including formation changes, student replacement, and ability training.

**Architecture:** Add an append-only `profile_snapshots` table and repository. Profile and progression services write the post-mutation profile snapshot inside their existing profile transaction, using the existing audit action type as operation metadata. Account export includes the snapshot history so changes are inspectable without changing the current profile DTO.

**Tech Stack:** Node.js ES modules, Fastify services, PostgreSQL JSONB migrations, existing Node assertion tests.

---

### Task 1: Add persistent profile snapshot storage

**Files:**
- Create: `server/migrations/010_profile_snapshots.sql`
- Create: `server/repositories/profile-snapshot-repository.js`
- Modify: `server/repositories/account-repository.js`

- [x] **Step 1: Add the migration**

Create an append-only table with the account, resulting profile version, operation type, full JSON profile, and creation time. Add an account/time index and enforce positive versions and non-empty operation names.

- [x] **Step 2: Add repository methods**

Implement `create(client, { accountId, profileVersion, actionType, profile })` and `listForAccount(client, accountId)` using parameterized queries and `JSON.stringify(profile)`.

- [x] **Step 3: Include snapshots in account export**

Select snapshot rows in ascending insertion order and expose them as `profileSnapshots` in `AccountRepository.exportData`.

- [x] **Step 4: Run syntax checks**

Run `node --check server/repositories/profile-snapshot-repository.js` and verify migration discovery with `node -e 'import("./server/db.js").then(async ({listMigrations}) => console.log((await listMigrations()).at(-1)))'`. Expected output ends with `010_profile_snapshots.sql`.

### Task 2: Snapshot direct profile updates

**Files:**
- Modify: `server/services/profile-service.js`
- Modify: `server/tests/profile.test.js`

- [x] **Step 1: Add the failing API assertions**

After a successful formation/name update, query `profile_snapshots` and assert one row exists with the saved profile version, the expected operation type, the updated formation/name, and a snapshot distinct from the live mutable profile object.

- [x] **Step 2: Wire the repository into `ProfileService`**

Instantiate `ProfileSnapshotRepository` and insert the saved `next` profile after `repository.update` and arena-defense synchronization, before audit append/commit. Preserve existing action type behavior (`student_rename` for rename requests, `profile_update` otherwise).

- [x] **Step 3: Run the focused API test**

Run `node server/tests/profile.test.js`. Expected: all profile API assertions pass, including the new snapshot row checks.

### Task 3: Snapshot progression/student operations

**Files:**
- Modify: `server/services/progression-service.js`
- Modify: `server/tests/progression.test.js`

- [x] **Step 1: Add failing snapshot assertions**

After training, recruitment, dismissal, and energy operations, query `profile_snapshots` and assert each successful mutation adds exactly one row with increasing profile versions and post-operation student data. Assert failed training adds no new row.

- [x] **Step 2: Write snapshots in `withProfile`**

Instantiate `ProfileSnapshotRepository`; after saving the incremented profile, derive `auditAction` and insert the saved profile payload with `profile.version` and that action type. Keep snapshot insertion in the same transaction so rollback removes it with the profile mutation.

- [x] **Step 3: Run the focused progression test**

Run `node server/tests/progression.test.js`. Expected: existing ledger/audit checks remain valid and snapshot history covers all successful progression mutations.

### Task 4: Verify export and full regression coverage

**Files:**
- Modify: `server/tests/account-data.test.js`
- Modify: `README.md`

- [x] **Step 1: Test exported snapshot history**

Perform one profile operation, call `/api/v1/account/export`, and assert `data.profileSnapshots` contains the operation type, profile version, and profile payload.

- [x] **Step 2: Document behavior**

Update the operations/user-facing documentation to state that successful formation, student replacement, training, recruitment, dismissal, and energy changes append immutable profile snapshots; failed operations do not.

- [x] **Step 3: Run verification**

Run `npm run test:api`, `node --check server/services/profile-service.js`, `node --check server/services/progression-service.js`, `node --check server/repositories/account-repository.js`, and the existing test suite relevant to account export. Expected: all pass.
