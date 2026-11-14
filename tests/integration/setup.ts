import { randomBytes } from "node:crypto";

import { afterAll, inject } from "vitest";

// Point every server module at the test database before any of them is imported.
process.env.DATABASE_URL = inject("testDatabaseUrl");
// Throwaway values for this run only (not secrets).
process.env.BETTER_AUTH_SECRET = randomBytes(32).toString("base64url");
process.env.BETTER_AUTH_URL = "http://127.0.0.1:3162";
process.env.SEED_ADMIN_PASSWORD = randomBytes(12).toString("base64url");
process.env.SEED_RESPONDER_PASSWORD = randomBytes(12).toString("base64url");
process.env.SEED_VIEWER_PASSWORD = randomBytes(12).toString("base64url");

afterAll(async () => {
  const g = globalThis as unknown as { wellWatchSql?: { end: (o?: { timeout?: number }) => Promise<void> } };
  await g.wellWatchSql?.end({ timeout: 1 });
});
