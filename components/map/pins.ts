/**
 * Pure pin model for the map. Turns water points and complaints into pins.
 * No React, no map library, no session. Colors follow spec section 7, and
 * every pin also has a shape and a text label (red line 11).
 */
import type { Complaint, Problem, WaterPoint } from "@/lib/domain/types";
import type { PlainKey } from "@/lib/i18n/strings";

export type PinShape = "circle" | "diamond" | "check" | "square";
export type PinColor = "red" | "yellow" | "green";

/**
 * "authenticated": signed-in users in the region; includes the complaint id
 * and spoken location text. "public": status and report count only (MP-6).
 * A public map is cut from this build (spec section 4); no public route uses it.
 */
export type MapViewKind = "authenticated" | "public";

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  shape: PinShape;
  color: PinColor;
  /** Text label key: always shown, never hover-only. */
  statusKey: PlainKey;
  /** What is wrong, as text, so red and yellow never differ by color alone. Null with no active complaint, and in the public view. */
  problem: Problem | null;
  unverified: boolean;
  needsReview: boolean;
  reportCount: number;
  /** Null in the public view. */
  complaintId: string | null;
  /** Null in the public view. */
  locationText: string | null;
}

const RED_PROBLEMS = new Set(["no_water", "broken"]);

/**
 * The complaint that decides a water point's pin. Active (open or passed on)
 * complaints come first. Among them a red-problem complaint wins over a yellow
 * one, so a pin is never calmer than its worst active problem (DECISION: the
 * spec does not say which wins; confirm). Then the higher priority score.
 * With no active complaint, the most recent fixed one.
 */
function pickComplaint(complaints: Complaint[]): Complaint | null {
  const severity = (c: Complaint) => (RED_PROBLEMS.has(c.problem) ? 1 : 0);
  const active = complaints
    .filter((c) => c.status === "open" || c.status === "passed_on")
    .sort((a, b) => severity(b) - severity(a) || b.priorityScore - a.priorityScore || b.updatedAt.localeCompare(a.updatedAt));
  if (active[0]) return active[0];
  const fixed = complaints.filter((c) => c.status === "fixed").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return fixed[0] ?? null;
}

export function buildPins(waterPoints: WaterPoint[], complaints: Complaint[], view: MapViewKind): MapPin[] {
  const pins: MapPin[] = [];
  for (const wp of waterPoints) {
    // No coordinates: not a pin (WP-3). It is counted and listed elsewhere.
    if (wp.latitude === null || wp.longitude === null) continue;
    const complaint = pickComplaint(complaints.filter((c) => c.waterPointId === wp.id));

    let shape: PinShape = "square";
    let color: PinColor = "green";
    let statusKey: PlainKey = "map.noOpenComplaint";
    if (complaint?.status === "open" || complaint?.status === "passed_on") {
      color = RED_PROBLEMS.has(complaint.problem) ? "red" : "yellow"; // `unknown` is yellow, never severe
      shape = complaint.status === "open" ? "circle" : "diamond";
      statusKey = complaint.status === "open" ? "status.open" : "status.passed_on";
    } else if (complaint?.status === "fixed") {
      shape = "check";
      statusKey = "status.fixed";
    }

    pins.push({
      id: wp.id,
      lat: wp.latitude,
      lng: wp.longitude,
      shape,
      color,
      statusKey,
      problem:
        view === "authenticated" && (complaint?.status === "open" || complaint?.status === "passed_on")
          ? complaint.problem
          : null,
      unverified: wp.verificationState === "unverified",
      // Internal triage: not shown in the public view.
      needsReview: view === "authenticated" ? (complaint?.needsReview ?? false) : false,
      reportCount: complaint?.reportCount ?? 0,
      complaintId: view === "authenticated" ? (complaint?.id ?? null) : null,
      locationText: view === "authenticated" ? wp.locationText : null,
    });
  }
  return pins;
}
