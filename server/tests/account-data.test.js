import assert from "node:assert/strict";
import { buildTestApp } from "./helpers.js";

const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct horse battery";
const NEW_PASSWORD = "new correct horse battery";

function request(app, options) {
  return app.inject({ ...options, headers: { origin: ORIGIN, ...options.headers } });
}

function sid(response) {
  const cookie = response.cookies.find(({ name }) => name === "sid");
  assert.ok(cookie, "response should set the sid cookie");
  return cookie;
}

const app = await buildTestApp({ config: { accountDeletionRetentionDays: 7 } });
try {
  const registered = await request(app, {
    method: "POST", url: "/api/v1/auth/register", payload: { username: "account01", password: PASSWORD },
  });
  assert.equal(registered.statusCode, 201);
  const originalCookie = sid(registered);
  const auth = { sid: originalCookie.value };

  const profileResponse = await app.inject({ method: "GET", url: "/api/v1/profile", cookies: auth });
  assert.equal(profileResponse.statusCode, 200);
  const profile = profileResponse.json();
  const renamed = await request(app, {
    method: "PUT",
    url: "/api/v1/profile",
    cookies: auth,
    payload: { version: profile.version, students: { planner: { ...profile.students.planner, name: "账户测试" } } },
  });
  assert.equal(renamed.statusCode, 200);

  const unauthenticatedExport = await app.inject({ method: "GET", url: "/api/v1/account/export" });
  assert.equal(unauthenticatedExport.statusCode, 401);
  const exported = await app.inject({ method: "GET", url: "/api/v1/account/export", cookies: auth });
  assert.equal(exported.statusCode, 200);
  assert.match(exported.headers["content-disposition"], /attachment/);
  assert.equal(exported.json().data.profile.payload.students.planner.name, "账户测试");
  assert.equal(exported.json().data.profileSnapshots.length, 1);
  assert.equal(exported.json().data.profileSnapshots[0].action_type, "student_rename");
  assert.equal(exported.json().data.profileSnapshots[0].profile.students.planner.name, "账户测试");
  assert.doesNotMatch(exported.body, /password_hash|correct horse battery/i);

  const invalidChange = await request(app, {
    method: "POST", url: "/api/v1/account/password", cookies: auth,
    payload: { currentPassword: "incorrect current password", newPassword: NEW_PASSWORD },
  });
  assert.equal(invalidChange.statusCode, 400);
  assert.equal(invalidChange.json().code, "INVALID_CURRENT_PASSWORD");

  const changed = await request(app, {
    method: "POST", url: "/api/v1/account/password", cookies: auth,
    payload: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
  });
  assert.equal(changed.statusCode, 204);
  assert.match(changed.headers["set-cookie"], /Max-Age=0/i);
  const revoked = await app.inject({ method: "GET", url: "/api/v1/auth/session", cookies: auth });
  assert.equal(revoked.statusCode, 401);

  const relogged = await request(app, {
    method: "POST", url: "/api/v1/auth/login", payload: { username: "account01", password: NEW_PASSWORD },
  });
  assert.equal(relogged.statusCode, 200);
  const currentCookie = sid(relogged);
  const currentAuth = { sid: currentCookie.value };

  const invalidDeletion = await request(app, {
    method: "DELETE", url: "/api/v1/account", cookies: currentAuth, payload: { password: PASSWORD },
  });
  assert.equal(invalidDeletion.statusCode, 400);
  const deletion = await request(app, {
    method: "DELETE", url: "/api/v1/account", cookies: currentAuth, payload: { password: NEW_PASSWORD },
  });
  assert.equal(deletion.statusCode, 200);
  assert.equal(deletion.json().status, "deleted");
  const deletedAccount = await app.db.query("SELECT count(*)::int AS total FROM accounts WHERE id = $1", [profile.accountId]);
  assert.equal(deletedAccount.rows[0].total, 0);
  const deletedProfile = await app.db.query("SELECT count(*)::int AS total FROM player_profiles WHERE account_id = $1", [profile.accountId]);
  assert.equal(deletedProfile.rows[0].total, 0);
  const deletedSnapshots = await app.db.query("SELECT count(*)::int AS total FROM profile_snapshots WHERE account_id = $1", [profile.accountId]);
  assert.equal(deletedSnapshots.rows[0].total, 0);
  const deletionRevoked = await app.inject({ method: "GET", url: "/api/v1/auth/session", cookies: currentAuth });
  assert.equal(deletionRevoked.statusCode, 401);
  const deletedLogin = await request(app, {
    method: "POST", url: "/api/v1/auth/login", payload: { username: "account01", password: NEW_PASSWORD },
  });
  assert.equal(deletedLogin.statusCode, 401);

  const auditAfterDeletion = await app.db.query(
    "SELECT count(*)::int AS total FROM account_audit_log WHERE account_id = $1",
    [profile.accountId],
  );
  assert.equal(auditAfterDeletion.rows[0].total, 0, "audit rows must be cascade-deleted with the account");

  console.log("account data API tests passed");
} finally {
  await app.close();
}
