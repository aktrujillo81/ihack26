import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { assertDevelopmentDatabase } from "@/db/seed/guard";
import { serverEnv } from "@/lib/config/env";
import { DEFAULT_TEXT_MAX_LENGTH } from "@/lib/config/intake-defaults";
import { getDb } from "@/lib/db";
import { complaints, configuration, historyEvents, reportCandidates, reports, waterPoints } from "@/lib/db/schema";
import { deriveComplaintFacts } from "@/lib/data/derive";
import { scrubNumbers } from "./scrub";
import { capFreeText } from "./text-caps";
import type { ValidatedReport } from "./types";

export type SaveReportResult = { ok: true; repeat: boolean } | { ok: false; reason: "store_failed" };

export async function saveReport(report: ValidatedReport): Promise<SaveReportResult> {
  // This is deliberately before getDb(): a production URL must never be opened by this path.
  assertDevelopmentDatabase(serverEnv.databaseUrl);

  const db = getDb();
  const cleaned = cleanReport(report);
  let storedId: string;
  try {
    const stored = await db.transaction(async (tx) => {
      const intakeRows = await tx
        .select({ organizationId: configuration.organizationId, regionId: configuration.regionId })
        .from(configuration)
        .where(eq(configuration.key, "intake.phone"));
      if (intakeRows.length !== 1) throw new Error("scope");
      const scope = intakeRows[0];

      if (cleaned.providerCallRef !== null) {
        const [repeat] = await tx
          .select({ id: reports.id })
          .from(reports)
          .where(and(eq(reports.organizationId, scope.organizationId), eq(reports.providerCallRef, cleaned.providerCallRef)))
          .limit(1);
        if (repeat) return { id: repeat.id, repeat: true };
      }

      const [row] = await tx
        .insert(reports)
        .values({
          ...scope,
          channel: cleaned.channel,
          locationText: cleaned.locationText,
          waterPointType: cleaned.waterPointType,
          problem: cleaned.problem,
          peopleAffected: cleaned.peopleAffected,
          servesSchoolOrClinic: cleaned.servesSchoolOrClinic,
          duration: cleaned.duration,
          callerConfirmed: cleaned.callerConfirmed,
          summary: null,
          languageSpoken: cleaned.languageSpoken,
          transcript: null,
          needsReview: cleaned.needsReview,
          needsReviewReason: cleaned.needsReviewReason,
          providerCallRef: cleaned.providerCallRef,
          endedReason: cleaned.endedReason,
        })
        // The dedupe index is partial, so PostgreSQL cannot infer it from a target list.
        .onConflictDoNothing()
        .returning({ id: reports.id });
      if (row) return { id: row.id, repeat: false };

      const [repeat] = await tx
        .select({ id: reports.id })
        .from(reports)
        .where(and(eq(reports.organizationId, scope.organizationId), eq(reports.providerCallRef, cleaned.providerCallRef!)))
        .limit(1);
      if (!repeat) throw new Error("report");
      return { id: repeat.id, repeat: true };
    });
    storedId = stored.id;
    if (stored.repeat) {
      console.log("[ingest] repeat");
      return { ok: true, repeat: true };
    }
  } catch {
    console.error("[ingest] store_failed");
    return { ok: false, reason: "store_failed" };
  }

  try {
    const result = await processStoredReport(storedId);
    return { ok: true, repeat: false, ...result };
  } catch {
    // A concurrent first complaint can lose the partial unique-index race. Retry once
    // as an attach before retaining the report as a processing failure.
    try {
      await processStoredReport(storedId);
      return { ok: true, repeat: false };
    } catch {
      await markProcessingError(storedId);
      console.error("[ingest] processing_error");
      return { ok: true, repeat: false };
    }
  }
}

function cleanReport(report: ValidatedReport): ValidatedReport {
  const text = capFreeText(
    {
      locationText: scrubNumbers(report.locationText),
      summary: "",
      languageSpoken: report.languageSpoken === null ? null : scrubNumbers(report.languageSpoken),
    },
    DEFAULT_TEXT_MAX_LENGTH,
  );
  const unusable = text.locationText.replaceAll("[number removed]", "").trim().length < 3 || text.locationText.toLowerCase() === "unknown";
  return {
    ...report,
    locationText: unusable ? "unknown" : text.locationText,
    summary: null,
    languageSpoken: text.languageSpoken === "" ? null : text.languageSpoken,
    needsReview: unusable || report.needsReview,
    needsReviewReason: unusable ? "unusable_location" : report.needsReviewReason,
  };
}

