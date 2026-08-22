import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPool, runMigrations } from "./db.js";
import { buildApp } from "./app.js";
import { ensureAdminAccount } from "./services/auth-service.js";
import { openBrowser, shouldOpenBrowser } from "./browser.js";
import { parseAllowedOrigins } from "./origins.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(resolve(projectRoot, ".env"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required; copy .env.example to .env and configure it`);
  return value;
}

const databaseUrl = required("DATABASE_URL");
const sessionSecret = required("SESSION_SECRET");
const environment = process.env.NODE_ENV ?? "development";
const openBrowserOnStart = shouldOpenBrowser(process.env.OPEN_BROWSER, {
  environment,
  ci: process.env.CI === "true",
});
const secureCookies = process.env.SECURE_COOKIES ?? (environment === "production" ? undefined : "false");
if (secureCookies !== "true" && secureCookies !== "false") {
  throw new Error("SECURE_COOKIES is required and must be true or false");
}
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "127.0.0.1";
const allowedOrigins = parseAllowedOrigins(process.env.APP_ORIGIN, {
  fallback: `http://localhost:${port}`,
});
const browserOrigin = parseAllowedOrigins(process.env.BROWSER_ORIGIN, {
  variableName: "BROWSER_ORIGIN",
  fallback: allowedOrigins[0],
})[0];
const adminUsername = process.env.ADMIN_USERNAME?.trim() || "admin";
const adminPassword = process.env.ADMIN_PASSWORD?.trim() || "superoi-admin";

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port");
if (sessionSecret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");

const pool = createPool({ connectionString: databaseUrl });
const app = buildApp({
  pool,
  config: {
    environment,
    sessionSecret,
    secureCookies: secureCookies === "true",
    allowedOrigins,
    staticDir: projectRoot,
  },
});

try {
  await runMigrations(pool);
  await ensureAdminAccount(pool, { username: adminUsername, password: adminPassword });
  await app.listen({ port, host });
  const browserUrl = `${browserOrigin.replace(/\/$/, "")}/`;
  console.log(`Super OI Simulator running at ${allowedOrigins.join(", ")}`);
  if (openBrowserOnStart) openBrowser(browserUrl);
} catch (error) {
  await app.close().catch(() => {});
  await pool.end().catch(() => {});
  console.error(error);
  process.exitCode = 1;
}

const shutdown = async () => {
  await app.close();
  await pool.end();
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
