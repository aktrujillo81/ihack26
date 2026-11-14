/**
 * TEST-ONLY mock-backed copy of the data layer (lib/data/complaints.ts).
 *
 * Tests that exercise screens and actions replace the real module with this one
 * (vi.mock("@/lib/data/complaints", () => import("../fixtures/mock-data-layer"))),
 * so they run without a database. It is NOT production code and must never be
 * imported from app/, components/ or lib/. The real implementation is tested
 * against Postgres in tests/integration.
 *
 * The types come from the real module, so this file can not drift in shape.
 */
import type {
  ComplaintDetail,
  ComplaintListItem,
  DataContext,
  DataResult,
  NeedsReviewItem,
  PartnerView,
  PublicPin,
  PublicScope,
  PublicStatus,
  ReportListView,
  WaterPointOptions,
} from "@/lib/data/complaints";
import type { Complaint, LastReportReceived, Partner, Report, WaterPoint } from "@/lib/domain/types";
import {
  mockComplaints,
  mockHistoryEvents,
  mockNotes,
  mockPartners,
  mockReports,
  mockWaterPoints,
} from "./mock-data";

/** The scope that matches the mock data's single organization and region. Tests only. */
export const MOCK_CONTEXT: DataContext = { organizationId: "org-demo", regionIds: ["region-demo"] };

export const LOADING = { status: "loading" } as const;


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
export function listPublicWaterPoints(
  scope: PublicScope | null,
  options: { includeUnverified?: boolean } = {},
): Promise<DataResult<PublicPin[]>> {
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
          wp.verificationState !== "archived" &&
          // Unverified points come straight from a caller's words (a home could be reported as a water point).
          // They are not published unless explicitly turned on.
          (options.includeUnverified === true || wp.verificationState !== "unverified"),
      )
      // Ordered by public values only (position, then type). Ordering by id would leak the order records were created in.
      .sort((a, b) => a.latitude - b.latitude || a.longitude - b.longitude || a.type.localeCompare(b.type));
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
