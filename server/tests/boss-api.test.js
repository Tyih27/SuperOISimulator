import assert from "node:assert/strict";
import { buildTestApp } from "./helpers.js";

const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct horse battery";
const request = (app, options) => app.inject({ ...options, headers: { origin: ORIGIN, ...options.headers } });
const sid = (response) => response.cookies.find(({ name }) => name === "sid")?.value;

const app = await buildTestApp({ config: { now: () => new Date("2026-08-19T12:00:00.000Z") } });
try {
  const alice = await request(app, { method: "POST", url: "/api/v1/auth/register", payload: { username: "bossalice", password: PASSWORD } });
  const cookie = { sid: sid(alice) };
  const profile = (await app.inject({ method: "GET", url: "/api/v1/profile", cookies: cookie })).json();
  const selection = { version: profile.version, teamIds: ["planner", "graphist", "structurer"], formation: profile.formation };

  const rejected = await request(app, { method: "POST", url: "/api/v1/boss/challenges", cookies: cookie, payload: {} });
  assert.equal(rejected.statusCode, 400);

  const challenge = await request(app, { method: "POST", url: "/api/v1/boss/challenges", cookies: cookie, payload: selection });
  assert.equal(challenge.statusCode, 201);
  const challengePayload = challenge.json();
  assert.ok(challengePayload.id);
  assert.equal(challengePayload.snapshot.level.topics.length, 1);
  assert.equal(challengePayload.snapshot.level.maxRounds, 30);
  assert.equal(challengePayload.snapshot.level.topics[0].skill.damageMultiplier, 0.6);
  const quota = await app.inject({ method: "GET", url: "/api/v1/boss/quota", cookies: cookie });
  assert.deepEqual(quota.json(), { battlesToday: 1, dailyLimit: 10 });

  const settled = await request(app, { method: "POST", url: `/api/v1/boss/challenges/${challengePayload.id}/settle`, cookies: cookie, payload: {} });
  assert.equal(settled.statusCode, 200);
  const settlement = settled.json();
  assert.ok(settlement.damage > 0);
  assert.ok(settlement.round <= 30);
  assert.equal(settlement.reward.trainingCoins, Math.floor(settlement.damage / 200));
  assert.equal(typeof settlement.replay.eventsHash, "string");
  assert.ok(settlement.profile);

  const profileAfter = await app.inject({ method: "GET", url: "/api/v1/profile", cookies: cookie });
  assert.equal(profileAfter.json().currencies.trainingCoins, profile.currencies.trainingCoins + settlement.reward.trainingCoins);
  const ledger = await app.db.query("SELECT delta FROM currency_ledger WHERE account_id = $1 AND source_type = 'boss'", [profile.accountId]);
  assert.equal(ledger.rows.length, 1);
  assert.equal(ledger.rows[0].delta, settlement.reward.trainingCoins);

  const replay = await settled;
  const doubleSettle = await request(app, { method: "POST", url: `/api/v1/boss/challenges/${challengePayload.id}/settle`, cookies: cookie, payload: {} });
  assert.equal(doubleSettle.statusCode, 409);

  const history = await app.inject({ method: "GET", url: "/api/v1/boss/challenges?limit=20", cookies: cookie });
  assert.equal(history.statusCode, 200);
  assert.equal(history.json().length, 1);
  assert.equal(history.json()[0].id, challengePayload.id);
  assert.equal(history.json()[0].status, "settled");
  assert.equal(history.json()[0].damage, settlement.damage);

  let currentVersion = profileAfter.json().version;
  for (let i = 0; i < 9; i += 1) {
    const extra = await request(app, { method: "POST", url: "/api/v1/boss/challenges", cookies: cookie, payload: { ...selection, version: currentVersion } });
    assert.equal(extra.statusCode, 201);
    const settledExtra = await request(app, { method: "POST", url: `/api/v1/boss/challenges/${extra.json().id}/settle`, cookies: cookie, payload: {} });
    assert.equal(settledExtra.statusCode, 200);
    if (settledExtra.json().profile?.version) currentVersion = settledExtra.json().profile.version;
  }
  const blocked = await request(app, { method: "POST", url: "/api/v1/boss/challenges", cookies: cookie, payload: { ...selection, version: currentVersion } });
  assert.equal(blocked.statusCode, 409);
  assert.equal(blocked.json().code, "BOSS_DAILY_LIMIT_REACHED");
  console.log("boss API tests passed");
} finally {
  await app.close();
}
