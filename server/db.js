import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), "migrations");

function requireConnectionString(connectionString) {
  if (typeof connectionString !== "string" || connectionString.trim() === "") {
    throw new Error("A PostgreSQL connection string is required");
  }
  return connectionString;
}

function schemaOption(schema) {
  if (schema === undefined) return undefined;
  if (!/^[a-z_][a-z0-9_]*$/i.test(schema)) {
    throw new Error("PostgreSQL schema names must contain only letters, numbers, and underscores");
  }
  return `-c search_path=${schema}`;
}

export function createPool({ connectionString, schema } = {}) {
  return new Pool({
    connectionString: requireConnectionString(connectionString),
    options: schemaOption(schema),
  });
}

export async function listMigrations(directory = migrationsDirectory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /^\d+_.+\.sql$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

export async function runMigrations(pool, { directory = migrationsDirectory } = {}) {
  if (!pool || typeof pool.connect !== "function") {
    throw new Error("A PostgreSQL pool is required to run migrations");
  }

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    for (const version of await listMigrations(directory)) {
      await client.query("BEGIN");
      try {
        const existing = await client.query(
          "SELECT 1 FROM schema_migrations WHERE version = $1",
          [version],
        );
        if (existing.rowCount === 0) {
          await client.query(await readFile(join(directory, version), "utf8"));
          await client.query(
            "INSERT INTO schema_migrations (version) VALUES ($1)",
            [version],
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
  }
}
