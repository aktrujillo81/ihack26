/**
 * npm run db:seed — creates the demo organization, region and one account per
 * role (AC-4). Safe to run more than once. Never prints a password or hash.
 *
 * Runs outside Next.js with tsx and the `react-server` condition, so the
 * `server-only` imports resolve. Loads env files with Next.js precedence:
 * shell, then .env.local, then .env.
 */
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // File missing: fine.
  }
}

async function main() {
  const { runSeed, readSeedPasswords, SeedConfigError } = await import("./seed");
  let passwords;
  try {
    passwords = readSeedPasswords();
  } catch (error) {
    if (error instanceof SeedConfigError) {
      console.error(`[db:seed] ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
  await runSeed(passwords);
  console.log("[db:seed] Done: 1 organization, 1 region, 3 accounts (org_admin, responder, viewer).");
  process.exit(0);
}

main().catch(() => {
  // Fixed message only: errors can carry connection strings or query parameters.
  console.error("[db:seed] Failed.");
  process.exit(1);
});
