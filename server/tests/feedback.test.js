import assert from "node:assert/strict";
import { ensureAdminAccount } from "../services/auth-service.js";
import { buildTestApp } from "./helpers.js";

const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct horse battery";

function request(app, options) {
  return app.inject({ ...options, headers: { origin: ORIGIN, ...options.headers } });
}

function cookie(response) {
  const value = response.cookies.find(({ name }) => name === "sid")?.value;
  assert.ok(value, "response should set a session cookie");
  return { sid: value };
}

const app = await buildTestApp();
try {
  await ensureAdminAccount(app.db, { username: "admin", password: "admin-password" });
  const user = await request(app, {
    method: "POST", url: "/api/v1/auth/register", payload: { username: "feedback01", password: PASSWORD },
  });
  const userCookie = cookie(user);
  const submitted = await request(app, {
    method: "POST", url: "/api/v1/account/feedback", cookies: userCookie,
    payload: { category: "suggestion", message: "增加更多训练题。" },
  });
  assert.equal(submitted.statusCode, 201);
  assert.equal(submitted.json().feedback.message, "增加更多训练题。");

  const denied = await app.inject({ method: "GET", url: "/api/v1/account/feedback", cookies: userCookie });
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.json().code, "ADMIN_REQUIRED");

  const admin = await request(app, {
    method: "POST", url: "/api/v1/auth/login", payload: { username: "admin", password: "admin-password" },
  });
  const listed = await app.inject({ method: "GET", url: "/api/v1/account/feedback", cookies: cookie(admin) });
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.json().feedback[0].username, "feedback01");

  const blank = await request(app, {
    method: "POST", url: "/api/v1/account/feedback", cookies: userCookie,
    payload: { message: "   " },
  });
  assert.equal(blank.statusCode, 400);

  console.log("feedback API tests passed");
} finally {
  await app.close();
}
