/**
 * `npm run db:seed:demo` against Postgres: the demo data lands in the demo
 * organization, reads back through the REAL data layer, is idempotent, holds no
 * caller details, and never touches another organization. Development database
 * (the integration setup refuses anything else).
 */
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { runSeed } from "@/db/seed/seed";
import { DEMO_COMPLAINTS, DEMO_NOTES, DEMO_PARTNERS, DEMO_POINTS, DEMO_REPORTS } from "@/db/seed/demo-data";
import { DemoSeedError, runDemoSeed } from "@/db/seed/demo";
import { getComplaint, getLastReportReceived, listComplaints, listNeedsLocation, listNeedsReview, listPublicWaterPoints, listWaterPoints, type DataContext } from "@/lib/data/complaints";
import { complaints, configuration, historyEvents, notes, organizations, partners, regions, reports, users, waterPoints } from "@/lib/db/schema";
import { getDb } from "@/lib/db";

import { createOrg, resetDb } from "./helpers";

const ok = <T,>(r: { status: string; data?: T }): T => {
  if (r.status !== "ok" || r.data === undefined) throw new Error(`expected data, got ${r.status}`);
  return r.data;
};

async function demoContext(): Promise<DataContext> {
  const db = getDb();
  const [org] = await db.select().from(organizations).where(eq(organizations.name, "Demo Organization"));
  const [region] = await db.select().from(regions).where(eq(regions.organizationId, org.id));
  return { organizationId: org.id, regionIds: [region.id] };
}

/** The seed accepts only port 5434 by default; the tests also use the throwaway Postgres CI starts on 5432. 5433 can never be allowed. */
const TEST_PORTS = { allowedPorts: ["5434", "5432"] } as const;

let ctx: DataContext;
let other: Awaited<ReturnType<typeof createOrg>>;

