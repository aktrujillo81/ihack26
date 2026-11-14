/**
 * Decides which server the integration tests may drop and recreate their
 * database on. Pure (no I/O), so tests/unit/test-db-target.test.ts covers it.
 *
 * Only a development server: the `npm run db:local` port (5434), or an explicit
 * TEST_DATABASE_URL set in the shell. The production database (5433, in `.env`)
 * is refused before any connection is made.
 */
export const TEST_DATABASE = "wellwatch_test";
export const DEV_DB_PORT = "5434";

export interface TestDbTarget {
  /** The database the tests drop, recreate and migrate. Always named TEST_DATABASE. */
  testUrl: string;
  /** Maintenance connection on the same server, used for drop/create. */
  adminUrl: string;
}

export function resolveTestDbTarget(opts: {
  /** TEST_DATABASE_URL as set in the shell (read BEFORE loading env files). */
  shellTestDatabaseUrl?: string;
  /** DATABASE_URL after loading .env.local and .env. */
  databaseUrl?: string;
}): TestDbTarget {
  let test: URL;
  if (opts.shellTestDatabaseUrl) {
    test = parse(opts.shellTestDatabaseUrl, "TEST_DATABASE_URL");
    if (test.pathname !== `/${TEST_DATABASE}`) {
      throw new Error(`TEST_DATABASE_URL must name the database "${TEST_DATABASE}" (it is dropped and recreated).`);
    }
  } else {
    if (!opts.databaseUrl) {
      throw new Error("Integration tests need DATABASE_URL (from .env.local) or TEST_DATABASE_URL, and `npm run db:local`.");
    }
    const base = parse(opts.databaseUrl, "DATABASE_URL");
    if (base.port !== DEV_DB_PORT) {
      throw new Error(
        `Refusing to run integration tests: DATABASE_URL is not the db:local server (port ${DEV_DB_PORT}). ` +
          "They drop and recreate a database. Use .env.local with `npm run db:local`, or set TEST_DATABASE_URL in the shell.",
      );
    }
    test = new URL(base.toString());
    test.pathname = `/${TEST_DATABASE}`;
  }
  const admin = new URL(test.toString());
  admin.pathname = "/postgres";
  return { testUrl: test.toString(), adminUrl: admin.toString() };
}

function parse(value: string, name: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${name} is not a valid URL.`);
  }
}
