/**
 * A small, controlled world for the data layer tests: two organizations, three
 * regions, water points of every kind, complaints, reports with secret
 * transcripts, notes, history and a partner with a contact value. Everything is
 * invented. There are no caller names and no phone numbers or emails.
 *
 * Secret markers ("SECRET-...") let a test prove they never leak into a place
 * they must not appear (a list, the public map, another organization).
 */
import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { complaints, historyEvents, notes, partners, regions, reports, users, waterPoints } from "@/lib/db/schema";

import { addStaff, createAuthUser, createOrg } from "./helpers";

export const SECRET = {
  transcript1: "SECRET-TRANSCRIPT-ONE",
  transcript2: "SECRET-TRANSCRIPT-TWO",
  summary1: "SECRET-SUMMARY-ONE",
  location1: "SECRET-LOCATION-RIVERSIDE",
  contact: "SECRET-PARTNER-CONTACT",
  noteText: "SECRET-NOTE-TEXT",
  otherOrgReport: "SECRET-OTHER-ORG-TRANSCRIPT",
  reviewSummary: "SECRET-REVIEW-SUMMARY",
  crossReport: "SECRET-CROSS-SCOPE-REPORT-TRANSCRIPT",
  crossNote: "SECRET-CROSS-SCOPE-NOTE",
  partnerB: "SECRET-PARTNER-OF-ANOTHER-ORG",
};

