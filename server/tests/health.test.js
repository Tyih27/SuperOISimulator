import assert from "node:assert/strict";
import { buildTestApp } from "./helpers.js";

const app = await buildTestApp();

try {
  const response = await app.inject({ method: "GET", url: "/health" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });

  const metrics = await app.inject({ method: "GET", url: "/metrics" });
  assert.equal(metrics.statusCode, 200);
  assert.match(metrics.headers["content-type"], /^text\/plain; version=0\.0\.4/);
  assert.match(metrics.body, /^super_oi_up 1$/m);
  assert.match(metrics.body, /^super_oi_accounts_total 0$/m);
  assert.doesNotMatch(metrics.body, /account_id|username/i);
  console.log("health API test passed");
} finally {
  await app.close();
}
