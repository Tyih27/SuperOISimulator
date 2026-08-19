# Skill Groups and Problem Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each student use a personally assigned, extensible normal-and-burst skill group, and make every topic monster execute its own configured skill.

**Architecture:** Define immutable skill-group content separately from students. A student stores `skillGroupId` and group-level progression, while the combat snapshot resolves that reference to an immutable `skillGroups` catalogue. Define topic skills as data with an explicit effect type and target rule, then route both student support effects and topic attacks through data-driven intents instead of checking technical IDs.

**Tech Stack:** JavaScript ES modules, Node.js built-in test runner, native browser DOM, JSON profile persistence, JSON Schema DTOs.

---

## File Structure

- Modify `src/data.js`: export the skill-group catalogue, replace each student's legacy inline skill fields and standalone `{ normal, burst }` levels with a `skillGroupId` and a per-group level record, and add a configured skill to every topic.
- Modify `src/combat/engine.js`: resolve a student's selected group, apply declarative support effects, and execute a topic's configured skill in `B1`–`B3` stages.
- Modify `src/combat/math.js`: calculate topic-skill damage from the declared multiplier and additive modifier while retaining the existing base formula.
- Modify `src/domain/profile.js`, `src/domain/progression.js`, and `src/domain/snapshot.js`: create, migrate, and snapshot group references/catalogue rather than copying skill definitions onto student records.
- Modify `server/services/profile-service.js` and `shared/contracts/v1.js`: validate and expose the new profile/snapshot shape without silently accepting malformed group references.
- Modify `src/app/main.js`: render the acting student's selected group and the acting topic's skill name/category.
- Modify `docs/GAME_DESIGN.md` and `README.md`: document the player-facing model and the prototype's scope.
- Modify `src/tests/combat-engine.test.js`, `src/tests/task6-verification.test.js`, `src/tests/domain-profile.test.js`, `src/tests/student-identity.test.js`, and relevant server profile tests: cover group selection, migration, snapshot immutability, data-driven support, topic skills, deterministic replay, and input validation.

### Task 1: Define the Content Shape

**Files:**
- Modify: `src/data.js:63-152`
- Test: `src/tests/combat-engine.test.js`

- [x] **Step 1: Write failing content-shape assertions**

```js
import { SKILL_GROUPS, STUDENTS, TOPICS } from "../data.js";

assert.ok(SKILL_GROUPS.planner);
assert.deepEqual(Object.keys(SKILL_GROUPS.planner.skills), ["normal", "burst"]);
assert.ok(STUDENTS.every(({ skillGroupId }) => SKILL_GROUPS[skillGroupId]));
assert.ok(TOPICS.every(({ skill }) => skill?.id && skill.effectType === "energyDamage"));
```

- [x] **Step 2: Run the focused test to verify it fails**

Run: `node --test src/tests/combat-engine.test.js`

Expected: FAIL because `SKILL_GROUPS`, `student.skillGroupId`, and `topic.skill` do not exist.

- [x] **Step 3: Add immutable, declarative content**

```js
export const SKILL_GROUPS = freeze({
  planner: {
    id: "planner",
    name: "拆解思路",
    skills: {
      normal: problemSkill({ id: "planner-normal", name: "逐个击破", targetRule: "lowestRemaining", relatedAbility: "dynamicProgramming" }),
      burst: problemSkill({ id: "planner-burst", name: "关键路径", targetRule: "highestDifficulty", relatedAbility: "dynamicProgramming", skillMultiplier: 1.5 }),
    },
  },
});

// Each student references a group; add later groups only to SKILL_GROUPS.
{ id: "planner", skillGroupId: "planner", skillGroupLevels: { planner: { normal: 1, burst: 1 } } }

{ id: "treeKnapsack", /* existing fields */, skill: { id: "treeKnapsack-attack", name: "递归压力", category: "problem", effectType: "energyDamage", targetRule: "matchingPosition", damageMultiplier: 1, flatBonus: 0 } }
```

Move all existing six normal/burst pairs into six named `SKILL_GROUPS` entries unchanged. Use the same generic topic attack skill shape for all eight topics but give each a stable ID and player-facing name; vary only multiplier/flat bonus where balance requires it. Update `createInitialBattleConfig` to clone `skillGroupId`, `skillGroupLevels`, `SKILL_GROUPS`, and every topic's `skill`.

