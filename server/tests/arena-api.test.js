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
  const bobDefense = { version: bobProfile.version, teamIds: ["structurer", "graphist", "planner"], formation: { A1: "structurer", A2: "graphist", A3: "planner" } };
  assert.equal((await request(app, { method: "PUT", url: "/api/v1/arena/defense", cookies: aliceCookie, payload: defense })).statusCode, 200);
  assert.equal((await request(app, { method: "PUT", url: "/api/v1/arena/defense", cookies: bobCookie, payload: bobDefense })).statusCode, 200);
  const opponents = await app.inject({ method: "GET", url: "/api/v1/arena/opponents", cookies: aliceCookie });
  assert.equal(opponents.statusCode, 200);
  assert.equal(opponents.json().length, 1);
  assert.equal(typeof opponents.json()[0].power, "number", "opponent list must include defense power");
  assert.ok(opponents.json()[0].power > 0);
  const match = await request(app, { method: "POST", url: "/api/v1/arena/matches", cookies: aliceCookie, payload: { opponentId: bob.json().account.id } });
  assert.equal(match.statusCode, 201);
  const matchPayload = match.json();
  assert.equal(matchPayload.snapshots.defender.team.length, 3);
  assert.deepEqual(matchPayload.snapshots.attacker.level.topicIds, matchPayload.snapshots.defender.level.topicIds);
  const teamPower = (snapshot) => snapshot.team.reduce((sum, student) => sum + Object.values(student.abilities).reduce((total, value) => total + value, 0) / Object.values(student.abilities).length, 0);
  const averagePower = (teamPower(matchPayload.snapshots.attacker) + teamPower(matchPayload.snapshots.defender)) / 2;
  for (const topic of matchPayload.snapshots.attacker.level.topics) {
    const difficulty = Object.values(topic.difficulties).reduce((sum, value) => sum + value, 0);
    assert.ok(difficulty >= averagePower * 0.89 && difficulty <= averagePower * 1.11, "arena topic difficulty should track average team power");
  }
  const settled = await request(app, { method: "POST", url: `/api/v1/arena/matches/${matchPayload.id}/settle`, cookies: aliceCookie, payload: {} });
  assert.equal(settled.statusCode, 200);
  assert.ok(settled.json().replay.attackerEventsHash);
  const settledProfile = await app.inject({ method: "GET", url: "/api/v1/profile", cookies: aliceCookie });
  assert.equal(settledProfile.statusCode, 200);
  assert.equal(settledProfile.json().currencies.trainingCoins, settled.json().reward.trainingCoins ? 1025 : 1000);
  const arenaLedger = await app.db.query("SELECT delta FROM currency_ledger WHERE account_id = $1 AND source_type = 'arena'", [alice.json().account.id]);
  assert.equal(arenaLedger.rows.length, settled.json().reward.trainingCoins ? 1 : 0);
  const replay = await app.inject({ method: "GET", url: `/api/v1/arena/matches/${matchPayload.id}`, cookies: bobCookie });
  assert.equal(replay.statusCode, 200);
  assert.equal(replay.json().hashes.attacker, settled.json().replay.attackerEventsHash);
  for (let i = 0; i < 38; i += 1) {
    const extra = await request(app, { method: "POST", url: "/api/v1/arena/matches", cookies: aliceCookie, payload: { opponentId: bob.json().account.id } });
    assert.equal(extra.statusCode, 201);
    const settledExtra = await request(app, { method: "POST", url: `/api/v1/arena/matches/${extra.json().id}/settle`, cookies: aliceCookie, payload: {} });
    assert.equal(settledExtra.statusCode, 200);
  }
  const pending = await request(app, { method: "POST", url: "/api/v1/arena/matches", cookies: aliceCookie, payload: { opponentId: bob.json().account.id } });
  assert.equal(pending.statusCode, 201);
  const defenseInfo = await app.inject({ method: "GET", url: "/api/v1/arena/defense", cookies: aliceCookie });
  assert.equal(defenseInfo.statusCode, 200);
  assert.equal(defenseInfo.json().battlesToday, 40);
  assert.equal(defenseInfo.json().dailyLimit, 40);
  const blocked = await request(app, { method: "POST", url: "/api/v1/arena/matches", cookies: aliceCookie, payload: { opponentId: bob.json().account.id } });
  assert.equal(blocked.statusCode, 409);
  assert.equal(blocked.json().code, "ARENA_DAILY_LIMIT_REACHED");
  console.log("arena API tests passed");
} finally {
  await app.close();
}
