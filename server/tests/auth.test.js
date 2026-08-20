import assert from "node:assert/strict";
import { buildTestApp } from "./helpers.js";

const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct horse battery";

function sessionCookie(response) {
  const cookie = response.cookies.find(({ name }) => name === "sid");
  assert.ok(cookie, "response should set the sid cookie");
  return cookie;
}

function request(app, options) {
  return app.inject({
    ...options,
    headers: { origin: ORIGIN, ...options.headers },
  });
}

const app = await buildTestApp({
  config: {
    authRateLimitMax: 4,
    allowedOrigins: [ORIGIN, "http://127.0.0.1:3000"],
  },
});

try {
  const invalid = await request(app, {
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { username: "a!", password: "short" },
  });
  assert.equal(invalid.statusCode, 400);

  const registered = await request(app, {
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { username: "Alice01", password: PASSWORD },
  });
  assert.equal(registered.statusCode, 201);
  assert.match(registered.headers["set-cookie"], /HttpOnly/i);
  assert.match(registered.headers["set-cookie"], /SameSite=Lax/i);
  assert.deepEqual(registered.json().account.username, "alice01");
  const registeredCookie = sessionCookie(registered);

  const loopbackRegistration = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers: { origin: "http://127.0.0.1:3000" },
    payload: { username: "loopback01", password: PASSWORD },
  });
  assert.equal(loopbackRegistration.statusCode, 201);

  const duplicate = await request(app, {
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { username: "ALICE01", password: PASSWORD },
  });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.json().code, "USERNAME_TAKEN");

  const wrongPassword = await request(app, {
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { username: "alice01", password: "wrong password value" },
  });
  assert.equal(wrongPassword.statusCode, 401);

  const unknownAccount = await request(app, {
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { username: "unknown01", password: "another wrong password" },
  });
  assert.equal(unknownAccount.statusCode, 401);
  assert.deepEqual(unknownAccount.json(), wrongPassword.json());

  const loggedIn = await request(app, {
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { username: "alice01", password: PASSWORD },
  });
  assert.equal(loggedIn.statusCode, 200);
  const loginCookie = sessionCookie(loggedIn);

  const authenticated = await app.inject({
    method: "GET",
    url: "/api/v1/auth/session",
    cookies: { sid: loginCookie.value },
  });
  assert.equal(authenticated.statusCode, 200);
  assert.deepEqual(authenticated.json().account, registered.json().account);

  const crossOriginLogout = await app.inject({
    method: "POST",
    url: "/api/v1/auth/logout",
    headers: { origin: "https://attacker.example" },
    cookies: { sid: loginCookie.value },
  });
  assert.equal(crossOriginLogout.statusCode, 403);

  const loggedOut = await request(app, {
    method: "POST",
    url: "/api/v1/auth/logout",
    cookies: { sid: loginCookie.value },
  });
  assert.equal(loggedOut.statusCode, 204);
  assert.match(loggedOut.headers["set-cookie"], /Max-Age=0/i);

  const revoked = await app.inject({
    method: "GET",
    url: "/api/v1/auth/session",
    cookies: { sid: loginCookie.value },
  });
  assert.equal(revoked.statusCode, 401);

  const stored = await app.db.query(
    `SELECT a.password_hash, s.token_hash
       FROM accounts a
       JOIN account_sessions s ON s.account_id = a.id
      WHERE a.username = $1
      ORDER BY s.created_at
      LIMIT 1`,
    ["alice01"],
  );
  assert.equal(stored.rowCount, 1);
  assert.notEqual(stored.rows[0].password_hash, PASSWORD);
  assert.match(stored.rows[0].password_hash, /^\$argon2id\$/);
  assert.match(stored.rows[0].token_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(stored.rows[0].token_hash, registeredCookie.value);

  const limitedAttempts = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    limitedAttempts.push(await request(app, {
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { username: "alice01", password: "another wrong password" },
    }));
  }
  assert.equal(limitedAttempts[0].statusCode, 401);
  assert.equal(limitedAttempts[1].statusCode, 429);

  console.log("auth API tests passed");
} finally {
  await app.close();
}
