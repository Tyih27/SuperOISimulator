import { randomUUID } from "node:crypto";
import { createPool, runMigrations } from "../db.js";
import { buildApp } from "../app.js";

function requireDatabaseUrl(databaseUrl) {
  if (typeof databaseUrl !== "string" || databaseUrl.trim() === "") {
    throw new Error("DATABASE_URL is required for API tests");
  }
  return databaseUrl;
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll("\"", "\"\"")}"`;
}

export async function buildTestApp({ databaseUrl = process.env.DATABASE_URL, config = {} } = {}) {
  const connectionString = requireDatabaseUrl(databaseUrl);
  const schema = `test_super_oi_${randomUUID().replaceAll("-", "")}`;
  const adminPool = createPool({ connectionString });
  let pool;

  await adminPool.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);

  try {
    pool = createPool({ connectionString, schema });
    await runMigrations(pool);

    const app = buildApp({
      pool,
      config: {
        environment: "test",
        sessionSecret: "test-session-secret-with-at-least-32-characters",
        allowedOrigins: ["http://localhost:3000"],
        ...config,
      },
    });
    app.addHook("onClose", async () => {
      await pool.end();
      await adminPool.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
      await adminPool.end();
    });
    return app;
  } catch (error) {
    await pool?.end();
    await adminPool.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
    await adminPool.end();
    throw error;
  }
}
