# Super OI Simulator Project Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a deployable Super OI Simulator with three-student formations from an unlimited roster, randomly named and player-renamable students with aptitude-based per-type ability ranges, account/password login, cloud saves, single-player progression, and a deterministic asynchronous arena.

**Architecture:** Preserve the existing browser-native ESM combat client and its deterministic `CombatEngine`. Add a Node.js ESM Fastify API with PostgreSQL as the authority for accounts, persistent player state, rewards, and arena settlement; share only versioned JSON contracts and the combat kernel, never browser state. Release the single-player vertical slice first, then reuse versioned battle snapshots and event logs for the asynchronous arena.

**Tech Stack:** Browser-native HTML/CSS/ES modules, Node.js 22 ESM, Fastify, PostgreSQL 16, `pg`, Argon2id, signed HttpOnly cookie sessions, Playwright, `node:assert/strict`, Docker Compose, GitHub Actions.

---

## Delivery Boundaries

- **Release 1 - single-player vertical slice:** registration/login, cloud save, unlimited owned-student roster, exactly three battle slots, randomly generated and player-renamable students with aptitude and independent per-type abilities, 3-5 campaign levels, rewards, specialist training, inventory, basic shop, recruitment, and browser end-to-end coverage.
- **Release 2 - asynchronous arena:** defensive formations, opponent discovery, server-authoritative mirrored battles, rating, leaderboard, season rewards, versioned replay records, and anti-tamper validation.
- The implementation must not add real-time matches, friend rooms, equipment, talent trees, random events, idle income, or relationship systems. These remain explicitly outside the release definition in `docs/GAME_DESIGN.md`.

## File Structure

| Path | Responsibility |
| --- | --- |
| `src/combat/` | Deterministic, browser/server-shared combat kernel and versioned replay serialization. |
| `src/domain/` | Pure account, roster, inventory, training, reward, and campaign rules. No DOM or SQL. |
| `src/api/` | Browser client for authenticated API requests and DTO validation. |
| `src/app/` | Screen state, navigation, formation editor, battle playback, and rendering. |
| `server/app.js` | Fastify application composition; no business rules in route files. |
| `server/routes/` | HTTP validation, authorization and status mapping. |
| `server/services/` | Transactional account, campaign, battle, and arena use cases. |
| `server/repositories/` | SQL-only persistence operations over PostgreSQL. |
| `server/migrations/` | Ordered, immutable PostgreSQL schema migrations. |
| `shared/contracts/` | Versioned request/response schemas used by server and browser. |
| `src/tests/`, `server/tests/`, `e2e/` | Unit, API integration, deterministic replay, and browser acceptance tests. |

## Task 1: Lock the Existing Combat Contract and Add Formation Editing

**Files:**
- Create: `src/app/formation.js`, `src/tests/formation.test.js`
- Modify: `index.html`, `styles/base.css`, `src/app/main.js`, `src/tests/page-audit.test.js`

- [x] **Step 1: Write formation controller tests before UI work.**

```js
import assert from "node:assert/strict";
import { FormationController } from "../app/formation.js";

const controller = new FormationController(["planner", "graphist", "structurer", "mathematician"]);
controller.toggle("mathematician");
assert.deepEqual(controller.selectedIds, ["planner", "graphist", "structurer"]);
assert.equal(controller.error, "每场只能选择 3 名学生");
controller.replace("planner", "mathematician");
assert.deepEqual(controller.positions, { A1: "mathematician", A2: "graphist", A3: "structurer" });
```

- [x] **Step 2: Run `node src/tests/formation.test.js`; verify the controller contract.**

- [x] **Step 3: Implement the pure controller and render it before combat starts.**

```js
export class FormationController {
  constructor(roster, positions = { A1: roster[0], A2: roster[1], A3: roster[2] }) {
    this.roster = [...roster];
    this.positions = { ...positions };
    this.error = null;
  }
  get selectedIds() { return Object.values(this.positions); }
  toggle(studentId) {
    if (!this.roster.includes(studentId)) throw new Error("Unknown student");
    if (this.selectedIds.includes(studentId)) return this.replace(studentId, null);
    const openSlot = ["A1", "A2", "A3"].find((slot) => !this.positions[slot]);
    if (!openSlot) { this.error = "每场只能选择 3 名学生"; return false; }
    this.positions[openSlot] = studentId;
    this.error = null;
    return true;
  }
  replace(outgoingId, incomingId) {
    const slot = Object.entries(this.positions).find(([, id]) => id === outgoingId)?.[0];
    if (!slot || (incomingId && (!this.roster.includes(incomingId) || this.selectedIds.includes(incomingId)))) return false;
    this.positions[slot] = incomingId;
    this.error = null;
    return true;
  }
}
```

