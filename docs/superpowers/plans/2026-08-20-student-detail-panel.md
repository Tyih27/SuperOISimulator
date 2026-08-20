# Student Detail Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players open a large centered student detail card from formation views and inspect identity, all ability values, skill-group progression, and normal/burst skill details.

**Architecture:** Keep the existing server-rendered client architecture. `progression.js` will render the reusable detail dialog markup from a selected student, while `router.js` owns selected-student state and delegated click/keyboard behavior. CSS will provide a centered overlay/card with responsive sections and focus-visible states; arena and roster cards will expose the same detail action.

**Tech Stack:** Native ES modules, template-string HTML, delegated DOM events, existing CSS custom properties, Node test scripts.

---

### Task 1: Define the detail panel view model and markup

**Files:**
- Modify: `src/app/progression.js`

- [ ] **Step 1: Add skill metadata helpers**

  Import `SKILL_GROUPS`, resolve a student's selected group, and expose normal/burst skill records plus their level values with safe fallbacks.

- [ ] **Step 2: Render the centered detail dialog**

  Add `renderStudentDetail({ student, onClose })` output using `<dialog>` semantics, a close button, identity summary, five ability values, energy, skill-group name, normal/burst levels, skill names, categories, target rules, and descriptions derived from the catalogue.

- [ ] **Step 3: Add detail triggers to formation cards**

  Add a button with `data-student-detail` to each roster card and student-choice row without changing selection checkbox behavior.

### Task 2: Wire selection, dismissal, and keyboard behavior

**Files:**
- Modify: `src/app/router.js`

- [ ] **Step 1: Track the selected student**

  Add `detailStudentId` to router state and pass the corresponding profile student to `renderStudentDetail` when rendering the roster route.

- [ ] **Step 2: Handle delegated open/close actions**

  Handle `[data-student-detail]`, `close-student-detail`, backdrop clicks, and Escape. Re-render after state changes and prevent a detail click from toggling formation selection.

- [ ] **Step 3: Preserve state across profile refreshes**

  Clear the selected ID after logout or when the selected student no longer exists after profile reload.

### Task 3: Style the panel and test the contract

**Files:**
- Modify: `styles/base.css`
- Modify: `src/tests/page-audit.test.js`

- [ ] **Step 1: Add responsive dialog styles**

  Use the existing surface, line, ink, muted, gold, and wash variables for a large centered card, dimmed backdrop, two-column detail sections, skill cards, and mobile single-column layout.

- [ ] **Step 2: Add source-level regression assertions**

  Assert the detail trigger, dialog markup, skill details, and close behavior remain present.

- [ ] **Step 3: Run focused verification**

  Run `npm run test:task6`, `node --check src/app/progression.js`, and `node --check src/app/router.js`; verify a rendered default roster contains the detail trigger and catalogue skill names.

