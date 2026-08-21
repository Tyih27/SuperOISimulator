import assert from "node:assert/strict";
import { buildTestApp } from "./helpers.js";

const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct horse battery";
const request = (app, options) => app.inject({ ...options, headers: { origin: ORIGIN, ...options.headers } });
const sid = (response) => response.cookies.find(({ name }) => name === "sid")?.value;

const app = await buildTestApp({ config: { now: () => new Date("2026-08-21T12:00:00.000Z") } });
try {
  const alice = await request(app, { method: "POST", url: "/api/v1/auth/register", payload: { username: "arenaedge1", password: PASSWORD } });
  const bob = await request(app, { method: "POST", url: "/api/v1/auth/register", payload: { username: "arenaedge2", password: PASSWORD } });
  const aliceCookie = { sid: sid(alice) };
  const bobCookie = { sid: sid(bob) };

  // ── No defense: challenge before saving ──────────────────────────────────
  const noDefenseOpponents = await app.inject({ method: "GET", url: "/api/v1/arena/opponents", cookies: aliceCookie });
  assert.equal(noDefenseOpponents.statusCode, 200);
  assert.ok(Array.isArray(noDefenseOpponents.json()));

  const noDefenseMatch = await request(app, {
    method: "POST", url: "/api/v1/arena/matches", cookies: aliceCookie,
    payload: { opponentId: bob.json().account.id },
  });
  assert.equal(noDefenseMatch.statusCode, 400);

  // ── Save defense ─────────────────────────────────────────────────────────
  const aliceProfile = (await app.inject({ method: "GET", url: "/api/v1/profile", cookies: aliceCookie })).json();
  const bobProfile = (await app.inject({ method: "GET", url: "/api/v1/profile", cookies: bobCookie })).json();

  const aliceDefense = await request(app, {
    method: "PUT", url: "/api/v1/arena/defense", cookies: aliceCookie,
    payload: { version: aliceProfile.version, teamIds: ["planner", "graphist", "structurer"], formation: aliceProfile.formation },
  });
  assert.equal(aliceDefense.statusCode, 200);

  const bobDefense = await request(app, {
    method: "PUT", url: "/api/v1/arena/defense", cookies: bobCookie,
    payload: { version: bobProfile.version, teamIds: ["mathematician", "implementer", "supporter"], formation: { A1: "mathematician", A2: "implementer", A3: "supporter" } },
  });
  assert.equal(bobDefense.statusCode, 200);

  // ── Self-challenge is blocked ────────────────────────────────────────────
  const selfMatch = await request(app, {
    method: "POST", url: "/api/v1/arena/matches", cookies: aliceCookie,
    payload: { opponentId: alice.json().account.id },
  });
  assert.equal(selfMatch.statusCode, 404);

  // ── Opponents excludes self ──────────────────────────────────────────────
  const opponents = await app.inject({ method: "GET", url: "/api/v1/arena/opponents", cookies: aliceCookie });
  assert.equal(opponents.statusCode, 200);
  const opponentIds = opponents.json().map((o) => o.accountId);
  assert.ok(!opponentIds.includes(alice.json().account.id), "opponents must not include self");
  assert.ok(opponentIds.includes(bob.json().account.id));

  // ── Defense version conflict ─────────────────────────────────────────────
  const staleDefense = await request(app, {
    method: "PUT", url: "/api/v1/arena/defense", cookies: aliceCookie,
    payload: { version: 1, teamIds: ["planner", "graphist", "structurer"], formation: aliceProfile.formation },
  });
  assert.equal(staleDefense.statusCode, 409);

  // ── History endpoint ─────────────────────────────────────────────────────
  const historyBefore = await app.inject({ method: "GET", url: "/api/v1/arena/matches?limit=5", cookies: aliceCookie });
  assert.equal(historyBefore.statusCode, 200);
  assert.ok(Array.isArray(historyBefore.json()));

  // ── Create and settle match ──────────────────────────────────────────────
  const match = await request(app, {
    method: "POST", url: "/api/v1/arena/matches", cookies: aliceCookie,
    payload: { opponentId: bob.json().account.id },
  });
  assert.equal(match.statusCode, 201);
  const matchId = match.json().id;

  const settled = await request(app, {
    method: "POST", url: `/api/v1/arena/matches/${matchId}/settle`, cookies: aliceCookie, payload: {},
  });
  assert.equal(settled.statusCode, 200);
  assert.ok(["attacker", "defender", "draw"].includes(settled.json().result.winner));
  assert.ok(settled.json().rating);

  // ── Duplicate settle ─────────────────────────────────────────────────────
  const dupSettle = await request(app, {
    method: "POST", url: `/api/v1/arena/matches/${matchId}/settle`, cookies: aliceCookie, payload: {},
  });
  assert.equal(dupSettle.statusCode, 409);

  // ── History after match ──────────────────────────────────────────────────
  const historyAfter = await app.inject({ method: "GET", url: "/api/v1/arena/matches?limit=5", cookies: aliceCookie });
  assert.equal(historyAfter.statusCode, 200);
  assert.ok(historyAfter.json().length >= 1);

  // ── Replay endpoint ──────────────────────────────────────────────────────
  const replay = await app.inject({ method: "GET", url: `/api/v1/arena/matches/${matchId}`, cookies: aliceCookie });
  assert.equal(replay.statusCode, 200);
  assert.ok(replay.json().result);
  assert.ok(replay.json().hashes);

  // ── Replay for unsettled match ───────────────────────────────────────────
  const match2 = await request(app, {
    method: "POST", url: "/api/v1/arena/matches", cookies: aliceCookie,
    payload: { opponentId: bob.json().account.id },
  });
  assert.equal(match2.statusCode, 201);
  const replayUnsettled = await app.inject({ method: "GET", url: `/api/v1/arena/matches/${match2.json().id}`, cookies: aliceCookie });
  assert.equal(replayUnsettled.statusCode, 409);

  // ── Invalid match ID ─────────────────────────────────────────────────────
  const invalidReplay = await app.inject({ method: "GET", url: "/api/v1/arena/matches/not-a-uuid", cookies: aliceCookie });
  assert.equal(invalidReplay.statusCode, 400);

  const invalidMatch = await request(app, {
    method: "POST", url: "/api/v1/arena/matches", cookies: aliceCookie,
    payload: { opponentId: "not-a-uuid" },
  });
  assert.equal(invalidMatch.statusCode, 400);

  // ── Invalid opponent ID ──────────────────────────────────────────────────
  const fakeOpponent = await request(app, {
    method: "POST", url: "/api/v1/arena/matches", cookies: aliceCookie,
    payload: { opponentId: "00000000-0000-0000-0000-000000000000" },
  });
  assert.equal(fakeOpponent.statusCode, 404);

  // ── Reward verification ──────────────────────────────────────────────────
  const aliceAfter = (await app.inject({ method: "GET", url: "/api/v1/profile", cookies: aliceCookie })).json();
  if (settled.json().result.winner === "attacker") {
    assert.equal(aliceAfter.currencies.trainingCoins, 1025);
  } else {
    assert.equal(aliceAfter.currencies.trainingCoins, 1000);
  }

  // ── Ledger entries ───────────────────────────────────────────────────────
  const ledger = await app.db.query("SELECT delta, source_type FROM currency_ledger WHERE account_id = $1 AND source_type = 'arena'", [alice.json().account.id]);
  if (settled.json().result.winner === "attacker") {
    assert.equal(ledger.rows.length, 1);
    assert.equal(ledger.rows[0].delta, 25);
  } else {
    assert.equal(ledger.rows.length, 0);
  }

  console.log("arena-edge API tests passed");
} finally {
  await app.close();
}
