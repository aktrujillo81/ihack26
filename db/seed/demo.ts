import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { serverEnv } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { complaints, configuration, historyEvents, notes, organizations, partners, regions, reportCandidates, reports, users, waterPoints } from "@/lib/db/schema";
import { SEED_ACCOUNTS, SEED_ORGANIZATION, SEED_REGION } from "./data";
import { deriveComplaintFacts } from "@/lib/data/derive";
import { assertDevelopmentDatabase, type GuardOptions } from "./guard";
import { DEMO_COMPLAINTS, DEMO_NOTES, DEMO_PARTNERS, DEMO_POINTS, DEMO_REPORTS } from "./demo-data";

export class DemoSeedError extends Error {}

/** The marker row in D1's `configuration` table. If it exists the demo data is already there. */
export const DEMO_MARKER_KEY = "demo_seed";
export const DEMO_VERSION = 1;

const HOUR_MS = 60 * 60 * 1000;

export type DemoSeedResult = { status: "seeded"; organizationId: string; counts: Record<string, number> } | { status: "already_seeded" };

/** The URL the database module connects with, read through the env module (red line 16). Unset reads as undefined, which the guard refuses. */
export function configuredDatabaseUrl(): string | undefined {
  try {
    return serverEnv.databaseUrl;
  } catch {
    return undefined;
  }
}

/**
 * Adds the demo water points, complaints, reports, notes, partners and history
 * to the demo organization and region that `npm run db:seed` created. Safe to
 * run twice: a marker row stops a second run. It never deletes anything
 * (history is append-only, red line 9), so to start over, delete the local
 * development database (`.pgdata/`), not the production one.
 *
Refusing to run against production is done HERE as well as in the command line
 * (db/seed/guard.ts), so no other caller can skip it: it checks the same
 * `DATABASE_URL` the database module connects with, before connecting. By default
 * only the development database (port 5434) is accepted; the integration tests
 * pass their own allowed ports. 5433 can never be allowed.
 */
