/**
 * The Better Auth session cookie names (docs/contracts.md, "Authentication"):
 * `better-auth.session_token`, and `__Secure-better-auth.session_token` when the
 * site is served over https. Client-safe and pure.
 *
 * Presence of this cookie proves NOTHING. It is only a hint used to choose a
 * message ("your session ended" vs no message) and by the proxy for a quick
 * redirect. A session is real only after `parseSession` accepts what
 * `getCurrentSession()` returns.
 */
export const SESSION_COOKIE_NAMES = ["better-auth.session_token", "__Secure-better-auth.session_token"] as const;

/** True if the request carries a session cookie, given a lookup such as `(name) => jar.has(name)`. */
export function hasSessionCookie(has: (name: string) => boolean): boolean {
  return SESSION_COOKIE_NAMES.some((name) => has(name));
}
