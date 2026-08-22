import assert from "node:assert/strict";
import { buildTestApp } from "./helpers.js";
import { createProfile } from "../../src/domain/profile.js";
import { buildDefenseSnapshot, syncArenaDefenseSnapshot } from "../services/arena-defense-sync.js";

const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct horse battery";
const request = (app, options) => app.inject({ ...options, headers: { origin: ORIGIN, ...options.headers } });
const sid = (response) => response.cookies.find(({ name }) => name === "sid")?.value;

// --- Unit-level behavior of the sync helper (no database required) ---
{
  const profile = createProfile({
    accountId: "sync-fixture",
    studentIds: ["planner", "graphist", "structurer"],
    formation: { A1: "planner", A2: "graphist", A3: "structurer" },
  });
  const snapshot = buildDefenseSnapshot(profile);
  assert.equal(snapshot.team.length, 3);
  assert.deepEqual(Object.values(snapshot.formation), Object.keys(profile.students));

  const emptyFormation = structuredClone(profile);
  emptyFormation.formation = { A1: null, A2: null, A3: null };
  assert.throws(() => buildDefenseSnapshot(emptyFormation));

  let saved = null;
  const okRepository = {
    getDefense: async () => ({ account_id: profile.accountId }),
    saveDefense: async (client, values) => { saved = values; return {}; },
  };
  assert.equal(await syncArenaDefenseSnapshot({}, { accountId: profile.accountId, profile, repository: okRepository }), true);
  assert.equal(saved.profileVersion, profile.version);

  saved = null;
  const missingRowRepository = { getDefense: async () => null, saveDefense: async () => { throw new Error("must not be called"); } };
  assert.equal(await syncArenaDefenseSnapshot({}, { accountId: profile.accountId, profile, repository: missingRowRepository }), false);
  assert.equal(saved, null);

  const failingRepository = { getDefense: async () => ({ account_id: profile.accountId }), saveDefense: async () => { throw new Error("boom"); } };
  assert.equal(await syncArenaDefenseSnapshot({}, { accountId: profile.accountId, profile, repository: failingRepository }), false);
  console.log("arena defense sync helper tests passed");
}

// --- Integration: every profile mutation refreshes a saved defense snapshot ---
const app = await buildTestApp({ config: { now: () => new Date("2026-08-22T12:00:00.000Z") } });
try {
  const alice = await request(app, { method: "POST", url: "/api/v1/auth/register", payload: { username: "syncalice", password: PASSWORD } });
  const bob = await request(app, { method: "POST", url: "/api/v1/auth/register", payload: { username: "syncbob", password: PASSWORD } });
  const aliceCookie = { sid: sid(alice) };
  const bobCookie = { sid: sid(bob) };

  const aliceProfileResponse = await app.inject({ method: "GET", url: "/api/v1/profile", cookies: aliceCookie });
  const aliceProfile = aliceProfileResponse.json();
  const starterIds = ["planner", "graphist", "structurer"];
  const savedDefense = await request(app, {
    method: "PUT",
    url: "/api/v1/arena/defense",
    cookies: aliceCookie,
    payload: { version: aliceProfile.version, teamIds: starterIds, formation: aliceProfile.formation },
  });
  assert.equal(savedDefense.statusCode, 200);
  const leadStudentId = aliceProfile.formation.A1;

  // Energy tonic: KFC purchase + use must refresh maxEnergy inside the snapshot.
  assert.equal((await request(app, { method: "POST", url: "/api/v1/progression/shop/purchases", cookies: aliceCookie, payload: { offerId: "energy-tonic" } })).statusCode, 200);
  const tonic = await request(app, { method: "POST", url: `/api/v1/progression/students/${encodeURIComponent(leadStudentId)}/energy`, cookies: aliceCookie, payload: {} });
  assert.equal(tonic.statusCode, 200);
  assert.equal(tonic.json().energy.currentValue, tonic.json().energy.previousValue + 50);

  // Specialist book: training must refresh abilities inside the snapshot.
  assert.equal((await request(app, { method: "POST", url: "/api/v1/progression/shop/purchases", cookies: aliceCookie, payload: { offerId: "daily-dp-book" } })).statusCode, 200);
  const trained = await request(app, { method: "POST", url: "/api/v1/progression/training/specialist", cookies: aliceCookie, payload: { studentId: leadStudentId, ability: "dynamicProgramming" } });
  assert.equal(trained.statusCode, 200);

  // Rename flows through ProfileService.update and must reach the snapshot too.
  const renamedProfile = await request(app, { method: "PUT", url: "/api/v1/profile", cookies: aliceCookie, payload: { version: trained.json().profile.version, students: { [leadStudentId]: { name: "快照同步员" } } } });
  assert.equal(renamedProfile.statusCode, 200);

  const refreshed = await app.inject({ method: "GET", url: "/api/v1/arena/defense", cookies: aliceCookie });
  assert.equal(refreshed.statusCode, 200);
  const latestProfile = renamedProfile.json();
  const snapshotLead = refreshed.json().snapshot.team.find((student) => student.id === leadStudentId);
  const profileLead = latestProfile.students[leadStudentId];
  assert.equal(snapshotLead.maxEnergy, profileLead.maxEnergy);
  assert.equal(snapshotLead.name, profileLead.name);
  assert.deepEqual(snapshotLead.abilities, profileLead.abilities);
  assert.equal(refreshed.json().snapshot.profileVersion, latestProfile.version);

  // Accounts without a saved defense must not gain one implicitly.
  const bobProfile = (await app.inject({ method: "GET", url: "/api/v1/profile", cookies: bobCookie })).json();
  assert.equal((await request(app, { method: "POST", url: "/api/v1/progression/shop/purchases", cookies: bobCookie, payload: { offerId: "energy-tonic" } })).statusCode, 200);
  await request(app, { method: "POST", url: `/api/v1/progression/students/${encodeURIComponent(bobProfile.formation.A1)}/energy`, cookies: bobCookie, payload: {} });
  const bobDefenseInfo = await app.inject({ method: "GET", url: "/api/v1/arena/defense", cookies: bobCookie });
  assert.equal(bobDefenseInfo.json().defense, null);
  const bobRows = await app.db.query("SELECT count(*)::int AS total FROM arena_defenses WHERE account_id = $1", [bob.json().account.id]);
  assert.equal(bobRows.rows[0].total, 0);
  console.log("arena defense sync API tests passed");
} finally {
  await app.close();
}
