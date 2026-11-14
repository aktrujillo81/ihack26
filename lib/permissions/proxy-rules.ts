/**
 * What the proxy (proxy.ts) does with a request. Pure, so it is tested without
 * a server.
 *
 * THE PROXY IS NOT THE DEFENCE. It only looks at whether a session cookie is
 * present, which proves nothing (a forged cookie passes). It exists to send
 * signed-out visitors to the sign-in page quickly. Every protected page,
 * route handler and action validates the session itself with `parseSession` or
 * a guard in lib/auth/guards.ts, because a proxy can be bypassed.
 *
 * Without a session cookie, only these get through: the public paths, and the
 * routes whose own handler authenticates (Better Auth, the Vapi webhook).
 * Everything else, listed or not, is refused.
 */
import { isPublicPath, isSelfAuthenticatingPath } from "./routes";

export type ProxyDecision =
  /** Let the request through to the page or handler (which still checks for itself). */
  | "pass"
  /** A page request without a session cookie: redirect to the sign-in page. */
  | "sign_in"
  /** An API request without a session cookie: 401, no body detail. */
  | "unauthorized";

export function decideProxy(pathname: string, hasSessionCookie: boolean): ProxyDecision {
  if (isPublicPath(pathname)) return "pass";
  if (isSelfAuthenticatingPath(pathname)) return "pass";
  if (hasSessionCookie) return "pass";
  return pathname === "/api" || pathname.startsWith("/api/") ? "unauthorized" : "sign_in";
}
