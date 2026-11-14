/**
 * The REAL data layer (lib/data/complaints.ts) against Postgres. This is where
 * red line 8 is proven for reads: two organizations, three regions, and every
 * attempt to read across those lines. Runs only against the test database on a
 * development server (see tests/integration/test-db-target.ts).
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  PUBLIC_PIN_KEYS,
  getComplaint,
  getLastReportReceived,
  listComplaints,
  listNeedsLocation,
  listNeedsReview,
  listPublicWaterPoints,
  listWaterPoints,
  type DataContext,
} from "@/lib/data/complaints";

import { SECRET, buildWorld, type World } from "./data-fixtures";
import { resetDb } from "./helpers";

let w: World;

beforeAll(async () => {
  await resetDb();
  w = await buildWorld();
});

const ok = <T,>(r: { status: string; data?: T }): T => {
  if (r.status !== "ok" || r.data === undefined) throw new Error(`expected data, got ${r.status}`);
  return r.data;
};
const NOT_FOUND = { status: "error", error: "not_found_or_denied" } as const;

describe("lists are scoped to the user's organization and regions", () => {
  it("one region sees only that region's complaints, most urgent first", async () => {
    const items = ok(await listComplaints(w.ctxA1));
    expect(items.map((i) => i.complaint.id)).toEqual([w.c.cOpen.id, w.c.cPassed.id, w.c.cCrossPoint.id, w.c.cFixed.id, w.c.cNoReports.id, w.c.cCrossPartner.id]);
    const scores = items.map((i) => i.complaint.priorityScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("two regions see both, and nothing from the other organization", async () => {
    const ids = ok(await listComplaints(w.ctxA1A2)).map((i) => i.complaint.id);
    expect(ids).toContain(w.c.cA2.id);
    expect(ids).not.toContain(w.c.cB.id);
  });

  it("the other organization sees only its own", async () => {
    // Organization B owns two complaints: its own, and one that points at one of A's water points.
    expect(ok(await listComplaints(w.ctxB)).map((i) => i.complaint.id)).toEqual([w.c.cForeignOnOurPoint.id, w.c.cB.id]);
  });

  it("a real organization id with another organization's region sees nothing", async () => {
    expect((await listComplaints({ organizationId: w.A.org.id, regionIds: [w.B.region.id] })).status).toBe("empty");
    expect((await listComplaints({ organizationId: w.B.org.id, regionIds: [w.A.region.id] })).status).toBe("empty");
  });

  it("every list function returns nothing for the other organization, never an error and never someone's data", async () => {
    const stranger: DataContext = { organizationId: w.B.org.id, regionIds: [w.A.region.id, w.regionA2.id] };
    for (const r of [await listComplaints(stranger), await listNeedsReview(stranger), await listNeedsLocation(stranger), await listWaterPoints(stranger), await getLastReportReceived(stranger)]) {
      expect(r.status).toBe("empty");
    }
  });
});

describe("a bad context returns nothing, never everything", () => {
  /** Built when a test runs (the world does not exist while the file is collected). */
  const badContexts = (): unknown[] => [
    undefined,
    null,
    {},
    { organizationId: w.A.org.id },
    { regionIds: [w.A.region.id] },
    { organizationId: w.A.org.id, regionIds: "not-an-array" },
    { organizationId: "not-a-uuid", regionIds: ["not-a-uuid"] },
    { organizationId: "", regionIds: [] },
    { organizationId: "00000000-0000-4000-8000-000000000000", regionIds: [] },
    { organizationId: "00000000-0000-4000-8000-000000000000", regionIds: ["x"] },
    { organizationId: "'; drop table complaints; --", regionIds: ["'; drop table complaints; --"] },
  ];

  it("lists", async () => {
    for (const ctx of badContexts()) {
      for (const read of [listComplaints, listNeedsReview, listNeedsLocation, listWaterPoints, getLastReportReceived]) {
        const r = await read(ctx as DataContext);
        expect(r.status, JSON.stringify(ctx)).toBe("empty");
      }
    }
  });

  it("the detail read", async () => {
    for (const ctx of badContexts()) expect(await getComplaint(ctx as DataContext, w.c.cOpen.id), JSON.stringify(ctx)).toEqual(NOT_FOUND);
  });
});

