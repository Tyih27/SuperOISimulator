# Default Ordinary Aptitude Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize every newly created student with the ordinary aptitude.

**Architecture:** Keep the full aptitude range configuration and v1 migration selection unchanged. Replace technical template defaults with ordinary aptitude so deterministic profile creation generates all five initial abilities from ordinary ranges.

**Tech Stack:** ECMAScript modules, Node.js built-in assertions.

---

### Task 1: Verify default profiles

**Files:**
- Modify: `src/tests/student-identity.test.js`
- Modify: `src/tests/domain-profile.test.js`

- [x] **Step 1: Assert that every student in a newly created profile has ordinary aptitude.**

```js
assert.ok(Object.values(profile.students).every(({ aptitude }) => aptitude === "普通"));
```

- [x] **Step 2: Run the affected tests after the default change; the assertions pass.**

### Task 2: Set ordinary creation defaults

**Files:**
- Modify: `src/data.js`
- Modify: `docs/GAME_DESIGN.md`

- [x] **Step 1: Set each technical template's `defaultAptitude` to `"普通"`.**

```js
{ id: "planner", defaultAptitude: "普通", skillGroupId: "planner" }
```

- [x] **Step 2: Update the design documentation so the initial six-student roster starts ordinary.**

- [x] **Step 3: Run `npm run check`; all tests and syntax checks pass.**