Add a roster panel with accessible checkboxes, three fixed A-slot selectors, and a visible `3 / 3` count. On confirm, call the existing `playback.setFormation({ teamIds, positions })`; disable combat controls until the three unique slots are valid.

- [x] **Step 4: Extend the page audit and run `npm run check`.**

- [x] **Step 5: Complete the formation editor implementation.**

```bash
git add index.html styles/base.css src/app/formation.js src/app/main.js src/tests/formation.test.js src/tests/page-audit.test.js
git commit -m "feat: add three-student formation editor"
```

## Task 2: Define Versioned Domain Models and Battle Snapshots

**Files:**
- Create: `src/domain/profile.js`, `src/domain/snapshot.js`, `src/tests/domain-profile.test.js`, `shared/contracts/v1.js`
- Modify: `src/data.js`, `src/combat/events.js`, `package.json`

- [x] **Step 1: Write domain tests for an unlimited roster and immutable battle input.**

```js
const profile = createProfile({ accountId: "acc-1", studentIds: ["planner", "graphist", "structurer", "mathematician"] });
const snapshot = createBattleSnapshot(profile, { levelId: "chapter-1-1", teamIds: ["planner", "graphist", "structurer"] });
assert.equal(snapshot.team.length, 3);
assert.throws(() => createBattleSnapshot(profile, { teamIds: ["planner", "graphist", "structurer", "mathematician"] }), /exactly three/);
assert.notEqual(snapshot.team[0].abilities, profile.students.planner.abilities);
```

- [x] **Step 2: Run `node src/tests/domain-profile.test.js`; verify profile and snapshot behavior.**

- [x] **Step 3: Implement versioned profile, snapshot, and DTO contracts.**

```js
export const PROFILE_SCHEMA_VERSION = 1;
export function createBattleSnapshot(profile, selection) {
  if (selection.teamIds.length !== 3 || new Set(selection.teamIds).size !== 3) throw new Error("Battle team must contain exactly three different students");
  return structuredClone({ engineVersion: "1", profileVersion: profile.version, ...selection });
}
```

The snapshot must contain only selected students, their effective persistent stats, selected skill-group references and levels, the immutable skill-group catalogue, level data (including topic skills), formation, seed, ruleset version, and timestamp. Add `engineVersion` and `rulesetVersion` to every serialized result without changing event order.

- [x] **Step 4: Run `npm test` and verify deterministic replay tests still pass.**

- [x] **Step 5: Complete the versioned domain model implementation.**

```bash
git add src/domain src/data.js src/combat/events.js shared/contracts/v1.js package.json
git commit -m "feat: add versioned profile and battle snapshot contracts"
```

## Follow-up: Student Identity Redesign

This is new work after the completed domain-model Task 2. It must not rewrite that task's acceptance record or claim that the existing v1 profile already supports the new behavior.

**Files:**
- Create: `src/domain/student-identity.js`, `src/tests/student-identity.test.js`
- Modify: `src/data.js`, `src/domain/profile.js`, `src/domain/snapshot.js`, `shared/contracts/v1.js`, `src/tests/domain-profile.test.js`, `package.json`

- [x] **Step 1: Write migration and behavior tests.**

Cover deterministic generation from a versioned name pool and stored seed; player rename after trimming and validating 1～12 visible characters; preservation of stable ID, aptitude, abilities, skill-group reference and levels, formation, and profile ownership after rename; and immutability of an already-created battle snapshot.

- [x] **Step 2: Version the student identity model.**

Replace static role-like display labels with generated player-facing names. Persist each student's `name`, `aptitude`, and independent five-type initial abilities in the profile. Add configurable aptitude-by-type ranges and versioned name pools. Keep existing technical IDs solely for compatibility and never display them as student classes.

