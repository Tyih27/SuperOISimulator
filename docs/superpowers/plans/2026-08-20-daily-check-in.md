# Daily Check-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a once-per-day check-in action that grants 1,000 training coins to the authenticated player.

**Architecture:** Store one claim row per account and UTC calendar day with a database uniqueness constraint. Execute the claim, profile currency mutation, ledger entry, and audit record inside the existing `ProgressionService.withProfile` transaction. Expose a protected progression endpoint and render a button on the existing progression screen.

**Tech Stack:** Node.js, Fastify, PostgreSQL migrations, vanilla browser JavaScript, Node test runner.

---

### Task 1: Persist daily claims

**Files:**
- Create: `server/migrations/007_daily_checkins.sql`
- Modify: `server/repositories/ledger-repository.js`

- [x] **Step 1: Add the unique claim table**

Create `daily_checkins` with `(account_id, claim_period)` as the primary key and a foreign key to `accounts`.

- [x] **Step 2: Add an idempotent claim repository method**

Add `claimDailyCheckIn(client, { accountId, claimPeriod })` using `INSERT ... ON CONFLICT DO NOTHING RETURNING claim_period`, returning a boolean.

### Task 2: Implement the progression action and API

**Files:**
- Modify: `server/services/progression-service.js`
- Modify: `server/routes/progression.js`
- Test: `server/tests/progression.test.js`

- [x] **Step 1: Write API assertions**

Assert the first `POST /api/v1/progression/daily-check-in` returns 1,000 training coins and updates the profile, the same-day second request returns `409 DAILY_CHECK_IN_ALREADY_CLAIMED`, and a next-day request succeeds when the service clock advances.

- [x] **Step 2: Implement `claimDailyCheckIn`**

Use the existing `dailyPeriod` helper and injected `now` clock. Claim the period row, add 1,000 `trainingCoins`, write a positive currency ledger entry with source type `daily-check-in`, and return the reward plus profile.

- [x] **Step 3: Register the protected route**

Add `POST /daily-check-in` with the same-origin and authenticated prehandlers and an empty object schema.

### Task 3: Add the client workflow

**Files:**
- Modify: `src/app/progression.js`
- Modify: `src/app/router.js`
- Test: `src/tests/page-audit.test.js`

- [x] **Step 1: Render the check-in control**

Add a dedicated check-in section to the progression resource area with a `data-action="daily-check-in"` button and status text.

- [x] **Step 2: Wire the action to the API**

Add a router handler that posts to `/progression/daily-check-in`, replaces the current profile from the response, and reports success or the server's already-claimed message.

- [x] **Step 3: Extend the page audit**

Assert the progression renderer contains the daily check-in action and reward text.

### Task 4: Verify

- [x] Run `node server/tests/progression.test.js`.
- [x] Run `node src/tests/page-audit.test.js`.
- [x] Run `npm test` and report any environment-dependent failures.
