/**
 * Which action each route needs, and the navigation derived from it. One
 * table drives both, so a link that is shown and the server check for its
 * route can never disagree. Hiding a link is a convenience; the server runs
 * the same check on every request.
 *
 * PROVISIONAL: the route paths are proposals. docs/contracts.md defines none
 * yet. Change them here, in one place.
 *
 * DEFAULT DENY: a path that is not public and not listed is refused. A path
 * containing anything but plain URL characters (percent-encoding, backslash,
 * semicolon, control or non-ASCII characters) is refused outright, so encoded
 * tricks like "/complaints/%2e%2e/admin" never match a rule.
 *
 * NOT ENFORCED YET. When W1 wires this into Next's proxy/middleware, that is
 * not the only defence: every server component, route handler and action must
 * also call a guard from lib/auth/guards.ts, because middleware can be
 * bypassed. Still to decide when wiring: how /_next/*, static files, the Vapi
 * webhook (authenticated by signature, not session) and sign-out are handled;
 * none has a rule here, so all are denied today.
 */
import type { PlainKey } from "../i18n/strings";
import { can, type Action } from "./matrix";

export interface RouteRule {
  /** A path prefix. "/complaints" also covers "/complaints/abc". */
  path: string;
  action: Action;
  /** Present only for routes that appear in the navigation. */
  navLabelKey?: PlainKey;
}

/**
 * Reachable without signing in. Exact matches only, so "/map/anything" is NOT
 * public. "/map" is the PUBLIC status-only map (no session, no detail); the
 * signed-in map lives at "/dashboard/map". A path must never be in both this
 * list and ROUTE_RULES (a test checks that).
 *
 * PROPOSED, NOT APPROVED: "/map" being public. The public read-only map is
 * listed as cut from this build in docs/spec.md section 4. A human must approve
 * it and record the decision in docs/decisions.md; until then, remove "/map"
 * from this list to make it signed-in-only. (The page also shows nothing unless
 * the PUBLISHED_MAP_* settings are set.)
 */
export const PUBLIC_PATHS: readonly string[] = ["/", "/sign-in", "/api/health", "/map"];

/**
 * Route groups whose own handler authenticates every request, so the proxy lets
 * them through without a session cookie. They are NOT public: each handler
 * refuses what it should.
 * - "/api/auth/": Better Auth. app/api/auth/[...all]/route.ts answers 404 for
 *   everything except POST sign-in and sign-out (docs/contracts.md).
 * - "/api/vapi/": the Vapi webhook. It checks a shared secret in constant time
 *   and refuses every request while the secret is unset.
 * Anything added here must authenticate itself in its handler.
 */
export const SELF_AUTHENTICATING_PREFIXES: readonly string[] = ["/api/auth/", "/api/vapi/"];

/**
 * The navigation shows only routes that exist. "/needs-review" has a page (W5)
 * and a link. "/needs-location" is a rule (so it is denied by default) but has
 * no navLabelKey until its page is built, so no link points at a 404.
 */
export const ROUTE_RULES: readonly RouteRule[] = [
  { path: "/complaints", action: "view", navLabelKey: "nav.complaints" },
  { path: "/dashboard/map", action: "view", navLabelKey: "nav.map" },
  { path: "/needs-review", action: "view", navLabelKey: "nav.needsReview" },
  { path: "/needs-location", action: "view" },
];

/** Only these characters may appear in a path we will match: letters, digits and - _ . ~ / */
const PLAIN_PATH = /^\/[A-Za-z0-9\-_.~/]*$/;

/**
 * Strip query, hash and a trailing slash. Returns null for any path that is not
 * plain (encoded, backslash, semicolon, control or non-ASCII characters), which
 * matches nothing and is denied.
 */
function normalize(pathname: string): string | null {
  const path = pathname.split(/[?#]/)[0] ?? "";
  if (!PLAIN_PATH.test(path)) return null;
  // Repeated slashes anywhere (including at the end, "/map//") are refused, not collapsed.
  if (path.includes("//")) return null;
  return path.length > 1 ? path.replace(/\/$/, "") : path;
}

export function isPublicPath(pathname: string): boolean {
  const path = normalize(pathname);
  return path !== null && PUBLIC_PATHS.includes(path);
}

/** True for a path below one of SELF_AUTHENTICATING_PREFIXES. The bare prefix itself ("/api/auth") is not. */
export function isSelfAuthenticatingPath(pathname: string): boolean {
  const path = normalize(pathname);
  if (path === null || path.split("/").some((segment) => segment === ".." || segment === ".")) return false;
  return SELF_AUTHENTICATING_PREFIXES.some((prefix) => path.startsWith(prefix) && path.length > prefix.length);
}

/** The action a route needs, or null if no rule covers it. Matches whole path segments, case-sensitively. */
export function requiredActionForPath(pathname: string, rules: readonly RouteRule[] = ROUTE_RULES): Action | null {
  const path = normalize(pathname);
  if (path === null || path.split("/").some((segment) => segment === ".." || segment === ".")) return null;
  if (path.includes("//")) return null;
  const rule = rules
    .filter((r) => path === r.path || path.startsWith(`${r.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return rule?.action ?? null;
}

export type RouteAccess = "public" | "allowed" | "denied";

/** Public paths pass. Everything else needs a listed rule and a role that has its action. */
export function accessForPath(pathname: string, role: unknown, rules: readonly RouteRule[] = ROUTE_RULES): RouteAccess {
  if (isPublicPath(pathname)) return "public";
  const action = requiredActionForPath(pathname, rules);
  return action !== null && can(role, action) ? "allowed" : "denied";
}

export interface NavItem {
  href: string;
  labelKey: PlainKey;
}

/** Links to show this role. A convenience only: the server still checks each route. */
export function navItemsFor(role: unknown, rules: readonly RouteRule[] = ROUTE_RULES): NavItem[] {
  return rules
    .filter((r): r is RouteRule & { navLabelKey: PlainKey } => r.navLabelKey !== undefined && can(role, r.action))
    .map((r) => ({ href: r.path, labelKey: r.navLabelKey }));
}