describe("lists carry no transcripts, summaries or caller details", () => {
  it("the complaint list has no transcript, no summary, no reports, and no spoken text from other records", async () => {
    const json = JSON.stringify(await listComplaints(w.ctxA1));
    for (const secret of [SECRET.transcript1, SECRET.transcript2, SECRET.summary1, SECRET.reviewSummary, SECRET.noteText, SECRET.contact, SECRET.otherOrgReport, SECRET.crossReport, SECRET.crossNote, SECRET.partnerB, "SECRET-REGION-TWO-TRANSCRIPT"]) {
      expect(json, secret).not.toContain(secret);
    }
    for (const item of ok(await listComplaints(w.ctxA1))) expect(item).not.toHaveProperty("reports");
  });

  it("the needs-review list has no transcript, and never another organization's reports", async () => {
    const reviews = ok(await listNeedsReview(w.ctxA1));
    expect(reviews.map((i) => i.report.id)).toEqual([w.r.rReview.id]);
    const json = JSON.stringify(reviews);
    expect(json).not.toContain("SECRET-REVIEW-TRANSCRIPT");
    expect(json).not.toContain(SECRET.reviewSummary);
    expect(json).not.toContain(SECRET.otherOrgReport);
    for (const item of reviews) {
      expect(item.report).not.toHaveProperty("transcript");
      expect(item.report).not.toHaveProperty("summary");
    }
    expect(ok(await listNeedsReview(w.ctxB)).map((i) => i.report.complaintId)).toEqual([w.c.cB.id]);
  });

  it("no returned object has a phone, email or contact key, at any depth", async () => {
    const all = JSON.stringify([
      await listComplaints(w.ctxA1A2),
      await getComplaint(w.ctxA1, w.c.cPassed.id),
      await listNeedsReview(w.ctxA1),
      await listNeedsLocation(w.ctxA1),
      await listWaterPoints(w.ctxA1),
    ]);
    expect(all).not.toMatch(/"[a-zA-Z]*(phone|email|contact)[a-zA-Z]*"\s*:/i);
    expect(all).not.toContain(SECRET.contact);
  });
});

describe("what a complaint shows is derived from its reports (D1 keeps no such columns on complaints)", () => {
  it("takes the most severe known values and keeps unknowns unknown", async () => {
    const open = ok(await listComplaints(w.ctxA1)).find((i) => i.complaint.id === w.c.cOpen.id)!.complaint;
    expect(open).toMatchObject({ problem: "no_water", peopleAffected: 150, servesSchoolOrClinic: true, duration: "week_or_more", reportCount: 2, scoreReason: "No water (+3), school (+3)" });
  });

  it("a complaint with no reports is all unknown, never zero", async () => {
    const none = ok(await listComplaints(w.ctxA1)).find((i) => i.complaint.id === w.c.cNoReports.id)!.complaint;
    expect(none).toMatchObject({ problem: "unknown", peopleAffected: "unknown", servesSchoolOrClinic: "unknown", duration: "unknown", needsReview: true });
  });

  it("a known 'false' beats unknown for school or clinic", async () => {
    const passed = ok(await listComplaints(w.ctxA1)).find((i) => i.complaint.id === w.c.cPassed.id)!.complaint;
    expect(passed).toMatchObject({ problem: "dirty", peopleAffected: 40, servesSchoolOrClinic: false, status: "passed_on", passedOnNote: "Demo Repair Co-op" });
  });
});

