import "server-only";

import { parseSession, type Session } from "./session";

/**
 * PROVISIONAL. Mirrors the columns of the D1 draft `users` table
 * (branch origin/feat/database-migrations, commit 2893c47), which is NOT on
 * main yet. It is deliberately not imported from lib/db/schema.ts: that file on
 * main is still the empty placeholder, and this code must not edit it.
 *
 * D1 draft facts this relies on:
 * - `organization_id` and `region_id` are required: ONE organization and ONE
 *   region per user. The session keeps a list of regions, so the one region
 *   becomes a one-item list.
 * - `role` is the enum `org_admin | responder | viewer`, the same names the
 *   permission matrix uses.
 * - `active` is a boolean. A user who is not active is refused.
 * - `auth_subject` links the row to the auth library's user. How it is filled
 *   is not defined yet (contracts.md says "undecided"); see
 *   docs/tasks/better-auth-setup-draft.md.
 */
export interface UserRow {
  id: string;
  organizationId: string;
  regionId: string;
  role: string;
  active: boolean;
}

/**
 * Builds a validated `Session` from a database user row and the expiry of the
 * auth library's session. Role, organization and region come only from the
 * database row, never from the client.
 *
 * Fails closed: returns `null` for anything unclear, including a user that is
 * not strictly `active === true`, a missing id, organization or region, an
 * unknown role, and an expiry that is missing, loose, past, or too far away.
 * The caller treats `null` as "not signed in".
 */
export function sessionFromUser(user: unknown, expiresAt: unknown, now?: number): Session | null {
  if (typeof user !== "object" || user === null || Array.isArray(user)) return null;
  const row = user as Record<string, unknown>;
  if (row.active !== true) return null;
  if (typeof row.regionId !== "string" || row.regionId.length === 0) return null;
  return parseSession(
    {
      userId: row.id,
      role: row.role,
      organizationId: row.organizationId,
      regionIds: [row.regionId],
      expiresAt,
    },
    now,
  );
}
