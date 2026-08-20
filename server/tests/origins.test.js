import assert from "node:assert/strict";
import { parseAllowedOrigins } from "../origins.js";

assert.deepEqual(
  parseAllowedOrigins("http://localhost:3000, http://127.0.0.1:3000/"),
  ["http://localhost:3000", "http://127.0.0.1:3000"],
);
assert.deepEqual(
  parseAllowedOrigins(undefined, { fallback: "http://localhost:3000" }),
  ["http://localhost:3000"],
);
assert.throws(
  () => parseAllowedOrigins("https://oisimulator.example.com/app"),
  /without paths/,
);
assert.throws(
  () => parseAllowedOrigins("http://localhost:3000,"),
  /non-empty origins/,
);

console.log("origin configuration tests passed");
