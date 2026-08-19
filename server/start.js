import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPool, runMigrations } from "./db.js";
import { buildApp } from "./app.js";

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

function retentionDays(value) {
  const days = Number.parseInt(value ?? "30", 10);
  if (!Number.isInteger(days) || days < 1 || days > 3_650) {
    throw new Error("ACCOUNT_DELETION_RETENTION_DAYS must be an integer from 1 to 3650");
  }
  return days;
}

const databaseUrl = required("DATABASE_URL");
const sessionSecret = required("SESSION_SECRET");
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "127.0.0.1";
const appOrigin = process.env.APP_ORIGIN ?? `http://localhost:${port}`;

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port");
if (sessionSecret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");

const pool = createPool({ connectionString: databaseUrl });
const app = buildApp({
  pool,
  config: {
    environment: process.env.NODE_ENV ?? "development",
    sessionSecret,
    allowedOrigins: [appOrigin],
    accountDeletionRetentionDays: retentionDays(process.env.ACCOUNT_DELETION_RETENTION_DAYS),
    staticDir: projectRoot,
  },
});

try {
  await runMigrations(pool);
  await app.listen({ port, host });
  console.log(`Super OI Simulator running at ${appOrigin}`);
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