describe("the demo seed", () => {
  beforeAll(async () => {
    await resetDb();
    // An unrelated organization that must stay untouched.
    other = await createOrg("Unrelated Org");
    await runSeed(); // the demo organization, region and three accounts (A1's seed)
    ctx = await demoContext();
  });

  it("refuses to run before the accounts exist, and says what to do", async () => {
    await resetDb();
    await expect(runDemoSeed(new Date(), TEST_PORTS)).rejects.toThrow(DemoSeedError);
    await expect(runDemoSeed(new Date(), TEST_PORTS)).rejects.toThrow(/npm run db:seed/);
    // Put the world back for the tests below.
    other = await createOrg("Unrelated Org");
    await runSeed();
    ctx = await demoContext();
  });

  it("seeds everything once, then says it is already there", async () => {
    const first = await runDemoSeed(new Date(), TEST_PORTS);
    expect(first.status).toBe("seeded");
    if (first.status === "seeded") {
      expect(first.counts).toMatchObject({
        partners: DEMO_PARTNERS.length,
        waterPoints: DEMO_POINTS.length,
        complaints: DEMO_COMPLAINTS.length,
        reports: DEMO_REPORTS.length,
        notes: DEMO_NOTES.length,
      });
    }
    const counts = async () => ({
      wp: (await getDb().select().from(waterPoints)).length,
      c: (await getDb().select().from(complaints)).length,
      r: (await getDb().select().from(reports)).length,
      n: (await getDb().select().from(notes)).length,
      h: (await getDb().select().from(historyEvents)).length,
      p: (await getDb().select().from(partners)).length,
    });
    const before = await counts();
    expect(await runDemoSeed(new Date(), TEST_PORTS)).toEqual({ status: "already_seeded" });
    expect(await counts()).toEqual(before);
    expect(before).toMatchObject({ wp: DEMO_POINTS.length, c: DEMO_COMPLAINTS.length, r: DEMO_REPORTS.length, n: DEMO_NOTES.length, p: DEMO_PARTNERS.length });
  });

  it("two runs at the same moment still insert once", async () => {
    await resetDb();
    other = await createOrg("Unrelated Org");
    await runSeed();
    ctx = await demoContext();
    const results = await Promise.all([runDemoSeed(new Date(), TEST_PORTS), runDemoSeed(new Date(), TEST_PORTS), runDemoSeed(new Date(), TEST_PORTS)]);
    expect(results.filter((r) => r.status === "seeded")).toHaveLength(1);
    expect((await getDb().select().from(waterPoints)).length).toBe(DEMO_POINTS.length);
  });

  it("refuses by itself when the database URL is unsafe, before it touches the database", async () => {
    const original = process.env.DATABASE_URL;
    try {
      for (const url of [
        "postgres://u:p@127.0.0.1:5433/x",
        "postgres://u:p@127.0.0.1:5434/x?port=5433",
        "postgres://u:p@127.0.0.1:5434#@prod-host:5433/x",
        "postgres://u:p@127.0.0.1/x",
      ]) {
        process.env.DATABASE_URL = url;
        await expect(runDemoSeed(new Date(), TEST_PORTS), url).rejects.toThrow(/Refusing to seed/);
      }
    } finally {
      process.env.DATABASE_URL = original;
    }
    // Nothing was written by those refused attempts.
    const [{ n }] = (await getDb().execute(sql`select count(*)::int as n from configuration where key = 'demo_seed'`)) as unknown as { n: number }[];
    expect(n).toBe(1);
  });

  it("refuses to guess when two active organizations share the demo name", async () => {
    await resetDb();
    await createOrg("Demo Organization");
    await createOrg("Demo Organization");
    await expect(runDemoSeed(new Date(), TEST_PORTS)).rejects.toThrow(/More than one active organization/);
    expect((await getDb().select().from(waterPoints)).length).toBe(0);
    other = await createOrg("Unrelated Org");
    await resetDb();
    other = await createOrg("Unrelated Org");
    await runSeed();
    ctx = await demoContext();
    expect(await runDemoSeed(new Date(), TEST_PORTS)).toMatchObject({ status: "seeded" });
  });

  it("refuses to fill an organization that already holds data it did not write", async () => {
    await resetDb();
    other = await createOrg("Unrelated Org");
    await runSeed();
    ctx = await demoContext();
    const scope = { organizationId: ctx.organizationId, regionId: ctx.regionIds[0] };
    await getDb().insert(waterPoints).values({ ...scope, locationText: "A real point", waterPointType: "well" });
    await expect(runDemoSeed(new Date(), TEST_PORTS)).rejects.toThrow(/already has data/);
    expect((await getDb().select().from(waterPoints)).length).toBe(1);
    expect((await getDb().select().from(configuration).where(eq(configuration.key, "demo_seed"))).length).toBe(0);
    // Put the world back for the tests below.
    await resetDb();
    other = await createOrg("Unrelated Org");
    await runSeed();
    ctx = await demoContext();
    expect(await runDemoSeed(new Date(), TEST_PORTS)).toMatchObject({ status: "seeded" });
  });

  it("leaves a marker row, and writes nothing to another organization", async () => {
    const markers = await getDb().select().from(configuration).where(eq(configuration.key, "demo_seed"));
    expect(markers).toHaveLength(1);
    expect(markers[0].organizationId).toBe(ctx.organizationId);
    for (const table of ["water_points", "complaints", "reports", "notes", "partners", "history_events", "configuration"]) {
      const [{ n }] = (await getDb().execute(sql.raw(`select count(*)::int as n from ${table} where organization_id = '${other.org.id}'`))) as unknown as { n: number }[];
      expect(n, table).toBe(0);
    }
    for (const read of [listComplaints, listWaterPoints, listNeedsReview, listNeedsLocation, getLastReportReceived]) {
      expect((await read({ organizationId: other.org.id, regionIds: [other.region.id] })).status).toBe("empty");
    }
  });
});

