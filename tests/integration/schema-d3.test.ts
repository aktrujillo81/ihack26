/**
 * Task D3-schema (contracts 4.1 items 1, 2, 3, 5, 6, 7, 8, 11) against Postgres:
 * the constraints refuse what they must, and migration 0003 backfills and guards
 * legacy data. Development database only (the integration setup refuses others).
 */
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { beforeAll, describe, expect, inject, it } from "vitest";

import { getDb } from "@/lib/db";
import { complaints, reportCandidates, reports, waterPoints } from "@/lib/db/schema";

import { createOrg, resetDb } from "./helpers";

type World = Awaited<ReturnType<typeof createOrg>>;

const scopeOf = (w: World) => ({ organizationId: w.org.id, regionId: w.region.id });

const baseReport = {
  channel: "phone" as const,
  locationText: "Riverside, near the market",
  waterPointType: "hand_pump" as const,
  problem: "broken" as const,
  duration: "today" as const,
};

async function point(w: World, text = "Riverside") {
  const [p] = await getDb().insert(waterPoints).values({ ...scopeOf(w), locationText: text, waterPointType: "tap" }).returning();
  return p;
}
async function report(w: World, extra: Partial<typeof reports.$inferInsert> = {}) {
  const [r] = await getDb().insert(reports).values({ ...scopeOf(w), ...baseReport, ...extra }).returning();
  return r;
}
async function complaint(w: World, waterPointId: string, status: "open" | "passed_on" | "fixed" = "open") {
  const [c] = await getDb().insert(complaints).values({ ...scopeOf(w), waterPointId, status, priorityReason: "test" }).returning();
  return c;
}
/** A query that must be refused by the database. */
const refused = (p: PromiseLike<unknown>) => expect(Promise.resolve(p)).rejects.toThrow();

let A: World;
let B: World;

describe("schema D3/D4/D5 constraints", () => {
  beforeAll(async () => {
    await resetDb();
    A = await createOrg("Org A");
    B = await createOrg("Org B");
  });

  it("refuses the same provider_call_ref twice in one organization, allows it in two, allows many nulls", async () => {
    await report(A, { providerCallRef: "call-1" });
    await refused(report(A, { providerCallRef: "call-1" }));
    await expect(report(B, { providerCallRef: "call-1" })).resolves.toBeTruthy();
    await report(A);
    await expect(report(A)).resolves.toBeTruthy();
  });

  it("refuses needs_review without a reason, accepts it with one, accepts no review without one", async () => {
    await refused(report(A, { needsReview: true }));
    await expect(report(A, { needsReview: true, needsReviewReason: "not_confirmed" })).resolves.toBeTruthy();
    await expect(report(A, { needsReview: false })).resolves.toBeTruthy();
    await refused(
      getDb().execute(
        sql`insert into reports (organization_id, region_id, channel, location_text, water_point_type, problem, duration, needs_review_reason) values (${A.org.id}, ${A.region.id}, 'phone', 'x', 'tap', 'broken', 'today', 'off_topic')`,
      ),
    );
  });

  it("allows only the three ended_reason values or null", async () => {
    for (const ended of ["customer-ended-call", "assistant-said-end-call-phrase", "other", null]) {
      await expect(report(A, { endedReason: ended })).resolves.toBeTruthy();
    }
    await refused(report(A, { endedReason: "silence-timed-out" }));
  });

  it("allows at most one open or passed_on complaint per water point", async () => {
    const p = await point(A, "Hilltop");
    await complaint(A, p.id, "open");
    await refused(complaint(A, p.id, "open"));
    await refused(complaint(A, p.id, "passed_on"));
    // Fixed complaints are history and may repeat; after fixing, a new one may open.
    await complaint(A, p.id, "fixed");
    await complaint(A, p.id, "fixed");
    await getDb().update(complaints).set({ status: "fixed" }).where(eq(complaints.waterPointId, p.id));
    await expect(complaint(A, p.id, "open")).resolves.toBeTruthy();
    // A different water point is unaffected.
    const q = await point(A, "Lakeside");
    await expect(complaint(A, q.id, "passed_on")).resolves.toBeTruthy();
  });

  it("refuses a candidate whose report and water point are in different scopes, and a duplicate pair", async () => {
    const r = await report(A, { needsReview: true, needsReviewReason: "ambiguous_match" });
    const p = await point(A, "Southgate west");
    const otherOrgPoint = await point(B, "Org B point");
    const [a2] = (await getDb().execute(
      sql`insert into regions (organization_id, name, slug) values (${A.org.id}, 'second', 'second-region') returning id`,
    )) as unknown as { id: string }[];
    const [otherRegionPoint] = await getDb()
      .insert(waterPoints)
      .values({ organizationId: A.org.id, regionId: a2.id, locationText: "Other region", waterPointType: "tap" })
      .returning();

    await expect(getDb().insert(reportCandidates).values({ ...scopeOf(A), reportId: r.id, waterPointId: p.id })).resolves.toBeTruthy();
    await refused(getDb().insert(reportCandidates).values({ ...scopeOf(A), reportId: r.id, waterPointId: p.id }));
    // Another organization's point under organization A's scope, and under its own scope with A's report.
    await refused(getDb().insert(reportCandidates).values({ ...scopeOf(A), reportId: r.id, waterPointId: otherOrgPoint.id }));
    await refused(getDb().insert(reportCandidates).values({ ...scopeOf(B), reportId: r.id, waterPointId: otherOrgPoint.id }));
    // Same organization, different region.
    await refused(getDb().insert(reportCandidates).values({ ...scopeOf(A), reportId: r.id, waterPointId: otherRegionPoint.id }));
  });

  it("lets a candidate be removed and repointed (a merge repoints it, an attach removes it)", async () => {
    const r = await report(A, { needsReview: true, needsReviewReason: "ambiguous_match" });
    const p1 = await point(A, "Cand one");
    const p2 = await point(A, "Cand two");
    const [c] = await getDb().insert(reportCandidates).values({ ...scopeOf(A), reportId: r.id, waterPointId: p1.id }).returning();
    await getDb().update(reportCandidates).set({ waterPointId: p2.id }).where(eq(reportCandidates.id, c.id));
    await getDb().delete(reportCandidates).where(eq(reportCandidates.id, c.id));
    expect(await getDb().select().from(reportCandidates).where(eq(reportCandidates.reportId, r.id))).toHaveLength(0);
  });

  it("stores location_key on a water point and leaves it null by default", async () => {
    const p = await point(A, "Keyed");
    expect(p.locationKey).toBeNull();
    const [k] = await getDb().update(waterPoints).set({ locationKey: "riverside near market" }).where(eq(waterPoints.id, p.id)).returning();
    expect(k.locationKey).toBe("riverside near market");
  });

  it("complaint facts default to unknown and refuse a negative people_affected", async () => {
    const p = await point(A, "Facts");
    const c = await complaint(A, p.id);
    expect(c).toMatchObject({ problem: "unknown", duration: "unknown", peopleAffected: null, servesSchoolOrClinic: null });
    await refused(getDb().update(complaints).set({ peopleAffected: -1 }).where(eq(complaints.id, c.id)));
  });
});

