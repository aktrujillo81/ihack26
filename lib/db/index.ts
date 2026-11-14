import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { serverEnv } from "@/lib/config/env";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

// Reuse one connection pool across hot reloads in development.
const globalForDb = globalThis as unknown as { wellWatchSql?: postgres.Sql; wellWatchDb?: Db };

function connect(): Db {
  if (!globalForDb.wellWatchDb) {
    // connect_timeout (seconds) keeps /api/health from hanging if the database is unreachable.
    globalForDb.wellWatchSql = postgres(serverEnv.databaseUrl, { max: 10, connect_timeout: 5 });
    globalForDb.wellWatchDb = drizzle(globalForDb.wellWatchSql, { schema });
  }
  return globalForDb.wellWatchDb;
}

/** Lazily connected so that importing this module never needs the database. */
export function getDb(): Db {
  return connect();
}

/** Returns true when the database answers a trivial query. */
export async function pingDb(): Promise<boolean> {
  try {
    connect();
    await globalForDb.wellWatchSql!`select 1`;
    return true;
  } catch {
    // Fixed code only: never log the error message or connection string.
    console.error("[health] db_unreachable");
    return false;
  }
}