describe("the detail read", () => {
  it("returns reports with transcripts (here only), notes, history and the partner", async () => {
    const d = ok(await getComplaint(w.ctxA1, w.c.cOpen.id));
    expect(d.reports.map((r) => r.id)).toEqual([w.r.r2.id, w.r.r1.id]); // newest first
    expect(d.reports.find((r) => r.id === w.r.r1.id)?.transcript).toBe(SECRET.transcript1);
    expect(d.reports.find((r) => r.id === w.r.r2.id)?.peopleAffected).toBe("unknown");
    expect(d.reports.find((r) => r.id === w.r.r2.id)?.servesSchoolOrClinic).toBe("unknown");
    expect(d.history.map((h) => h.type)).toEqual(["created", "status_changed", "note_added"]); // oldest first
    expect(d.waterPoint?.id).toBe(w.wp.wpOpen.id);
    expect(d.waterPoint?.latitude).toBeCloseTo(-1.2921, 4);
  });

  it("rows from other regions and organizations that point at this complaint are never shown", async () => {
    const d = ok(await getComplaint(w.ctxA1, w.c.cOpen.id));
    const json = JSON.stringify(d);
    for (const secret of [SECRET.crossReport, SECRET.crossNote]) expect(json, secret).not.toContain(secret);
    expect(d.reports).toHaveLength(2);
    expect(d.notes).toHaveLength(2);
    expect(d.history).toHaveLength(3);
    // Two regions see the region-2 report, but still never the other organization's.
    const both = ok(await getComplaint(w.ctxA1A2, w.c.cOpen.id));
    expect(both.reports).toHaveLength(3);
    expect(JSON.stringify(both)).not.toContain("8888");
  });

  it("a partner that belongs to another organization is never shown, even if the complaint points at it", async () => {
    const d = ok(await getComplaint(w.ctxA1, w.c.cCrossPartner.id));
    expect(d.complaint.status).toBe("passed_on");
    expect(d.passedOnTo).toBeNull();
    expect(JSON.stringify(d)).not.toContain(SECRET.partnerB);
    expect(JSON.stringify(d)).not.toContain(SECRET.contact);
  });

  it("the partner has no contact field and its contact value never appears", async () => {
    const d = ok(await getComplaint(w.ctxA1, w.c.cPassed.id));
    expect(d.passedOnTo).toMatchObject({ name: "Demo Repair Co-op", type: "repair technician" });
    expect(d.passedOnTo).not.toHaveProperty("contact");
    expect(JSON.stringify(d)).not.toContain(SECRET.contact);
  });

  it("a note's author is shown only if the author is in this organization", async () => {
    const d = ok(await getComplaint(w.ctxA1, w.c.cOpen.id));
    expect(d.notes.find((n) => n.text === SECRET.noteText)?.author).toBe("Test Staff");
    // The second note was written by a user of ANOTHER organization: no name is shown.
    expect(d.notes.find((n) => n.text === "Note by someone else")?.author).toBeNull();
    // Same for history: an actor from another organization is null, a staff actor in this one is named.
    expect(d.history.find((h) => h.type === "status_changed")?.actor).toBe("Test Staff");
    expect(d.history.find((h) => h.type === "note_added")?.actor).toBeNull();
    expect(d.history.find((h) => h.type === "created")?.actor).toBeNull();
  });

  it("a water point in another region is not shown on an in-scope complaint", async () => {
    const d = ok(await getComplaint(w.ctxA1, w.c.cCrossPoint.id));
    expect(d.waterPoint).toBeNull();
    const item = ok(await listComplaints(w.ctxA1)).find((i) => i.complaint.id === w.c.cCrossPoint.id)!;
    expect(item.waterPoint).toBeNull();
  });

  it("returns the version token: UTC text to the microsecond", async () => {
    const d = ok(await getComplaint(w.ctxA1, w.c.cOpen.id));
    expect(d.complaint.version).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
  });

  it("another organization, another region, a missing id and a malformed id all answer identically", async () => {
    const answers = [
      await getComplaint(w.ctxB, w.c.cOpen.id), // another organization
      await getComplaint({ organizationId: w.A.org.id, regionIds: [w.regionA2.id] }, w.c.cOpen.id), // another region, same organization
      await getComplaint(w.ctxA1, "00000000-0000-4000-8000-000000000000"), // missing
      await getComplaint(w.ctxA1, w.c.cA2.id), // exists, but in another region
      await getComplaint(w.ctxA1, w.c.cB.id), // exists, in another organization
      await getComplaint(w.ctxA1, "not-a-uuid"),
      await getComplaint(w.ctxA1, ""),
      await getComplaint(w.ctxA1, "' or 1=1 --"),
      await getComplaint(w.ctxA1, `${w.c.cOpen.id}x`),
    ];
    for (const a of answers) expect(a).toEqual(NOT_FOUND);
  });

  it("never leaks another organization's secret in any answer", async () => {
    const json = JSON.stringify([await getComplaint(w.ctxB, w.c.cOpen.id), await getComplaint(w.ctxA1, w.c.cB.id), await listComplaints(w.ctxA1)]);
    expect(json).not.toContain(SECRET.otherOrgReport);
  });
});

