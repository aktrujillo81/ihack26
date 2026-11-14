/**
 * Which action each route needs, and the navigation derived from it. One
 * table drives both, so a link that is shown and the server check for its
 * route can never disagree. Hiding a link is a convenience; the server runs
 * the same check on every request.
 *
 * PROVISIONAL: the route paths are proposals. docs/contracts.md defines none
 * yet. Change them here, in one place.
 *
 * DEFAULT DENY: a path that is not public and not listed is refused.
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

/** Reachable without signing in. Exact matches only. */
export const PUBLIC_PATHS: readonly string[] = ["/", "/sign-in", "/api/health"];

export const ROUTE_RULES: readonly RouteRule[] = [
  { path: "/complaints", action: "view", navLabelKey: "nav.complaints" },
  { path: "/map", action: "view", navLabelKey: "nav.map" },
  { path: "/needs-review", action: "view", navLabelKey: "common.needsReview" },
  { path: "/needs-location", action: "view", navLabelKey: "common.needsLocation" },
];

/** Strip query, hash and a trailing slash. Anything odd stays odd and will not match a rule. */
function normalize(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] ?? "";
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(normalize(pathname));
}

/** The action a route needs, or null if no rule covers it. Matches whole path segments, case-sensitively. */
export function requiredActionForPath(pathname: string, rules: readonly RouteRule[] = ROUTE_RULES): Action | null {
  const path = normalize(pathname);
  if (path.includes("..") || path.includes("//")) return null;
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
