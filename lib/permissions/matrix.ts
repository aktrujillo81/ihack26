/**
 * Role and permission matrix. Pure functions: no session, no database, safe to
 * import from browser code (for hiding links) and from server code (for the
 * real check). Hiding a link is a convenience only; the server enforces.
 *
 * Source: docs/spec.md section 7 (permissions table) and section 2 (roles).
 * PROVISIONAL: docs/contracts.md defines no permissions yet. When it does,
 * this file must match it (see docs/contracts-swap-plan.md).
 *
 * DEFAULT DENY: an unknown role, a missing role, an unknown action, or a
 * missing permission is refused. Nothing is allowed unless it is listed here.
 */
import { ROLES, type Role } from "../domain/types";

export const ACTIONS = [
  "view", // map, complaints, transcripts in the user's regions
  "change_status",
  "add_note",
  "pass_on", // records a hand-off step only; nothing is sent
  "create_water_point",
  "verify_water_point",
  "edit_water_point",
  "place_pin",
  "merge_water_points",
  "manage_partners",
  "manage_regions", // set up by a seed script in this build
  "manage_users", // users and roles: set up by a seed script in this build
] as const;
export type Action = (typeof ACTIONS)[number];

const VIEW_ONLY: readonly Action[] = ["view"];
const RESPONDER: readonly Action[] = [
  "view",
  "change_status",
  "add_note",
  "pass_on",
  "create_water_point",
  "verify_water_point",
  "edit_water_point",
  "place_pin",
  "merge_water_points",
];

export const PERMISSIONS: Readonly<Record<Role, readonly Action[]>> = {
  viewer: VIEW_ONLY,
  responder: RESPONDER,
  org_admin: ACTIONS,
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isAction(value: unknown): value is Action {
  return typeof value === "string" && (ACTIONS as readonly string[]).includes(value);
}

/** True only for a known role, a known action, and an explicit grant. */
export function can(role: unknown, action: unknown): boolean {
  if (!isRole(role) || !isAction(action)) return false;
  return PERMISSIONS[role].includes(action);
}

/** What a user may see: one organization and a set of regions (spec section 5, rule 1). */
export interface Scope {
  organizationId: string;
  regionIds: readonly string[];
}

/** Anything owned by an organization and region. */
export interface Scoped {
  organizationId: string;
  regionId: string;
}

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Valid scope: a non-empty organization and at least one non-empty region. Anything else is not a scope. */
export function isValidScope(scope: unknown): scope is Scope {
  return (
    isObject(scope) &&
    isNonEmptyString(scope.organizationId) &&
    Array.isArray(scope.regionIds) &&
    scope.regionIds.length > 0 &&
    scope.regionIds.every(isNonEmptyString)
  );
}

/**
 * True only if both the scope and the record are well formed and the record is
 * in the same organization and one of the user's regions. Organizations never
 * see each other's data (red line 8).
 */
export function inScope(scope: unknown, record: unknown): boolean {
  if (!isValidScope(scope)) return false;
  if (!isObject(record) || !isNonEmptyString(record.organizationId) || !isNonEmptyString(record.regionId)) return false;
  return record.organizationId === scope.organizationId && scope.regionIds.includes(record.regionId);
}