- [x] **Step 4: Run the focused test to verify it passes**

Run: `node --test src/tests/combat-engine.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data.js src/tests/combat-engine.test.js
git commit -m "feat: define extensible skill groups and topic skills"
```

### Task 2: Make Student and Topic Actions Data Driven

**Files:**
- Modify: `src/combat/engine.js:15-228`
- Modify: `src/combat/math.js:52-65`
- Test: `src/tests/combat-engine.test.js`
- Test: `src/tests/task6-verification.test.js`

- [x] **Step 1: Write failing behavior tests**

```js
const groupEngine = new CombatEngine({ students: [{ ...STUDENTS[0], skillGroupId: "structurer" }, ...STUDENTS.slice(1)] });
groupEngine.step();
assert.equal(groupEngine.events.find((entry) => entry.type === "action").skill, "structurer-normal");

const topicEngine = new CombatEngine({ maxRounds: 1 });
topicEngine.step(); topicEngine.step();
const action = topicEngine.events.find((entry) => entry.type === "action" && entry.actor === "treeKnapsack");
assert.equal(action.skill, "treeKnapsack-attack");
assert.equal(action.skillName, "递归压力");

const recovery = new CombatEngine({ students: [{ ...STUDENTS[2], skillGroupId: "structurer" }, ...STUDENTS.slice(0, 2)] });
recovery.students.planner.energy = 1;
recovery.step();
assert.ok(recovery.students.planner.energy > 1);
```

- [x] **Step 2: Run behavior tests to verify they fail**

Run: `node --test src/tests/combat-engine.test.js src/tests/task6-verification.test.js`

Expected: FAIL because the engine still reads legacy `data.skills`, topics always use the hard-coded `problem-attack`, and recovery is selected by an ID prefix.

- [x] **Step 3: Resolve skill groups and declarative effects in the engine**

```js
studentSkill(studentData, focus) {
  const group = this.skillGroups[studentData.skillGroupId];
  if (!group) throw new Error(`Unknown skill group: ${studentData.skillGroupId}`);
  return group.skills[focus >= this.focusMax ? "burst" : "normal"];
}

// Support skills explicitly state their target resource, never infer it from skill.id.
if (skill.category === "support") {
  const targetKey = skill.effectType === "focusGain" ? "focusDeltas" : "energyDeltas";
  intent[targetKey][target.id] = (intent[targetKey][target.id] ?? 0) + amount;
}

const skill = problem.skill;
const target = this.selectStudentTargets(skill.targetRule, position, snapshot)[0];
const damage = calculateTopicSkillDamage(this.effectiveStudent(snapshot, target.id), problem, skill);
```

Pass `options.skillGroups ?? SKILL_GROUPS` into `this.skillGroups`; derive `this.focusMax` from the level. Emit topic actions with `skill`, `skillName`, `category`, and `burst: false`. Keep default `energyDamage` only as an explicit backward-compatible fallback for custom test problems without `skill`.

- [x] **Step 4: Add and use the topic skill formula**

```js
export function calculateTopicSkillDamage(student, topic, skill = {}) {
  const base = calculateEnergyDamage(student, topic);
  return clamp(roundHalfUp(base * (skill.damageMultiplier ?? 1) + (skill.flatBonus ?? 0)), 0, skill.maxDamage ?? 2_000);
}
```

Use `effectType` to reject unsupported topic effects with a clear `Error`, rather than silently treating new content as an attack.

- [x] **Step 5: Run the focused regression suite**

Run: `node --test src/tests/combat-engine.test.js src/tests/task6-verification.test.js`

Expected: PASS, including byte-identical replay assertions.

- [ ] **Step 6: Commit**

```bash
git add src/combat/engine.js src/combat/math.js src/tests/combat-engine.test.js src/tests/task6-verification.test.js
git commit -m "feat: execute student groups and topic skills"
```

### Task 3: Version Persistent Profiles and Snapshots

**Files:**
- Modify: `src/domain/profile.js:1-150`
- Modify: `src/domain/progression.js:42-60`
- Modify: `src/domain/snapshot.js:1-85`
- Test: `src/tests/domain-profile.test.js`
- Test: `src/tests/student-identity.test.js`

