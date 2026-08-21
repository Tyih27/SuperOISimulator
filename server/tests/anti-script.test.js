import assert from "node:assert/strict";
import { buildTestApp } from "./helpers.js";
import { DEFAULT_THRESHOLD_MS } from "../middleware/anti-script.js";

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

// Use a threshold higher than the default for deterministic testing.
const TEST_THRESHOLD_MS = 50;

const app = await buildTestApp({
  config: {
    antiScriptThresholdMs: TEST_THRESHOLD_MS,
    sessionSecret: "test-session-secret-with-at-least-32-characters",
    allowedOrigins: [ORIGIN],
  },
});

try {
  // Verify the exported default constant.
  assert.equal(DEFAULT_THRESHOLD_MS, 30, "DEFAULT_THRESHOLD_MS should be 30");

  // Register and login
  const registered = await request(app, {
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { username: "antitest01", password: PASSWORD },
  });
  assert.equal(registered.statusCode, 201);
  const cookie = sessionCookie(registered);

  // Test 1: GET requests should not be affected by anti-script
  const profile1 = await app.inject({
    method: "GET",
    url: "/api/v1/profile",
    cookies: { sid: cookie.value },
  });
  assert.equal(profile1.statusCode, 200, "GET should not be rate limited");

  // Test 2: First mutating request should succeed
  const dailyCheckIn1 = await request(app, {
    method: "POST",
    url: "/api/v1/progression/daily-check-in",
    cookies: { sid: cookie.value },
  });
  assert.equal(dailyCheckIn1.statusCode, 200, "First request should succeed");

  // Test 3: Rapid second request should be blocked (429)
  const dailyCheckIn2 = await request(app, {
    method: "POST",
    url: "/api/v1/progression/daily-check-in",
    cookies: { sid: cookie.value },
  });
  assert.equal(dailyCheckIn2.statusCode, 429, "Rapid request should be blocked");
  assert.equal(dailyCheckIn2.json().code, "REQUEST_TOO_FREQUENT");
  assert.equal(dailyCheckIn2.json().message, "操作过于频繁，请稍后再试");

  // Test 4: Request after waiting should succeed (no 429)
  await new Promise((resolve) => setTimeout(resolve, TEST_THRESHOLD_MS + 10));
  const dailyCheckIn3 = await request(app, {
    method: "POST",
    url: "/api/v1/progression/daily-check-in",
    cookies: { sid: cookie.value },
  });
  // This will fail with 409 because already claimed, but not 429
  assert.notEqual(dailyCheckIn3.statusCode, 429, "Request after delay should not be 429");
  assert.equal(dailyCheckIn3.statusCode, 409, "Should fail with already claimed");

  // Test 5: Different account should not be affected
  const registered2 = await request(app, {
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { username: "antitest02", password: PASSWORD },
  });
  assert.equal(registered2.statusCode, 201);
  const cookie2 = sessionCookie(registered2);

  const dailyCheckIn4 = await request(app, {
    method: "POST",
    url: "/api/v1/progression/daily-check-in",
    cookies: { sid: cookie2.value },
  });
  assert.equal(dailyCheckIn4.statusCode, 200, "Different account should succeed");

  // Test 6: POST to recruitment should be affected
  const recruit1 = await request(app, {
    method: "POST",
    url: "/api/v1/progression/recruitment",
    cookies: { sid: cookie2.value },
  });
  assert.equal(recruit1.statusCode, 200, "First recruitment should succeed");

  const recruit2 = await request(app, {
    method: "POST",
    url: "/api/v1/progression/recruitment",
    cookies: { sid: cookie2.value },
  });
  assert.equal(recruit2.statusCode, 429, "Rapid recruitment should be blocked");

  console.log("anti-script tests passed");
} finally {
  await app.close();
}
