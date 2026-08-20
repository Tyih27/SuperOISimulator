import assert from "node:assert/strict";
import { buildTestApp } from "./helpers.js";

const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct horse battery";
const request = (app, options) => app.inject({ ...options, headers: { origin: ORIGIN, ...options.headers } });
const sid = (response) => response.cookies.find(({ name }) => name === "sid")?.value;

const app = await buildTestApp({ config: { now: () => new Date("2026-08-19T12:00:00.000Z") } });
try {
  const alice = await request(app, { method: "POST", url: "/api/v1/auth/register", payload: { username: "arenaalice", password: PASSWORD } });
  const bob = await request(app, { method: "POST", url: "/api/v1/auth/register", payload: { username: "arenabob", password: PASSWORD } });
  const aliceCookie = { sid: sid(alice) };
  const bobCookie = { sid: sid(bob) };
  const aliceProfile = (await app.inject({ method: "GET", url: "/api/v1/profile", cookies: aliceCookie })).json();
  const bobProfile = (await app.inject({ method: "GET", url: "/api/v1/profile", cookies: bobCookie })).json();
  const defense = { version: aliceProfile.version, teamIds: ["planner", "graphist", "structurer"], formation: aliceProfile.formation };
  const bobDefense = { version: bobProfile.version, teamIds: ["mathematician", "implementer", "supporter"], formation: { A1: "mathematician", A2: "implementer", A3: "supporter" } };
  assert.equal((await request(app, { method: "PUT", url: "/api/v1/arena/defense", cookies: aliceCookie, payload: defense })).statusCode, 200);
  assert.equal((await request(app, { method: "PUT", url: "/api/v1/arena/defense", cookies: bobCookie, payload: bobDefense })).statusCode, 200);
  const opponents = await app.inject({ method: "GET", url: "/api/v1/arena/opponents", cookies: aliceCookie });
  assert.equal(opponents.statusCode, 200);
  assert.equal(opponents.json().length, 1);
  const match = await request(app, { method: "POST", url: "/api/v1/arena/matches", cookies: aliceCookie, payload: { opponentId: bob.json().account.id } });
  assert.equal(match.statusCode, 201);
  assert.equal(match.json().snapshots.defender.team.length, 3);
  const settled = await request(app, { method: "POST", url: `/api/v1/arena/matches/${match.json().id}/settle`, cookies: aliceCookie, payload: {} });
  assert.equal(settled.statusCode, 200);
  assert.ok(settled.json().replay.attackerEventsHash);
  const settledProfile = await app.inject({ method: "GET", url: "/api/v1/profile", cookies: aliceCookie });
  assert.equal(settledProfile.statusCode, 200);
  assert.equal(settledProfile.json().currencies.trainingCoins, settled.json().reward.trainingCoins ? 1025 : 1000);
  const arenaLedger = await app.db.query("SELECT delta FROM currency_ledger WHERE account_id = $1 AND source_type = 'arena'", [alice.json().account.id]);
  assert.equal(arenaLedger.rows.length, settled.json().reward.trainingCoins ? 1 : 0);
  const replay = await app.inject({ method: "GET", url: `/api/v1/arena/matches/${match.json().id}`, cookies: bobCookie });
  assert.equal(replay.statusCode, 200);
  assert.equal(replay.json().hashes.attacker, settled.json().replay.attackerEventsHash);
  console.log("arena API tests passed");
} finally {
  await app.close();
}