function locationKey(text: string): string | null {
  if (text === "unknown") return null;
  const key = text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return key || null;
}

async function processStoredReport(reportId: string): Promise<{ outcome?: "matched" | "new" | "needs_review" }> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [report] = await tx.select().from(reports).where(eq(reports.id, reportId)).limit(1);
    if (!report) throw new Error("report");
    const key = locationKey(report.locationText);
    const [scoringConfig] = await tx.select({ value: configuration.value }).from(configuration).where(and(eq(configuration.organizationId, report.organizationId), eq(configuration.regionId, report.regionId), eq(configuration.key, "scoring.weights"))).limit(1);
    const weights = resolveWeights(scoringConfig?.value);
    const blocked = report.needsReviewReason === "malformed_payload" || report.needsReviewReason === "no_structured_data" || report.needsReviewReason === "unusable_location" || report.needsReviewReason === "processing_error";
    if (blocked || key === null) return;

    const points = await tx
      .select()
      .from(waterPoints)
      .where(and(eq(waterPoints.organizationId, report.organizationId), eq(waterPoints.regionId, report.regionId), eq(waterPoints.locationKey, key), inArray(waterPoints.verificationState, ["unverified", "verified", "merged"])));
    const candidates = resolveCandidates(points).filter((point) => point.waterPointType === report.waterPointType || point.waterPointType === "unknown" || report.waterPointType === "unknown");
    if (candidates.length > 1) {
      await tx.update(reports).set({ needsReview: true, needsReviewReason: "ambiguous_match", updatedAt: new Date() }).where(eq(reports.id, report.id));
      await tx.insert(reportCandidates).values(candidates.map((point) => ({ organizationId: report.organizationId, regionId: report.regionId, reportId: report.id, waterPointId: point.id })));
      return;
    }

    let pointId = candidates[0]?.id;
    if (!pointId) {
      const [point] = await tx.insert(waterPoints).values({
        organizationId: report.organizationId,
        regionId: report.regionId,
        locationText: report.locationText,
        waterPointType: report.waterPointType,
        verificationState: "unverified",
        locationSource: "landmark_only",
        needsReview: report.needsReview,
        locationKey: key,
      }).returning({ id: waterPoints.id });
      pointId = point.id;
    }

    const [existing] = await tx.select().from(complaints).where(and(eq(complaints.organizationId, report.organizationId), eq(complaints.regionId, report.regionId), eq(complaints.waterPointId, pointId), inArray(complaints.status, ["open", "passed_on"]))).limit(1);
    let complaintId = existing?.id;
    if (!complaintId) {
      const [complaint] = await tx.insert(complaints).values({ organizationId: report.organizationId, regionId: report.regionId, waterPointId: pointId, priorityReason: "problem unknown +1; total 1", reportCount: 0 }).returning({ id: complaints.id });
      complaintId = complaint.id;
      await tx.insert(historyEvents).values({ organizationId: report.organizationId, regionId: report.regionId, complaintId, waterPointId: pointId, actorUserId: null, eventType: "created", afterData: { status: "open" } });
    }
    await tx.update(reports).set({ complaintId, waterPointId: pointId, updatedAt: new Date() }).where(eq(reports.id, report.id));
    const attached = await tx.select({ problem: reports.problem, peopleAffected: reports.peopleAffected, servesSchoolOrClinic: reports.servesSchoolOrClinic, duration: reports.duration, needsReview: reports.needsReview }).from(reports).where(eq(reports.complaintId, complaintId));
    const facts = deriveComplaintFacts(attached);
    const reportCount = attached.length;
    const score = scoreComplaint(facts, reportCount, weights);
    await tx.update(complaints).set({ reportCount, priorityScore: score.score, priorityReason: score.reason, needsReview: attached.some((r) => r.needsReview), problem: facts.problem, peopleAffected: facts.peopleAffected === "unknown" ? null : facts.peopleAffected, servesSchoolOrClinic: facts.servesSchoolOrClinic === "unknown" ? null : facts.servesSchoolOrClinic, duration: facts.duration, updatedAt: new Date() }).where(eq(complaints.id, complaintId));
    await tx.insert(historyEvents).values({ organizationId: report.organizationId, regionId: report.regionId, complaintId, waterPointId: pointId, actorUserId: null, eventType: "report_added", beforeData: { reportCount: reportCount - 1 }, afterData: { reportCount } });
  });
  return {};
}

