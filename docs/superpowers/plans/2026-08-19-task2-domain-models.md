# Versioned Domain Models and Battle Snapshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define a versioned player profile, immutable three-student battle snapshots, v1 DTO schemas, and versioned deterministic event serialization.

**Architecture:** Keep persistent player data in `src/domain/profile.js` and derive self-contained combat input in `src/domain/snapshot.js`. Static student, topic, and level definitions remain in `src/data.js`; serialization metadata is attached by `src/combat/events.js` without modifying event entries or their order.

**Tech Stack:** Node.js 22 ESM, browser-native ES modules, `node:assert/strict`, JSON Schema-compatible contract objects.

---

### Task 1: Specify Profile and Snapshot Behavior

**Files:**
- Create: `src/tests/domain-profile.test.js`

- [x] **Step 1: Write profile and snapshot tests.**

```js
const profile = createProfile({
  accountId: "acc-1",
  studentIds: ["planner", "graphist", "structurer", "mathematician"],
});
const snapshot = createBattleSnapshot(profile, {
  levelId: "chapter-1-1",
  teamIds: ["planner", "graphist", "structurer"],
  timestamp: "2026-08-19T00:00:00.000Z",
});
assert.equal(Object.keys(profile.students).length, 4);
assert.equal(snapshot.team.length, 3);
assert.notEqual(snapshot.team[0].abilities, profile.students.planner.abilities);
assert.throws(() => createBattleSnapshot(profile, {
  teamIds: ["planner", "graphist", "structurer", "mathematician"],
}), /exactly three/);
```

- [x] **Step 2: Run the test and verify it fails before the domain modules exist.**

Run: `node src/tests/domain-profile.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/domain/profile.js`.

### Task 2: Implement Versioned Domain Objects

**Files:**
- Create: `src/domain/profile.js`
- Create: `src/domain/snapshot.js`
- Modify: `src/data.js`

- [x] **Step 1: Export content versions and a campaign level ID from `src/data.js`.**

```js
export const ENGINE_VERSION = "1";
export const RULESET_VERSION = "1";
```

The first level uses ID `chapter-1-1`, while its existing battle content and display name stay unchanged.

- [x] **Step 2: Implement a profile factory with no roster-size cap.**

```js
export const PROFILE_SCHEMA_VERSION = 1;
export function createProfile({ accountId, studentIds }) {
  // Validate the account and known, unique IDs, then clone persistent stats.
  return { schemaVersion: PROFILE_SCHEMA_VERSION, version: 1, accountId, students };
}
```

Each student owns independent `abilities` and `skillLevels` objects initialized from static data.

- [x] **Step 3: Implement immutable snapshot creation.**

```js
export function createBattleSnapshot(profile, selection) {
  // Validate exactly three owned IDs and a matching A1/A2/A3 formation.
  return deepFreeze({
    snapshotVersion: 1,
    engineVersion: ENGINE_VERSION,
    rulesetVersion: RULESET_VERSION,
    profileVersion: profile.version,
    team,
    level,
    formation,
    seed,
    timestamp,
  });
}
```

The returned object contains only selected students, cloned persistent stats and skill levels, the selected level and its topic data, formation, seed, versions, and timestamp.

- [x] **Step 4: Run `node src/tests/domain-profile.test.js`.**

Expected: `domain profile tests passed`.

### Task 3: Add v1 DTOs and Versioned Serialization

**Files:**
- Create: `shared/contracts/v1.js`
- Modify: `src/combat/events.js`
- Modify: `src/tests/domain-profile.test.js`
- Modify: `package.json`

- [x] **Step 1: Export frozen JSON Schema-compatible DTO constants.**

```js
export const CONTRACT_VERSION = 1;
export const PROFILE_DTO_SCHEMA = deepFreeze({ /* exact profile fields */ });
export const BATTLE_SNAPSHOT_DTO_SCHEMA = deepFreeze({ /* exact snapshot fields */ });
export const BATTLE_RESULT_DTO_SCHEMA = deepFreeze({ /* versioned result fields */ });
```

- [x] **Step 2: Serialize event logs and battle results with version metadata.**

```js
export function serializeEvents(events) {
  return JSON.stringify({ engineVersion: ENGINE_VERSION, rulesetVersion: RULESET_VERSION, events });
}
```

`serializeBattleResult(result)` uses the same two version fields. Neither function sorts, filters, nor mutates the supplied event array.

- [x] **Step 3: Add `test:domain` to the aggregate test script and domain files to syntax checks.**

Run: `npm test`

Expected: all combat, formation, playback, domain, Task 6 verification, and page-audit tests pass.

- [x] **Step 4: Run the full check.**

Run: `npm run check`

Expected: all tests and JavaScript syntax checks pass.
