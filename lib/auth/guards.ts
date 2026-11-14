import "server-only";

import type { DataContext } from "../data/complaints";
import type { Role } from "../domain/types";
import type { PlainKey } from "../i18n/strings";
import { can, inScope, isRole, type Action } from "../permissions/matrix";
import { parseSession, type Session } from "./session";

/**
 * Server-side guards. Each takes the raw session value as input (whatever the
 * auth layer returns) and validates it itself, so a missing or malformed
 * session is refused. They fail closed: if anything is unclear, they throw.
 * Call them in every protected server component, route handler and action.
 */

export type AuthFailure =
  /** No valid, unexpired session. Send the user to sign in. */
  | "unauthenticated"
  /** Signed in, but the role does not allow the action. */
  | "forbidden"
  /** The record is in another organization or region. */
  | "out_of_scope"
  /** The record does not exist. */
  | "not_found";

export class AuthError extends Error {
  readonly kind: AuthFailure;
  constructor(kind: AuthFailure) {
    super(kind);
    this.name = "AuthError";
    this.kind = kind;
  }
}

/** A valid, unexpired session, or `AuthError("unauthenticated")`. */
export function requireSession(raw: unknown, now?: number): Session {
  const session = parseSession(raw, now);
  if (!session) throw new AuthError("unauthenticated");
  return session;
}

/** The session, if its role is one of `allowed`. An empty list allows nobody. */
export function requireRole(raw: unknown, ...allowed: Role[]): Session {
  const session = requireSession(raw);
  if (!allowed.some((r) => isRole(r) && r === session.role)) throw new AuthError("forbidden");
  return session;
}

/** The session, if its role may perform `action` (the matrix decides). */
export function requireAction(raw: unknown, action: Action): Session {
  const session = requireSession(raw);
  if (!can(session.role, action)) throw new AuthError("forbidden");
  return session;
}

/** The session, if the record is in its organization and regions. Out of scope looks like not found. */
export function requireScope(raw: unknown, record: unknown): Session {
  const session = requireSession(raw);
  if (!inScope(session, record)) throw new AuthError("out_of_scope");
  return session;
}

/**
 * Scope first, then role. A record in another organization is reported as out
 * of scope whatever the role, so a Viewer probing another organization learns
 * nothing about it.
 */
export function requireActionInScope(raw: unknown, action: Action, record: unknown): Session {
  const session = requireScope(raw, record);
  if (!can(session.role, action)) throw new AuthError("forbidden");
  return session;
}

/** The data layer context for a session: the only place a `DataContext` is made from a user. */
export function toDataContext(session: Session): DataContext {
  return { organizationId: session.organizationId, regionIds: [...session.regionIds] };
}

/**
 * The message a screen shows for a failure. Out of scope and not found share
 * one message, so existence is never revealed. Anything unrecognised is a
 * generic error, never a success.
 */
export function failureMessageKey(error: unknown): PlainKey {
  if (!(error instanceof AuthError)) return "common.error";
  switch (error.kind) {
    case "unauthenticated":
      return "signIn.expired";
    case "forbidden":
      return "common.denied";
    case "out_of_scope":
    case "not_found":
      return "detail.notFoundOrDenied";
    default:
      return "common.error";
  }
}
