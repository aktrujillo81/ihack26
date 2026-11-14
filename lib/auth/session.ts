import "server-only";

import { SESSION_LIFETIME_SECONDS } from "../config/auth";
import { isRole } from "../permissions/matrix";
import type { Role } from "../domain/types";

/**
 * The application session shape. Better Auth (task A1) owns the login identity;
 * lib/auth/adapter.ts turns it into this shape through the D1 `users` row
 * (lib/auth/user-session.ts) and `parseSession` re-validates it. Nothing in the
 * app trusts a session that did not pass `parseSession`.
 *
 * Still PROVISIONAL until docs/contracts.md names it: one organization and ONE
 * region per user (D1: users.organization_id, users.region_id), kept as a list
 * of regions so several can be added later.
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
 * later is refused. Imported from the one source for the value,
 * lib/config/auth.ts (staff sessions last 12 hours, decided by the humans,
 * 2026-11-14), so the auth library and this check can never disagree.
 */
export const MAX_SESSION_LIFETIME_MS = SESSION_LIFETIME_SECONDS * 1000;

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
 * The raw session for the current request, or `null`. Server components, route
 * handlers and actions call this and pass the result to `parseSession` or one of
 * the guards in ./guards.ts; nothing may use the raw value directly.
 *
 * Reads Better Auth's session (signed cookie, row read from the database every
 * time, no cookie cache), then the D1 `users` row, through lib/auth/adapter.ts.
 * Fails closed: no cookie, forged cookie, signed out, expired, inactive user,
 * archived region or organization, no matching row, or any error gives `null`.
 * There is no mock user and no pass-through.
 */
export async function getCurrentSession(): Promise<unknown> {
  try {
    // Imported here so importing this module never loads Better Auth or the database.
    const { readSessionFromHeaders } = await import("./adapter");
    return await readSessionFromHeaders();
  } catch {
    return null;
  }
}