describe("the demo data, read back through the real data layer as the demo staff would see it", () => {
  it("lists every status, most urgent first, with the scores and reasons stored", async () => {
    const items = ok(await listComplaints(ctx));
    expect(items).toHaveLength(DEMO_COMPLAINTS.length);
    const scores = items.map((i) => i.complaint.priorityScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(new Set(items.map((i) => i.complaint.status))).toEqual(new Set(["open", "passed_on", "fixed"]));
    expect(items[0].complaint).toMatchObject({ problem: "no_water", peopleAffected: 150, servesSchoolOrClinic: true, duration: "week_or_more", reportCount: 3, priorityScore: 12 });
  });

  it("shows every problem type, and unknown values as unknown", async () => {
    const items = ok(await listComplaints(ctx)).map((i) => i.complaint);
    expect(new Set(items.map((i) => i.problem))).toEqual(new Set(["no_water", "broken", "slow", "dirty", "other", "unknown"]));
    const stonebridge = items.find((c) => c.scoreReason.startsWith("Broken (+3). People affected"));
    expect(stonebridge).toMatchObject({ peopleAffected: "unknown", servesSchoolOrClinic: "unknown", duration: "unknown" });
  });

  it("needs location: the two unverified points with no coordinates", async () => {
    const points = ok(await listNeedsLocation(ctx));
    expect(points.map((p) => p.locationText).sort()).toEqual(["Northgate, near the bus stop", "Stonebridge, past the church on the dirt road"]);
  });

  it("needs review: the three unmatched reports and the incomplete one", async () => {
    const reviews = ok(await listNeedsReview(ctx));
    expect(reviews).toHaveLength(4);
    expect(reviews.filter((r) => r.report.complaintId === null)).toHaveLength(3);
    for (const r of reviews) {
      expect(r.report).not.toHaveProperty("transcript");
      expect(r.report).not.toHaveProperty("summary");
    }
  });

  it("the merged and archived points are hidden by default", async () => {
    const active = ok(await listWaterPoints(ctx)).map((p) => p.verificationState);
    expect(active).not.toContain("merged");
    expect(active).not.toContain("archived");
    expect(ok(await listWaterPoints(ctx, { includeInactive: true }))).toHaveLength(DEMO_POINTS.length);
  });

  it("the detail has the timeline, notes with staff names, the partner and transcripts", async () => {
    const lakeside = ok(await listComplaints(ctx)).find((i) => i.complaint.status === "passed_on")!;
    const d = ok(await getComplaint(ctx, lakeside.complaint.id));
    expect(d.passedOnTo).toMatchObject({ name: "Demo Pump Repair Co-op" });
    expect(d.passedOnTo).not.toHaveProperty("contact");
    expect(d.notes.map((n) => n.author)).toEqual(["Demo Responder"]);
    expect(d.history.map((h) => h.type)).toEqual(expect.arrayContaining(["created", "report_added", "passed_on", "note_added"]));
    expect(d.history.find((h) => h.type === "passed_on")?.actor).toBe("Demo Responder");
    expect(d.reports.every((r) => (r.transcript ?? "").length > 0)).toBe(true);
  });

  it("the last report is recent", async () => {
    const last = ok(await getLastReportReceived(ctx));
    expect(Date.now() - Date.parse(last.receivedAt ?? "")).toBeLessThan(4 * 60 * 60 * 1000);
  });

  it("the public map shows only verified points by default, with derived statuses and nothing else", async () => {
    const scope = { organizationId: ctx.organizationId, regionIds: ctx.regionIds };
    const pins = ok(await listPublicWaterPoints(scope));
    expect(pins).toHaveLength(8);
    expect(new Set(pins.map((p) => p.status))).toEqual(new Set(["open", "passed_on", "fixed", "none"]));
    expect(ok(await listPublicWaterPoints(scope, { includeUnverified: true }))).toHaveLength(9);
    const json = JSON.stringify(pins);
    for (const text of [...DEMO_POINTS.map((p) => p.locationText), ...DEMO_REPORTS.map((r) => r.summary)]) expect(json).not.toContain(text);
  });
});

describe("the stored demo data holds no caller details and respects red line 9", () => {
  it("no phone-number-like or email-like text in any text column the seed wrote", async () => {
    const db = getDb();
    const texts: string[] = [];
    for (const r of await db.select().from(reports)) texts.push(r.locationText, r.summary ?? "", r.transcript ?? "", r.languageSpoken ?? "");
    for (const n of await db.select().from(notes)) texts.push(n.body);
    for (const w of await db.select().from(waterPoints)) texts.push(w.locationText);
    for (const c of await db.select().from(complaints)) texts.push(c.priorityReason, c.passedOnNote ?? "");
    for (const p of await db.select().from(partners)) texts.push(p.name, p.type, p.contact ?? "");
    for (const text of texts) {
      expect(text, text).not.toMatch(/(\+\d[\d\s().-]{7,}\d)|(\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4})/);
      expect(text, text).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
    }
    expect((await db.select().from(partners)).every((p) => p.contact === null)).toBe(true);
  });

  it("the seed never stores a password or credential outside the auth tables", async () => {
    const db = getDb();
    const everything = JSON.stringify([await db.select().from(reports), await db.select().from(notes), await db.select().from(configuration)]);
    expect(everything).not.toMatch(/password|passwd|secret/i);
  });

  it("history written by the seed can not be changed or deleted afterwards (the database refuses)", async () => {
    const db = getDb();
    const [event] = await db.select().from(historyEvents).limit(1);
    await expect(db.update(historyEvents).set({ eventType: "tampered" }).where(eq(historyEvents.id, event.id))).rejects.toThrow();
    await expect(db.delete(historyEvents).where(eq(historyEvents.id, event.id))).rejects.toThrow();
  });

  it("the demo staff exist, and the seed did not change any of them", async () => {
    const staff = await getDb().select().from(users);
    expect(staff.map((s) => s.role).sort()).toEqual(["org_admin", "responder", "viewer"]);
    expect(staff.every((s) => s.active)).toBe(true);
  });
});