- [x] **Step 1: Write failing migration and snapshot tests**

```js
const profile = createProfile({ accountId: "groups", studentIds: ["planner"] });
assert.equal(profile.students.planner.skillGroupId, "planner");
assert.deepEqual(profile.students.planner.skillGroupLevels, { planner: { normal: 1, burst: 1 } });

const migrated = migrateProfile({ ...legacyProfile, students: { planner: { ...legacyProfile.students.planner, skills: { normal: oldNormal, burst: oldBurst }, skillLevels: { normal: 3, burst: 2 } } } });
assert.equal(migrated.students.planner.skillGroupId, "planner");
assert.deepEqual(migrated.students.planner.skillGroupLevels.planner, { normal: 3, burst: 2 });

const snapshot = createBattleSnapshot(profile, { levelId: "chapter-1-1", timestamp: "2026-08-19T00:00:00.000Z" });
assert.equal(snapshot.team[0].skillGroupId, profile.students.planner.skillGroupId);
assert.notEqual(snapshot.skillGroups, SKILL_GROUPS);
```

- [x] **Step 2: Run the domain tests to verify they fail**

Run: `node --test src/tests/domain-profile.test.js src/tests/student-identity.test.js`

Expected: FAIL because profiles and snapshots still contain legacy inline skill fields and standalone `{ normal, burst }` level maps instead of a selected group reference.

- [x] **Step 3: Implement the v3 profile migration**

Set `PROFILE_SCHEMA_VERSION` and `BATTLE_SNAPSHOT_VERSION` to `3`. New and recruited students must receive `skillGroupId: template.skillGroupId` and `skillGroupLevels: { [template.skillGroupId]: { normal: 1, burst: 1 } }`. During migration, map legacy inline skills to the template's stable group ID and move legacy `{ normal, burst }` levels into that group's entry. Preserve any already-v3 group records, reject an unknown group ID, and do not mutate legacy inputs.

Make each battle snapshot include a deep clone of the full `skillGroups` catalogue and include only each team's `skillGroupId` and `skillGroupLevels`; no snapshot may retain `skills` or `skillLevels` fields. Pass `snapshot.skillGroups` into `CombatEngine` in the test helper.

- [x] **Step 4: Run the domain tests to verify they pass**

Run: `node --test src/tests/domain-profile.test.js src/tests/student-identity.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/profile.js src/domain/progression.js src/domain/snapshot.js src/tests/domain-profile.test.js src/tests/student-identity.test.js
git commit -m "feat: persist skill group selections in profiles"
```

### Task 4: Validate API Contracts and Stored Profiles

**Files:**
- Modify: `shared/contracts/v1.js:27-35,203-217,250-285`
- Modify: `server/services/profile-service.js:51-72,130-146`
- Test: `server/tests/profile.test.js`

- [x] **Step 1: Write failing API validation tests**

```js
const invalidGroup = structuredClone(profile);
invalidGroup.students.planner.skillGroupId = "missing";
await assert.rejects(() => service.update(accountId, invalidGroup), { code: "INVALID_PROFILE" });

const invalidLevels = structuredClone(profile);
delete invalidLevels.students.planner.skillGroupLevels.planner.burst;
await assert.rejects(() => service.update(accountId, invalidLevels), { code: "INVALID_PROFILE" });
```

- [x] **Step 2: Run the server profile test to verify it fails**

Run: `node --test server/tests/profile.test.js`

Expected: FAIL because validation requires the retired fields and does not validate a catalogue reference.

- [x] **Step 3: Define and validate the v3 shape**

Replace `skillLevelMap` in profile-v3 student schemas with `skillGroupLevels`, an object whose additional property is a map requiring positive-integer `normal` and `burst`. Require non-empty `skillGroupId`. Preserve v1/v2 schemas for historical payloads; export explicit v3 DTO constants rather than changing old schema constants in place.

In `validateStudent`, import `SKILL_GROUPS`, require an existing `student.skillGroupId`, require exactly one `{ normal, burst }` record for that selected group, and reject retired `skills` and `skillLevels` keys. In `mergeUpdate`, treat `skillGroupId` and `skillGroupLevels` as server-managed progression fields beside abilities.

