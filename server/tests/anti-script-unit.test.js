import assert from "node:assert/strict";
import { createAntiScriptHook, DEFAULT_THRESHOLD_MS } from "../middleware/anti-script.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(method, accountId) {
  return {
    method,
    account: accountId ? { id: accountId } : undefined,
  };
}

function makeReply() {
  let statusCode;
  let body;
  return {
    code(status) {
      statusCode = status;
      return {
        send(payload) {
          body = payload;
          return this;
        },
      };
    },
    get statusCode() { return statusCode; },
    get body() { return body; },
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Tests ────────────────────────────────────────────────────────────────────

// 1. DEFAULT_THRESHOLD_MS export
assert.equal(DEFAULT_THRESHOLD_MS, 30, "DEFAULT_THRESHOLD_MS should be 30");

// 2. thresholdMs=0 disables the hook entirely
{
  const hook = createAntiScriptHook({ thresholdMs: 0 });
  const req = makeRequest("POST", "user-1");
  const reply = makeReply();
  await hook(req, reply);
  assert.equal(reply.statusCode, undefined, "No 429 when threshold is 0");
}

// 3. thresholdMs=-1 also disables the hook
{
  const hook = createAntiScriptHook({ thresholdMs: -1 });
  const req = makeRequest("POST", "user-1");
  const reply = makeReply();
  await hook(req, reply);
  assert.equal(reply.statusCode, undefined, "No 429 when threshold is negative");
}

// 4. GET requests pass through
{
  const hook = createAntiScriptHook({ thresholdMs: 30 });
  const req = makeRequest("GET", "user-1");
  const reply = makeReply();
  await hook(req, reply);
  assert.equal(reply.statusCode, undefined, "GET should not be rate limited");
}

// 5. First POST from an account succeeds
{
  const hook = createAntiScriptHook({ thresholdMs: 30 });
  const req = makeRequest("POST", "user-1");
  const reply = makeReply();
  await hook(req, reply);
  assert.equal(reply.statusCode, undefined, "First POST should succeed");
}

// 6. Rapid second POST is blocked (429)
{
  const hook = createAntiScriptHook({ thresholdMs: 50 });
  const req1 = makeRequest("POST", "user-rapid");
  const reply1 = makeReply();
  await hook(req1, reply1);
  assert.equal(reply1.statusCode, undefined, "First POST succeeds");

  const req2 = makeRequest("POST", "user-rapid");
  const reply2 = makeReply();
  await hook(req2, reply2);
  assert.equal(reply2.statusCode, 429, "Rapid second POST should be blocked");
  assert.equal(reply2.body.code, "REQUEST_TOO_FREQUENT");
}

// 7. POST after waiting succeeds
{
  const hook = createAntiScriptHook({ thresholdMs: 30 });
  const req1 = makeRequest("POST", "user-wait");
  const reply1 = makeReply();
  await hook(req1, reply1);
  assert.equal(reply1.statusCode, undefined);

  await sleep(40);

  const req2 = makeRequest("POST", "user-wait");
  const reply2 = makeReply();
  await hook(req2, reply2);
  assert.equal(reply2.statusCode, undefined, "POST after delay should succeed");
}

// 8. Different accounts are independent
{
  const hook = createAntiScriptHook({ thresholdMs: 50 });
  const req1 = makeRequest("POST", "user-a");
  const reply1 = makeReply();
  await hook(req1, reply1);
  assert.equal(reply1.statusCode, undefined);

  const req2 = makeRequest("POST", "user-b");
  const reply2 = makeReply();
  await hook(req2, reply2);
  assert.equal(reply2.statusCode, undefined, "Different account should succeed");
}

// 9. Requests without account pass through (unauthenticated)
{
  const hook = createAntiScriptHook({ thresholdMs: 30 });
  const req = makeRequest("POST", undefined);
  const reply = makeReply();
  await hook(req, reply);
  assert.equal(reply.statusCode, undefined, "Unauthenticated requests pass through");
}

// 10. PUT and DELETE are also rate limited
{
  const hook = createAntiScriptHook({ thresholdMs: 50 });
  const req1 = makeRequest("PUT", "user-put");
  const reply1 = makeReply();
  await hook(req1, reply1);
  assert.equal(reply1.statusCode, undefined);

  const req2 = makeRequest("DELETE", "user-put");
  const reply2 = makeReply();
  await hook(req2, reply2);
  assert.equal(reply2.statusCode, 429, "DELETE after PUT should be blocked");
}

console.log("anti-script unit tests passed");