The existing v1 DTO requires a `role` in battle snapshots, so introduce a new contract and profile schema version rather than silently changing v1. Provide a deterministic migration from v1 profiles: retain existing technical IDs and ability values, assign an aptitude compatible with the data, and generate a name only when a legacy custom name is absent.

- [x] **Step 3: Build battle snapshots from persistent identity data.**

The new snapshot version includes stable ID, current player-visible name, aptitude, abilities, skill-group reference and levels, the immutable skill-group catalogue, ruleset version, and name-pool version. A later rename must not mutate an existing snapshot or historical event log.

- [x] **Step 4: Run `npm test && npm run check`.**

Verify legacy profile migration, generated-name reproducibility, rename validation, unchanged combat outcome after a rename, and byte-identical event serialization for the same snapshot and seed.

## Task 3: Add PostgreSQL, Migrations, and an Isolated API Test Harness

**Files:**
- Create: `docker-compose.yml`, `.env.example`, `server/app.js`, `server/db.js`, `server/migrations/001_initial.sql`, `server/tests/helpers.js`, `server/tests/health.test.js`
- Modify: `package.json`, `.gitignore`, `.github/workflows/check.yml`

- [x] **Step 1: Write an API integration test that starts the app against `DATABASE_URL` and checks health.**

```js
const app = await buildTestApp();
const response = await app.inject({ method: "GET", url: "/health" });
assert.deepEqual(response.json(), { status: "ok" });
await app.close();
```

- [x] **Step 2: Run `node server/tests/health.test.js`; expect failure because `buildTestApp` does not exist.**

- [x] **Step 3: Implement the server foundation and migration runner.**

```sql
CREATE TABLE schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE accounts (
  id uuid PRIMARY KEY, username text NOT NULL UNIQUE,
  password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
```

`docker-compose.yml` must expose PostgreSQL only on localhost, create database `super_oi`, and use values from `.env`. `server/app.js` must receive its pool and configuration as parameters so tests never use production configuration.

- [x] **Step 4: Run migrations in a disposable database, then run `npm run test:api`. Expected: `health API test passed`.**

- [x] **Step 5: Complete the PostgreSQL API foundation implementation.**

```bash
git add docker-compose.yml .env.example .gitignore package.json server .github/workflows/check.yml
git commit -m "feat: add PostgreSQL API foundation"
```

## Task 4: Implement Secure Registration, Password Login, and Logout

**Files:**
- Create: `server/routes/auth.js`, `server/services/auth-service.js`, `server/repositories/account-repository.js`, `server/tests/auth.test.js`
- Modify: `server/app.js`, `server/migrations/001_initial.sql`, `shared/contracts/v1.js`

- [x] **Step 1: Write tests for registration, duplicate usernames, session authentication, and logout.**

```js
const registered = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { username: "alice01", password: "correct horse battery" } });
assert.equal(registered.statusCode, 201);
assert.ok(registered.cookies.find(({ name }) => name === "sid"));
assert.equal((await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { username: "alice01", password: "wrong" } })).statusCode, 401);
```

- [x] **Step 2: Run `node server/tests/auth.test.js`; expect failure because the auth routes do not exist.**

- [x] **Step 3: Implement password and session handling.**

```js
const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
reply.setCookie("sid", sessionToken, { httpOnly: true, secure: config.isProduction, sameSite: "lax", path: "/" });
```

Reject usernames outside `[a-zA-Z0-9_]{3,24}` and passwords shorter than 12 characters. Store only Argon2id hashes and SHA-256 hashes of random session tokens. Add session expiry, logout revocation, rate limiting on auth routes, and same-origin checks for mutating cookie-authenticated requests.

- [x] **Step 4: Run `npm run test:api`; verify the database contains no submitted plaintext password and all four auth cases pass.**

- [x] **Step 5: Complete the authentication implementation.**

```bash
git add server/routes/auth.js server/services/auth-service.js server/repositories/account-repository.js server/tests/auth.test.js server/app.js server/migrations/001_initial.sql shared/contracts/v1.js
git commit -m "feat: add password login and sessions"
```

## Task 5: Persist Player Profiles, Inventory, and Cloud Saves

**Files:**
- Create: `server/routes/profile.js`, `server/services/profile-service.js`, `server/repositories/profile-repository.js`, `server/migrations/002_profiles.sql`, `server/tests/profile.test.js`
- Modify: `src/domain/profile.js`, `shared/contracts/v1.js`, `server/app.js`

