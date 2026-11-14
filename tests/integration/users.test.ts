import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { changeRole, deactivateUser } from "@/lib/auth/users";
import { getDb } from "@/lib/db";
import { historyEvents, users } from "@/lib/db/schema";
import { addStaff, createAuthUser, createOrg, resetDb } from "./helpers";

beforeEach(resetDb);

async function orgWithAdmins(count: number) {
  const { org, region } = await createOrg("AC5 Org");
  const admins = [];
  for (let i = 0; i < count; i++) {
    const au = await createAuthUser(`admin${i}@example.com`);
    admins.push(await addStaff(au.id, org.id, region.id, "org_admin", `admin${i}@example.com`));
  }
  return { org, region, admins };
}

async function activeAdminCount(organizationId: string) {
  const rows = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.organizationId, organizationId), eq(users.role, "org_admin"), eq(users.active, true)));
  return rows.length;
}

const allHistory = () => getDb().select().from(historyEvents);

describe("AC-5: the last Org Admin cannot be removed or demoted", () => {
  it("refuses to demote or deactivate the last admin, and writes no history", async () => {
    const { org, admins } = await orgWithAdmins(1);
    const actor = admins[0].id;
    expect(await changeRole({ organizationId: org.id, actorUserId: actor, userId: admins[0].id, role: "responder" })).toBe(
      "last_admin",
    );
    expect(await deactivateUser({ organizationId: org.id, actorUserId: actor, userId: admins[0].id })).toBe("last_admin");
    expect(await activeAdminCount(org.id)).toBe(1);
    expect(await allHistory()).toHaveLength(0);
  });

  it("with two admins, one can be demoted, then the other is protected", async () => {
    const { org, admins } = await orgWithAdmins(2);
    const actor = admins[1].id;
    expect(await changeRole({ organizationId: org.id, actorUserId: actor, userId: admins[0].id, role: "viewer" })).toBe("ok");
    expect(await deactivateUser({ organizationId: org.id, actorUserId: actor, userId: admins[1].id })).toBe("last_admin");
    expect(await activeAdminCount(org.id)).toBe(1);
  });

  it("each role change and deactivation writes exactly one history_events row (actor, before, after)", async () => {
    const { org, region, admins } = await orgWithAdmins(1);
    const actor = admins[0].id;
    const au = await createAuthUser("member@example.com");
    const member = await addStaff(au.id, org.id, region.id, "responder", "member@example.com");

    expect(await changeRole({ organizationId: org.id, actorUserId: actor, userId: member.id, role: "viewer" })).toBe("ok");
    let events = await allHistory();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      organizationId: org.id,
      regionId: region.id,
      actorUserId: actor,
      eventType: "role_changed",
      beforeData: { userId: member.id, role: "responder" },
      afterData: { userId: member.id, role: "viewer" },
      complaintId: null,
      waterPointId: null,
    });

    // No change, no event.
    expect(await changeRole({ organizationId: org.id, actorUserId: actor, userId: member.id, role: "viewer" })).toBe("ok");
    expect(await allHistory()).toHaveLength(1);

    expect(await deactivateUser({ organizationId: org.id, actorUserId: actor, userId: member.id })).toBe("ok");
    events = await allHistory();
    expect(events).toHaveLength(2);
    expect(events.find((e) => e.eventType === "user_deactivated")).toMatchObject({
      organizationId: org.id,
      regionId: region.id,
      actorUserId: actor,
      beforeData: { userId: member.id, active: true },
      afterData: { userId: member.id, active: false },
    });

    // Deactivation keeps the row (red line 9).
    const [row] = await getDb().select().from(users).where(eq(users.id, member.id));
    expect(row.active).toBe(false);
    // An inactive user is no longer a target.
    expect(await deactivateUser({ organizationId: org.id, actorUserId: actor, userId: member.id })).toBe("not_found");
  });

  it("concurrent self-demotions of the last two admins leave exactly one admin and one history row", async () => {
    for (let round = 0; round < 5; round++) {
      await resetDb();
      const { org, admins } = await orgWithAdmins(2);
      const [a, b] = admins.map((x) => x.id);
      const results = await Promise.all([
        changeRole({ organizationId: org.id, actorUserId: a, userId: a, role: "responder" }),
        changeRole({ organizationId: org.id, actorUserId: b, userId: b, role: "responder" }),
      ]);
      expect(results.sort()).toEqual(["last_admin", "ok"]);
      expect(await activeAdminCount(org.id)).toBe(1);
      expect(await allHistory()).toHaveLength(1);
    }
  });

  it("concurrent self-deactivate and self-demote leave exactly one admin", async () => {
    for (let round = 0; round < 5; round++) {
      await resetDb();
      const { org, admins } = await orgWithAdmins(2);
      const [a, b] = admins.map((x) => x.id);
      const results = await Promise.all([
        deactivateUser({ organizationId: org.id, actorUserId: a, userId: a }),
        changeRole({ organizationId: org.id, actorUserId: b, userId: b, role: "viewer" }),
      ]);
      expect(results.sort()).toEqual(["last_admin", "ok"]);
      expect(await activeAdminCount(org.id)).toBe(1);
    }
  });

  it("concurrent cross-demotions: the loser's actor is no longer an admin (forbidden); one admin remains", async () => {
    for (let round = 0; round < 5; round++) {
      await resetDb();
      const { org, admins } = await orgWithAdmins(2);
      const [a, b] = admins.map((x) => x.id);
      const results = await Promise.all([
        changeRole({ organizationId: org.id, actorUserId: b, userId: a, role: "responder" }),
        deactivateUser({ organizationId: org.id, actorUserId: a, userId: b }),
      ]);
      expect(results.sort()).toEqual(["forbidden", "ok"]);
      expect(await activeAdminCount(org.id)).toBe(1);
      expect(await allHistory()).toHaveLength(1);
    }
  });

  it("a target in another organization is not_found; unknown role and bad ids are refused", async () => {
    const { org, admins } = await orgWithAdmins(2);
    const { org: other, region: otherRegion } = await createOrg("Other");
    const otherAu = await createAuthUser("other-admin@example.com");
    const otherAdmin = await addStaff(otherAu.id, other.id, otherRegion.id, "org_admin", "other-admin@example.com");
    const actor = admins[1].id;
    // Valid actor, its own organization, target from another organization.
    expect(await changeRole({ organizationId: org.id, actorUserId: actor, userId: otherAdmin.id, role: "viewer" })).toBe(
      "not_found",
    );
    expect(await deactivateUser({ organizationId: org.id, actorUserId: actor, userId: otherAdmin.id })).toBe("not_found");
    expect(await changeRole({ organizationId: org.id, actorUserId: actor, userId: admins[0].id, role: "owner" })).toBe(
      "invalid_role",
    );
    expect(await changeRole({ organizationId: org.id, actorUserId: actor, userId: "", role: "viewer" })).toBe("not_found");
    expect(await activeAdminCount(org.id)).toBe(2);
    expect(await allHistory()).toHaveLength(0);
  });
});

