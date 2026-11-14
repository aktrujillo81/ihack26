/**
 * The REAL complaint writes against Postgres, through the real actions (session,
 * scope, role, input) and the real transaction. Covers: the change and its
 * history event written together, the version check (no silent overwrite, even
 * under concurrency), a Viewer refused whatever the payload, every attempt to
 * cross an organization or region, and history that can only grow (red line 9).
 * Development database only (the integration setup refuses anything else).
 */
import { readFileSync } from "node:fs";

import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { addComplaintNote, changeComplaintStatus } from "@/lib/actions/complaints";
import { addNote, applyStatusChange, getComplaintHead } from "@/lib/data/complaint-writes";
import { getComplaint, listComplaints, type DataContext } from "@/lib/data/complaints";
import { complaints, historyEvents, notes, users } from "@/lib/db/schema";
import { getDb } from "@/lib/db";
import type { Role } from "@/lib/domain/types";

import { buildWorld, historyFor, rawComplaint, type World } from "./data-fixtures";
import { addStaff, createAuthUser, resetDb } from "./helpers";

let w: World;

beforeEach(async () => {
  await resetDb();
  w = await buildWorld();
});

let emailCounter = 0;
/** A staff member of organization A, region 1, with the given role. */
async function staff(role: Role) {
  emailCounter += 1;
  const email = `writer-${emailCounter}@example.org`;
  const au = await createAuthUser(email);
  return addStaff(au.id, w.A.org.id, w.A.region.id, role, email);
}

/** A responder of organization A in region 2 (not region 1). */
async function staffInRegion2() {
  emailCounter += 1;
  const email = `writer-${emailCounter}@example.org`;
  const au = await createAuthUser(email);
  return addStaff(au.id, w.A.org.id, w.regionA2.id, "responder", email);
}

/** The raw session value the actions are given, built from a real staff row. */
const rawSession = (row: { id: string; role: string; organizationId: string; regionId: string }, over: Record<string, unknown> = {}) => ({
  userId: row.id,
  role: row.role,
  organizationId: row.organizationId,
  regionIds: [row.regionId],
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  ...over,
});

async function versionOf(ctx: DataContext, id: string): Promise<string> {
  const r = await getComplaint(ctx, id);
  if (r.status !== "ok") throw new Error("expected data");
  return r.data.complaint.version;
}

/** Everything a write could change about one complaint, read straight from the tables. */
async function snapshot(id: string) {
  const row = await rawComplaint(id);
  const events = (await historyFor(id)).sort((a, b) => a.id.localeCompare(b.id));
  const noteRows = await getDb().select().from(notes).where(eq(notes.complaintId, id));
  return JSON.stringify({ row, events, noteRows });
}

const saved = { status: "saved" };

