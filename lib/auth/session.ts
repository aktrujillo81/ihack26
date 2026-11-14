import "server-only";

import { isRole } from "../permissions/matrix";
import type { Role } from "../domain/types";

/**
 * PROVISIONAL session shape. Better Auth is not wired yet and the D1 tables
 * (users, roles, organizations, regions) do not exist, so every field here is
 * an assumption. When the real session exists, write one adapter that turns it
 * into this shape and passes it through `parseSession`. Nothing else changes.
 *
 * Assumptions, all PROVISIONAL until D1 and docs/contracts.md exist:
 * - Auth provider: Better Auth (docs/decisions.md, 2026-11-14; AGENTS.md agrees).
 *   Its tables and session shape are not confirmed yet.
 * - A user belongs to ONE organization and ONE region in the D1 draft
 *   (users.organization_id, users.region_id), kept here as a list of regions so
 *   several can be added later. ./user-session.ts maps a user row to this shape.
 * - The adapter must read role, organization and regions from the database or a
 *   signed server-side session, never from a client-readable cookie or header,
 *   and should look them up on every request so role changes and deactivation
 *   take effect immediately, not at expiry.
 */
export interface Session {
  userId: string;
  role: Role;
  organizationId: string;
  regionIds: string[];
  /** ISO timestamp. Required: sessions expire (AC-7). A session with no expiry is refused. */
  expiresAt: string;
}

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.length > 0;

/** Strict ISO 8601 with a timezone. `Date.parse` alone also accepts loose strings like "Dec 25 2099". */
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * The longest a session may last from now (AC-7). A session claiming to expire
 * later is refused. 12 hours, the humans' decision (2026-11-14: staff sessions
 * last 12 hours, one config value; recorded in docs/decisions.md on the A1
 * branch, feat/auth-roles). The auth library's own session length must be set
 * at or below this, or its sessions will be refused here.
 *
 * PROVISIONAL: the single source of truth for the length is A1's config value
 * (lib/config/auth.ts on that branch). When A1 is on main, import it instead of
 * repeating the number here.
 */
export const MAX_SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;

/**
 * Strictly validates an untrusted value. Returns a session only if every field
 * is well formed and the session has not expired. Anything else is `null`
 * (fail closed). Never trusts a role or scope that came from the client.
 */
export function parseSession(
  raw: unknown,
  now: number = Date.now(),
  maxLifetimeMs: number = MAX_SESSION_LIFETIME_MS,
): Session | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const s = raw as Record<string, unknown>;
  if (!isNonEmptyString(s.userId) || !isRole(s.role) || !isNonEmptyString(s.organizationId)) return null;
  if (!Array.isArray(s.regionIds) || s.regionIds.length === 0 || !s.regionIds.every(isNonEmptyString)) return null;
  if (!isNonEmptyString(s.expiresAt) || !ISO_TIMESTAMP.test(s.expiresAt)) return null;
  const expires = Date.parse(s.expiresAt);
  if (!Number.isFinite(expires) || expires <= now || expires - now > maxLifetimeMs) return null;
  return {
    userId: s.userId,
    role: s.role,
    organizationId: s.organizationId,
    regionIds: [...s.regionIds],
    expiresAt: s.expiresAt,
  };
}

/**
 * WIRING POINT (W1, after D1): read the Better Auth session from the request
 * (cookies and headers on the server), map it to the `Session` shape, and
 * return it. Until then this returns `null`, so every protected route is
 * refused. There is no mock user and no pass-through.
 */
export async function getCurrentSession(): Promise<unknown> {
  return null;
}
