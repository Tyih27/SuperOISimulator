import assert from "node:assert/strict";
import { ApiError, createApiClient } from "../api/client.js";

const requests = [];
const fetchImpl = async (url, options) => {
  requests.push({ url, options });
  return {
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    json: async () => ({ ok: true }),
  };
};

const client = createApiClient({ fetchImpl });
assert.deepEqual(await client.post("/auth/login", { username: "alice01", password: "correct horse battery" }), { ok: true });
assert.equal(requests[0].url, "/api/v1/auth/login");
assert.equal(requests[0].options.credentials, "same-origin");
assert.equal(requests[0].options.headers["content-type"], "application/json");
assert.equal(requests[0].options.body, JSON.stringify({ username: "alice01", password: "correct horse battery" }));

assert.deepEqual(await client.delete("/account", { password: "correct horse battery" }), { ok: true });
assert.equal(requests[1].options.method, "DELETE");
assert.equal(requests[1].options.body, JSON.stringify({ password: "correct horse battery" }));

const noContent = createApiClient({ fetchImpl: async () => ({ ok: true, status: 204, headers: { get: () => "" } }) });
assert.equal(await noContent.post("/auth/logout"), null);

const rejected = createApiClient({ fetchImpl: async () => ({
  ok: false,
  status: 401,
  headers: { get: () => "application/json" },
  json: async () => ({ code: "UNAUTHENTICATED", message: "Authentication required" }),
}) });
await assert.rejects(() => rejected.get("/profile"), (error) => error instanceof ApiError && error.status === 401 && error.code === "UNAUTHENTICATED");

console.log("api client tests passed");
