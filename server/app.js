import Fastify from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { authRoutes } from "./routes/auth.js";

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

export function buildApp({ pool, config = {} } = {}) {
  const app = Fastify({ logger: config.logger ?? false });
  app.decorate("db", requirePool(pool));
  app.decorate("config", Object.freeze({
    ...config,
    isProduction: config.isProduction ?? config.environment === "production",
  }));

  app.get("/health", async () => ({ status: "ok" }));

  app.register(async (api) => {
    await api.register(cookie, {
      secret: requireSessionSecret(config.sessionSecret),
      hook: "onRequest",
    });
    await api.register(rateLimit, { global: false });
    await api.register(authRoutes, { prefix: "/api/v1/auth" });
  });

  return app;
}
