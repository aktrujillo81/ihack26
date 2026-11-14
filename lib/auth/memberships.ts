import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import { ROLES, type Role } from "@/lib/domain/types";
import { getDb } from "@/lib/db";
import { membershipRegions, memberships, organizations, regions } from "@/lib/db/schema";

/**
 * Memberships: who may see which organization and regions, with which role.
 * Documented in docs/contracts.md ("Permission rules").
 */

export interface ActiveAccess {
  membershipId: string;
  role: Role;
  organizationId: string;
  regionIds: string[];
}

interface MembershipRow {
  membershipId: string;
  role: string;
  organizationId: string;
}

/**
 * Pure decision. Exactly one active membership with a known role and at least
 * one region gives access. Zero or several memberships, or no regions, give
 * none: the system never picks one (red line 7).
 */
export function decideAccess(rows: readonly MembershipRow[], regionIds: readonly string[]): ActiveAccess | null {
  if (rows.length !== 1) return null;
  const [row] = rows;
  if (!(ROLES as readonly string[]).includes(row.role)) return null;
  if (regionIds.length === 0) return null;
  return {
    membershipId: row.membershipId,
    role: row.role as Role,
    organizationId: row.organizationId,
    regionIds: [...regionIds],
  };
}

/** Reads the user's access from the database. Called on every request, so changes apply at once. */
export async function loadActiveAccess(userId: string): Promise<ActiveAccess | null> {
  const db = getDb();
  const rows = await db
    .select({ membershipId: memberships.id, role: memberships.role, organizationId: memberships.organizationId })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(and(eq(memberships.userId, userId), isNull(memberships.archivedAt), isNull(organizations.archivedAt)))
    .limit(2);
  if (rows.length !== 1) return decideAccess(rows, []);

  const regionRows = await db
    .select({ id: regions.id })
    .from(membershipRegions)
    .innerJoin(regions, eq(regions.id, membershipRegions.regionId))
    .where(and(eq(membershipRegions.membershipId, rows[0].membershipId), isNull(regions.archivedAt)))
    .orderBy(asc(regions.id));
  return decideAccess(rows, regionRows.map((r) => r.id));
}

export type MembershipChangeResult =
  | "ok"
  /** No active membership with that id in that organization. */
  | "not_found"
  /** The change would leave the organization without an active Org Admin (AC-5). */
  | "last_admin"
  | "invalid_role";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/**
 * Locks every active Org Admin row of the organization (in id order, so two
 * changes never deadlock), then the target row. A concurrent change waits, then
 * sees the committed result, so two demotions cannot both pass.
 */
async function lockForChange(tx: Tx, organizationId: string, membershipId: string) {
  const admins = await tx
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.organizationId, organizationId),
        eq(memberships.role, "org_admin"),
        isNull(memberships.archivedAt),
      ),
    )
    .orderBy(asc(memberships.id))
    .for("update");
  const [target] = await tx
    .select({ id: memberships.id, role: memberships.role })
    .from(memberships)
    .where(
      and(
        eq(memberships.id, membershipId),
        eq(memberships.organizationId, organizationId),
        isNull(memberships.archivedAt),
      ),
    )
    .for("update");
  return { adminIds: admins.map((a) => a.id), target };
}

function leavesNoAdmin(adminIds: string[], target: { id: string; role: string }): boolean {
  return target.role === "org_admin" && adminIds.filter((id) => id !== target.id).length === 0;
}

/**
 * Changes a member's role within one organization. The caller must already be
 * allowed to manage users in `organizationId` (checked by the caller's guard).
 */
export async function changeRole(input: {
  organizationId: string;
  membershipId: string;
  role: unknown;
}): Promise<MembershipChangeResult> {
  const { organizationId, membershipId, role } = input;
  if (typeof role !== "string" || !(ROLES as readonly string[]).includes(role)) return "invalid_role";
  const newRole = role as Role;
  return getDb().transaction(async (tx) => {
    const { adminIds, target } = await lockForChange(tx, organizationId, membershipId);
    if (!target) return "not_found";
    if (target.role === newRole) return "ok";
    if (newRole !== "org_admin" && leavesNoAdmin(adminIds, target)) return "last_admin";
    await tx.update(memberships).set({ role: newRole }).where(eq(memberships.id, target.id));
    return "ok";
  });
}

/** "Removes" a member by archiving the membership (red line 9). Their next request is refused. */
export async function archiveMembership(input: {
  organizationId: string;
  membershipId: string;
}): Promise<MembershipChangeResult> {
  const { organizationId, membershipId } = input;
  return getDb().transaction(async (tx) => {
    const { adminIds, target } = await lockForChange(tx, organizationId, membershipId);
    if (!target) return "not_found";
    if (leavesNoAdmin(adminIds, target)) return "last_admin";
    await tx.update(memberships).set({ archivedAt: new Date() }).where(eq(memberships.id, target.id));
    return "ok";
  });
}
