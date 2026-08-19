# Authenticated Single-Player Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing server-authoritative campaign playable in a browser through account, campaign, roster, progression, and replay screens.

**Architecture:** The browser holds only transient view state such as the current route and a pending formation. `src/api/client.js` is the single transport boundary; every durable profile, currency, inventory, battle result, and session state is read from or mutated through the v1 API. The authenticated application is rendered in `#app`; combat snapshots and event logs come from the server-authoritative battle endpoints.

**Tech Stack:** Browser-native ES modules, Fetch API, Fastify v1 API, Node `assert/strict`, Playwright.

---

### Task 1: API Client

**Files:**
- Create: `src/api/client.js`, `src/tests/api-client.test.js`
- Modify: `package.json`

- [x] **Step 1: Test JSON request construction, empty responses, and structured HTTP errors.**

```js
const client = createApiClient({ fetchImpl });
await client.post("/auth/login", { username: "alice01", password: "correct horse battery" });
assert.equal(request.credentials, "same-origin");
await assert.rejects(() => client.get("/profile"), (error) => error.status === 401);
```

- [x] **Step 2: Implement `ApiError`, `api`, and `createApiClient`.**

- [x] **Step 3: Run `node src/tests/api-client.test.js`; expect `api client tests passed`.**

### Task 2: Authenticated Application

**Files:**
- Create: `src/app/auth.js`, `src/app/router.js`, `src/app/campaign.js`, `src/app/progression.js`
- Modify: `index.html`, `src/app/main.js`, `styles/base.css`

- [x] **Step 1: Add a login/register screen and restore an existing signed-cookie session with `GET /auth/session`.**

- [x] **Step 2: Render hash-routed campaign, roster, and progression screens from the server profile.**

- [x] **Step 3: Send profile renames and formations through `PUT /profile`, and training, shop, recruitment through their dedicated progression endpoints.**

- [x] **Step 4: Start battles with exactly three distinct persisted placements, then settle and replay only the server-returned event log and reward.**

### Task 3: Browser Acceptance

**Files:**
- Create: `e2e/single-player.spec.js`, `e2e/serve.mjs`, `playwright.config.js`
- Modify: `package.json`, `docs/superpowers/plans/2026-08-19-project-completion.md`

- [x] **Step 1: Route the API in Playwright and verify registration, campaign selection, formation persistence, battle settlement, reload, training, and logout.**

- [x] **Step 2: Add desktop and 375px projects and assert the document does not horizontally overflow.**

- [x] **Step 3: Run `npm run check` and `npm run test:e2e`; both desktop and 375px projects pass.**