- [x] **Step 1: Write an authenticated round-trip and optimistic-version-conflict test.**

```js
const saved = await request.put("/api/v1/profile", { version: 1, formation: { A1: "planner", A2: "graphist", A3: "structurer" } });
assert.equal(saved.statusCode, 200);
assert.equal((await request.put("/api/v1/profile", { version: 1, formation: saved.json().formation })).statusCode, 409);
```

- [x] **Step 2: Run `node server/tests/profile.test.js`; expect failure because profile endpoints do not exist.**

- [x] **Step 3: Add tables and transactional service methods.**

```sql
CREATE TABLE player_profiles (account_id uuid PRIMARY KEY REFERENCES accounts(id), version integer NOT NULL, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
```

Initialize a new profile with six students whose names are generated from a stored seed/name-pool version, each with an aptitude and independently configured five-type ability values, empty inventory, initial training coins and recruitment tickets, one unlocked campaign level, and a valid three-student formation. The profile API must allow a player to rename an owned student while preserving its stable ID and stats; after trimming, names must contain 1～12 visible characters. `PUT` must validate the DTO, including name and aptitude-range constraints, lock the row, compare `version`, increment it exactly once, and return the full saved profile.

- [x] **Step 4: Run `npm run test:api`; assert that a second fresh login reads the persisted profile and stale writes return HTTP 409.**

- [x] **Step 5: Commit.**

```bash
git add server/routes/profile.js server/services/profile-service.js server/repositories/profile-repository.js server/migrations/002_profiles.sql server/tests/profile.test.js src/domain/profile.js shared/contracts/v1.js server/app.js
git commit -m "feat: persist versioned player profiles"
```

## Task 6: Implement Campaign, Rewards, Specialist Training, Shop, and Recruitment

**Files:**
- Create: `src/domain/progression.js`, `server/routes/progression.js`, `server/services/progression-service.js`, `server/repositories/ledger-repository.js`, `server/migrations/003_progression.sql`, `server/tests/progression.test.js`
- Modify: `src/data.js`, `src/domain/snapshot.js`, `server/app.js`

- [x] **Step 1: Write tests for one-time settlement, specialist training cost, shop limits, and recruitment ownership.**

```js
assert.equal(applySpecialistTraining(profile, { studentId: "planner", ability: "dynamicProgramming" }).students.planner.abilities.dynamicProgramming, 840);
assert.throws(() => applySpecialistTraining({ ...profile, currencies: { trainingCoins: 0 } }, request), /training coins/);
assert.equal(await service.settleCampaignBattle(input).reward.trainingCoins, 100);
await assert.rejects(() => service.settleCampaignBattle(input), /already settled/);
```

- [x] **Step 2: Run `node server/tests/progression.test.js`; verify settlement, training, shop, and recruitment flows.**

- [x] **Step 3: Add immutable content and transactional ledgers.**

Define 3-5 levels in `src/data.js`, with ordered difficulty and both objective types. Also define the five ability keys, the aptitude-by-type initial ranges, and versioned name pools used by starter students and recruitment. Record every resource mutation in `currency_ledger` and every granted item in `inventory_entries`; enforce shop purchase limits with a unique `(account_id, offer_id, reset_period)` key. Specialist training is the only released stat upgrade: it consumes a named training book plus coins and adds a fixed ability increment.

- [x] **Step 4: Run `npm test && npm run test:api`; verify a completed battle cannot award resources twice and a roster can grow beyond six students while a battle request still allows exactly three.**

- [x] **Step 5: Complete the progression and economy implementation.**

```bash
git add src/domain/progression.js src/data.js src/domain/snapshot.js server/routes/progression.js server/services/progression-service.js server/repositories/ledger-repository.js server/migrations/003_progression.sql server/tests/progression.test.js server/app.js
git commit -m "feat: add campaign progression economy"
```

## Task 7: Make the Server Authoritative for Single-Player Battle Settlement

**Files:**
- Create: `server/routes/battles.js`, `server/services/battle-service.js`, `server/repositories/battle-repository.js`, `server/migrations/004_battles.sql`, `server/tests/battle-service.test.js`
- Modify: `src/combat/engine.js`, `src/combat/events.js`, `shared/contracts/v1.js`, `server/app.js`

