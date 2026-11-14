import "server-only";

import { isRole } from "../permissions/matrix";
import type { Role } from "../domain/types";

/**
 * PROVISIONAL session shape. Better Auth is not wired yet and the D1 tables
 * (users, roles, organizations, regions) do not exist, so every field here is
 * an assumption. When the real session exists, write one adapter that turns it
 * into this shape and passes it through `parseSession`. Nothing else changes.
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

/**
 * Strictly validates an untrusted value. Returns a session only if every field
 * is well formed and the session has not expired. Anything else is `null`
 * (fail closed). Never trusts a role or scope that came from the client.
 */
export function parseSession(raw: unknown, now: number = Date.now()): Session | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const s = raw as Record<string, unknown>;
  if (!isNonEmptyString(s.userId) || !isRole(s.role) || !isNonEmptyString(s.organizationId)) return null;
  if (!Array.isArray(s.regionIds) || s.regionIds.length === 0 || !s.regionIds.every(isNonEmptyString)) return null;
  if (!isNonEmptyString(s.expiresAt)) return null;
  const expires = Date.parse(s.expiresAt);
  if (!Number.isFinite(expires) || expires <= now) return null;
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