describe("water points and the last report", () => {
  it("lists active points, hides merged and archived unless asked", async () => {
    const active = ok(await listWaterPoints(w.ctxA1)).map((p) => p.id);
    expect(active).toContain(w.wp.wpOpen.id);
    expect(active).not.toContain(w.wp.wpMerged.id);
    expect(active).not.toContain(w.wp.wpArchived.id);
    const all = ok(await listWaterPoints(w.ctxA1, { includeInactive: true })).map((p) => p.id);
    expect(all).toContain(w.wp.wpMerged.id);
    expect(all).toContain(w.wp.wpArchived.id);
    expect(all).not.toContain(w.wp.wpA2.id);
  });

  it("needs-location lists only active points with no coordinates", async () => {
    expect(ok(await listNeedsLocation(w.ctxA1)).map((p) => p.id)).toEqual([w.wp.wpNoCoords.id]);
  });

  it("coordinates are numbers, and a point with none has null", async () => {
    const pts = ok(await listWaterPoints(w.ctxA1));
    expect(pts.find((p) => p.id === w.wp.wpOpen.id)?.longitude).toBeCloseTo(36.8219, 4);
    expect(pts.find((p) => p.id === w.wp.wpNoCoords.id)).toMatchObject({ latitude: null, longitude: null });
  });

  it("the last report received is the newest in the user's own scope only", async () => {
    expect(ok(await getLastReportReceived(w.ctxA1))).toEqual({ receivedAt: "2026-11-13T12:00:00.000Z" });
    expect(ok(await getLastReportReceived(w.ctxB))).toEqual({ receivedAt: "2026-11-14T09:00:00.000Z" });
    expect(ok(await getLastReportReceived(w.ctxA1A2))).toEqual({ receivedAt: "2026-11-14T07:00:00.000Z" });
  });
});

describe("the public read returns only the allowlisted fields", () => {
  const publicA = () => ({ organizationId: w.A.org.id, regionIds: [w.A.region.id] });

  it("every pin has exactly the public keys", async () => {
    for (const pin of ok(await listPublicWaterPoints(publicA()))) expect(Object.keys(pin).sort()).toEqual([...PUBLIC_PIN_KEYS].sort());
  });

  it("no value from any record appears: no location text, ids, scores, notes, transcripts or contacts", async () => {
    const json = JSON.stringify(await listPublicWaterPoints(publicA(), { includeUnverified: true }));
    for (const secret of [SECRET.location1, SECRET.transcript1, SECRET.summary1, SECRET.noteText, SECRET.contact, "Reason text", "No water (+3)", w.wp.wpOpen.id, w.c.cOpen.id, w.A.org.id, w.A.region.id]) {
      expect(json, secret).not.toContain(secret);
    }
  });

  it("only verified, active water points with coordinates are published by default", async () => {
    const pins = ok(await listPublicWaterPoints(publicA()));
    expect(pins).toHaveLength(5); // open, passed on, fixed, open (needs review), bare. Not: unverified, no coordinates, merged, archived.
    expect(pins.every((p) => p.unverified === false)).toBe(true);
  });

  it("unverified points are published only when explicitly turned on", async () => {
    const pins = ok(await listPublicWaterPoints(publicA(), { includeUnverified: true }));
    expect(pins).toHaveLength(6);
    expect(pins.filter((p) => p.unverified)).toHaveLength(1);
  });

  it("status comes from complaints without exposing any", async () => {
    const statuses = ok(await listPublicWaterPoints(publicA())).map((p) => p.status).sort();
    expect(statuses).toEqual(["fixed", "none", "open", "open", "passed_on"]);
    // Another organization has an OPEN complaint on our "fixed" water point. It must not change what we publish.
    const fixedPin = ok(await listPublicWaterPoints(publicA())).find((p) => p.status === "fixed");
    expect(fixedPin).toBeDefined();
  });

  it("the order depends on public values only, and keys are positions, not ids", async () => {
    const pins = ok(await listPublicWaterPoints(publicA()));
    const lat = pins.map((p) => p.latitude);
    expect(lat).toEqual([...lat].sort((a, b) => a - b));
    expect(pins.map((p) => p.key)).toEqual(pins.map((_, i) => `pin-${i + 1}`));
  });

  it("never shows another organization's or region's points", async () => {
    expect(ok(await listPublicWaterPoints({ organizationId: w.B.org.id, regionIds: [w.B.region.id] }))).toHaveLength(1);
    expect(JSON.stringify(await listPublicWaterPoints(publicA(), { includeUnverified: true }))).not.toContain("-2.000000");
    expect((await listPublicWaterPoints({ organizationId: w.A.org.id, regionIds: [w.B.region.id] })).status).toBe("empty");
  });

  it("a missing, empty or malformed scope publishes nothing", async () => {
    for (const scope of [null, { organizationId: "", regionIds: [] }, { organizationId: w.A.org.id, regionIds: [] }, { organizationId: "org-demo", regionIds: ["region-demo"] }, { organizationId: w.A.org.id, regionIds: ["x"] }]) {
      expect((await listPublicWaterPoints(scope as never)).status, JSON.stringify(scope)).toBe("empty");
    }
  });
});