function resolveCandidates(points: Array<typeof waterPoints.$inferSelect>): Array<typeof waterPoints.$inferSelect> {
  const byId = new Map(points.map((point) => [point.id, point]));
  const result = new Map<string, typeof points[number]>();
  for (const point of points) {
    let current = point;
    const seen = new Set<string>();
    while (current.verificationState === "merged" && current.mergedIntoId && !seen.has(current.id)) {
      seen.add(current.id);
      const next = byId.get(current.mergedIntoId);
      if (!next) break;
      current = next;
    }
    if (current.verificationState !== "archived") result.set(current.id, current);
  }
  return [...result.values()];
}

interface ScoreWeights {
  problemSevere: number;
  problemOther: number;
  school: number;
  people100: number;
  people20: number;
  weekOrMore: number;
  fewDays: number;
  extraReport: number;
  extraReportCap: number;
}

const DEFAULT_SCORE_WEIGHTS: ScoreWeights = { problemSevere: 3, problemOther: 1, school: 3, people100: 2, people20: 1, weekOrMore: 2, fewDays: 1, extraReport: 1, extraReportCap: 3 };

function resolveWeights(value: unknown): ScoreWeights {
  if (typeof value !== "object" || value === null) return DEFAULT_SCORE_WEIGHTS;
  const row = value as Record<string, unknown>;
  const number = (key: keyof ScoreWeights) => typeof row[key] === "number" && Number.isFinite(row[key]) && row[key] >= 0 ? row[key] as number : DEFAULT_SCORE_WEIGHTS[key];
  return { problemSevere: number("problemSevere"), problemOther: number("problemOther"), school: number("school"), people100: number("people100"), people20: number("people20"), weekOrMore: number("weekOrMore"), fewDays: number("fewDays"), extraReport: number("extraReport"), extraReportCap: number("extraReportCap") };
}

function scoreComplaint(facts: ReturnType<typeof deriveComplaintFacts>, reportCount: number, weights: ScoreWeights): { score: number; reason: string } {
  const items: string[] = [];
  const problemPoints = facts.problem === "no_water" || facts.problem === "broken" ? weights.problemSevere : weights.problemOther;
  items.push(`problem ${facts.problem} +${problemPoints}`);
  let total = problemPoints;
  if (facts.servesSchoolOrClinic === true) { items.push(`school_or_clinic +${weights.school}`); total += weights.school; }
  if (typeof facts.peopleAffected === "number") {
    const points = facts.peopleAffected >= 100 ? weights.people100 : facts.peopleAffected >= 20 ? weights.people20 : 0;
    if (points) { items.push(`people ${facts.peopleAffected >= 100 ? "100_or_more" : "20_to_99"} +${points}`); total += points; }
  }
  if (facts.duration === "week_or_more" || facts.duration === "few_days") { const points = facts.duration === "week_or_more" ? weights.weekOrMore : weights.fewDays; items.push(`duration ${facts.duration} +${points}`); total += points; }
  const extras = Math.min(Math.max(reportCount - 1, 0), weights.extraReportCap);
  if (extras) { const points = extras * weights.extraReport; items.push(`extra_reports ${extras} +${points}`); total += points; }
  return { score: total, reason: `${items.join("; ")}; total ${total}` };
}

async function markProcessingError(reportId: string): Promise<void> {
  try {
    await getDb().update(reports).set({ needsReview: true, needsReviewReason: "processing_error", complaintId: null, waterPointId: null, updatedAt: new Date() }).where(eq(reports.id, reportId));
  } catch {
    // The original failure is already represented by the fixed log code.
  }
}
