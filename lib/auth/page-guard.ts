import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { hasSessionCookie } from "./cookie";
import { getCurrentSession, parseSession, type Session } from "./session";

/**
 * The guard every protected PAGE and layout calls first. Layouts do not run
 * again when a user navigates between pages, so each page must call this itself;
 * the proxy and the layout are not enough.
 *
 * Returns a session only if `parseSession` accepted what `getCurrentSession()`
 * returned. Otherwise it redirects to the sign-in page and never returns:
 * - a session cookie was present but is no longer valid: `?reason=expired`, so
 *   the page says "Your session ended". (The server cannot tell an expired
 *   session from a signed-out one; any present-but-invalid cookie shows it.)
 * - no cookie: plain sign-in page, no message.
 * The destination is fixed; nothing from the request is copied into it.
 */
export async function requirePageSession(): Promise<Session> {
  const session = parseSession(await getCurrentSession());
  if (session) return session;

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
