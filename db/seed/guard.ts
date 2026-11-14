/**
 * The demo seed writes a lot of invented rows, so it must never run against the
 * production database (docs/decisions.md: port 5433 on the host is production;
 * development uses `npm run db:local` on 5434). Pure: no database, no file
 * reads, so it is unit-tested.
 *
 * AN ALLOWLIST, NOT A BLOCKLIST. The database driver does not read only the
 * URL's host and port: it also honors `?host=` and `?port=` in the query string
 * and the PGHOST, PGPORT and PGHOSTADDR variables, and it cuts the address at
 * different characters than the WHATWG `URL` parser does. A check that only
 * looks at `new URL(...).port` can say "5434" while the driver connects to 5433.
 * So this accepts a URL only if it is the plain, boring shape we expect:
 *   - protocol postgres: or postgresql:
 *   - host exactly 127.0.0.1, localhost or [::1]
 *   - port written, and exactly one of the allowed ports (default: 5434 only)
 *   - NO query string, NO fragment, no backslash, and exactly one "@"
 * and it refuses when any of PGHOST, PGHOSTADDR, PGPORT, PGSERVICE or
 * PGSERVICEFILE is set (the driver would use them).
 *
 * Messages name the host and port only, never the connection string (it holds
 * the password).
 */
export const PRODUCTION_DB_PORT = "5433";

/** The `npm run db:local` development database. The default, and the only port the command line accepts. */
export const DEV_DB_PORT = "5434";

export class UnsafeDatabaseError extends Error {}

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/** Environment variables the Postgres driver would honor in place of (or beside) the URL. */
const DRIVER_ENV = ["PGHOST", "PGHOSTADDR", "PGPORT", "PGSERVICE", "PGSERVICEFILE"] as const;

export interface GuardOptions {
  /** Ports that may be used. Default: the development database only. Never include 5433. */
  allowedPorts?: readonly string[];
  /** Where to read PGHOST and the rest from. Default: process.env. */
  env?: Record<string, string | undefined>;
  /** Default: process.env.NODE_ENV. */
  nodeEnv?: string | undefined;
}

/**
 * Throws unless the URL is a plain local development database on an allowed
 * port. Refuses: NODE_ENV=production, driver environment variables, a missing
 * or odd URL, any query string or fragment, any host that is not this machine,
 * a missing port, port 5433 (production), and any port not on the allowlist.
 */
export function assertDevelopmentDatabase(databaseUrl: string | undefined, options: GuardOptions = {}): void {
  const allowedPorts = options.allowedPorts ?? [DEV_DB_PORT];
  const env = options.env ?? process.env;
  const nodeEnv = "nodeEnv" in options ? options.nodeEnv : process.env.NODE_ENV;

  if (allowedPorts.includes(PRODUCTION_DB_PORT)) {
    throw new UnsafeDatabaseError("Refusing to seed: the production port can never be allowed.");
  }
  if (nodeEnv === "production") {
    throw new UnsafeDatabaseError("Refusing to seed: NODE_ENV is production.");
  }
  for (const name of DRIVER_ENV) {
    if (env[name]) {
      throw new UnsafeDatabaseError(`Refusing to seed: ${name} is set, and the database driver would use it instead of the URL.`);
    }
  }
  if (!databaseUrl) {
    throw new UnsafeDatabaseError("Refusing to seed: DATABASE_URL is not set. Use .env.local with `npm run db:local` (port 5434).");
  }
  // Characters the driver and the URL parser read differently, or that can smuggle in another host or port.
  if (/[?#\\\s]/.test(databaseUrl) || (databaseUrl.match(/@/g) ?? []).length !== 1) {
    throw new UnsafeDatabaseError("Refusing to seed: DATABASE_URL has a query string, fragment or unusual characters. Use a plain URL.");
  }
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new UnsafeDatabaseError("Refusing to seed: DATABASE_URL is not a valid URL.");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new UnsafeDatabaseError("Refusing to seed: DATABASE_URL is not a postgres URL.");
  }
  if (!LOCAL_HOSTS.has(url.hostname.toLowerCase())) {
    throw new UnsafeDatabaseError(`Refusing to seed: the database host "${url.hostname}" is not this machine.`);
  }
  if (url.port === PRODUCTION_DB_PORT) {
    throw new UnsafeDatabaseError(
      `Refusing to seed: port ${PRODUCTION_DB_PORT} is the production database. Use \`npm run db:local\` (port ${DEV_DB_PORT}).`,
    );
  }
  if (url.port === "") {
    throw new UnsafeDatabaseError(`Refusing to seed: DATABASE_URL has no port. It must say ${allowedPorts.join(" or ")} explicitly.`);
  }
  if (!allowedPorts.includes(url.port)) {
    throw new UnsafeDatabaseError(`Refusing to seed: port ${url.port} is not allowed. Use \`npm run db:local\` (port ${DEV_DB_PORT}).`);
  }
}
