import "server-only";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { can, type Action } from "../permissions/matrix";
import { hasSessionCookie } from "./cookie";
import { getCurrentSession, parseSession, type Session } from "./session";

/**
 * The guard every protected PAGE and layout calls first. Layouts do not run
 * again when a user navigates between pages, so each page must call this itself;
 * the proxy and the layout are not enough.
 *
 * Returns a session only if `parseSession` accepted what `getCurrentSession()`
 * returned AND the session's role may perform `action` (the permission matrix
 * decides; default "view", which every page needs). Otherwise:
 * - no valid session: redirect to the sign-in page. If a session cookie was
 *   present but is no longer valid the page shows "Your session ended"
 *   (`?reason=expired`). The server cannot tell an expired session from a
 *   signed-out one; any present-but-invalid cookie shows it. No cookie: plain
 *   sign-in page, no message.
 * - a valid session whose role lacks the permission: the page answers "not
 *   found", the same as a page that does not exist, so nothing is revealed.
 *   (Redirecting to the sign-in page would loop: it sends signed-in users to the
 *   list.)
 * Redirect destinations are fixed; nothing from the request is copied into them.
 */
export async function requirePageSession(action: Action = "view"): Promise<Session> {
  const session = parseSession(await getCurrentSession());
  if (session) {
    if (!can(session.role, action)) notFound();
    return session;
  }

  let hadCookie = false;
  try {
    const jar = await cookies();
    hadCookie = hasSessionCookie((name) => jar.has(name));
  } catch {
    hadCookie = false;
  }
  redirect(hadCookie ? "/sign-in?reason=expired" : "/sign-in");
}

/** The current session or `null`, without redirecting. For pages that behave differently when signed in (the sign-in page). */
export async function getOptionalSession(): Promise<Session | null> {
  return parseSession(await getCurrentSession());
}
