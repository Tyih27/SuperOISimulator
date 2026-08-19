# Task 4 Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure account registration, password login, authenticated session lookup, and logout to the Fastify API.

**Architecture:** Keep SQL in an account repository, password and token policy in an auth service, and HTTP validation/cookie behavior in an auth route plugin. Persist Argon2id password hashes and SHA-256 hashes of random session tokens; authenticate requests through an HttpOnly same-origin cookie.

**Tech Stack:** Node.js ESM, Fastify 5, PostgreSQL 16, Argon2id, `@fastify/cookie`, `@fastify/rate-limit`, `node:assert/strict`.

---

### Task 1: Authentication persistence and behavior

**Files:**
- Create: `server/repositories/account-repository.js`
- Create: `server/services/auth-service.js`
- Create: `server/routes/auth.js`
- Create: `server/tests/auth.test.js`
- Modify: `server/migrations/001_initial.sql`
- Modify: `server/app.js`
- Modify: `shared/contracts/v1.js`
- Modify: `package.json`

- [x] **Step 1: Write failing API tests**

Test username/password validation, registration, duplicate usernames, wrong-password login, session lookup, logout revocation, cookie flags, Origin rejection, rate limiting, and absence of plaintext passwords in PostgreSQL.

- [x] **Step 2: Run the focused test and verify failure**

Run: `node server/tests/auth.test.js`

Expected: failure because the authentication routes are not registered.

- [x] **Step 3: Implement the authentication stack**

Add an `account_sessions` table with token hash, expiry, and revocation timestamps. Implement transactional account creation, Argon2id verification, random session issuance, cookie authentication, logout revocation, input validation, same-origin checks, and route-specific rate limits.

- [x] **Step 4: Run focused and full verification**

Run: `npm run test:api && npm run check`

Expected: health and authentication API tests pass, followed by all existing unit and syntax checks.
