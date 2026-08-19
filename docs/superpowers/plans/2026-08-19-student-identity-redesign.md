# Student Identity Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static student display labels with deterministic, persistent player-facing identities while preserving v1 profile and snapshot compatibility.

**Architecture:** A focused identity module owns deterministic seeded name generation, visible-character validation, aptitude configuration, and profile rename operations. Profile v2 persists identity attributes and migrates v1 data deterministically; snapshot v2 copies those persisted fields and uses a separate DTO schema so v1 contracts remain unchanged.

**Tech Stack:** ECMAScript modules, Node.js built-in assertions, existing deterministic RNG, JSON Schema DTO constants.

---

### Task 1: Specify identity behavior

**Files:**
- Create: `src/tests/student-identity.test.js`
- Modify: `package.json`

- [x] **Step 1: Write identity tests.**

```js
const first = createStudentIdentity({ studentId: "planner", seed: "account-1" });
assert.deepEqual(first, createStudentIdentity({ studentId: "planner", seed: "account-1" }));
assert.equal(renameStudent(profile, "planner", "  林澈  ").students.planner.name, "林澈");
assert.throws(() => renameStudent(profile, "planner", " "), /1 to 12 visible characters/);
```

- [x] **Step 2: Run `node src/tests/student-identity.test.js`; it passes.**

- [x] **Step 3: Implement `src/domain/student-identity.js`.**

```js
export const STUDENT_IDENTITY_VERSION = 2;
export function createStudentIdentity({ studentId, seed, namePoolVersion, aptitude }) { /* deterministic identity */ }
export function renameStudent(profile, studentId, name) { /* update only the owned name */ }
```

- [x] **Step 4: Add `test:identity` to `package.json` and run it; it passes.**

### Task 2: Version persistent profiles and compatibility data

**Files:**
- Modify: `src/data.js`
- Modify: `src/domain/profile.js`
- Modify: `src/tests/domain-profile.test.js`

- [x] **Step 1: Add v2 profile migration tests.**

```js
const migrated = migrateProfile(v1Profile, { seed: "legacy-account" });
assert.equal(migrated.schemaVersion, 2);
assert.equal(migrated.students.planner.id, "planner");
assert.deepEqual(migrated.students.planner.abilities, v1Profile.students.planner.abilities);
```

- [x] **Step 2: Add versioned name pools and aptitude-by-ability ranges in `src/data.js`, retaining technical IDs and each student's skill-group reference.**

- [x] **Step 3: Implement `createProfile` v2 defaults and `migrateProfile` in `src/domain/profile.js`.**

```js
export const PROFILE_SCHEMA_VERSION = 2;
export function migrateProfile(profile, { seed = profile.accountId } = {}) { /* v1 -> v2 */ }
```

- [x] **Step 4: Run the profile and identity tests; they pass.**

### Task 3: Produce immutable v2 battle contracts

**Files:**
- Modify: `src/domain/snapshot.js`
- Modify: `shared/contracts/v1.js`
- Modify: `src/tests/domain-profile.test.js`

- [x] **Step 1: Add tests that a snapshot stores the current persisted name, aptitude, skill-group reference and levels, name-pool version, and remains unchanged after a rename.**

```js
const snapshot = createBattleSnapshot(profile, selection);
const renamed = renameStudent(profile, "planner", "顾言");
assert.notEqual(snapshot.team[0].name, renamed.students.planner.name);
```

- [x] **Step 2: Change snapshot creation to require a v2 profile and populate team students from persistent identity data.**

- [x] **Step 3: Export v2 profile and battle-snapshot JSON schemas without changing v1 schema requirements.**

- [x] **Step 4: Verify equal snapshots and seeds yield byte-identical serialized event streams and combat outcomes after a rename.**

### Task 4: Verify the complete redesign

**Files:**
- Modify: `package.json`

- [x] **Step 1: Include identity tests in `npm test` and the new module in `npm run check`.**

- [x] **Step 2: Run `npm test && npm run check`; all existing and new tests pass.**

- [x] **Step 3: Review the diff to confirm v1 DTO exports still require `role` and v2 schemas exclude it.**