export async function runDemoSeed(now: Date = new Date(), options: Pick<GuardOptions, "allowedPorts"> = {}): Promise<DemoSeedResult> {
  assertDevelopmentDatabase(configuredDatabaseUrl(), { allowedPorts: options.allowedPorts });
  const ago = (hours: number) => new Date(now.getTime() - hours * HOUR_MS);

  return getDb().transaction(async (tx) => {
    // One demo seed at a time.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('wellwatch_demo_seed'))`);

    // The organization is found by NAME, and names are not unique in D1. More than one match could mean
    // a real organization was given this name, so refuse instead of picking one.
    const matches = await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(and(eq(organizations.name, SEED_ORGANIZATION.name), isNull(organizations.archivedAt)));
    if (matches.length > 1) {
      throw new DemoSeedError("More than one active organization has the demo organization's name. Refusing to guess which one to fill.");
    }
    const [org] = matches;
    if (!org) throw new DemoSeedError("The demo organization does not exist. Run `npm run db:seed` first.");
    const [region] = await tx
      .select({ id: regions.id })
      .from(regions)
      .where(and(eq(regions.organizationId, org.id), eq(regions.slug, SEED_REGION.slug), isNull(regions.archivedAt)))
      .limit(1);
    if (!region) throw new DemoSeedError("The demo region does not exist. Run `npm run db:seed` first.");
    const scope = { organizationId: org.id, regionId: region.id };

    const [marker] = await tx
      .select({ id: configuration.id })
      .from(configuration)
      .where(and(eq(configuration.organizationId, org.id), eq(configuration.regionId, region.id), eq(configuration.key, DEMO_MARKER_KEY)))
      .limit(1);
    if (marker) return { status: "already_seeded" } as const;

    // A demo organization starts empty. If it already holds data that this seed did not write, it may be a
    // real organization that shares the name: refuse instead of mixing invented rows into it.
    for (const table of [waterPoints, complaints, reports, notes, partners] as const) {
      const [existing] = await tx.select({ id: table.id }).from(table).where(eq(table.organizationId, org.id)).limit(1);
      if (existing) throw new DemoSeedError("The demo organization already has data. Refusing to add demo rows to it.");
    }

    // Staff who wrote notes and made changes: the seeded demo accounts.
    const staff = new Map<"responder" | "admin", string>();
    for (const [name, role] of [["responder", "responder"], ["admin", "org_admin"]] as const) {
      const account = SEED_ACCOUNTS.find((a) => a.role === role);
      const [row] = account
        ? await tx
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.organizationId, org.id), eq(users.email, account.email.toLowerCase())))
            .limit(1)
        : [];
      if (!row) throw new DemoSeedError("The demo staff accounts do not exist. Run `npm run db:seed` first.");
      staff.set(name, row.id);
    }

    // Partners (no contact details).
    const partnerIds = new Map<string, string>();
    for (const p of DEMO_PARTNERS) {
      const [row] = await tx.insert(partners).values({ ...scope, name: p.name, type: p.type, contact: null }).returning({ id: partners.id });
      partnerIds.set(p.key, row.id);
    }

    // Water points. A merged point is inserted first and pointed at its survivor afterwards.
    const pointIds = new Map<string, string>();
    for (const p of DEMO_POINTS) {
      const [row] = await tx
        .insert(waterPoints)
        .values({
          ...scope,
          locationText: p.locationText,
          waterPointType: p.type,
          verificationState: p.verification,
          locationSource: p.source,
          latitude: p.lat,
          longitude: p.lng,
          needsReview: p.needsReview ?? false,
          createdAt: ago(100),
          updatedAt: ago(100),
        })
        .returning({ id: waterPoints.id });
      pointIds.set(p.key, row.id);
    }
    for (const p of DEMO_POINTS) {
      if (!p.mergedInto) continue;
      await tx.update(waterPoints).set({ mergedIntoId: pointIds.get(p.mergedInto) }).where(eq(waterPoints.id, pointIds.get(p.key)!));
    }

    // Complaints. The report count is counted from the demo reports, not typed in.
    const complaintIds = new Map<string, string>();
    for (const c of DEMO_COMPLAINTS) {
      const theirReports = DEMO_REPORTS.filter((r) => r.complaint === c.key);
      const lastTouchHours = Math.min(...theirReports.map((r) => r.hoursAgo), c.fixedHoursAgo ?? Infinity, c.passedOnNote ? 24 : Infinity, c.createdHoursAgo);
      const facts = deriveComplaintFacts(theirReports.map((r) => ({ problem: r.problem, duration: r.duration, peopleAffected: r.people, servesSchoolOrClinic: r.school })));
      const [row] = await tx
        .insert(complaints)
        .values({
          ...scope,
          problem: facts.problem,
          peopleAffected: facts.peopleAffected === "unknown" ? null : facts.peopleAffected,
          servesSchoolOrClinic: facts.servesSchoolOrClinic === "unknown" ? null : facts.servesSchoolOrClinic,
          duration: facts.duration,
          waterPointId: pointIds.get(c.point)!,
          status: c.status,
          priorityScore: c.score,
          priorityReason: c.reason,
          reportCount: theirReports.length,
          needsReview: c.needsReview ?? false,
          passedOnPartnerId: c.partner ? partnerIds.get(c.partner) : null,
          passedOnNote: c.passedOnNote ?? null,
          fixedAt: c.fixedHoursAgo !== undefined ? ago(c.fixedHoursAgo) : null,
          createdAt: ago(c.createdHoursAgo),
          updatedAt: ago(lastTouchHours),
        })
        .returning({ id: complaints.id });
      complaintIds.set(c.key, row.id);
    }

    // Reports, including unmatched ones (needs review). Never dropped.
    for (const r of DEMO_REPORTS) {
      if (r.needsReview && !r.reason) throw new DemoSeedError(`Demo report ${r.key} needs review but has no reason.`);
      const [reportRow] = await tx.insert(reports).values({
        ...scope,
        complaintId: r.complaint ? complaintIds.get(r.complaint) : null,
        waterPointId: r.point ? pointIds.get(r.point) : null,
        channel: "phone",
        locationText: r.locationText,
        waterPointType: r.type,
        problem: r.problem,
        peopleAffected: r.people,
        servesSchoolOrClinic: r.school,
        duration: r.duration,
        callerConfirmed: !r.needsReview,
        summary: r.summary,
        languageSpoken: "English",
        transcript: r.transcript,
        needsReview: r.needsReview ?? false,
        needsReviewReason: r.reason ?? null,
        receivedAt: ago(r.hoursAgo),
        createdAt: ago(r.hoursAgo),
        updatedAt: ago(r.hoursAgo),
      }).returning({ id: reports.id });
      for (const key of r.candidates ?? []) {
        await tx.insert(reportCandidates).values({ ...scope, reportId: reportRow.id, waterPointId: pointIds.get(key)! });
      }
    }

    for (const n of DEMO_NOTES) {
      await tx.insert(notes).values({ ...scope, complaintId: complaintIds.get(n.complaint)!, authorUserId: staff.get(n.by)!, body: n.text, createdAt: ago(n.hoursAgo), updatedAt: ago(n.hoursAgo) });
    }

    // History: append-only. One "created" per complaint, then what happened to it.
    const events: (typeof historyEvents.$inferInsert)[] = [];
    for (const c of DEMO_COMPLAINTS) {
      const base = { ...scope, complaintId: complaintIds.get(c.key)!, waterPointId: pointIds.get(c.point)! };
      events.push({ ...base, actorUserId: null, eventType: "created", afterData: { status: "open" }, createdAt: ago(c.createdHoursAgo) });
      const theirReports = DEMO_REPORTS.filter((r) => r.complaint === c.key).sort((a, b) => b.hoursAgo - a.hoursAgo);
      theirReports.slice(1).forEach((r, i) => {
        events.push({ ...base, actorUserId: null, eventType: "report_added", beforeData: { reportCount: i + 1 }, afterData: { reportCount: i + 2 }, createdAt: ago(r.hoursAgo) });
      });
      if (c.status === "passed_on") {
        events.push({ ...base, actorUserId: staff.get("responder")!, eventType: "passed_on", beforeData: { status: "open" }, afterData: { status: "passed_on", passedOnNote: c.passedOnNote ?? null }, createdAt: ago(24) });
      }
      if (c.status === "fixed" && c.fixedHoursAgo !== undefined) {
        events.push({ ...base, actorUserId: staff.get("responder")!, eventType: "status_changed", beforeData: { status: "open" }, afterData: { status: "fixed" }, createdAt: ago(c.fixedHoursAgo) });
      }
    }
    for (const n of DEMO_NOTES) {
      const c = DEMO_COMPLAINTS.find((x) => x.key === n.complaint)!;
      events.push({ ...scope, complaintId: complaintIds.get(n.complaint)!, waterPointId: pointIds.get(c.point)!, actorUserId: staff.get(n.by)!, eventType: "note_added", createdAt: ago(n.hoursAgo) });
    }
    const dup = DEMO_POINTS.find((p) => p.mergedInto);
    if (dup) {
      events.push({ ...scope, complaintId: null, waterPointId: pointIds.get(dup.key)!, actorUserId: staff.get("responder")!, eventType: "merged", afterData: { mergedIntoId: pointIds.get(dup.mergedInto!) ?? null }, createdAt: ago(50) });
    }
    await tx.insert(historyEvents).values(events);

    await tx.insert(configuration).values({ ...scope, key: DEMO_MARKER_KEY, value: { version: DEMO_VERSION } });

    return {
      status: "seeded",
      organizationId: org.id,
      counts: {
        partners: DEMO_PARTNERS.length,
        waterPoints: DEMO_POINTS.length,
        complaints: DEMO_COMPLAINTS.length,
        reports: DEMO_REPORTS.length,
        notes: DEMO_NOTES.length,
        historyEvents: events.length,
      },
    } as const;
  });
}
