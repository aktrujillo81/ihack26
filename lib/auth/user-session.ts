import "server-only";

import { parseSession, type Session } from "./session";

/**
 * Maps a D1 `users` row to a session. D1 is on main (PR #27) and A1 (lib/auth/users.ts)
 * selects exactly these columns, so `UserRow` mirrors them rather than importing the
 * schema type, which keeps this file free of the database. Still PROVISIONAL until
 * docs/contracts.md names the session shape.
 *
 * D1 draft facts this relies on:
 * - `organization_id` and `region_id` are required: ONE organization and ONE
 *   region per user. The session keeps a list of regions, so the one region
 *   becomes a one-item list.
 * - Ids are uuids.
 * - `role` is the enum `org_admin | responder | viewer`, the same names the
 *   permission matrix uses.
 * - `active` is a boolean. A user who is not active is refused.
 * - `auth_subject` links the row to the auth library's user. How it is filled
 *   is not defined yet (contracts.md says "undecided"); see
 *   docs/tasks/better-auth-setup-draft.md.
 *
 * NOT CHECKED HERE (the D1 draft does not enforce it either): that the user's
 * region belongs to the user's organization. See the draft doc, section 12.
 */
export interface UserRow {
  id: string;
  organizationId: string;
  regionId: string;
  role: string;
  active: boolean;
}

/** A uuid. PROVISIONAL: D1 uses uuid ids. Rejects empty, whitespace-only and non-uuid values. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The auth library's session expiry arrives as a `Date` (lib/auth/adapter.ts passes
 * `result.session.expiresAt`). Accept a valid `Date` or a strict ISO string, and
 * hand `parseSession` an ISO string. Anything else is passed through unchanged so it is refused.
 */
function expiryToIso(value: unknown): unknown {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  return value;
}

/**
 * Builds a validated `Session` from a database user row and the expiry of the
 * auth library's session. Role, organization and region come only from the
 * database row, never from the client.
 *
 * The CALLER must have found `user` by `auth_subject = <auth library user id>`
 * and must pass it only if exactly one row matched (ask for two rows and refuse
 * unless one comes back), after checking the id is a non-empty string.
 *
 * Fails closed: returns `null` for anything unclear, including a user that is
 * not strictly `active === true`, an id, organization or region that is not a
 * uuid, an unknown role, and an expiry that is missing, loose, past, or too far
 * away. The caller treats `null` as "not signed in".
 */
export function sessionFromUser(user: unknown, expiresAt: unknown, now?: number): Session | null {
  if (typeof user !== "object" || user === null || Array.isArray(user)) return null;
  const row = user as Record<string, unknown>;
  if (row.active !== true) return null;
  for (const id of [row.id, row.organizationId, row.regionId]) {
    if (typeof id !== "string" || !UUID.test(id)) return null;
  }
  return parseSession(
    {
      userId: row.id,
      role: row.role,
      organizationId: row.organizationId,
      regionIds: [row.regionId],
      expiresAt: expiryToIso(expiresAt),
    },
    now,
  );
}
