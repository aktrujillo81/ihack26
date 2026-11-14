import "server-only";

import { lt } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { authSession } from "@/lib/db/schema";

/**
 * Deletes every expired staff session row (they hold staff IP and user agent;
 * decided by the humans: deleted at expiry, not kept). Better Auth 1.7.23
 * deletes an expired row only when that row's own cookie is read, so this runs
 * on every sign-in and from `npm run db:cleanup-sessions`. Returns the count.
 */
export async function deleteExpiredSessions(): Promise<number> {
  const deleted = await getDb()
    .delete(authSession)
    .where(lt(authSession.expiresAt, new Date()))
    .returning({ id: authSession.id });
  return deleted.length;
}