describe("the actor must be an active Org Admin of the same organization (checked in the transaction)", () => {
  async function setup() {
    const { org, region, admins } = await orgWithAdmins(1);
    const responderAu = await createAuthUser("resp@example.com");
    const responder = await addStaff(responderAu.id, org.id, region.id, "responder", "resp@example.com");
    const viewerAu = await createAuthUser("view@example.com");
    const viewer = await addStaff(viewerAu.id, org.id, region.id, "viewer", "view@example.com");
    return { org, region, admin: admins[0], responder, viewer };
  }

  it("responder actor: forbidden, nothing written", async () => {
    const { org, responder, viewer } = await setup();
    expect(await changeRole({ organizationId: org.id, actorUserId: responder.id, userId: viewer.id, role: "org_admin" })).toBe(
      "forbidden",
    );
    expect(await deactivateUser({ organizationId: org.id, actorUserId: responder.id, userId: viewer.id })).toBe("forbidden");
    const [row] = await getDb().select().from(users).where(eq(users.id, viewer.id));
    expect(row).toMatchObject({ role: "viewer", active: true });
    expect(await allHistory()).toHaveLength(0);
  });

  it("admin of another organization as actor: forbidden, whichever organizationId is passed", async () => {
    const { org, viewer } = await setup();
    const { org: other, region: otherRegion } = await createOrg("Other");
    const au = await createAuthUser("foreign-admin@example.com");
    const foreignAdmin = await addStaff(au.id, other.id, otherRegion.id, "org_admin", "foreign-admin@example.com");
    expect(await changeRole({ organizationId: org.id, actorUserId: foreignAdmin.id, userId: viewer.id, role: "responder" })).toBe(
      "forbidden",
    );
    expect(await deactivateUser({ organizationId: org.id, actorUserId: foreignAdmin.id, userId: viewer.id })).toBe("forbidden");
    // Passing the actor's own organization does not reach a target in another one.
    expect(await deactivateUser({ organizationId: other.id, actorUserId: foreignAdmin.id, userId: viewer.id })).toBe("not_found");
    expect(await allHistory()).toHaveLength(0);
  });

  it("inactive admin actor: forbidden", async () => {
    const { org, region, viewer } = await setup();
    const au = await createAuthUser("gone-admin@example.com");
    const gone = await addStaff(au.id, org.id, region.id, "org_admin", "gone-admin@example.com");
    await getDb().update(users).set({ active: false }).where(eq(users.id, gone.id));
    expect(await changeRole({ organizationId: org.id, actorUserId: gone.id, userId: viewer.id, role: "responder" })).toBe(
      "forbidden",
    );
    expect(await deactivateUser({ organizationId: org.id, actorUserId: gone.id, userId: viewer.id })).toBe("forbidden");
    expect(await allHistory()).toHaveLength(0);
  });

  it("unknown actor id: forbidden", async () => {
    const { org, viewer } = await setup();
    const missing = "00000000-0000-4000-8000-000000000000";
    expect(await deactivateUser({ organizationId: org.id, actorUserId: missing, userId: viewer.id })).toBe("forbidden");
  });
});