- [x] **Step 1: Write tests that reject client-supplied rewards and accept only a server-created battle ID.**

```js
const started = await request.post("/api/v1/campaign/battles", { levelId: "chapter-1-1", teamIds: ["planner", "graphist", "structurer"], positions });
const settled = await request.post(`/api/v1/campaign/battles/${started.json().id}/settle`, {});
assert.equal(settled.json().eventLogHash, settled.json().recomputedEventLogHash);
assert.equal((await request.post(`/api/v1/campaign/battles/${started.json().id}/settle`, {})).statusCode, 409);
```

- [x] **Step 2: Run `node server/tests/battle-service.test.js`; expect failure because battle endpoints do not exist.**

- [x] **Step 3: Implement server-owned battle snapshots and settlement.**

```js
const result = new CombatEngine(snapshot).run();
await transaction(async (db) => saveBattleAndApplyReward(db, { snapshot, result, eventLogHash: sha256(serializeEvents(result.events)) }));
```

The browser may play the returned event list but never submits progress, victory, resources, or seed. Store `engineVersion`, `rulesetVersion`, full snapshot, ordered event log, and SHA-256 event-log hash in `battle_records`.

- [x] **Step 4: Run `npm run check && npm run test:api`; assert identical snapshots produce identical hashes and an account cannot settle another account's battle.**

- [x] **Step 5: Complete the authoritative battle settlement implementation.**

```bash
git add server/routes/battles.js server/services/battle-service.js server/repositories/battle-repository.js server/migrations/004_battles.sql server/tests/battle-service.test.js src/combat/engine.js src/combat/events.js shared/contracts/v1.js server/app.js
git commit -m "feat: add authoritative campaign battle settlement"
```

## Task 8: Build Account, Campaign, Roster, and Progression Screens

**Files:**
- Create: `src/api/client.js`, `src/app/router.js`, `src/app/auth.js`, `src/app/campaign.js`, `src/app/progression.js`, `src/tests/api-client.test.js`, `e2e/single-player.spec.js`
- Modify: `index.html`, `src/app/main.js`, `src/app/state.js`, `styles/base.css`, `package.json`

- [x] **Step 1: Write API-client and browser acceptance tests.**

```js
await page.goto("/");
await page.getByLabel("用户名").fill("alice01");
await page.getByLabel("密码").fill("correct horse battery");
await page.getByRole("button", { name: "注册并登录" }).click();
await page.getByRole("link", { name: "主线关卡" }).click();
await expect(page.getByText("第 1 章")).toBeVisible();
```

- [x] **Step 2: Run `npx playwright test e2e/single-player.spec.js`; confirm the new authenticated flow is covered.**

- [x] **Step 3: Implement screen routing and API ownership boundaries.**

```js
export async function api(path, options = {}) {
  const response = await fetch(`/api/v1${path}`, { credentials: "same-origin", headers: { "content-type": "application/json", ...options.headers }, ...options });
  if (!response.ok) throw new ApiError(response.status, await response.json());
  return response.status === 204 ? null : response.json();
}
```

Provide login/register, logout, campaign selection, roster management, three-slot formation editing, inventory, training, shop, recruitment, battle playback, and post-battle rewards. Render server profile data; do not use `localStorage` for credentials, sessions, currency, inventory, or battle rewards.

- [x] **Step 4: Run desktop and 375px Playwright projects. Expected: registration, training, formation selection, battle settlement, reload, and logout complete without horizontal scrolling.**

- [x] **Step 5: Verify with `npm run check && npm run test:e2e`.**

```bash
git add index.html styles/base.css src/api src/app src/tests/api-client.test.js e2e/single-player.spec.js package.json
git commit -m "feat: add authenticated single-player experience"
```

## Task 9: Add Data Migration, Recovery, and Operations Controls

**Files:**
- Create: `server/migrations/005_audit.sql`, `server/services/profile-migration.js`, `server/routes/account-data.js`, `server/tests/profile-migration.test.js`, `docs/OPERATIONS.md`
- Modify: `server/app.js`, `src/app/auth.js`, `e2e/single-player.spec.js`

- [x] **Step 1: Write migration tests from profile schema versions 1 and 2 to the current version.**

