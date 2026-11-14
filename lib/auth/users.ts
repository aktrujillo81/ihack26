import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { historyEvents, organizations, regions, users } from "@/lib/db/schema";
import { ROLES, type Role } from "@/lib/domain/types";

/**
 * Staff access on D1's `users` table (task A1). Better Auth owns the login
 * identity; the `users` row found by `auth_subject = auth_user.id` owns
 * organization, region, role and active. Documented in docs/contracts.md.
 */

/** The camelCase shape lib/auth/user-session.ts `sessionFromUser` expects. */
export interface StaffUserRow {
  id: string;
  organizationId: string;
  regionId: string;
  role: string;
  active: boolean;
}

/**
 * Finds the staff row for a Better Auth user id, or null. Asks for two rows and
 * accepts exactly one (red line 7). The region must be live and belong to the
 * user's organization, and the organization must be live: auth_subject has no
 * FK, and sessionFromUser checks none of this. `active` is returned, not
 * filtered, so the caller (sessionFromUser) refuses an inactive user.
 */
export async function findStaffUser(authSubject: unknown): Promise<StaffUserRow | null> {
  if (typeof authSubject !== "string" || authSubject.trim().length === 0) return null;
  const rows = await getDb()
    .select({
      id: users.id,
      organizationId: users.organizationId,
      regionId: users.regionId,
      role: users.role,
      active: users.active,
    })
    .from(users)
    .innerJoin(regions, and(eq(regions.id, users.regionId), eq(regions.organizationId, users.organizationId)))
    .innerJoin(organizations, eq(organizations.id, users.organizationId))
    .where(and(eq(users.authSubject, authSubject), isNull(regions.archivedAt), isNull(organizations.archivedAt)))
    .limit(2);
  return rows.length === 1 ? rows[0] : null;
}

/** True when this Better Auth user may get a session: one active staff row with a live region. */
export async function hasActiveAccess(authSubject: unknown): Promise<boolean> {
  const row = await findStaffUser(authSubject);
  return row?.active === true;
}

export type UserChangeResult =
  | "ok"
  /** No active user with that id in that organization. */
  | "not_found"
  /** The change would leave the organization without an active Org Admin (AC-5). */
  | "last_admin"
  /** The actor is not an active Org Admin of this organization (checked in the transaction). */
  | "forbidden"
  | "invalid_role";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/**
 * Locks every active Org Admin row of the organization (in id order, so two
 * changes never deadlock), then the actor's row, then the target row. A
 * concurrent change waits, then sees the committed result, so two demotions
 * cannot both pass and a just-demoted actor cannot act.
 */
async function lockForChange(tx: Tx, organizationId: string, actorUserId: string, userId: string) {
  const admins = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.organizationId, organizationId), eq(users.role, "org_admin"), eq(users.active, true)))
    .orderBy(asc(users.id))
    .for("update");
  const [actor] = await tx
    .select({ role: users.role, active: users.active, organizationId: users.organizationId })
    .from(users)
    .where(eq(users.id, actorUserId))
    .for("update");
  const actorAllowed =
    !!actor && actor.role === "org_admin" && actor.active === true && actor.organizationId === organizationId;
  const [target] = await tx
    .select({ id: users.id, role: users.role, organizationId: users.organizationId, regionId: users.regionId })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.organizationId, organizationId), eq(users.active, true)))
    .for("update");
  return { adminIds: admins.map((a) => a.id), actorAllowed, target };
}

function leavesNoAdmin(adminIds: string[], target: { id: string; role: string }): boolean {
  return target.role === "org_admin" && adminIds.filter((id) => id !== target.id).length === 0;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/**
 * Changes a staff member's role. `organizationId` and `actorUserId` MUST come
 * from the signed-in session, never from the request. The caller's guard checks
 * that the actor may manage users; this function checks again inside the
 * transaction (active org_admin of the same organization, else "forbidden").
 * Writes one history_events row in the same transaction.
 */
export async function changeRole(input: {
  organizationId: string;
  actorUserId: string;
  userId: string;
  role: unknown;
}): Promise<UserChangeResult> {
  const { organizationId, actorUserId, userId, role } = input;
  if (typeof role !== "string" || !(ROLES as readonly string[]).includes(role)) return "invalid_role";
  if (!isUuid(organizationId) || !isUuid(userId) || !isUuid(actorUserId)) return "not_found";
  const newRole = role as Role;
  return getDb().transaction(async (tx) => {
    const { adminIds, actorAllowed, target } = await lockForChange(tx, organizationId, actorUserId, userId);
    // Defence in depth: the caller's guard checks this too. Nothing is written.
    if (!actorAllowed) return "forbidden";
    if (!target) return "not_found";
    if (target.role === newRole) return "ok";
    if (newRole !== "org_admin" && leavesNoAdmin(adminIds, target)) return "last_admin";
    await tx.update(users).set({ role: newRole, updatedAt: new Date() }).where(eq(users.id, target.id));
    await tx.insert(historyEvents).values({
      organizationId: target.organizationId,
      regionId: target.regionId,
      actorUserId,
      eventType: "role_changed",
      beforeData: { userId: target.id, role: target.role },
      afterData: { userId: target.id, role: newRole },
    });
    return "ok";
  });
}

/**
 * "Removes" a staff member by setting active = false (red line 9: D1 has no
 * archived_at on users). Their next request is refused. Same rules as changeRole.
 */
export async function deactivateUser(input: {
  organizationId: string;
  actorUserId: string;
  userId: string;
}): Promise<UserChangeResult> {
  const { organizationId, actorUserId, userId } = input;
  if (!isUuid(organizationId) || !isUuid(userId) || !isUuid(actorUserId)) return "not_found";
  return getDb().transaction(async (tx) => {
    const { adminIds, actorAllowed, target } = await lockForChange(tx, organizationId, actorUserId, userId);
    // Defence in depth: the caller's guard checks this too. Nothing is written.
    if (!actorAllowed) return "forbidden";
    if (!target) return "not_found";
    if (leavesNoAdmin(adminIds, target)) return "last_admin";
    await tx.update(users).set({ active: false, updatedAt: new Date() }).where(eq(users.id, target.id));
    await tx.insert(historyEvents).values({
      organizationId: target.organizationId,
      regionId: target.regionId,
      actorUserId,
      eventType: "user_deactivated",
      beforeData: { userId: target.id, active: true },
      afterData: { userId: target.id, active: false },
    });
    return "ok";
  });
}
