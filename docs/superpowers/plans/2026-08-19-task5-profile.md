# Task 5 Profile Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist versioned player profiles for authenticated accounts, including six deterministic student identities, formation, inventory, currencies, tickets, and optimistic-concurrency updates.

**Architecture:** Store the complete validated profile payload as JSONB in a one-row-per-account table. A profile service owns defaults, DTO validation, rename constraints, authentication context, row locking, and exact version increments; a repository owns SQL. Fastify routes expose GET/PUT behind the existing signed session cookie.

**Tech Stack:** Node.js ES modules, Fastify, PostgreSQL/pg, existing domain identity helpers, JSON Schema DTOs, node:test assertions.

---

### Task 1: Define persisted profile contract and migration

**Files:**
- Modify: `src/domain/profile.js`
- Modify: `shared/contracts/v1.js`
- Create: `server/migrations/002_profiles.sql`

- [x] Add default profile fields for inventory, training coins, recruitment tickets, and one unlocked campaign level while retaining deterministic six-student identity generation.
- [x] Add a strict v2 profile DTO and update validation constants for names, aptitudes, abilities, formation, and persistence metadata.
- [x] Create `player_profiles(account_id, version, payload, updated_at)` with a foreign key and JSONB payload.

### Task 2: Implement repository and transactional service

**Files:**
- Create: `server/repositories/profile-repository.js`
- Create: `server/services/profile-service.js`

- [x] Read or initialize a profile for an account, using a deterministic account seed and the six content students.
- [x] Validate incoming profile updates, ownership, names (1-12 visible characters), aptitude ranges, inventory/currency values, and exactly three distinct formation members.
- [x] Lock the row with `FOR UPDATE`, compare the submitted version, increment once, and return the complete saved profile; map stale writes to a 409 service error.

### Task 3: Add authenticated profile routes and integration tests

**Files:**
- Create: `server/routes/profile.js`
- Modify: `server/app.js`
- Create: `server/tests/profile.test.js`
- Modify: `package.json`

- [x] Require the existing signed session cookie, expose `GET /api/v1/profile` and `PUT /api/v1/profile`, and return stable error DTOs.
- [x] Test default initialization, authenticated round-trip, rename preservation, cross-account isolation, and optimistic-version conflict.
- [x] Include profile API tests in `test:api` and syntax checks.

### Task 4: Verify and update project status

- [x] Run profile tests, API tests, and the full existing test suite.
- [x] Update README and the completion plan to record Task 5 completion and identify Task 6 as next.