```js
const migrated = migrateProfile({ schemaVersion: 1, students: { planner: legacyStudent } });
assert.equal(migrated.schemaVersion, CURRENT_PROFILE_SCHEMA_VERSION);
assert.deepEqual(migrated.formation, { A1: "planner", A2: "graphist", A3: "structurer" });
```

- [x] **Step 2: Run `node server/tests/profile-migration.test.js`; verify deterministic migration behavior.**

- [x] **Step 3: Implement profile migration and account data controls.**

Expose authenticated export as JSON, password change requiring the current password, and account deletion that revokes sessions and queues deletion after a documented retention window. During migration, preserve stable technical IDs, retain existing custom names when present, and generate names from the documented versioned pool when legacy data lacks them; populate aptitude and per-type ability values from the documented ranges when legacy data lacks them. Append rename, reward, training, shop, recruitment, and battle settlement actions to an append-only audit table with account ID, action type, payload hash, and timestamp.

- [x] **Step 4: Run API tests and the Playwright export/reload scenario; verify migrated profiles remain playable and audit records do not contain password material.**

- [x] **Step 5: Complete the data migration, recovery, and operations controls implementation.**

```bash
git add server/migrations/005_audit.sql server/services/profile-migration.js server/routes/account-data.js server/tests/profile-migration.test.js server/app.js src/app/auth.js e2e/single-player.spec.js docs/OPERATIONS.md
git commit -m "feat: add profile migration and account recovery controls"
```

## Task 10: Build the Batch Simulator and Balance Gate

**Files:**
- Create: `scripts/simulate-formations.js`, `src/tests/balance-simulation.test.js`, `docs/BALANCE_BASELINE.md`
- Modify: `package.json`, `src/data.js`

- [x] **Step 1: Write a deterministic aggregate test.**

```js
const report = simulate({ levelId: "chapter-1-1", seeds: [1, 2, 3], rosterIds: starterIds });
assert.equal(report.formations, 20);
assert.equal(report.seeds, 3);
assert.ok(report.rows.every((row) => row.averageRounds > 0 && row.winRate >= 0 && row.winRate <= 1));
```

- [x] **Step 2: Run `node src/tests/balance-simulation.test.js`; expect failure because the simulator does not exist.**

- [x] **Step 3: Implement a CLI that enumerates combinations and all six slot permutations, runs fixed seeds, and emits JSON/CSV.**

```bash
node scripts/simulate-formations.js --level chapter-1-1 --seeds 1,2,3,4,5 --out reports/chapter-1-1.json
```

Report formation, positions, win rate, average rounds, average remaining energy, completed topics, and normal/burst skill counts. Commit a human-readable baseline for each campaign level and require review when a content change moves a baseline by more than 10 percentage points.

- [x] **Step 4: Run `npm run simulate:balance && npm test`; expected: reports are deterministic for the same input.**

- [x] **Step 5: Complete Task 10 implementation and verification.**

```bash
git add scripts/simulate-formations.js src/tests/balance-simulation.test.js docs/BALANCE_BASELINE.md package.json src/data.js
git commit -m "feat: add deterministic balance simulator"
```

## Task 11: Implement the Asynchronous Arena

**Files:**
- Create: `src/combat/arena-engine.js`, `server/routes/arena.js`, `server/services/arena-service.js`, `server/repositories/arena-repository.js`, `server/migrations/006_arena.sql`, `server/tests/arena.test.js`, `src/app/arena.js`, `e2e/arena.spec.js`
- Modify: `shared/contracts/v1.js`, `server/app.js`, `src/app/router.js`, `src/app/main.js`, `styles/base.css`

- [x] **Step 1: Write deterministic paired-battle tests for win, simultaneous completion tie-break, and round-limit score tie-break.**

```js
const result = runArena({ attackerSnapshot, defenderSnapshot, seed: "arena-1" });
assert.equal(result.attacker.eventsHash, runArena({ attackerSnapshot, defenderSnapshot, seed: "arena-1" }).attacker.eventsHash);
assert.ok(["attacker", "defender", "draw"].includes(result.winner));
```

- [x] **Step 2: Run `node server/tests/arena.test.js`; verify the deterministic arena contract.**

- [x] **Step 3: Implement synchronized A1/B1/A2/B2/A3/B3 resolution and server arena records.**

