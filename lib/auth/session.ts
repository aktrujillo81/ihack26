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
 * - Auth provider: Better Auth (docs/decisions.md, 2026-11-14). AGENTS.md still
 *   says Supabase and is out of date.
 * - A user belongs to ONE organization and one or more regions. The spec does
 *   not say this explicitly.
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
 * PROPOSED, NOT APPROVED: the longest a session may last from now (AC-7). A
 * session claiming to expire later is refused. The real value belongs in
 * configuration and is unknown.
 */
export const MAX_SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

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
