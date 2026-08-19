# Task 9 Profile Migration and Account Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate legacy persisted profiles to the current schema and provide authenticated export, password change, account deletion, and append-only audit records.

**Architecture:** Keep migration pure and deterministic in `server/services/profile-migration.js`, invoke it at profile read/update boundaries, and expose account controls through authenticated Fastify routes. Record only action metadata and payload hashes in PostgreSQL; never persist passwords or sensitive secrets in audit payloads.

**Tech Stack:** Node.js ESM, Fastify, PostgreSQL/`pg`, Argon2id, built-in test runner, Playwright.

---

### Task 1: Profile migration

**Files:** `server/services/profile-migration.js`, `server/tests/profile-migration.test.js`, `server/services/profile-service.js`

- [x] Add tests for v1/v2 to current migration, stable IDs, custom/generated names, aptitude and ability defaults, valid formation, and non-mutation.
- [x] Implement a pure `migrateProfile` with current schema version and deterministic identity defaults.
- [x] Apply migration before validation and persistence, then run focused tests.

### Task 2: Audit persistence and account controls

**Files:** `server/migrations/005_audit.sql`, `server/repositories/account-repository.js`, `server/routes/account-data.js`, `server/app.js`, API tests

- [x] Add append-only audit table and repository helper storing account, action, hash, timestamp.
- [x] Add export, password change, and deletion endpoints with session authorization and transaction boundaries.
- [x] Add audit calls for profile/progression/battle mutations and verify no password material is logged.

### Task 3: Browser recovery flow and operations docs

**Files:** `src/app/auth.js`, `e2e/single-player.spec.js`, `docs/OPERATIONS.md`, `README.md`, `package.json`

- [x] Add authenticated account actions and export/download handling to the UI.
- [x] Extend browser coverage for export, password change, reload, and logout/delete behavior.
- [x] Document migration, retention, backup, restore, and operational recovery; run full checks.
