import Fastify from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { createAntiScriptHook } from "./middleware/anti-script.js";
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, join, normalize, resolve } from "node:path";
import { authRoutes } from "./routes/auth.js";
import { profileRoutes } from "./routes/profile.js";
import { progressionRoutes } from "./routes/progression.js";
import { battleRoutes } from "./routes/battles.js";
import { accountDataRoutes } from "./routes/account-data.js";
import { arenaRoutes } from "./routes/arena.js";
import { metricsRoutes } from "./routes/metrics.js";
import { feedbackRoutes } from "./routes/feedback.js";

function requirePool(pool) {
  if (!pool || typeof pool.query !== "function") {
    throw new Error("buildApp requires a PostgreSQL pool");
  }
  return pool;
}

function requireSessionSecret(secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("config.sessionSecret must contain at least 32 characters");
  }
  return secret;
}

const CONTENT_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
});

function staticPath(staticDir, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relative = normalize(decoded === "/" ? "index.html" : decoded.replace(/^[/\\]+/, ""));
  const isPublicAsset = relative === "index.html"
    || relative === "favicon.ico"
    || relative.startsWith("assets/")
    || relative.startsWith("src/")
    || relative.startsWith("styles/");
  if (!isPublicAsset) return null;
  const root = resolve(staticDir);
  const file = resolve(join(root, relative));
  return file === root || file.startsWith(`${root}/`) ? file : null;
}

function configureStaticFiles(app, staticDir) {
  if (typeof staticDir !== "string" || staticDir.trim() === "") return;
  const root = isAbsolute(staticDir) ? staticDir : resolve(staticDir);
  app.setNotFoundHandler(async (request, reply) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return reply.code(404).send({ code: "NOT_FOUND", message: "Route not found" });
    }
    if (request.url.startsWith("/api/")) {
      return reply.code(404).send({ code: "NOT_FOUND", message: "Route not found" });
    }
    const pathname = new URL(request.url, "http://localhost").pathname;
    const file = staticPath(root, pathname);
    if (!file) return reply.code(404).send({ code: "NOT_FOUND", message: "File not found" });
    try {
      const content = await readFile(file);
      return reply.type(CONTENT_TYPES[extname(file)] ?? "application/octet-stream").send(request.method === "HEAD" ? undefined : content);
    } catch (error) {
      if (error?.code === "ENOENT" || error?.code === "EISDIR") {
        return reply.code(404).send({ code: "NOT_FOUND", message: "File not found" });
      }
      throw error;
    }
  });
}

export function buildApp({ pool, config = {} } = {}) {
  const app = Fastify({
    logger: config.logger ?? false,
    // Reject unknown request fields instead of silently dropping forged data.
    ajv: { customOptions: { removeAdditional: false } },
  });
  app.decorate("db", requirePool(pool));
  app.decorate("config", Object.freeze({
    ...config,
    isProduction: config.isProduction ?? config.environment === "production",
  }));

  app.get("/health", async () => {
    await app.db.query("SELECT 1");
    return { status: "ok" };
  });
  app.register(metricsRoutes);

  app.register(async (api) => {
    await api.register(cookie, {
      secret: requireSessionSecret(config.sessionSecret),
      hook: "onRequest",
    });
    await api.register(rateLimit, { global: false });
    api.addHook("onRequest", createAntiScriptHook({ thresholdMs: config.antiScriptThresholdMs ?? 30 }));
    await api.register(authRoutes, { prefix: "/api/v1/auth" });
    await api.register(accountDataRoutes, { prefix: "/api/v1/account" });
    await api.register(feedbackRoutes, { prefix: "/api/v1/account/feedback" });
    await api.register(profileRoutes, { prefix: "/api/v1/profile" });
    await api.register(progressionRoutes, { prefix: "/api/v1/progression" });
    await api.register(battleRoutes, { prefix: "/api/v1" });
    await api.register(arenaRoutes, { prefix: "/api/v1/arena" });
  });

  configureStaticFiles(app, config.staticDir);

  return app;
}
