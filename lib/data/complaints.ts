/**
 * PROVISIONAL thin data layer for the web app (W2 to W5).
 *
 * Every screen reads data through this file and nowhere else. It is the ONLY
 * file allowed to import `lib/domain/mock`.
 *
 * SWAP POINT: when the real complaint API (task D6) and docs/contracts.md
 * exist, replace the bodies of the functions below with calls to that API.
 * Keep the signatures and result shapes, and no screen needs to change. Delete
 * the mock import and `MOCK_CONTEXT` at the same time.
 *
 * Rules kept here (they are enforced for real by the server):
 * - Every read takes a `DataContext`. Records outside the user's organization
 *   or regions are never returned (red line 8). Filtering here only mimics the
 *   server so screens are built against the right behavior.
 * - Another organization's record and a missing record look identical
 *   (`not_found_or_denied`), so existence is not revealed.
 * - No caller details are returned. Partner `contact` is dropped from views.
 */
import type { Complaint, HistoryEvent, LastReportReceived, Note, Partner, Report, WaterPoint, WaterPointType } from "../domain/types";
import {
  mockComplaints,
  mockHistoryEvents,
  mockNotes,
  mockPartners,
  mockReports,
  mockWaterPoints,
} from "../domain/mock";

/** Who is asking. Supplied by the server session, never by the browser. */
export interface DataContext {
  organizationId: string;
  regionIds: string[];
}

/** PROVISIONAL: matches the mock data's single organization and region. Remove with the mock. */
export const MOCK_CONTEXT: DataContext = { organizationId: "org-demo", regionIds: ["region-demo"] };

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
}

/** A report as shown in a list: no transcript (transcripts appear only on the detail page). */
export type ReportListView = Omit<Report, "transcript">;

export interface NeedsReviewItem {
  report: ReportListView;
  /** Several possible matches are listed, never resolved to one. */
  candidates: WaterPoint[];
}

export interface WaterPointOptions {
  /** Merged and archived points are hidden by default. */
  includeInactive?: boolean;
}

function inScope(ctx: DataContext, record: { organizationId: string; regionId: string }): boolean {
  return record.organizationId === ctx.organizationId && ctx.regionIds.includes(record.regionId);
}

function result<T>(items: T[]): DataResult<T[]> {
  return items.length === 0 ? { status: "empty" } : { status: "ok", data: items };
}

async function guarded<T>(read: () => DataResult<T>): Promise<DataResult<T>> {
  try {
    return read();
  } catch {
    return { status: "error", error: "failed" };
  }
}

const byId = <T extends { id: string }>(items: T[], id: string | null): T | null =>
  id === null ? null : (items.find((item) => item.id === id) ?? null);

function toPartnerView({ contact: _contact, ...rest }: Partner): PartnerView {
  return rest;
}

function toReportListView({ transcript: _transcript, ...rest }: Report): ReportListView {
  return rest;
}

/** A related record is returned only if it is in the user's scope; otherwise it is treated as absent. */
function scopedById<T extends { id: string; organizationId: string; regionId: string }>(
  ctx: DataContext,
  items: T[],
  id: string | null,
): T | null {
  const found = byId(items, id);
  return found && inScope(ctx, found) ? found : null;
}

/** Complaints in the user's regions, most urgent first. */
export function listComplaints(ctx: DataContext): Promise<DataResult<ComplaintListItem[]>> {
  return guarded(() =>
    result(
      mockComplaints
        .filter((c) => inScope(ctx, c))
        .sort((a, b) => b.priorityScore - a.priorityScore || b.updatedAt.localeCompare(a.updatedAt))
        .map((complaint) => ({ complaint, waterPoint: scopedById(ctx, mockWaterPoints, complaint.waterPointId) })),
    ),
  );
}

