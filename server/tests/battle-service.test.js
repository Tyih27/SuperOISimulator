import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { serializeEvents } from "../../src/combat/events.js";
import { buildTestApp } from "./helpers.js";

const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct horse battery";

function request(app, options) {
  return app.inject({ ...options, headers: { origin: ORIGIN, ...options.headers } });
}

function sid(response) {
  return response.cookies.find(({ name }) => name === "sid");
}

function eventLogHash(events) {
  return createHash("sha256").update(serializeEvents(events)).digest("hex");
}

function battleRequest() {
  return {
    levelId: "chapter-1-1",
    teamIds: ["planner", "graphist", "structurer"],
    formation: { A1: "planner", A2: "graphist", A3: "structurer" },
  };
}

const app = await buildTestApp({
  config: {
    now: () => new Date("2026-08-19T12:00:00.000Z"),
  },
});

try {
  const registered = await request(app, {
    method: "POST", url: "/api/v1/auth/register", payload: { username: "battle01", password: PASSWORD },
  });
  const cookie = sid(registered);
  assert.ok(cookie);
  const auth = { sid: cookie.value };

  // This test fixture uses trained values to exercise the reward branch.
  const profile = (await app.inject({ method: "GET", url: "/api/v1/profile", cookies: auth })).json();
  for (const student of Object.values(profile.students)) {
    student.aptitude = "顶尖";
    for (const ability of Object.keys(student.abilities)) student.abilities[ability] = 2_000;
  }
  await app.db.query("UPDATE player_profiles SET payload = $2::jsonb WHERE account_id = $1", [
    profile.accountId,
    JSON.stringify(profile),
  ]);

  const forged = await request(app, {
    method: "POST", url: "/api/v1/campaign/battles", cookies: auth,
    payload: { ...battleRequest(), result: "win", reward: { trainingCoins: 999999 } },
  });
  assert.equal(forged.statusCode, 400);

  const first = await request(app, {
    method: "POST", url: "/api/v1/campaign/battles", cookies: auth, payload: battleRequest(),
  });
  assert.equal(first.statusCode, 201);
  assert.ok(first.json().id);
  assert.equal(first.json().snapshot.profileVersion, profile.version);

  const second = await request(app, {
    method: "POST", url: "/api/v1/campaign/battles", cookies: auth, payload: battleRequest(),
  });
  assert.equal(second.statusCode, 201);
  assert.deepEqual(second.json().snapshot, first.json().snapshot);

  const settled = await request(app, {
    method: "POST", url: `/api/v1/campaign/battles/${first.json().id}/settle`, cookies: auth, payload: {},
  });
  assert.equal(settled.statusCode, 200);
  assert.equal(settled.json().result.result, "win");
  assert.equal(settled.json().eventLogHash, eventLogHash(settled.json().result.events));
  assert.equal(settled.json().eventLogHash, settled.json().recomputedEventLogHash);
  assert.equal(settled.json().reward.trainingCoins, 100);
  const stored = await app.db.query(
    "SELECT status, snapshot, event_log, event_log_hash FROM battle_records WHERE id = $1",
    [first.json().id],
  );
  assert.equal(stored.rows[0].status, "settled");
  assert.deepEqual(stored.rows[0].snapshot, first.json().snapshot);
  assert.deepEqual(stored.rows[0].event_log, settled.json().result.events);
  assert.equal(stored.rows[0].event_log_hash.trim(), settled.json().eventLogHash);

  const duplicate = await request(app, {
    method: "POST", url: `/api/v1/campaign/battles/${first.json().id}/settle`, cookies: auth, payload: {},
  });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.json().code, "BATTLE_ALREADY_SETTLED");

  const settledSecond = await request(app, {
    method: "POST", url: `/api/v1/campaign/battles/${second.json().id}/settle`, cookies: auth, payload: {},
  });
  assert.equal(settledSecond.statusCode, 200);
  assert.equal(settledSecond.json().eventLogHash, settled.json().eventLogHash);

  const other = await request(app, {
    method: "POST", url: "/api/v1/auth/register", payload: { username: "battle02", password: PASSWORD },
  });
  const foreign = await request(app, {
    method: "POST", url: `/api/v1/campaign/battles/${second.json().id}/settle`,
    cookies: { sid: sid(other).value }, payload: {},
  });
  assert.equal(foreign.statusCode, 404);

  const invalidId = await request(app, {
    method: "POST", url: "/api/v1/campaign/battles/not-a-uuid/settle", cookies: auth, payload: {},
  });
  assert.equal(invalidId.statusCode, 400);

  const auditEntries = await app.db.query(
    "SELECT action_type FROM account_audit_log WHERE account_id = $1 ORDER BY id",
    [profile.accountId],
  );
  assert.deepEqual(auditEntries.rows.map(({ action_type: actionType }) => actionType), [
    "battle_started", "battle_started", "battle_settlement", "battle_settlement",
  ]);

  const legacySettlement = await request(app, {
    method: "POST", url: "/api/v1/progression/campaign/settlements", cookies: auth,
    payload: { settlementId: "forged", levelId: "chapter-1-1", result: "win" },
  });
  assert.equal(legacySettlement.statusCode, 404);

  console.log("authoritative battle API tests passed");
} finally {
  await app.close();
}
