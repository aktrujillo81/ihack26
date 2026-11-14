/**
 * npm run db:seed:demo: adds invented demo water points, complaints, reports,
 * notes and partners to the demo organization (run `npm run db:seed` first).
 *
 * It REFUSES to run unless DATABASE_URL is a local development database that
 * is not port 5433 (production). The check happens before the database module
 * is even loaded, and its messages never print the connection string.
 * No credentials are in this file or in the demo data.
 *
 * Runs outside Next.js with tsx and the `react-server` condition, so the
 * `server-only` imports resolve. Loads env files with Next.js precedence:
 * shell, then .env.local, then .env.
 */
import { assertDevelopmentDatabase, UnsafeDatabaseError } from "./guard";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // File missing: fine.
  }
}

async function main() {
  try {
    // Read through the env module (red line 16), imported only now that the env files are loaded.
    const { serverEnv } = await import("@/lib/config/env");
    let url: string | undefined;
    try {
      url = serverEnv.databaseUrl;
    } catch {
      url = undefined; // unset: the guard refuses
    }
    assertDevelopmentDatabase(url);
  } catch (error) {
    if (error instanceof UnsafeDatabaseError) {
      console.error(`[db:seed:demo] ${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  const { runDemoSeed, DemoSeedError } = await import("./demo");
  try {
    const result = await runDemoSeed();
    if (result.status === "already_seeded") {
      console.log("[db:seed:demo] The demo data is already there. Nothing changed.");
    } else {
      const c = result.counts;
      console.log(
        `[db:seed:demo] Done in organization ${result.organizationId}: ${c.waterPoints} water points, ${c.complaints} complaints, ${c.reports} reports, ${c.notes} notes, ${c.partners} partners, ${c.historyEvents} history events. All invented; history times are made up.`,
      );
    }
    process.exit(0);
  } catch (error) {
    if (error instanceof DemoSeedError) {
      console.error(`[db:seed:demo] ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

main().catch(() => {
  // Fixed message only: errors can carry connection strings or query parameters.
  console.error("[db:seed:demo] Failed.");
  process.exit(1);
});
