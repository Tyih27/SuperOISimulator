/**
 * Anti-script middleware: enforces a minimum interval between consecutive
 * mutating operations from the same account. Returns 429 when violated.
 *
 * Default threshold: 30ms (configurable via `thresholdMs` option).
 * Set thresholdMs to 0 to disable (useful for e2e tests).
 * Only applies to POST / PUT / DELETE requests (GET is safe).
 * In-memory store is acceptable for a single-instance deployment.
 */

/** @type {number} Minimum interval between operations in ms. */
export const DEFAULT_THRESHOLD_MS = 30;

const MUTATING_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

export class AntiScriptError extends Error {
  constructor(message = "操作过于频繁，请稍后再试") {
    super(message);
    this.name = "AntiScriptError";
    this.code = "REQUEST_TOO_FREQUENT";
    this.statusCode = 429;
  }
}

/**
 * Create a Fastify onRequest hook that blocks mutating requests
 * arriving faster than `thresholdMs` from the same authenticated account.
 *
 * @param {{ thresholdMs?: number }} options
 * @returns {import('fastify').FastifyRequest['hooks']['onRequest']}
 */
export function createAntiScriptHook({ thresholdMs = DEFAULT_THRESHOLD_MS } = {}) {
  // When thresholdMs is 0, skip rate limiting entirely (e2e test mode).
  if (thresholdMs <= 0) {
    return async function noopHook() {};
  }

  /** @type {Map<string, number>} accountId → last request timestamp (ms) */
  const lastRequestTime = new Map();

  // Periodically prune stale entries to prevent unbounded growth.
  // Entries older than 5 minutes are removed.
  const STALE_MS = 5 * 60 * 1000;
  setInterval(() => {
    const now = Date.now();
    for (const [id, ts] of lastRequestTime) {
      if (now - ts > STALE_MS) lastRequestTime.delete(id);
    }
  }, 60_000).unref();

  return async function antiScriptHook(request, reply) {
    if (!MUTATING_METHODS.has(request.method)) return;

    const account = request.account;
    const accountId = account?.id;
    if (!accountId) return; // unauthenticated requests handled elsewhere

    const now = Date.now();
    const last = lastRequestTime.get(accountId);
    if (last !== undefined && now - last < thresholdMs) {
      return reply.code(429).send({
        code: "REQUEST_TOO_FREQUENT",
        message: "操作过于频繁，请稍后再试",
      });
    }
    lastRequestTime.set(accountId, now);
  };
}