- [x] **Step 4: Run the server profile test to verify it passes**

Run: `node --test server/tests/profile.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/contracts/v1.js server/services/profile-service.js server/tests/profile.test.js
git commit -m "feat: validate skill group profile records"
```

### Task 5: Show Student Skill Groups by Actor, Not Position

**Files:**
- Modify: `src/app/main.js:77-167`
- Test: `src/tests/page-audit.test.js`

- [x] **Step 1: Write the failing UI audit**

```js
assert.match(source, /skillGroupId/);
assert.match(source, /topic\.skill/);
assert.doesNotMatch(source, /data\.skills\[/);
```

- [x] **Step 2: Run the UI audit to verify it fails**

Run: `node --test src/tests/page-audit.test.js`

Expected: FAIL because rendering selects legacy `data.skills` from a slot's student data and topic actions are labelled as a generic attack instead of using the actor's configured skill metadata.

- [x] **Step 3: Render resolved group and topic skill metadata**

```js
function currentStudentSkill(studentData, runtimeStudent) {
  const group = skillGroups[studentData.skillGroupId];
  return group.skills[runtimeStudent.focus >= level.focusMax ? "burst" : "normal"];
}

const actorSkill = studentById[action.actor]
  ? currentStudentSkill(studentById[action.actor], combat.students[action.actor])
  : topicById[action.actor]?.skill;
```

Use the group name beside the student skill in the skill panel. For topic actions, render `action.skillName` and state that it is a topic skill; do not infer topic attacks from a missing name. Keep A/B slot labels solely as board locations.

- [x] **Step 4: Run the UI audit to verify it passes**

Run: `node --test src/tests/page-audit.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/main.js src/tests/page-audit.test.js
git commit -m "feat: display student groups and topic skills"
```

### Task 6: Update Documentation and Verify the Release

**Files:**
- Modify: `docs/GAME_DESIGN.md:78-114,203-253,321-361,600-612`
- Modify: `README.md:7-19,105-113`

- [x] **Step 1: Update the design rules**

Replace the statement that every student has only two inline skills with: every student selects exactly one personal skill group; each group contains a normal and burst skill; a student's group is independent of A1/A2/A3; future content may add groups without changing the student schema. Document topic `skill` data, `energyDamage` effect, target rules, and the formula `round(baseDamage × damageMultiplier + flatBonus)`.

- [x] **Step 2: Update the project README**

Add current-feature bullets for extensible student skill groups and configured topic skills. Amend the design principles to state that positions decide turn order/targeting only, never skills.

- [x] **Step 3: Run full checks**

Run: `npm run check`

Expected: PASS with all client and server test groups plus syntax checks passing.

- [x] **Step 4: Perform a deterministic smoke check**

Run: `node --input-type=module -e 'import { CombatEngine } from "./src/combat/engine.js"; import { serializeEvents } from "./src/combat/events.js"; const a = new CombatEngine({ seed: "skill-groups" }).run(); const b = new CombatEngine({ seed: "skill-groups" }).run(); if (serializeEvents(a.events) !== serializeEvents(b.events)) throw new Error("non-deterministic events"); console.log(a.events.filter((e) => e.type === "action" && String(e.actor).includes("treeKnapsack")).map((e) => e.skillName).join(","));'`

Expected: prints `递归压力` and exits 0.

- [ ] **Step 5: Commit**

```bash
git add docs/GAME_DESIGN.md README.md
git commit -m "docs: document skill groups and topic skills"
```

## Self-Review

- Spec coverage: Task 1 and Task 3 make normal/burst a single extensible group and assign each person a group; Task 2 makes the engine use the actor's group independent of position; Tasks 1 and 2 add and execute topic skills; Task 5 exposes both in the browser; Tasks 3 and 4 preserve persistent data integrity; Task 6 updates documentation and verifies deterministic behavior.
- Placeholder scan: no `TBD`, `TODO`, “implement later”, or unspecified test steps remain.
- Type consistency: `skillGroupId`, `skillGroupLevels`, `SKILL_GROUPS`, `topic.skill`, `effectType`, and `damageMultiplier` use the same names across content, engine, profile, contract, UI, and tests.
