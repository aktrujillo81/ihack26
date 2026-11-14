/**
 * The demo seed writes a lot of invented rows, so it must never run against the
 * production database (docs/decisions.md: port 5433 on the host is production;
 * development uses `npm run db:local` on 5434). Pure: no database, no env reads,
 * so it is unit-tested.
 *
 * Messages name the host and port only, never the connection string (it holds
 * the password).
 */
export const PRODUCTION_DB_PORT = "5433";

export class UnsafeDatabaseError extends Error {}

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

/**
 * Throws unless the URL points at a local development database that is not the
 * production port. Refuses: a missing or invalid URL, any non-local host,
 * port 5433, and any run with NODE_ENV=production.
 */
export function assertDevelopmentDatabase(databaseUrl: string | undefined, nodeEnv: string | undefined = process.env.NODE_ENV): void {
  if (nodeEnv === "production") {
    throw new UnsafeDatabaseError("Refusing to seed: NODE_ENV is production.");
  }
  if (!databaseUrl) {
    throw new UnsafeDatabaseError("Refusing to seed: DATABASE_URL is not set. Use .env.local with `npm run db:local` (port 5434).");
  }
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new UnsafeDatabaseError("Refusing to seed: DATABASE_URL is not a valid URL.");
  }
  if (!LOCAL_HOSTS.has(url.hostname.toLowerCase())) {
    throw new UnsafeDatabaseError(`Refusing to seed: the database host "${url.hostname}" is not this machine.`);
  }
  if (url.port === PRODUCTION_DB_PORT) {
    throw new UnsafeDatabaseError(
      `Refusing to seed: port ${PRODUCTION_DB_PORT} is the production database. Use \`npm run db:local\` (port 5434).`,
    );
  }
}