/** Applies migrations before the last to a scratch database, inserts legacy rows, then runs the last one's statements. */
describe("migration 0003 on legacy data", () => {
  const migrationsDir = path.resolve("db/migrations");
  const legacyMigration = "0003_ancient_namorita";
  const statements = readFileSync(path.join(migrationsDir, `${legacyMigration}.sql`), "utf8").split("--> statement-breakpoint");

  async function scratch(name: string) {
    const url = new URL(inject("testDatabaseUrl"));
    const admin = new URL(url);
    admin.pathname = "/postgres";
    url.pathname = `/${name}`;
    const a = postgres(admin.toString(), { max: 1, onnotice: () => {} });
    await a.unsafe(`drop database if exists ${name} with (force)`);
    await a.unsafe(`create database ${name}`);
    await a.end();
    const dir = mkdtempSync(path.join(tmpdir(), "mig-"));
    cpSync(migrationsDir, dir, { recursive: true });
    const j = JSON.parse(readFileSync(path.join(dir, "meta/_journal.json"), "utf8"));
    const legacyIndex = j.entries.findIndex((entry: { tag: string }) => entry.tag === legacyMigration);
    j.entries = j.entries.slice(0, legacyIndex);
    writeFileSync(path.join(dir, "meta/_journal.json"), JSON.stringify(j));
    const conn = postgres(url.toString(), { max: 1, onnotice: () => {} });
    await migrate(drizzle(conn), { migrationsFolder: dir });
    return conn;
  }

  async function legacyBase(s: postgres.Sql) {
    const [o] = await s`insert into organizations (name) values ('Legacy') returning id`;
    const [r] = await s`insert into regions (organization_id, name, slug) values (${o.id}, 'R', 'r') returning id`;
    return { o: o.id as string, r: r.id as string };
  }
  const wp = async (s: postgres.Sql, b: { o: string; r: string }, t: string) =>
    (await s`insert into water_points (organization_id, region_id, location_text, water_point_type) values (${b.o}, ${b.r}, ${t}, 'tap') returning id`)[0].id as string;

  it("backfills review reasons and complaint facts", async () => {
    const s = await scratch("wellwatch_test_backfill");
    try {
      const b = await legacyBase(s);
      const p = await wp(s, b, "Legacy point");
      const [c] = await s`insert into complaints (organization_id, region_id, water_point_id, priority_reason) values (${b.o}, ${b.r}, ${p}, 'x') returning id`;
      const [empty] = await s`insert into complaints (organization_id, region_id, water_point_id, priority_reason) values (${b.o}, ${b.r}, ${await wp(s, b, "No reports")}, 'x') returning id`;
      const ins = (x: { complaint?: string | null; text: string; problem: string; duration: string; people: number | null; school: boolean | null; confirmed: boolean | null; review: boolean }) =>
        s`insert into reports (organization_id, region_id, complaint_id, channel, location_text, water_point_type, problem, duration, people_affected, serves_school_or_clinic, caller_confirmed, needs_review)
          values (${b.o}, ${b.r}, ${x.complaint ?? null}, 'phone', ${x.text}, 'tap', ${x.problem}, ${x.duration}, ${x.people}, ${x.school}, ${x.confirmed}, ${x.review}) returning id`;
      await ins({ complaint: c.id, text: "a", problem: "slow", duration: "today", people: 10, school: false, confirmed: true, review: false });
      const [flaggedAttached] = await ins({ complaint: c.id, text: "a", problem: "no_water", duration: "week_or_more", people: 120, school: null, confirmed: false, review: true });
      const [flaggedAttached2] = await ins({ complaint: c.id, text: "a", problem: "unknown", duration: "unknown", people: null, school: null, confirmed: true, review: true });
      const [lost] = await ins({ text: "unknown", problem: "unknown", duration: "unknown", people: null, school: null, confirmed: null, review: true });
      const [other] = await ins({ text: "Somewhere known", problem: "broken", duration: "today", people: null, school: null, confirmed: null, review: true });
      const [fine] = await ins({ text: "ok", problem: "broken", duration: "today", people: null, school: null, confirmed: true, review: false });

      for (const st of statements) await s.unsafe(st);

      const reasons = Object.fromEntries((await s`select id, needs_review_reason as r from reports`).map((x) => [x.id, x.r]));
      expect(reasons[flaggedAttached.id]).toBe("not_confirmed");
      expect(reasons[flaggedAttached2.id]).toBe("invalid_fields");
      expect(reasons[lost.id]).toBe("unusable_location");
      expect(reasons[other.id]).toBe("processing_error");
      expect(reasons[fine.id]).toBeNull();

      const [facts] = await s`select problem, duration, people_affected, serves_school_or_clinic as school from complaints where id = ${c.id}`;
      expect(facts).toMatchObject({ problem: "no_water", duration: "week_or_more", people_affected: 120, school: false });
      const [none] = await s`select problem, duration, people_affected, serves_school_or_clinic as school from complaints where id = ${empty.id}`;
      expect(none).toMatchObject({ problem: "unknown", duration: "unknown", people_affected: null, school: null });
      // location_key is not backfilled (D4).
      expect((await s`select count(*)::int as n from water_points where location_key is not null`)[0].n).toBe(0);
    } finally {
      await s.end();
    }
  });

  it("stops, changing nothing, when a water point already has two active complaints", async () => {
    const s = await scratch("wellwatch_test_backfill");
    try {
      const b = await legacyBase(s);
      const p = await wp(s, b, "Doubled");
      for (const status of ["open", "passed_on"]) {
        await s`insert into complaints (organization_id, region_id, water_point_id, status, priority_reason) values (${b.o}, ${b.r}, ${p}, ${status}, 'x')`;
      }
      await s`insert into reports (organization_id, region_id, channel, location_text, water_point_type, problem, duration, needs_review) values (${b.o}, ${b.r}, 'phone', 'x', 'tap', 'broken', 'today', true)`;
      let failure: unknown;
      try {
        for (const st of statements) await s.unsafe(st);
      } catch (e) {
        failure = e;
      }
      expect(String((failure as Error)?.message)).toMatch(/more than one open or passed_on complaint/);
      // The guard runs first: no review reason was filled in.
      expect((await s`select count(*)::int as n from reports where needs_review_reason is not null`)[0].n).toBe(0);
    } finally {
      await s.end();
    }
  });
});