describe("a status change is written together with its history event", () => {
  it("open to fixed: status, fixed time, a new version, and exactly one event naming the author", async () => {
    const responder = w.staffA;
    const ctx = w.ctxA1;
    const id = w.c.cOpen.id;
    const before = await rawComplaint(id);
    const versionBefore = await versionOf(ctx, id);
    const eventsBefore = (await historyFor(id)).length;

    const res = await changeComplaintStatus(rawSession(responder), { complaintId: id, status: "fixed", version: versionBefore });
    expect(res).toEqual(saved);

    const after = await rawComplaint(id);
    expect(after.status).toBe("fixed");
    expect(after.fixedAt).not.toBeNull();
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
    expect(await versionOf(ctx, id)).not.toBe(versionBefore);

    const events = await historyFor(id);
    expect(events).toHaveLength(eventsBefore + 1);
    const event = events.find((e) => e.eventType === "status_changed" && (e.afterData as { status?: string })?.status === "fixed" && e.actorUserId === responder.id)!;
    expect(event).toMatchObject({ organizationId: w.A.org.id, regionId: w.A.region.id, complaintId: id, actorUserId: responder.id });
    expect(event.beforeData).toEqual({ status: "open" });
    expect(event.afterData).toEqual({ status: "fixed" });
  });

  it("pass on: records who it was passed to, sets no partner, and sends nothing (it is a recorded step)", async () => {
    const id = w.c.cOpen.id;
    const res = await changeComplaintStatus(rawSession(w.staffA), { complaintId: id, status: "passed_on", passedOnTo: "  Demo Repair Co-op  ", version: await versionOf(w.ctxA1, id) });
    expect(res).toEqual(saved);
    const row = await rawComplaint(id);
    expect(row).toMatchObject({ status: "passed_on", passedOnNote: "Demo Repair Co-op", passedOnPartnerId: null, fixedAt: null });
    const event = (await historyFor(id)).find((e) => e.eventType === "passed_on")!;
    expect(event.beforeData).toEqual({ status: "open" });
    expect(event.afterData).toEqual({ status: "passed_on" });
    // The typed text is on the complaint row only, never in history.
    for (const e of await historyFor(id)) {
      expect(JSON.stringify([e.beforeData, e.afterData])).not.toContain("Demo Repair Co-op");
    }
  });

  it("reopen: back to open, clears the fixed time and the pass-on, and keeps the earlier history", async () => {
    const id = w.c.cPassed.id;
    // passed on -> fixed -> reopened
    expect(await changeComplaintStatus(rawSession(w.staffA), { complaintId: id, status: "fixed", version: await versionOf(w.ctxA1, id) })).toEqual(saved);
    const eventsAfterFix = await historyFor(id);
    expect(await changeComplaintStatus(rawSession(w.staffA), { complaintId: id, status: "open", version: await versionOf(w.ctxA1, id) })).toEqual(saved);
    const row = await rawComplaint(id);
    expect(row).toMatchObject({ status: "open", fixedAt: null, passedOnNote: null, passedOnPartnerId: null });
    const events = await historyFor(id);
    expect(events).toHaveLength(eventsAfterFix.length + 1);
    expect(events.find((e) => e.eventType === "reopened")).toMatchObject({ beforeData: { status: "fixed" }, afterData: { status: "open" } });
    // The earlier events are all still there, unchanged.
    for (const e of eventsAfterFix) expect(JSON.stringify(events.find((x) => x.id === e.id))).toBe(JSON.stringify(e));
  });

  it("version tokens round-trip exactly and move forward on every change", async () => {
    const id = w.c.cOpen.id;
    const seen: string[] = [await versionOf(w.ctxA1, id)];
    for (const [status, extra] of [["passed_on", { passedOnTo: "Demo Repair Co-op" }], ["fixed", {}], ["open", {}], ["passed_on", { passedOnTo: "Demo District Office" }], ["fixed", {}]] as const) {
      expect(await changeComplaintStatus(rawSession(w.staffA), { complaintId: id, status, version: seen.at(-1), ...extra }), status).toEqual(saved);
      seen.push(await versionOf(w.ctxA1, id));
    }
    expect(new Set(seen).size).toBe(seen.length);
    expect([...seen].sort()).toEqual(seen); // text order is time order
  });

  it("the list and the detail show the new state and the appended timeline", async () => {
    const id = w.c.cOpen.id;
    await changeComplaintStatus(rawSession(w.staffA), { complaintId: id, status: "fixed", version: await versionOf(w.ctxA1, id) });
    const d = await getComplaint(w.ctxA1, id);
    if (d.status !== "ok") throw new Error("expected data");
    expect(d.data.complaint.status).toBe("fixed");
    expect(d.data.history.at(-1)).toMatchObject({ type: "status_changed", actor: "Test Staff" });
    const list = await listComplaints(w.ctxA1);
    if (list.status !== "ok") throw new Error("expected data");
    expect(list.data.find((i) => i.complaint.id === id)?.complaint.status).toBe("fixed");
  });
});