/** One complaint with everything the detail page shows. */
export function getComplaint(ctx: DataContext, id: string): Promise<DataResult<ComplaintDetail>> {
  return guarded(() => {
    const complaint = byId(mockComplaints, id);
    if (!complaint || !inScope(ctx, complaint)) return { status: "error", error: "not_found_or_denied" };
    return {
      status: "ok",
      data: {
        complaint,
        waterPoint: scopedById(ctx, mockWaterPoints, complaint.waterPointId),
        reports: mockReports.filter((r) => r.complaintId === id && inScope(ctx, r)).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
        notes: mockNotes.filter((n) => n.complaintId === id && inScope(ctx, n)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        history: mockHistoryEvents.filter((h) => h.complaintId === id && inScope(ctx, h)).sort((a, b) => a.at.localeCompare(b.at)),
        passedOnTo: (() => {
          const partner = scopedById(ctx, mockPartners, complaint.passedOnPartnerId);
          return partner ? toPartnerView(partner) : null;
        })(),
      },
    };
  });
}

/** Reports the system could not match or complete, oldest first. */
export function listNeedsReview(ctx: DataContext): Promise<DataResult<NeedsReviewItem[]>> {
  return guarded(() =>
    result(
      mockReports
        .filter((r) => r.needsReview && inScope(ctx, r))
        .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
        .map((report) => ({
          report: toReportListView(report),
          candidates: report.candidateWaterPointIds
            .map((id) => scopedById(ctx, mockWaterPoints, id))
            .filter((wp): wp is WaterPoint => wp !== null),
        })),
    ),
  );
}

/** Active water points with no coordinates: not pins, listed instead (WP-3). */
export function listNeedsLocation(ctx: DataContext): Promise<DataResult<WaterPoint[]>> {
  return guarded(() =>
    result(
      mockWaterPoints.filter(
        (wp) =>
          inScope(ctx, wp) &&
          wp.latitude === null &&
          wp.longitude === null &&
          wp.verificationState !== "merged" &&
          wp.verificationState !== "archived",
      ),
    ),
  );
}

/** Water points in the user's regions. Merged and archived points are hidden unless `includeInactive`. */
export function listWaterPoints(ctx: DataContext, options: WaterPointOptions = {}): Promise<DataResult<WaterPoint[]>> {
  return guarded(() =>
    result(
      mockWaterPoints.filter(
        (wp) =>
          inScope(ctx, wp) &&
          (options.includeInactive || (wp.verificationState !== "merged" && wp.verificationState !== "archived")),
      ),
    ),
  );
}

/**
 * When the last report arrived, from the user's own scope only. `empty` means
 * none has ever arrived. Assumes every timestamp is an ISO string in UTC ("Z"),
 * so string order is time order; the real API must guarantee that.
 */
export function getLastReportReceived(ctx: DataContext): Promise<DataResult<LastReportReceived>> {
  return guarded<LastReportReceived>(() => {
    const latest = mockReports
      .filter((r) => inScope(ctx, r))
      .map((r) => r.receivedAt)
      .sort()
      .at(-1);
    return latest ? { status: "ok", data: { receivedAt: latest } } : { status: "empty" };
  });
}

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
 * field in `toPublicPin`, never by spreading a record, so a field added to
 * `WaterPoint` or `Complaint` cannot reach the public by accident.
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

function publicStatusOf(complaints: Complaint[]): PublicStatus {
  if (complaints.some((c) => c.status === "open")) return "open";
  if (complaints.some((c) => c.status === "passed_on")) return "passed_on";
  if (complaints.some((c) => c.status === "fixed")) return "fixed";
  return "none";
}

function toPublicPin(index: number, wp: WaterPoint & { latitude: number; longitude: number }, complaints: Complaint[]): PublicPin {
  return {
    key: `pin-${index + 1}`,
    latitude: wp.latitude,
    longitude: wp.longitude,
    type: wp.type,
    status: publicStatusOf(complaints),
    unverified: wp.verificationState === "unverified",
  };
}

/**
 * The public read. Returns only `PublicPin`s for active water points with
 * coordinates in the public scope. Reads no session. A missing, empty or
 * malformed scope returns `empty` (fail closed), never everything.
 *
 * SWAP POINT: with the real API this must be its own endpoint that selects
 * only these columns, not a filter applied after reading full rows.
 */
export function listPublicWaterPoints(scope: PublicScope | null): Promise<DataResult<PublicPin[]>> {
  return guarded<PublicPin[]>(() => {
    if (
      !scope ||
      typeof scope.organizationId !== "string" ||
      scope.organizationId.length === 0 ||
      !Array.isArray(scope.regionIds) ||
      scope.regionIds.length === 0
    ) {
      return { status: "empty" };
    }
    const points = mockWaterPoints
      .filter(
        (wp): wp is WaterPoint & { latitude: number; longitude: number } =>
          wp.organizationId === scope.organizationId &&
          scope.regionIds.includes(wp.regionId) &&
          wp.latitude !== null &&
          wp.longitude !== null &&
          wp.verificationState !== "merged" &&
          wp.verificationState !== "archived",
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    return result(
      points.map((wp, i) =>
        toPublicPin(
          i,
          wp,
          mockComplaints.filter((c) => c.waterPointId === wp.id && c.organizationId === wp.organizationId),
        ),
      ),
    );
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
