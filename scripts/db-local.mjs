#!/usr/bin/env node
/**
 * Local PostgreSQL 17 without Docker, for development only.
 *
 *   npm run db:local     (leave it running; Ctrl+C stops it)
 *
 * Uses the `embedded-postgres` package, which installs real Postgres binaries
 * for your OS through npm. Data lives in `.pgdata/` (gitignored), so it
 * survives restarts. Delete that folder to start from an empty database.
 *
 * Reads POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB and POSTGRES_PORT from
 * the shell, then `.env.local`, then `.env` (same names as compose.yaml), so
 * DATABASE_URL stays the same whether you use Docker or this script.
 *
 * Listens on 127.0.0.1 only. Never use this on the host server.
 */
import { existsSync } from "node:fs";
import path from "node:path";

import EmbeddedPostgres from "embedded-postgres";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // File missing: fine.
  }
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env.local and fill it in.`);
  return value;
}

async function main() {
  const user = required("POSTGRES_USER");
  const password = required("POSTGRES_PASSWORD");
  const database = required("POSTGRES_DB");
  const port = Number(process.env.POSTGRES_PORT || 5433);
  const databaseDir = path.resolve(".pgdata");

  const pg = new EmbeddedPostgres({
    databaseDir,
    port,
    user,
    password,
    authMethod: "scram-sha-256",
    persistent: true,
    // Never listen on a network interface, only on this machine.
    postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
    onLog: () => {},
    onError: (message) => console.error(`[postgres] ${message}`),
  });

  if (!existsSync(path.join(databaseDir, "PG_VERSION"))) {
    console.log("[db:local] First run: creating the database cluster in .pgdata/ ...");
    await pg.initialise();
  }

  try {
    await pg.start();
  } catch {
    throw new Error(
      `Postgres did not start. Is something else (for example the Docker database) already using port ${port}?`,
    );
  }

  const client = pg.getPgClient("postgres", "127.0.0.1");
  await client.connect();
  const { rowCount } = await client.query("select 1 from pg_database where datname = $1", [database]);
  if (!rowCount) {
    await client.query(`create database ${client.escapeIdentifier(database)}`);
    console.log(`[db:local] Created database "${database}".`);
  }
  await client.end();

  console.log(`[db:local] Postgres 17 is ready on 127.0.0.1:${port}. Press Ctrl+C to stop.`);
  // Keep the process alive. embedded-postgres stops the server on Ctrl+C or exit.
  setInterval(() => {}, 1 << 30);
}

main().catch((error) => {
  console.error(`[db:local] ${error.message}`);
  // Let the process end on its own so embedded-postgres can clean up.
  process.exitCode = 1;
});
