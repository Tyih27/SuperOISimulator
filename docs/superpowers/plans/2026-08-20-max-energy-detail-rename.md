# Max Energy Card and Detail Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each student's maximum energy on roster cards and move student renaming into the student detail view.

**Architecture:** Keep profile persistence in the existing router `PUT /profile` flow. The roster card becomes read-only for identity and exposes only the detail action; the detail overlay owns the name input and save/cancel actions for the selected student.

**Tech Stack:** Native ES modules, template-string HTML, delegated DOM events, existing CSS tokens and Node source-level tests.

---

### Task 1: Update student card and detail markup

**Files:**
- Modify: `src/app/progression.js`

- [x] Remove the inline card rename controls and render a `最大精力` metric on every roster card.
- [x] Add a detail-view rename form with the selected student's current name, `maxlength="12"`, save, and cancel controls.
- [x] Keep detail summary maximum energy and all existing skill/ability content intact.

### Task 2: Move rename state and actions into the detail workflow

**Files:**
- Modify: `src/app/router.js`
- Modify: `styles/base.css`

- [x] Use the selected detail student as the only rename target; remove card edit/cancel branches and clear stale rename state on navigation/logout.
- [x] Handle detail rename save/cancel actions and Enter submission while preserving the existing profile update request and error handling.
- [x] Style the detail rename form responsively and keep focus-visible controls accessible.

### Task 3: Verify the UI contract

**Files:**
- Modify: `src/tests/page-audit.test.js`

- [x] Assert cards contain `最大精力`, detail markup contains the rename controls, and card-level edit controls are absent.
- [x] Run focused source checks and the page audit test.