describe("two people can never silently overwrite each other (the version check)", () => {
  it("a stale version is refused: nothing changes and nothing is written", async () => {
    const id = w.c.cOpen.id;
    const stale = await versionOf(w.ctxA1, id);
    expect(await changeComplaintStatus(rawSession(w.staffA), { complaintId: id, status: "passed_on", passedOnTo: "Demo Repair Co-op", version: stale })).toEqual(saved);

    const snap = await snapshot(id);
    // A second person, still looking at the old screen, tries to mark it fixed.
    expect(await changeComplaintStatus(rawSession(w.staffA), { complaintId: id, status: "fixed", version: stale })).toEqual({ status: "conflict" });
    expect(await snapshot(id)).toBe(snap);
    expect((await rawComplaint(id)).status).toBe("passed_on");

    // After reloading they can act.
    expect(await changeComplaintStatus(rawSession(w.staffA), { complaintId: id, status: "fixed", version: await versionOf(w.ctxA1, id) })).toEqual(saved);
  });

  it("the same stale form can not be submitted twice (a double click is not a second change)", async () => {
    const id = w.c.cOpen.id;
    const version = await versionOf(w.ctxA1, id);
    const eventsBefore = (await historyFor(id)).length;
    const first = await changeComplaintStatus(rawSession(w.staffA), { complaintId: id, status: "fixed", version });
    const second = await changeComplaintStatus(rawSession(w.staffA), { complaintId: id, status: "fixed", version });
    expect(first).toEqual(saved);
    // The complaint is already fixed, so "fixed" again is not an allowed step: refused, nothing written.
    expect(second).toEqual({ status: "invalid" });
    // An allowed step with the old version (reopen) is a conflict, not a success.
    expect(await changeComplaintStatus(rawSession(w.staffA), { complaintId: id, status: "open", version })).toEqual({ status: "conflict" });
    expect((await rawComplaint(id)).status).toBe("fixed");
    expect((await historyFor(id)).length).toBe(eventsBefore + 1); // only the first submit wrote an event
  });

  it("two changes at the same moment with the same version: exactly one wins, one event", async () => {
    const id = w.c.cOpen.id;
    const version = await versionOf(w.ctxA1, id);
    const eventsBefore = (await historyFor(id)).length;
    const results = await Promise.all([
      changeComplaintStatus(rawSession(w.staffA), { complaintId: id, status: "fixed", version }),
      changeComplaintStatus(rawSession(w.staffA), { complaintId: id, status: "passed_on", passedOnTo: "Demo Repair Co-op", version }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(["conflict", "saved"]);
    expect((await historyFor(id)).length).toBe(eventsBefore + 1);
    expect(["fixed", "passed_on"]).toContain((await rawComplaint(id)).status);
  });

  it("many at once: still exactly one winner", async () => {
    const id = w.c.cOpen.id;
    const version = await versionOf(w.ctxA1, id);
    const eventsBefore = (await historyFor(id)).length;
    const results = await Promise.all(Array.from({ length: 8 }, () => changeComplaintStatus(rawSession(w.staffA), { complaintId: id, status: "fixed", version })));
    expect(results.filter((r) => r.status === "saved")).toHaveLength(1);
    expect(results.filter((r) => r.status === "conflict")).toHaveLength(7);
    expect((await historyFor(id)).length).toBe(eventsBefore + 1);
  });

  it("a malformed or missing version is invalid and writes nothing", async () => {
    const id = w.c.cOpen.id;
    const snap = await snapshot(id);
    for (const version of [undefined, null, "", "garbage", "2026-11-14", "2026-11-14T12:00:00Z", "2026-11-14T12:00:00.123Z", "' or 1=1 --", 5]) {
      expect(await changeComplaintStatus(rawSession(w.staffA), { complaintId: id, status: "fixed", version }), String(version)).toEqual({ status: "invalid" });
    }
    expect(await snapshot(id)).toBe(snap);
  });

  it("a version that looks right but belongs to the past is a conflict, not a success", async () => {
    const id = w.c.cOpen.id;
    const real = await versionOf(w.ctxA1, id);
    const wrong = real.replace(/\.\d{6}Z$/, (m) => (m === ".000000Z" ? ".000001Z" : ".000000Z"));
    expect(await changeComplaintStatus(rawSession(w.staffA), { complaintId: id, status: "fixed", version: wrong })).toEqual({ status: "conflict" });
  });
});

describe("a Viewer is refused on every write, whatever the payload, and nothing changes", () => {
  it("status changes, pass-ons, reopens and notes", async () => {
    const viewer = await staff("viewer");
    const session = rawSession(viewer);
    const ids = [w.c.cOpen.id, w.c.cPassed.id, w.c.cFixed.id];
    const snaps = await Promise.all(ids.map(snapshot));
    for (const id of ids) {
      const version = await versionOf(w.ctxA1, id);
      for (const status of ["open", "passed_on", "fixed", "bogus", undefined]) {
        expect(await changeComplaintStatus(session, { complaintId: id, status, passedOnTo: "Demo Repair Co-op", version }), `${id} ${String(status)}`).toEqual({ status: "denied" });
      }
      for (const text of ["a note", "", "x".repeat(5000)]) expect(await addComplaintNote(session, { complaintId: id, text }), text.slice(0, 8)).toEqual({ status: "denied" });
    }
    expect(await Promise.all(ids.map(snapshot))).toEqual(snaps);
  });

  it("a role claimed in the payload, or on the session object, changes nothing", async () => {
    const viewer = await staff("viewer");
    const id = w.c.cOpen.id;
    const snap = await snapshot(id);
    const spoofed = { ...rawSession(viewer), isAdmin: true, claimedRole: "org_admin", permissions: ["change_status", "manage_users"] };
    expect(await changeComplaintStatus(spoofed, { complaintId: id, status: "fixed", version: await versionOf(w.ctxA1, id), role: "org_admin" } as never)).toEqual({ status: "denied" });
    expect(await snapshot(id)).toBe(snap);
  });

  it("a viewer session is refused (the role is taken from the validated session; the write layer checks the author is active staff in scope)", async () => {
    const viewer = await staff("viewer");
    expect(await changeComplaintStatus({ ...rawSession(viewer), role: "viewer" }, { complaintId: w.c.cOpen.id, status: "fixed", version: await versionOf(w.ctxA1, w.c.cOpen.id) })).toEqual({ status: "denied" });
  });
});

describe("every way across an organization or region is 'not found', identically, and writes nothing", () => {
  it("another organization's staff, another region's staff, a missing id and malformed ids", async () => {
    const id = w.c.cOpen.id;
    const version = await versionOf(w.ctxA1, id);
    const snap = await snapshot(id);
    const otherOrg = rawSession(w.staffB); // a responder of organization B
    const otherRegion = rawSession({ id: w.staffA.id, role: "responder", organizationId: w.A.org.id, regionId: w.regionA2.id }); // same organization, region 2 only
    const answers = [
      await changeComplaintStatus(otherOrg, { complaintId: id, status: "fixed", version }),
      await changeComplaintStatus(otherRegion, { complaintId: id, status: "fixed", version }),
      await changeComplaintStatus(rawSession(w.staffA), { complaintId: "00000000-0000-4000-8000-000000000000", status: "fixed", version }),
      await changeComplaintStatus(rawSession(w.staffA), { complaintId: w.c.cA2.id, status: "fixed", version }), // exists, but in region 2
      await changeComplaintStatus(rawSession(w.staffA), { complaintId: w.c.cB.id, status: "fixed", version }), // exists, in organization B
      await changeComplaintStatus(rawSession(w.staffA), { complaintId: "not-a-uuid", status: "fixed", version }),
      await changeComplaintStatus(rawSession(w.staffA), { complaintId: "' or 1=1 --", status: "fixed", version }),
    ];
    for (const a of answers) expect(a).toEqual({ status: "not_found" });
    expect(await snapshot(id)).toBe(snap);
    expect(await snapshot(w.c.cA2.id)).toBe(await snapshot(w.c.cA2.id));
  });

  it("notes the same way", async () => {
    const id = w.c.cOpen.id;
    const snap = await snapshot(id);
    for (const session of [rawSession(w.staffB), rawSession({ id: w.staffA.id, role: "responder", organizationId: w.A.org.id, regionId: w.regionA2.id })]) {
      expect(await addComplaintNote(session, { complaintId: id, text: "from outside" })).toEqual({ status: "not_found" });
    }
    expect(await snapshot(id)).toBe(snap);
  });

  it("an Org Admin of another organization is also 'not found', never 'denied' or allowed", async () => {
    const admin = await getDb().insert(users).values({ organizationId: w.B.org.id, regionId: w.B.region.id, authSubject: "admin-b-subject", email: "admin-b@example.org", displayName: "Admin B", role: "org_admin", active: true }).returning();
    const id = w.c.cOpen.id;
    const snap = await snapshot(id);
    expect(await changeComplaintStatus(rawSession(admin[0]), { complaintId: id, status: "fixed", version: await versionOf(w.ctxA1, id) })).toEqual({ status: "not_found" });
    expect(await snapshot(id)).toBe(snap);
  });

  it("a write never touches another complaint, in this region or any other", async () => {
    const others = [w.c.cPassed.id, w.c.cFixed.id, w.c.cA2.id, w.c.cB.id, w.c.cForeignOnOurPoint.id];
    const snaps = await Promise.all(others.map(snapshot));
    await changeComplaintStatus(rawSession(w.staffA), { complaintId: w.c.cOpen.id, status: "fixed", version: await versionOf(w.ctxA1, w.c.cOpen.id) });
    await addComplaintNote(rawSession(w.staffA), { complaintId: w.c.cOpen.id, text: "hi" });
    expect(await Promise.all(others.map(snapshot))).toEqual(snaps);
  });

  it("the write layer itself (called directly, past the action checks) refuses another organization, another region and bad contexts", async () => {
    const id = w.c.cOpen.id;
    const version = await versionOf(w.ctxA1, id);
    const snap = await snapshot(id);
    for (const ctx of [w.ctxB, { organizationId: w.A.org.id, regionIds: [w.regionA2.id] }, { organizationId: w.A.org.id, regionIds: [] }] as DataContext[]) {
      expect(await applyStatusChange({ ctx, actorUserId: w.staffA.id, complaintId: id, expectedVersion: version, to: "fixed" })).toEqual({ status: "not_found" });
      expect(await addNote({ ctx, actorUserId: w.staffA.id, complaintId: id, text: "x" })).toEqual({ status: "not_found" });
    }
    // An author who is staff in the organization but in a different region than the context.
    expect(await applyStatusChange({ ctx: { organizationId: w.A.org.id, regionIds: [w.A.region.id] }, actorUserId: (await staffInRegion2()).id, complaintId: id, expectedVersion: version, to: "fixed" })).toEqual({ status: "denied" });
    expect(await snapshot(id)).toBe(snap);
  });

  it("the head lookup answers identically too", async () => {
    const answers = [await getComplaintHead(w.ctxB, w.c.cOpen.id), await getComplaintHead(w.ctxA1, "00000000-0000-4000-8000-000000000000"), await getComplaintHead(w.ctxA1, "nope"), await getComplaintHead(w.ctxA1, w.c.cA2.id), await getComplaintHead(w.ctxA1, w.c.cB.id)];
    for (const a of answers) expect(a).toEqual({ status: "error", error: "not_found_or_denied" });
    expect(await getComplaintHead(w.ctxA1, w.c.cOpen.id)).toMatchObject({ status: "ok", data: { status: "open", organizationId: w.A.org.id } });
  });
});

describe("organization, region and author come from the stored row and the session, never from the request", () => {
  it("fields smuggled into the request are ignored", async () => {
    const id = w.c.cOpen.id;
    const spoof = { organizationId: w.B.org.id, regionId: w.B.region.id, authorUserId: w.staffB.id, actorUserId: w.staffB.id, userId: w.staffB.id };
    await changeComplaintStatus(rawSession(w.staffA), { complaintId: id, status: "fixed", version: await versionOf(w.ctxA1, id), ...spoof } as never);
    await addComplaintNote(rawSession(w.staffA), { complaintId: id, text: "A note", ...spoof } as never);
    const events = await historyFor(id);
    const mine = events.filter((e) => e.actorUserId === w.staffA.id && e.createdAt.getTime() > Date.now() - 60_000);
    expect(mine.length).toBeGreaterThanOrEqual(2);
    for (const e of mine) expect(e).toMatchObject({ organizationId: w.A.org.id, regionId: w.A.region.id });
    const note = (await getDb().select().from(notes).where(and(eq(notes.complaintId, id), eq(notes.body, "A note"))))[0];
    expect(note).toMatchObject({ organizationId: w.A.org.id, regionId: w.A.region.id, authorUserId: w.staffA.id });
  });

  it("a write by an inactive staff member, or by someone from another organization, is refused by the write itself", async () => {
    const id = w.c.cOpen.id;
    const version = await versionOf(w.ctxA1, id);
    const snap = await snapshot(id);
    const inactive = await staff("responder");
    await getDb().update(users).set({ active: false }).where(eq(users.id, inactive.id));
    expect(await applyStatusChange({ ctx: w.ctxA1, actorUserId: inactive.id, complaintId: id, expectedVersion: version, to: "fixed" })).toEqual({ status: "denied" });
    expect(await addNote({ ctx: w.ctxA1, actorUserId: inactive.id, complaintId: id, text: "hi" })).toEqual({ status: "denied" });
    // An author who exists, but in another organization.
    expect(await applyStatusChange({ ctx: w.ctxA1, actorUserId: w.staffB.id, complaintId: id, expectedVersion: version, to: "fixed" })).toEqual({ status: "denied" });
    // An author id that does not exist at all.
    expect(await applyStatusChange({ ctx: w.ctxA1, actorUserId: "00000000-0000-4000-8000-000000000000", complaintId: id, expectedVersion: version, to: "fixed" })).toEqual({ status: "denied" });
    expect(await snapshot(id)).toBe(snap);
  });
});

describe("input is checked, and a bad request writes nothing", () => {
  it("transitions the spec does not allow, a pass-on with no note, and too-long text", async () => {
    const s = rawSession(w.staffA);
    const open = w.c.cOpen.id;
    const fixed = w.c.cFixed.id;
    const passed = w.c.cPassed.id;
    const snaps = await Promise.all([open, fixed, passed].map(snapshot));
    const v = (id: string) => versionOf(w.ctxA1, id);
    for (const [id, status, extra] of [
      [open, "open", {}], // same status
      [fixed, "fixed", {}],
      [fixed, "passed_on", { passedOnTo: "x" }], // fixed to passed on
      [passed, "open", {}], // passed on back to open: not in the spec
      [open, "passed_on", {}], // no note
      [open, "passed_on", { passedOnTo: "   " }],
      [open, "passed_on", { passedOnTo: "x".repeat(201) }],
      [open, "done", {}],
    ] as const) {
      expect(await changeComplaintStatus(s, { complaintId: id, status, version: await v(id), ...extra }), `${id} ${status}`).toEqual({ status: "invalid" });
    }
    expect(await Promise.all([open, fixed, passed].map(snapshot))).toEqual(snaps);
  });

  it("the write function itself refuses a transition the actions would also refuse", async () => {
    const id = w.c.cFixed.id;
    const snap = await snapshot(id);
    expect(await applyStatusChange({ ctx: w.ctxA1, actorUserId: w.staffA.id, complaintId: id, expectedVersion: await versionOf(w.ctxA1, id), to: "passed_on", passedOnNote: "x" })).toEqual({ status: "invalid" });
    expect(await applyStatusChange({ ctx: w.ctxA1, actorUserId: w.staffA.id, complaintId: id, expectedVersion: await versionOf(w.ctxA1, id), to: "fixed" })).toEqual({ status: "invalid" });
    expect(await snapshot(id)).toBe(snap);
  });

  it("bad contexts and ids reach no row", async () => {
    const snap = await snapshot(w.c.cOpen.id);
    for (const ctx of [{ organizationId: "x", regionIds: [] }, { organizationId: w.A.org.id, regionIds: [] }, { organizationId: "'; drop table complaints; --", regionIds: ["x"] }] as DataContext[]) {
      expect(await applyStatusChange({ ctx, actorUserId: w.staffA.id, complaintId: w.c.cOpen.id, expectedVersion: "2026-11-14T12:00:00.000000Z", to: "fixed" })).toEqual({ status: "not_found" });
      expect(await addNote({ ctx, actorUserId: w.staffA.id, complaintId: w.c.cOpen.id, text: "x" })).toEqual({ status: "not_found" });
    }
    expect(await snapshot(w.c.cOpen.id)).toBe(snap);
  });
});

describe("notes", () => {
  it("a note is saved with the session's user as author, the complaint's scope, and a history event that holds no note text", async () => {
    const id = w.c.cOpen.id;
    const res = await addComplaintNote(rawSession(w.staffA), { complaintId: id, text: "  Checked with the committee.  " });
    expect(res).toEqual(saved);
    const row = (await getDb().select().from(notes).where(and(eq(notes.complaintId, id), eq(notes.body, "Checked with the committee."))))[0];
    expect(row).toMatchObject({ authorUserId: w.staffA.id, organizationId: w.A.org.id, regionId: w.A.region.id });
    const event = (await historyFor(id)).find((e) => e.eventType === "note_added" && (e.afterData as { noteId?: string })?.noteId === row.id)!;
    expect(event).toMatchObject({ actorUserId: w.staffA.id, organizationId: w.A.org.id, regionId: w.A.region.id });
    expect(JSON.stringify(event)).not.toContain("Checked with the committee");
    const d = await getComplaint(w.ctxA1, id);
    if (d.status !== "ok") throw new Error("expected data");
    expect(d.data.notes.find((n) => n.text === "Checked with the committee.")?.author).toBe("Test Staff");
  });

  it("adding a note does not move the complaint's version, so it never blocks or breaks a status change in progress", async () => {
    const id = w.c.cOpen.id;
    const version = await versionOf(w.ctxA1, id);
    expect(await addComplaintNote(rawSession(w.staffA), { complaintId: id, text: "A note while someone else has the page open" })).toEqual(saved);
    expect(await versionOf(w.ctxA1, id)).toBe(version);
    expect(await changeComplaintStatus(rawSession(w.staffA), { complaintId: id, status: "fixed", version })).toEqual(saved);
  });

  it("empty, whitespace-only and over-long notes are invalid and write nothing", async () => {
    const id = w.c.cOpen.id;
    const snap = await snapshot(id);
    for (const text of ["", "   ", "\n\t", "x".repeat(1001), undefined, null, 5]) {
      expect(await addComplaintNote(rawSession(w.staffA), { complaintId: id, text }), String(text)).toEqual({ status: "invalid" });
    }
    expect(await snapshot(id)).toBe(snap);
  });

  it("two notes at the same moment are both kept", async () => {
    const id = w.c.cOpen.id;
    const before = (await getDb().select().from(notes).where(eq(notes.complaintId, id))).length;
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => addComplaintNote(rawSession(w.staffA), { complaintId: id, text: `parallel note ${i}` })));
    expect(results.every((r) => r.status === "saved")).toBe(true);
    expect((await getDb().select().from(notes).where(eq(notes.complaintId, id))).length).toBe(before + 5);
  });
});

describe("history only ever grows (red line 9), and a change and its event are all or nothing", () => {
  it("the events the writes created can not be changed or deleted afterwards (the database refuses)", async () => {
    const id = w.c.cOpen.id;
    await changeComplaintStatus(rawSession(w.staffA), { complaintId: id, status: "fixed", version: await versionOf(w.ctxA1, id) });
    await addComplaintNote(rawSession(w.staffA), { complaintId: id, text: "note" });
    const events = await historyFor(id);
    expect(events.length).toBeGreaterThan(2);
    for (const e of events) {
      await expect(getDb().update(historyEvents).set({ note: "tampered" }).where(eq(historyEvents.id, e.id))).rejects.toThrow();
      await expect(getDb().delete(historyEvents).where(eq(historyEvents.id, e.id))).rejects.toThrow();
    }
  });

  it("the write code only ever inserts into history_events", () => {
    const source = readFileSync("lib/data/complaint-writes.ts", "utf8");
    expect(source).not.toMatch(/update\(\s*historyEvents/);
    expect(source).not.toMatch(/delete\(\s*historyEvents/);
    expect(source).not.toMatch(/\.delete\(/);
    expect(source).toMatch(/insert\(\s*historyEvents/);
  });

  it("if the history event can not be written, the status change is rolled back too", async () => {
    const id = w.c.cOpen.id;
    const version = await versionOf(w.ctxA1, id);
    const snap = await snapshot(id);
    const db = getDb();
    await db.execute(sql.raw(`create or replace function test_fail_history() returns trigger language plpgsql as $$ begin if new.event_type = 'status_changed' then raise exception 'injected failure'; end if; return new; end $$`));
    await db.execute(sql.raw(`create trigger test_fail_history_trg before insert on history_events for each row execute function test_fail_history()`));
    try {
      expect(await changeComplaintStatus(rawSession(w.staffA), { complaintId: id, status: "fixed", version })).toEqual({ status: "error" });
      expect(await snapshot(id)).toBe(snap); // status, fixed time, updated_at and events: all unchanged
    } finally {
      await db.execute(sql.raw(`drop trigger if exists test_fail_history_trg on history_events`));
      await db.execute(sql.raw(`drop function if exists test_fail_history()`));
    }
    // And once the failure is gone, the same request works.
    expect(await changeComplaintStatus(rawSession(w.staffA), { complaintId: id, status: "fixed", version })).toEqual(saved);
  });

  it("if the history event can not be written, the note is rolled back too", async () => {
    const id = w.c.cOpen.id;
    const snap = await snapshot(id);
    const db = getDb();
    await db.execute(sql.raw(`create or replace function test_fail_history() returns trigger language plpgsql as $$ begin if new.event_type = 'note_added' then raise exception 'injected failure'; end if; return new; end $$`));
    await db.execute(sql.raw(`create trigger test_fail_history_trg before insert on history_events for each row execute function test_fail_history()`));
    try {
      expect(await addComplaintNote(rawSession(w.staffA), { complaintId: id, text: "will not be kept" })).toEqual({ status: "error" });
      expect(await snapshot(id)).toBe(snap);
    } finally {
      await db.execute(sql.raw(`drop trigger if exists test_fail_history_trg on history_events`));
      await db.execute(sql.raw(`drop function if exists test_fail_history()`));
    }
  });

  it("a failed write logs a fixed code only: no query, value or connection string", async () => {
    const original = console.error;
    const logged: unknown[] = [];
    console.error = (...args: unknown[]) => void logged.push(args);
    const db = getDb();
    await db.execute(sql.raw(`create or replace function test_fail_history() returns trigger language plpgsql as $$ begin raise exception 'injected failure with a-secret-value'; end $$`));
    await db.execute(sql.raw(`create trigger test_fail_history_trg before insert on history_events for each row execute function test_fail_history()`));
    try {
      await changeComplaintStatus(rawSession(w.staffA), { complaintId: w.c.cOpen.id, status: "fixed", version: await versionOf(w.ctxA1, w.c.cOpen.id) });
    } finally {
      console.error = original;
      await db.execute(sql.raw(`drop trigger if exists test_fail_history_trg on history_events`));
      await db.execute(sql.raw(`drop function if exists test_fail_history()`));
    }
    const text = JSON.stringify(logged);
    expect(text).toContain("write_failed");
    expect(text).not.toContain("a-secret-value");
    expect(text).not.toContain("injected failure");
    expect(text).not.toMatch(/insert into|update "complaints"|postgres:\/\//i);
  });
});

describe("the rest of the world is untouched by the writes", () => {
  it("an unrelated complaint's version does not move when another is changed", async () => {
    const before = await versionOf(w.ctxA1, w.c.cPassed.id);
    await changeComplaintStatus(rawSession(w.staffA), { complaintId: w.c.cOpen.id, status: "fixed", version: await versionOf(w.ctxA1, w.c.cOpen.id) });
    expect(await versionOf(w.ctxA1, w.c.cPassed.id)).toBe(before);
    const raw = await getDb().select().from(complaints).where(eq(complaints.id, w.c.cB.id));
    expect(raw[0].status).toBe("open");
  });
});
