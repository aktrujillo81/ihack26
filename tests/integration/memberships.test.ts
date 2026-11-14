import { and, eq, isNull } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { archiveMembership, changeRole } from "@/lib/auth/memberships";
import { getDb } from "@/lib/db";
import { memberships } from "@/lib/db/schema";
import { addMembership, createOrg, createUser, resetDb } from "./helpers";

beforeEach(resetDb);

async function orgWithAdmins(count: number) {
  const { org, region } = await createOrg("AC5 Org");
  const admins = [];
  for (let i = 0; i < count; i++) {
    const u = await createUser(`admin${i}@test.example`);
    admins.push(await addMembership(u.id, org.id, "org_admin", [region.id]));
  }
  return { org, region, admins };
}

async function activeAdminCount(organizationId: string) {
  const rows = await getDb()
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(eq(memberships.organizationId, organizationId), eq(memberships.role, "org_admin"), isNull(memberships.archivedAt)),
    );
  return rows.length;
}

describe("AC-5: the last Org Admin cannot be removed or demoted", () => {
  it("refuses to demote or archive the last admin", async () => {
    const { org, admins } = await orgWithAdmins(1);
    expect(await changeRole({ organizationId: org.id, membershipId: admins[0].id, role: "responder" })).toBe("last_admin");
    expect(await archiveMembership({ organizationId: org.id, membershipId: admins[0].id })).toBe("last_admin");
    expect(await activeAdminCount(org.id)).toBe(1);
  });

  it("with two admins, one can be demoted, then the other is protected", async () => {
    const { org, admins } = await orgWithAdmins(2);
    expect(await changeRole({ organizationId: org.id, membershipId: admins[0].id, role: "viewer" })).toBe("ok");
    expect(await archiveMembership({ organizationId: org.id, membershipId: admins[1].id })).toBe("last_admin");
    expect(await activeAdminCount(org.id)).toBe(1);
  });

  it("archiving keeps the row (history is never deleted)", async () => {
    const { org, region, admins } = await orgWithAdmins(1);
    const u = await createUser("member@test.example");
    const m = await addMembership(u.id, org.id, "responder", [region.id]);
    expect(await archiveMembership({ organizationId: org.id, membershipId: m.id })).toBe("ok");
    const [row] = await getDb().select().from(memberships).where(eq(memberships.id, m.id));
    expect(row.archivedAt).toBeInstanceOf(Date);
    expect(admins).toHaveLength(1);
  });

  it("concurrent demotions of the last two admins leave exactly one admin", async () => {
    for (let round = 0; round < 5; round++) {
      await resetDb();
      const { org, admins } = await orgWithAdmins(2);
      const results = await Promise.all([
        changeRole({ organizationId: org.id, membershipId: admins[0].id, role: "responder" }),
        changeRole({ organizationId: org.id, membershipId: admins[1].id, role: "responder" }),
      ]);
      expect(results.sort()).toEqual(["last_admin", "ok"]);
      expect(await activeAdminCount(org.id)).toBe(1);
    }
  });

  it("concurrent archive and demote leave exactly one admin", async () => {
    const { org, admins } = await orgWithAdmins(2);
    const results = await Promise.all([
      archiveMembership({ organizationId: org.id, membershipId: admins[0].id }),
      changeRole({ organizationId: org.id, membershipId: admins[1].id, role: "viewer" }),
    ]);
    expect(results.sort()).toEqual(["last_admin", "ok"]);
    expect(await activeAdminCount(org.id)).toBe(1);
  });

  it("refuses a membership from another organization and an unknown role", async () => {
    const { org, admins } = await orgWithAdmins(2);
    const { org: other } = await createOrg("Other");
    expect(await changeRole({ organizationId: other.id, membershipId: admins[0].id, role: "viewer" })).toBe("not_found");
    expect(await archiveMembership({ organizationId: other.id, membershipId: admins[0].id })).toBe("not_found");
    expect(await changeRole({ organizationId: org.id, membershipId: admins[0].id, role: "owner" })).toBe("invalid_role");
    expect(await activeAdminCount(org.id)).toBe(2);
  });
});
