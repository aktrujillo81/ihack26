import path from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { TestProject } from "vitest/node";

export const TEST_DATABASE = "wellwatch_test";

declare module "vitest" {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}

/**
 * Recreates the `wellwatch_test` database on the server named by DATABASE_URL
 * and applies db/migrations. Never touches the development database itself.
 */
export default async function setup(project: TestProject) {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // File missing: fine.
    }
  }
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("Integration tests need DATABASE_URL (see .env.example) and a running Postgres (npm run db:local).");

  const testUrl = new URL(base);
  if (testUrl.pathname === `/${TEST_DATABASE}`) throw new Error("DATABASE_URL must name the development database, not the test one.");
  testUrl.pathname = `/${TEST_DATABASE}`;

  const admin = postgres(base, { max: 1, connect_timeout: 5, onnotice: () => {} });
  try {
    await admin`select 1`;
  } catch {
    await admin.end({ timeout: 1 });
    throw new Error("Integration tests could not reach Postgres at DATABASE_URL. Start it with `npm run db:local`.");
  }
  await admin.unsafe(`drop database if exists ${TEST_DATABASE} with (force)`);
  await admin.unsafe(`create database ${TEST_DATABASE}`);
  await admin.end();

  const sql = postgres(testUrl.toString(), { max: 1, onnotice: () => {} });
  await migrate(drizzle(sql), { migrationsFolder: path.resolve("db/migrations") });
  await sql.end();

  project.provide("testDatabaseUrl", testUrl.toString());
}
