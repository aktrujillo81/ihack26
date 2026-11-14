import "server-only";

import { and, asc, desc, eq, inArray, isNotNull, isNull, notInArray, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { DEMO_DATA_MARKER_KEY } from "@/lib/config/demo";
import { DATA_LIST_HARD_LIMIT } from "@/lib/config/ui";
import { getDb } from "@/lib/db";
import { complaints, configuration, historyEvents, notes, partners, reports, technicianTickets, users, waterPoints } from "@/lib/db/schema";
import type {
  Complaint,
  HistoryEvent,
  LastReportReceived,
  NeedsReviewReason,
  Note,
  Partner,
  Report,
  TechnicianTicket,
  WaterPoint,
  WaterPointType,
} from "@/lib/domain/types";

import { deriveComplaintFacts, isUuid, toCoordinate, topReviewReason, type ReportFacts } from "./derive";

/**
 * The data layer for the web app: every screen reads data through this file.
 * It reads D1's tables (lib/db/schema.ts) with Drizzle.
 *
 * REAL now: complaints, water points, reports, notes, history events and
 * partners, all read from the database.
 *
 * What D1 does not store, so what is derived or unknown here (PROVISIONAL until
 * S6, docs/reviews/D1.md):
 * - A complaint's problem, people affected, school or clinic, and duration are
 *   derived from its reports (the most severe values; lib/data/derive.ts).
 * - There is no review reason and no list of candidate water points: both are
 *   null / empty.
 * - A history event's description is built by the screen from `event_type`,
 *   `before_data` and `after_data`.
 * - A water point has no name; only its type and the spoken location text.
 * - A complaint's version (for D6's overwrite check) is its `updated_at` as
 *   text, to the microsecond.
 *
 * Rules kept here (red line 8; the data layer is the last line of defence, the
 * guards are the first):
 * - Every read takes a `DataContext` built from the validated session.
 *   EVERY query filters by that organization and those regions, on every table
 *   it touches, including joined ones. A context that is missing, empty or has
 *   a non-uuid id returns nothing, never everything.
 * - Another organization's record and a missing record look identical
 *   (`not_found_or_denied`), so existence is not revealed.
 * - Lists select named columns, never `transcript` or `summary`.
 * - No caller details are returned. Partner `contact` is dropped from views.
 */

/** Who is asking. Supplied by the server session, never by the browser. */
export interface DataContext {
  organizationId: string;
  regionIds: string[];
}

export type DataErrorKind =
  /** Missing, or in another organization or region. Deliberately indistinguishable. */
  | "not_found_or_denied"
  /** The whole action is refused, e.g. a Viewer trying to edit. */
  | "denied"
  | "failed";

/** What a screen gets back once loading has finished. Matches docs/ux-screen-notes.md. */
export type DataResult<T> =
  | { status: "ok"; data: T }
  | { status: "empty" }
  | { status: "error"; error: DataErrorKind };

/** What a screen renders. `loading` is the state before the promise settles. */
export type Loadable<T> = { status: "loading" } | DataResult<T>;

export const LOADING: Loadable<never> = { status: "loading" };

/** Partner without its contact field: no contact details reach the web app. */
export type PartnerView = Omit<Partner, "contact">;

export interface ComplaintListItem {
  complaint: Complaint;
  waterPoint: WaterPoint | null;
}

export interface ComplaintDetail {
  complaint: Complaint;
  waterPoint: WaterPoint | null;
  /** Newest first. Transcripts are included: signed-in users in the region only. */
  reports: Report[];
  notes: Note[];
  /** Oldest first. */
  history: HistoryEvent[];
  passedOnTo: PartnerView | null;
  partners?: PartnerView[];
  technicianTickets: TechnicianTicket[];
}

/** A report as shown in a list: no transcript and no summary (both are caller-derived text and appear only on the detail page). */
export type ReportListView = Omit<Report, "transcript" | "summary">;

export interface NeedsReviewItem {
  report: ReportListView;
  /** D1 stores no candidate list, so this is empty until S6/D4 add one. */
  candidates: WaterPoint[];
}

export interface WaterPointOptions {
  /** Merged and archived points are hidden by default. */
  includeInactive?: boolean;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** A context we will query with: a uuid organization and at least one uuid region. Anything else returns nothing. */
function usable(ctx: unknown): ctx is DataContext {
  if (typeof ctx !== "object" || ctx === null) return false;
  const c = ctx as Record<string, unknown>;
  return isUuid(c.organizationId) && Array.isArray(c.regionIds) && c.regionIds.length > 0 && c.regionIds.every(isUuid);
}

type Scoped = { organizationId: AnyPgColumn; regionId: AnyPgColumn };

/** The scope filter. Applied to every table a query reads, including joined tables. */
const scope = (table: Scoped, ctx: DataContext): SQL =>
  and(eq(table.organizationId, ctx.organizationId), inArray(table.regionId, ctx.regionIds)) as SQL;

/** For the write functions in ./complaint-writes.ts: the same scope filter and context check the reads use. */
export { scope as scopeFilter, usable as isUsableContext };

const empty = { status: "empty" } as const;

function result<T>(items: T[]): DataResult<T[]> {
  return items.length === 0 ? empty : { status: "ok", data: items };
}

/** Runs a read. Any failure becomes a generic error: a fixed code is logged, never the query, values or connection string. */
async function guarded<T>(read: () => Promise<DataResult<T>>): Promise<DataResult<T>> {
  try {
    return await read();
  } catch {
    console.error("[data] read_failed");
    return { status: "error", error: "failed" };
  }
}

/** A row's version: `updated_at` as UTC text to the microsecond (the driver and JS dates only keep milliseconds). */
export const versionOf = (column: AnyPgColumn): SQL<string> =>
  sql<string>`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

const iso = (d: Date): string => d.toISOString();

type WaterPointRow = typeof waterPoints.$inferSelect;
type ComplaintRow = typeof complaints.$inferSelect;
type ReportRow = typeof reports.$inferSelect;

function toWaterPoint(row: WaterPointRow): WaterPoint {
  return {
    id: row.id,
    organizationId: row.organizationId,
    regionId: row.regionId,
    type: row.waterPointType,
    locationText: row.locationText,
    latitude: toCoordinate(row.latitude),
    longitude: toCoordinate(row.longitude),
    locationSource: row.locationSource,
    verificationState: row.verificationState,
    mergedIntoId: row.mergedIntoId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function toComplaint(row: ComplaintRow, version: string, reportFacts: ReportFacts[], reportReasons: readonly (NeedsReviewReason | null)[] = []): Complaint {
  const facts = deriveComplaintFacts(reportFacts);
  return {
    id: row.id,
    organizationId: row.organizationId,
    regionId: row.regionId,
    waterPointId: row.waterPointId,
    status: row.status,
    ...facts,
    reportCount: row.reportCount,
    priorityScore: row.priorityScore,
    scoreReason: row.priorityReason,
    needsReview: row.needsReview,
    // The complaint stores no reason: it is the highest-priority reason among its reports (null if none is stored).
    needsReviewReason: row.needsReview ? topReviewReason(reportReasons) : null,
    passedOnPartnerId: row.passedOnPartnerId,
    passedOnNote: row.passedOnNote,
    assignedPartnerId: row.assignedPartnerId,
    assignedAt: row.assignedAt ? iso(row.assignedAt) : null,
    version,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

/** The columns a list needs from a report. Never `transcript` or `summary` (caller-derived free text; the detail page only). */
const reportFactColumns = {
  complaintId: reports.complaintId,
  problem: reports.problem,
  peopleAffected: reports.peopleAffected,
  servesSchoolOrClinic: reports.servesSchoolOrClinic,
  duration: reports.duration,
  needsReviewReason: reports.needsReviewReason,
};

/** A report for a list: every column except `transcript`. */
const reportListColumns = {
  id: reports.id,
  organizationId: reports.organizationId,
  regionId: reports.regionId,
  complaintId: reports.complaintId,
  waterPointId: reports.waterPointId,
  channel: reports.channel,
  locationText: reports.locationText,
  waterPointType: reports.waterPointType,
  problem: reports.problem,
  peopleAffected: reports.peopleAffected,
  servesSchoolOrClinic: reports.servesSchoolOrClinic,
  duration: reports.duration,
  callerConfirmed: reports.callerConfirmed,
  languageSpoken: reports.languageSpoken,
  needsReview: reports.needsReview,
  needsReviewReason: reports.needsReviewReason,
  receivedAt: reports.receivedAt,
};

type ReportListRow = Pick<ReportRow, keyof typeof reportListColumns & keyof ReportRow>;

function toReportListView(row: ReportListRow): ReportListView {
  return {
    id: row.id,
    organizationId: row.organizationId,
    regionId: row.regionId,
    channel: row.channel,
    waterPointId: row.waterPointId,
    complaintId: row.complaintId,
    locationText: row.locationText,
    waterPointType: row.waterPointType,
    problem: row.problem,
    peopleAffected: row.peopleAffected ?? "unknown",
    servesSchoolOrClinic: row.servesSchoolOrClinic ?? "unknown",
    duration: row.duration,
    callerConfirmed: row.callerConfirmed ?? false,
    languageSpoken: row.languageSpoken ?? "unknown",
    needsReview: row.needsReview,
    needsReviewReason: row.needsReviewReason,
    candidateWaterPointIds: [],
    receivedAt: iso(row.receivedAt),
  };
}

const toFacts = (r: { problem: ReportFacts["problem"]; peopleAffected: number | null; servesSchoolOrClinic: boolean | null; duration: ReportFacts["duration"] }): ReportFacts => ({
  problem: r.problem,
  peopleAffected: r.peopleAffected,
  servesSchoolOrClinic: r.servesSchoolOrClinic,
  duration: r.duration,
});

// ---------------------------------------------------------------------------
// Reads for signed-in users
// ---------------------------------------------------------------------------

/** Complaints in the user's regions, most urgent first. Lists carry no transcripts. */
export function listComplaints(ctx: DataContext): Promise<DataResult<ComplaintListItem[]>> {
  return guarded(async () => {
    if (!usable(ctx)) return empty;
    const db = getDb();
    const rows = await db
      .select({ complaint: complaints, version: versionOf(complaints.updatedAt) })
      .from(complaints)
      .where(scope(complaints, ctx))
      .orderBy(desc(complaints.priorityScore), desc(complaints.updatedAt))
      .limit(DATA_LIST_HARD_LIMIT);
    if (rows.length === 0) return empty;

    const complaintIds = rows.map((r) => r.complaint.id);
    const waterPointIds = [...new Set(rows.map((r) => r.complaint.waterPointId))];
    const [points, facts] = await Promise.all([
      db.select().from(waterPoints).where(and(scope(waterPoints, ctx), inArray(waterPoints.id, waterPointIds))),
      db.select(reportFactColumns).from(reports).where(and(scope(reports, ctx), inArray(reports.complaintId, complaintIds))),
    ]);
    const pointById = new Map(points.map((p) => [p.id, p]));
    const factsByComplaint = new Map<string, ReportFacts[]>();
    const reasonsByComplaint = new Map<string, (NeedsReviewReason | null)[]>();
    for (const f of facts) {
      if (f.complaintId === null) continue;
      factsByComplaint.set(f.complaintId, [...(factsByComplaint.get(f.complaintId) ?? []), toFacts(f)]);
      reasonsByComplaint.set(f.complaintId, [...(reasonsByComplaint.get(f.complaintId) ?? []), f.needsReviewReason]);
    }
    return result(
      rows.map(({ complaint, version }) => {
        const point = pointById.get(complaint.waterPointId);
        return {
          complaint: toComplaint(complaint, version, factsByComplaint.get(complaint.id) ?? [], reasonsByComplaint.get(complaint.id) ?? []),
          waterPoint: point ? toWaterPoint(point) : null,
        };
      }),
    );
  });
}

/** One complaint with everything the detail page shows. An unknown id and another organization's id answer identically. */
export function getComplaint(ctx: DataContext, id: string): Promise<DataResult<ComplaintDetail>> {
  return guarded(async () => {
    const notFound = { status: "error", error: "not_found_or_denied" } as const;
    if (!usable(ctx) || !isUuid(id)) return notFound;
    const db = getDb();
    const [row] = await db
      .select({ complaint: complaints, version: versionOf(complaints.updatedAt) })
      .from(complaints)
      .where(and(eq(complaints.id, id), scope(complaints, ctx)))
      .limit(1);
    if (!row) return notFound;
    const { complaint, version } = row;

    const [pointRows, reportRows, noteRows, eventRows, partnerRows, directoryRows, ticketRows] = await Promise.all([
      db.select().from(waterPoints).where(and(eq(waterPoints.id, complaint.waterPointId), scope(waterPoints, ctx))).limit(1),
      db.select().from(reports).where(and(eq(reports.complaintId, id), scope(reports, ctx))).orderBy(desc(reports.receivedAt)),
      db
        .select({ note: notes, author: users.displayName })
        .from(notes)
        // The author's name is staff data. Join only within this organization so a crafted row cannot show another organization's staff.
        .leftJoin(users, and(eq(users.id, notes.authorUserId), eq(users.organizationId, ctx.organizationId)))
        .where(and(eq(notes.complaintId, id), scope(notes, ctx), isNull(notes.archivedAt)))
        .orderBy(asc(notes.createdAt)),
      db
        .select({ event: historyEvents, actor: users.displayName })
        .from(historyEvents)
        .leftJoin(users, and(eq(users.id, historyEvents.actorUserId), eq(users.organizationId, ctx.organizationId)))
        .where(and(eq(historyEvents.complaintId, id), scope(historyEvents, ctx)))
        .orderBy(asc(historyEvents.createdAt)),
      complaint.passedOnPartnerId
        ? db
            .select({ id: partners.id, organizationId: partners.organizationId, regionId: partners.regionId, name: partners.name, type: partners.type })
            .from(partners)
            .where(and(eq(partners.id, complaint.passedOnPartnerId), scope(partners, ctx)))
            .limit(1)
        : Promise.resolve([]),
      db.select({ id: partners.id, organizationId: partners.organizationId, regionId: partners.regionId, name: partners.name, type: partners.type }).from(partners).where(scope(partners, ctx)).orderBy(asc(partners.name)),
      db.select().from(technicianTickets).where(and(eq(technicianTickets.complaintId, id), scope(technicianTickets, ctx))).orderBy(desc(technicianTickets.createdAt)),
    ]);

    // The contact column is not even loaded: only these named columns are selected.
    const toPartnerView = (rest: { id: string; organizationId: string; regionId: string; name: string; type: string }): PartnerView => ({
      id: rest.id,
      organizationId: rest.organizationId,
      regionId: rest.regionId,
      name: rest.name,
      type: rest.type,
    });

    const detail: ComplaintDetail = {
      complaint: toComplaint(complaint, version, reportRows.map(toFacts), reportRows.map((r) => r.needsReviewReason)),
      waterPoint: pointRows[0] ? toWaterPoint(pointRows[0]) : null,
      reports: reportRows.map((r) => ({ ...toReportListView(r), summary: r.summary ?? "", transcript: r.transcript })),
      notes: noteRows.map(({ note, author }) => ({
        id: note.id,
        organizationId: note.organizationId,
        regionId: note.regionId,
        complaintId: note.complaintId,
        author,
        text: note.body,
        createdAt: iso(note.createdAt),
        archivedAt: note.archivedAt ? iso(note.archivedAt) : null,
      })),
      history: eventRows.map(({ event, actor }) => ({
        id: event.id,
        organizationId: event.organizationId,
        regionId: event.regionId,
        complaintId: event.complaintId,
        waterPointId: event.waterPointId,
        type: event.eventType,
        actor,
        before: codesOnly(event.beforeData),
        after: codesOnly(event.afterData),
        note: event.note,
        at: iso(event.createdAt),
      })),
      passedOnTo: partnerRows[0] ? toPartnerView(partnerRows[0]) : null,
      partners: directoryRows.map(toPartnerView),
      technicianTickets: ticketRows.map((ticket): TechnicianTicket => ({
        id: ticket.id,
        organizationId: ticket.organizationId,
        regionId: ticket.regionId,
        complaintId: ticket.complaintId,
        waterPointId: ticket.waterPointId,
        technicianUserId: ticket.technicianUserId,
        status: ticket.status,
        locationText: ticket.locationText,
        latitude: toCoordinate(ticket.latitude) ?? 0,
        longitude: toCoordinate(ticket.longitude) ?? 0,
        issueSummary: ticket.issueSummary,
        notes: ticket.notes,
        createdAt: iso(ticket.createdAt),
        updatedAt: iso(ticket.updatedAt),
      })),
    };
    return { status: "ok", data: detail };
  });
}

/** Keys of history before/after data that are codes or ids. Anything else (such as old free text) is dropped before it reaches the browser. */
const HISTORY_CODE_KEYS = ["status", "reportCount", "mergedIntoId", "noteId", "userId", "role", "active", "assigned"] as const;

export function codesOnly(data: unknown): Record<string, string | number | boolean | null> | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const out: Record<string, string | number | boolean | null> = {};
  for (const key of HISTORY_CODE_KEYS) {
    const value = (data as Record<string, unknown>)[key];
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) out[key] = value as string | number | boolean | null;
  }
  return out;
}

/** Reports the system could not match or complete, oldest first. No transcripts. */
export function listNeedsReview(ctx: DataContext): Promise<DataResult<NeedsReviewItem[]>> {
  return guarded(async () => {
    if (!usable(ctx)) return empty;
    const rows = await getDb()
      .select(reportListColumns)
      .from(reports)
      .where(and(scope(reports, ctx), eq(reports.needsReview, true)))
      .orderBy(asc(reports.receivedAt))
      .limit(DATA_LIST_HARD_LIMIT);
    return result(rows.map((r) => ({ report: toReportListView(r), candidates: [] })));
  });
}

/** Active water points with no coordinates: not pins, listed instead (WP-3). */
export function listNeedsLocation(ctx: DataContext): Promise<DataResult<WaterPoint[]>> {
  return guarded(async () => {
    if (!usable(ctx)) return empty;
    const rows = await getDb()
      .select()
      .from(waterPoints)
      .where(
        and(
          scope(waterPoints, ctx),
          isNull(waterPoints.latitude),
          isNull(waterPoints.longitude),
          notInArray(waterPoints.verificationState, ["merged", "archived"]),
        ),
      )
      .orderBy(asc(waterPoints.createdAt))
      .limit(DATA_LIST_HARD_LIMIT);
    return result(rows.map(toWaterPoint));
  });
}

/** Water points in the user's regions. Merged and archived points are hidden unless `includeInactive`. */
export function listWaterPoints(ctx: DataContext, options: WaterPointOptions = {}): Promise<DataResult<WaterPoint[]>> {
  return guarded(async () => {
    if (!usable(ctx)) return empty;
    const filters = [scope(waterPoints, ctx)];
    if (!options.includeInactive) filters.push(notInArray(waterPoints.verificationState, ["merged", "archived"]));
    const rows = await getDb().select().from(waterPoints).where(and(...filters)).orderBy(asc(waterPoints.createdAt)).limit(DATA_LIST_HARD_LIMIT);
    return result(rows.map(toWaterPoint));
  });
}

/** When the last report arrived, from the user's own scope only. `empty` means none has ever arrived. */
export function getLastReportReceived(ctx: DataContext): Promise<DataResult<LastReportReceived>> {
  return guarded(async () => {
    if (!usable(ctx)) return empty;
    const [row] = await getDb()
      .select({ latest: sql<Date | null>`max(${reports.receivedAt})` })
      .from(reports)
      .where(scope(reports, ctx));
    const latest = row?.latest ? new Date(row.latest) : null;
    return latest ? { status: "ok", data: { receivedAt: iso(latest) } } : empty;
  });
}

// ---------------------------------------------------------------------------
// The public read (status only)
// ---------------------------------------------------------------------------

/**
 * Which data may be published without signing in. NOT a user: it is a
 * configuration choice (lib/config/public-map.ts), and when it is not set the
 * public read returns nothing. PROVISIONAL: which organization and regions are
 * public is an unknown decision (the public map is cut from the spec).
 */
export interface PublicScope {
  organizationId: string;
  regionIds: readonly string[];
}

/** The only statuses the public sees. Derived from complaints; no complaint is exposed. */
export type PublicStatus = "open" | "passed_on" | "fixed" | "none";

/**
 * The ENTIRE public shape of a water point, by allowlist. It is built field by
 * field in `toPublicPin`, never by spreading a record, so a field added to a
 * table cannot reach the public by accident.
 *
 * Deliberately absent: ids, spoken location text, report or reporter counts,
 * problem, people affected, school or clinic, duration, score, notes,
 * transcripts, dates, organization, region, review flags, partner.
 * A water point has no name field in the data (only spoken location text, which
 * is not public), so the public label is its type.
 */
export interface PublicPin {
  /** A position in this response only. Not an internal id, and not stable between loads. */
  key: string;
  latitude: number;
  longitude: number;
  type: WaterPointType;
  status: PublicStatus;
  unverified: boolean;
}

/** The exact keys of `PublicPin`. A test fails if a pin has any other key. */
export const PUBLIC_PIN_KEYS = ["key", "latitude", "longitude", "type", "status", "unverified"] as const;

function publicStatusOf(statuses: readonly string[]): PublicStatus {
  if (statuses.includes("open")) return "open";
  if (statuses.includes("passed_on")) return "passed_on";
  if (statuses.includes("fixed")) return "fixed";
  return "none";
}

function toPublicPin(index: number, point: { latitude: number; longitude: number; type: WaterPointType; unverified: boolean }, statuses: readonly string[]): PublicPin {
  return {
    key: `pin-${index + 1}`,
    latitude: point.latitude,
    longitude: point.longitude,
    type: point.type,
    status: publicStatusOf(statuses),
    unverified: point.unverified,
  };
}

/**
 * The public read. Selects ONLY the columns a pin needs (never the spoken
 * location text) for active water points with coordinates in the public scope,
 * and only the status of their complaints. Reads no session. A missing, empty
 * or malformed scope returns `empty` (fail closed), never everything.
 */
export function listPublicWaterPoints(
  scope_: PublicScope | null,
  options: { includeUnverified?: boolean } = {},
): Promise<DataResult<PublicPin[]>> {
  return guarded(async () => {
    if (!scope_ || !isUuid(scope_.organizationId) || !Array.isArray(scope_.regionIds) || scope_.regionIds.length === 0 || !scope_.regionIds.every(isUuid)) {
      return empty;
    }
    const ctx: DataContext = { organizationId: scope_.organizationId, regionIds: [...scope_.regionIds] };
    const db = getDb();
    const filters = [
      scope(waterPoints, ctx),
      isNotNull(waterPoints.latitude),
      isNotNull(waterPoints.longitude),
      notInArray(waterPoints.verificationState, ["merged", "archived"]),
    ];
    // Unverified points come straight from a caller's words (a home could be reported as a water point).
    // They are not published unless explicitly turned on.
    if (options.includeUnverified !== true) filters.push(eq(waterPoints.verificationState, "verified"));

    const points = await db
      .select({
        id: waterPoints.id,
        latitude: waterPoints.latitude,
        longitude: waterPoints.longitude,
        type: waterPoints.waterPointType,
        verificationState: waterPoints.verificationState,
      })
      .from(waterPoints)
      .where(and(...filters))
      .limit(DATA_LIST_HARD_LIMIT);
    if (points.length === 0) return empty;

    const statuses = await db
      .select({ waterPointId: complaints.waterPointId, status: complaints.status })
      .from(complaints)
      .where(and(scope(complaints, ctx), inArray(complaints.waterPointId, points.map((p) => p.id))));
    const statusesByPoint = new Map<string, string[]>();
    for (const s of statuses) statusesByPoint.set(s.waterPointId, [...(statusesByPoint.get(s.waterPointId) ?? []), s.status]);

    const placed = points
      .map((p) => ({ id: p.id, latitude: toCoordinate(p.latitude), longitude: toCoordinate(p.longitude), type: p.type, unverified: p.verificationState === "unverified" }))
      .filter((p): p is typeof p & { latitude: number; longitude: number } => p.latitude !== null && p.longitude !== null)
      // Ordered by public values only (position, then type). Ordering by id would leak the order records were created in.
      .sort((a, b) => a.latitude - b.latitude || a.longitude - b.longitude || a.type.localeCompare(b.type));
    return result(placed.map((p, i) => toPublicPin(i, p, statusesByPoint.get(p.id) ?? [])));
  });
}

/**
 * Compile-time guard: no returned shape may contain a phone, email or contact
 * field, at any depth. If a field like that is added to a type returned above,
 * typecheck fails here.
 */
type DeepKeys<T> = T extends readonly (infer U)[]
  ? DeepKeys<U>
  : T extends object
    ? { [K in keyof T & string]: K | DeepKeys<T[K]> }[keyof T & string]
    : never;
type ForbiddenKey = `${string}phone${string}` | `${string}email${string}` | `${string}contact${string}`;
type NoForbiddenKeys<T> = Extract<Lowercase<DeepKeys<T>>, ForbiddenKey> extends never ? true : never;
export const NO_CALLER_CONTACT_FIELDS: [
  NoForbiddenKeys<ComplaintListItem>,
  NoForbiddenKeys<ComplaintDetail>,
  NoForbiddenKeys<NeedsReviewItem>,
  NoForbiddenKeys<WaterPoint>,
  NoForbiddenKeys<LastReportReceived>,
  NoForbiddenKeys<PublicPin>,
] = [true, true, true, true, true, true];

// ---------------------------------------------------------------------------
// Sample data indicator
// ---------------------------------------------------------------------------

/**
 * Is the data this user sees invented demo data? True while the row that
 * `npm run db:seed:demo` writes (key `demo_seed` in `configuration`) exists in
 * the user's own organization and regions. Read-only, scoped like every other
 * read, and it returns nothing but a yes or no. Any problem answers `false`: a
 * missing tag is better than a broken page. PROVISIONAL: when real calls start
 * to arrive (D3), the team must decide whether demo rows stay beside real ones.
 */
export async function isSampleData(ctx: DataContext): Promise<boolean> {
  if (!usable(ctx)) return false;
  try {
    const [row] = await getDb()
      .select({ id: configuration.id })
      .from(configuration)
      .where(and(scope(configuration, ctx), eq(configuration.key, DEMO_DATA_MARKER_KEY)))
      .limit(1);
    return !!row;
  } catch {
    console.error("[data] read_failed");
    return false;
  }
}