export async function buildWorld() {
  const db = getDb();

  const A = await createOrg("Org A");
  const B = await createOrg("Org B");
  // A second region in organization A.
  const [regionA2] = await db
    .insert(regions)
    .values({ organizationId: A.org.id, name: "Org A region two", slug: "region-a2" })
    .returning();

  const staffAuth = await createAuthUser("staff-a@example.org");
  const staffA = await addStaff(staffAuth.id, A.org.id, A.region.id, "responder", "staff-a@example.org");
  const staffBAuth = await createAuthUser("staff-b@example.org");
  const staffB = await addStaff(staffBAuth.id, B.org.id, B.region.id, "responder", "staff-b@example.org");

  const scopeA1 = { organizationId: A.org.id, regionId: A.region.id };
  const scopeA2 = { organizationId: A.org.id, regionId: regionA2.id };
  const scopeB = { organizationId: B.org.id, regionId: B.region.id };

  const point = (scope: typeof scopeA1, over: Partial<typeof waterPoints.$inferInsert> = {}) =>
    db
      .insert(waterPoints)
      .values({
        ...scope,
        locationText: "Demo village near the demo school",
        waterPointType: "hand_pump",
        verificationState: "verified",
        locationSource: "map_pin",
        latitude: "-1.292100",
        longitude: "36.821900",
        ...over,
      })
      .returning()
      .then((r) => r[0]);

  // Organization A, region 1
  const wpOpen = await point(scopeA1, { locationText: SECRET.location1, latitude: "-1.292100", longitude: "36.821900" });
  const wpPassed = await point(scopeA1, { waterPointType: "borehole", latitude: "-1.295500", longitude: "36.830200" });
  const wpFixed = await point(scopeA1, { waterPointType: "tap", latitude: "-1.288800", longitude: "36.815000" });
  const wpNone = await point(scopeA1, { waterPointType: "well", latitude: "-1.301000", longitude: "36.840000" });
  // A verified point with no complaint at all: its public status is "none".
  const wpBare = await point(scopeA1, { waterPointType: "borehole", latitude: "-1.305000", longitude: "36.845000" });
  const wpUnverified = await point(scopeA1, { waterPointType: "tap", verificationState: "unverified", locationSource: "landmark_only", latitude: "-1.310000", longitude: "36.800000" });
  const wpNoCoords = await point(scopeA1, { waterPointType: "well", verificationState: "unverified", locationSource: "landmark_only", latitude: null, longitude: null });
  const wpMerged = await point(scopeA1, { verificationState: "merged", mergedIntoId: wpOpen.id, latitude: null, longitude: null });
  const wpArchived = await point(scopeA1, { verificationState: "archived", latitude: "-1.320000", longitude: "36.850000" });
  // Organization A, region 2 and organization B
  const wpA2 = await point(scopeA2, { waterPointType: "other", latitude: "-1.400000", longitude: "36.900000" });
  // A second region-2 point: at most one active complaint may exist per water point (contracts 4.1 item 8).
  const wpA2b = await point(scopeA2, { waterPointType: "other", latitude: "-1.410000", longitude: "36.910000" });
  const wpB = await point(scopeB, { waterPointType: "borehole", latitude: "-2.000000", longitude: "37.000000" });

  const [partner] = await db
    .insert(partners)
    .values({ ...scopeA1, name: "Demo Repair Co-op", type: "repair technician", contact: SECRET.contact })
    .returning();

  // A partner that belongs to ANOTHER organization. The schema lets a complaint point at it.
  const [partnerB] = await db
    .insert(partners)
    .values({ ...scopeB, name: SECRET.partnerB, type: "repair technician", contact: SECRET.contact })
    .returning();

  const complaint = (scope: typeof scopeA1, waterPointId: string, over: Partial<typeof complaints.$inferInsert> = {}) =>
    db
      .insert(complaints)
      .values({ ...scope, waterPointId, priorityReason: "Reason text", ...over })
      .returning()
      .then((r) => r[0]);

  const cOpen = await complaint(scopeA1, wpOpen.id, { status: "open", priorityScore: 12, priorityReason: "No water (+3), school (+3)", reportCount: 2 });
  const cPassed = await complaint(scopeA1, wpPassed.id, { status: "passed_on", priorityScore: 7, reportCount: 1, passedOnPartnerId: partner.id, passedOnNote: "Demo Repair Co-op" });
  const cFixed = await complaint(scopeA1, wpFixed.id, { status: "fixed", priorityScore: 2, reportCount: 1, fixedAt: new Date() });
  const cNoReports = await complaint(scopeA1, wpNone.id, { status: "open", priorityScore: 1, reportCount: 0, needsReview: true });
  // A complaint in region 1 that points at a water point in region 2: the water point must not be shown.
  const cCrossPoint = await complaint(scopeA1, wpA2.id, { status: "open", priorityScore: 3 });
  const cA2 = await complaint(scopeA2, wpA2b.id, { status: "open", priorityScore: 9 });
  const cB = await complaint(scopeB, wpB.id, { status: "open", priorityScore: 20 });
  // In-scope complaint on a point with no coordinates that is "passed on" to another organization's partner.
  const cCrossPartner = await complaint(scopeA1, wpNoCoords.id, { status: "passed_on", priorityScore: 0, passedOnPartnerId: partnerB.id });
  // ANOTHER organization's complaint that points at one of OUR water points. Our public status must not change.
  const cForeignOnOurPoint = await complaint(scopeB, wpFixed.id, { status: "open", priorityScore: 50 });

  const report = (scope: typeof scopeA1, complaintId: string | null, waterPointId: string | null, over: Partial<typeof reports.$inferInsert> = {}) =>
    db
      .insert(reports)
      .values({
        ...scope,
        complaintId,
        waterPointId,
        channel: "phone",
        locationText: "Demo village",
        waterPointType: "hand_pump",
        problem: "unknown",
        duration: "unknown",
        ...over,
      })
      .returning()
      .then((r) => r[0]);

  // Two reports on the open complaint: the most severe values must win; unknowns must stay unknown.
  const r1 = await report(scopeA1, cOpen.id, wpOpen.id, {
    problem: "no_water", peopleAffected: 150, servesSchoolOrClinic: true, duration: "week_or_more",
    summary: SECRET.summary1, transcript: SECRET.transcript1, receivedAt: new Date("2026-11-11T07:00:00Z"),
  });
  const r2 = await report(scopeA1, cOpen.id, wpOpen.id, {
    problem: "slow", peopleAffected: null, servesSchoolOrClinic: null, duration: "few_days",
    transcript: SECRET.transcript2, receivedAt: new Date("2026-11-13T07:00:00Z"),
  });
  await report(scopeA1, cPassed.id, wpPassed.id, { problem: "dirty", peopleAffected: 40, servesSchoolOrClinic: false, duration: "today", receivedAt: new Date("2026-11-12T07:00:00Z") });
  await report(scopeA1, cFixed.id, wpFixed.id, { problem: "other", receivedAt: new Date("2026-11-09T07:00:00Z") });
  // Needs review, unmatched.
  const rReview = await report(scopeA1, null, null, { needsReview: true, needsReviewReason: "unusable_location", locationText: "unknown", summary: SECRET.reviewSummary, transcript: "SECRET-REVIEW-TRANSCRIPT", receivedAt: new Date("2026-11-13T12:00:00Z") });
  // Other region and organization.
  await report(scopeA2, cA2.id, wpA2b.id, { problem: "broken", transcript: "SECRET-REGION-TWO-TRANSCRIPT", receivedAt: new Date("2026-11-14T07:00:00Z") });
  await report(scopeB, cB.id, wpB.id, { problem: "broken", transcript: SECRET.otherOrgReport, needsReview: true, needsReviewReason: "not_confirmed", receivedAt: new Date("2026-11-14T09:00:00Z") });

  // Rows in OTHER scopes that point at our open complaint (the schema allows it). None may ever be shown.
  await report(scopeA2, cOpen.id, wpOpen.id, { problem: "other", peopleAffected: 9999, servesSchoolOrClinic: false, duration: "today", transcript: SECRET.crossReport, receivedAt: new Date("2026-11-10T00:00:00Z") });
  await report(scopeB, cOpen.id, wpOpen.id, { problem: "other", peopleAffected: 8888, transcript: SECRET.crossReport, receivedAt: new Date("2026-11-10T01:00:00Z") });
  await db.insert(notes).values({ ...scopeB, complaintId: cOpen.id, authorUserId: staffB.id, body: SECRET.crossNote });
  await db.insert(notes).values({ ...scopeA2, complaintId: cOpen.id, authorUserId: staffA.id, body: SECRET.crossNote });
  await db.insert(historyEvents).values([
    { ...scopeB, complaintId: cOpen.id, waterPointId: wpOpen.id, actorUserId: staffB.id, eventType: "status_changed", beforeData: { status: "open" }, afterData: { status: "fixed" }, createdAt: new Date("2026-11-12T11:00:00Z") },
    { ...scopeA2, complaintId: cOpen.id, waterPointId: wpOpen.id, actorUserId: null, eventType: "created", createdAt: new Date("2026-11-12T12:00:00Z") },
  ]);

  await db.insert(notes).values({ ...scopeA1, complaintId: cOpen.id, authorUserId: staffA.id, body: SECRET.noteText });
  // A note whose author belongs to ANOTHER organization (the schema allows it): that name must never be shown.
  await db.insert(notes).values({ ...scopeA1, complaintId: cOpen.id, authorUserId: staffB.id, body: "Note by someone else" });

  await db.insert(historyEvents).values([
    { ...scopeA1, complaintId: cOpen.id, waterPointId: wpOpen.id, actorUserId: null, eventType: "created", afterData: { status: "open" }, createdAt: new Date("2026-11-11T07:00:00Z") },
    { ...scopeA1, complaintId: cOpen.id, waterPointId: wpOpen.id, actorUserId: staffA.id, eventType: "status_changed", beforeData: { status: "open" }, afterData: { status: "fixed" }, createdAt: new Date("2026-11-12T09:00:00Z") },
    { ...scopeA1, complaintId: cOpen.id, waterPointId: wpOpen.id, actorUserId: staffB.id, eventType: "note_added", createdAt: new Date("2026-11-12T10:00:00Z") },
  ]);

  return {
    A, B, regionA2, staffA, staffB, partner, partnerB,
    scopeA1, scopeA2, scopeB,
    wp: { wpOpen, wpPassed, wpFixed, wpNone, wpBare, wpUnverified, wpNoCoords, wpMerged, wpArchived, wpA2, wpA2b, wpB },
    c: { cOpen, cPassed, cFixed, cNoReports, cCrossPoint, cCrossPartner, cForeignOnOurPoint, cA2, cB },
    r: { r1, r2, rReview },
    ctxA1: { organizationId: A.org.id, regionIds: [A.region.id] },
    ctxA1A2: { organizationId: A.org.id, regionIds: [A.region.id, regionA2.id] },
    ctxB: { organizationId: B.org.id, regionIds: [B.region.id] },
  };
}

export type World = Awaited<ReturnType<typeof buildWorld>>;

/** Reads a complaint row directly, bypassing the data layer. */
export async function rawComplaint(id: string) {
  const [row] = await getDb().select().from(complaints).where(eq(complaints.id, id));
  return row;
}

export async function historyFor(complaintId: string) {
  return getDb().select().from(historyEvents).where(and(eq(historyEvents.complaintId, complaintId)));
}

export async function countUsers() {
  return (await getDb().select().from(users)).length;
}