```js
for (const stage of STAGE_ORDER) {
  const intents = [attacker, defender].map((side) => side.createIntent(stage, sharedSnapshot));
  applyAtomically(intents);
  resolveArenaTerminalAfterStage();
}
```

Save immutable defensive formation snapshots, match seed, both combat snapshots, engine/ruleset versions, both ordered logs and hashes, rating before/after, and reward ledger IDs. Matchmaking must only expose accounts with a valid defensive formation and must never return mutable opponent profile data.

- [x] **Step 4: Add browser test: set defense, select an opponent, complete replay, verify rating update and read-only historical replay. Run `npm run test:api && npx playwright test e2e/arena.spec.js`.**

- [x] **Step 5: Complete Task 11 implementation and verification.**

```bash
git add src/combat/arena-engine.js server/routes/arena.js server/services/arena-service.js server/repositories/arena-repository.js server/migrations/006_arena.sql server/tests/arena.test.js src/app/arena.js e2e/arena.spec.js shared/contracts/v1.js server/app.js src/app/router.js src/app/main.js styles/base.css
git commit -m "feat: add asynchronous arena and replay"
```

## Task 12: Release Gate, Deployment, and Monitoring

**Files:**
- Create: `Dockerfile`, `docker-compose.production.yml`, `.github/workflows/release.yml`, `server/routes/metrics.js`, `docs/DEPLOYMENT.md`, `docs/SECURITY.md`
- Modify: `package.json`, `.github/workflows/check.yml`, `README.md`

- [x] **Step 1: Write a smoke test that runs against the built container.**

```bash
docker compose -f docker-compose.production.yml up -d --build
curl --fail http://localhost:3000/health
docker compose -f docker-compose.production.yml down -v
```

- [x] **Step 2: Run the smoke script before implementation; expect failure because no production compose file exists.**

- [x] **Step 3: Build the release pipeline.**

The production image must run migrations before accepting traffic, serve static browser assets and API from one origin, require `DATABASE_URL`, `SESSION_SECRET`, and secure-cookie configuration, and expose only aggregate health/metrics without account identifiers. CI must run unit tests, API tests with PostgreSQL, Playwright desktop/mobile tests, replay determinism tests, `npm run check`, migration-upgrade tests, and the container smoke test.

- [x] **Step 4: Run the full release command.**

```bash
npm run check && npm run test:api && npx playwright test && npm run simulate:balance && docker compose -f docker-compose.production.yml up --build --abort-on-container-exit
```

Expected: every test suite passes, the health check is HTTP 200, and the generated balance reports match their committed baselines.

- [x] **Step 5: Commit.**

```bash
git add Dockerfile docker-compose.production.yml .github/workflows/release.yml server/routes/metrics.js docs/DEPLOYMENT.md docs/SECURITY.md package.json .github/workflows/check.yml README.md
git commit -m "chore: add production release gate"
```

## Acceptance Checklist

- [ ] A player can register, login, logout, change password, export data, and use the same profile on another device.
- [ ] The account can own more than three students, while every campaign and arena battle rejects formations other than exactly three distinct students.
- [ ] Campaign progress, currency, inventory, training, shop limits, recruitment, and formation persist only through server transactions.
- [ ] The browser can replay a server-created battle but cannot forge battle rewards or settlement results.
- [ ] The same snapshot, engine version, ruleset version, and seed always produce the same ordered event log and hash.
- [ ] Arena battles resolve paired actions atomically, have the documented tie-breaks, and retain immutable historical replays.
- [ ] Desktop and mobile browser acceptance suites, API tests, unit tests, balance simulation, migration checks, and container smoke tests pass in CI.

## Plan Self-Review

- **Specification coverage:** Tasks 1-10 cover the documented single-player vertical slice, including the newly required account/password login and cloud persistence. Task 11 covers the documented first asynchronous multiplayer version. Task 12 covers deployment and quality gates required to operate those systems.
- **Boundary check:** Real-time multiplayer, friends, equipment, talent trees, random events, idle rewards, and relationship systems are intentionally excluded from this delivery plan, matching the design document.
- **Contract check:** `createBattleSnapshot` is the only transition from persistent profile state to combat input; `CombatEngine` remains deterministic; server routes settle snapshots and return records; the client consumes DTOs and event logs.
