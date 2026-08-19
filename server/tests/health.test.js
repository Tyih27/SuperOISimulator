import assert from "node:assert/strict";
import { buildTestApp } from "./helpers.js";

const app = await buildTestApp();

try {
  const response = await app.inject({ method: "GET", url: "/health" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });
  console.log("health API test passed");
} finally {
  await app.close();
}
