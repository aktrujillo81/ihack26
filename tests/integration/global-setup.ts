import path from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { TestProject } from "vitest/node";

import { TEST_DATABASE, resolveTestDbTarget } from "./test-db-target";

declare module "vitest" {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}

/**
 * Recreates the `wellwatch_test` database and applies db/migrations, on a
 * development server only (see ./test-db-target.ts). Refuses anything else
 * before connecting.
 */
export default async function setup(project: TestProject) {
  // Read before loading env files, so only a value set in the shell counts.
  const shellTestDatabaseUrl = process.env.TEST_DATABASE_URL;
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // File missing: fine.
    }
  }
  const { testUrl, adminUrl } = resolveTestDbTarget({ shellTestDatabaseUrl, databaseUrl: process.env.DATABASE_URL });

  const admin = postgres(adminUrl, { max: 1, connect_timeout: 5, onnotice: () => {} });
  try {
    await admin`select 1`;
  } catch {
    await admin.end({ timeout: 1 });
    throw new Error("Integration tests could not reach the test Postgres server. Start it with `npm run db:local`.");
  }
  await admin.unsafe(`drop database if exists ${TEST_DATABASE} with (force)`);
  await admin.unsafe(`create database ${TEST_DATABASE}`);
  await admin.end();

  const sql = postgres(testUrl, { max: 1, onnotice: () => {} });
  await migrate(drizzle(sql), { migrationsFolder: path.resolve("db/migrations") });
  await sql.end();

  project.provide("testDatabaseUrl", testUrl);
}
