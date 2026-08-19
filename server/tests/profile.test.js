import assert from "node:assert/strict";
import { buildTestApp } from "./helpers.js";

const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct horse battery";

function request(app, options) {
  return app.inject({ ...options, headers: { origin: ORIGIN, ...options.headers } });
}

function sid(response) {
  return response.cookies.find(({ name }) => name === "sid");
}

const app = await buildTestApp();
try {
  const registered = await request(app, {
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { username: "profile01", password: PASSWORD },
  });
  assert.equal(registered.statusCode, 201);
  const cookie = sid(registered);
  assert.ok(cookie);

  const initial = await app.inject({ method: "GET", url: "/api/v1/profile", cookies: { sid: cookie.value } });
  assert.equal(initial.statusCode, 200);
  const initialProfile = initial.json();
  assert.equal(Object.keys(initialProfile.students).length, 6);
  assert.deepEqual(initialProfile.currencies, { trainingCoins: 1000, recruitmentTickets: 1 });
  assert.deepEqual(initialProfile.formation, { A1: "planner", A2: "graphist", A3: "structurer" });
  assert.deepEqual(initialProfile.unlockedLevelIds, ["chapter-1-1"]);

  const legacyPayload = structuredClone(initialProfile);
  legacyPayload.schemaVersion = 2;
  for (const student of Object.values(legacyPayload.students)) {
    student.skillLevels = student.skillGroupLevels[student.skillGroupId];
    student.skills = { normal: { id: "legacy-normal" }, burst: { id: "legacy-burst" } };
    delete student.skillGroupId;
    delete student.skillGroupLevels;
  }
  await app.db.query(
    "UPDATE player_profiles SET payload = $2::jsonb WHERE account_id = $1",
    [initialProfile.accountId, JSON.stringify(legacyPayload)],
  );
  const migratedResponse = await app.inject({ method: "GET", url: "/api/v1/profile", cookies: { sid: cookie.value } });
  assert.equal(migratedResponse.statusCode, 200);
  assert.equal(migratedResponse.json().schemaVersion, 3);
  assert.deepEqual(migratedResponse.json().students.planner.skillGroupLevels.planner, { normal: 1, burst: 1 });
  const persistedMigration = await app.db.query(
    "SELECT payload FROM player_profiles WHERE account_id = $1",
    [initialProfile.accountId],
  );
  assert.equal(persistedMigration.rows[0].payload.schemaVersion, 3);
  assert.deepEqual(persistedMigration.rows[0].payload.students.planner.skillGroupLevels.planner, { normal: 1, burst: 1 });

  const saved = await request(app, {
    method: "PUT",
    url: "/api/v1/profile",
    cookies: { sid: cookie.value },
    payload: {
      version: initialProfile.version,
      formation: { A1: "planner", A2: "graphist", A3: "mathematician" },
      students: { planner: { ...initialProfile.students.planner, name: "  林澈  " } },
    },
  });
  assert.equal(saved.statusCode, 200);
  const savedProfile = saved.json();
  assert.equal(savedProfile.version, initialProfile.version + 1);
  assert.equal(savedProfile.students.planner.name, "林澈");
  assert.equal(savedProfile.students.planner.id, "planner");
  assert.deepEqual(savedProfile.students.planner.abilities, initialProfile.students.planner.abilities);
  const profileAudit = await app.db.query(
    "SELECT action_type FROM account_audit_log WHERE account_id = $1 ORDER BY id",
    [initialProfile.accountId],
  );
  assert.deepEqual(profileAudit.rows.map(({ action_type: actionType }) => actionType), ["student_rename"]);

  const invalidGroup = structuredClone(savedProfile);
  invalidGroup.students.planner.skillGroupId = "missing";
  const invalidGroupResponse = await request(app, {
    method: "PUT",
    url: "/api/v1/profile",
    cookies: { sid: cookie.value },
    payload: {
      version: savedProfile.version,
      students: { planner: invalidGroup.students.planner },
    },
  });
  assert.equal(invalidGroupResponse.statusCode, 400);
  assert.equal(invalidGroupResponse.json().code, "INVALID_PROFILE");

  const invalidLevels = structuredClone(savedProfile);
  delete invalidLevels.students.planner.skillGroupLevels.planner.burst;
  const invalidLevelsResponse = await request(app, {
    method: "PUT",
    url: "/api/v1/profile",
    cookies: { sid: cookie.value },
    payload: {
      version: savedProfile.version,
      students: { planner: invalidLevels.students.planner },
    },
  });
  assert.equal(invalidLevelsResponse.statusCode, 400);

  const stale = await request(app, {
    method: "PUT",
    url: "/api/v1/profile",
    cookies: { sid: cookie.value },
    payload: { version: initialProfile.version, formation: savedProfile.formation },
  });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.json().code, "PROFILE_VERSION_CONFLICT");

  const invalidName = await request(app, {
    method: "PUT",
    url: "/api/v1/profile",
    cookies: { sid: cookie.value },
    payload: {
      version: savedProfile.version,
      students: { planner: { ...savedProfile.students.planner, name: "" } },
    },
  });
  assert.equal(invalidName.statusCode, 400);

  const clientEconomyWrite = await request(app, {
    method: "PUT",
    url: "/api/v1/profile",
    cookies: { sid: cookie.value },
    payload: { version: savedProfile.version, currencies: { trainingCoins: 999999, recruitmentTickets: 1 } },
  });
  assert.equal(clientEconomyWrite.statusCode, 400);

  const unauthenticated = await app.inject({ method: "GET", url: "/api/v1/profile" });
  assert.equal(unauthenticated.statusCode, 401);

  const secondLogin = await request(app, {
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { username: "profile01", password: PASSWORD },
  });
  const fresh = await app.inject({
    method: "GET",
    url: "/api/v1/profile",
    cookies: { sid: sid(secondLogin).value },
  });
  assert.equal(fresh.statusCode, 200);
  assert.deepEqual(fresh.json(), savedProfile);

  const other = await request(app, {
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { username: "profile02", password: PASSWORD },
  });
  const otherProfile = await app.inject({
    method: "GET",
    url: "/api/v1/profile",
    cookies: { sid: sid(other).value },
  });
  assert.equal(otherProfile.statusCode, 200);
  assert.notEqual(otherProfile.json().accountId, savedProfile.accountId);
  assert.equal(otherProfile.json().version, 1);

  console.log("profile API tests passed");
} finally {
  await app.close();
}
