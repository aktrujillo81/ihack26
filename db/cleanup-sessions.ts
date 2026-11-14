/**
 * npm run db:cleanup-sessions — deletes expired staff session rows (for the
 * demo reset). Sign-in also does this automatically. Prints only a count.
 * Env precedence: shell, then .env.local, then .env.
 */
export {};

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // File missing: fine.
  }
}

async function main() {
  const { deleteExpiredSessions } = await import("../lib/auth/session-cleanup");
  const count = await deleteExpiredSessions();
  console.log(`[db:cleanup-sessions] Deleted ${count} expired session(s).`);
  process.exit(0);
}

main().catch(() => {
  // Fixed message only: errors can carry connection strings or query parameters.
  console.error("[db:cleanup-sessions] Failed.");
  process.exit(1);
});
