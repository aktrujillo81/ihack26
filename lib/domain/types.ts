/**
 * PROVISIONAL. Replace with the types generated from or defined by
 * docs/contracts.md once it exists (task S6).
 *
 * Names and values come from docs/spec.md sections 6, 7 and 8, not from a real
 * Vapi payload or database. Do not add fields the spec does not mention.
 * Nothing here holds caller details (no names, no phone numbers).
 */

/** Spec section 8 allowed values. */
export const WATER_POINT_TYPES = ["well", "hand_pump", "tap", "borehole", "other", "unknown"] as const;
export type WaterPointType = (typeof WATER_POINT_TYPES)[number];

export const PROBLEMS = ["no_water", "broken", "dirty", "slow", "other", "unknown"] as const;
export type Problem = (typeof PROBLEMS)[number];

export const DURATIONS = ["today", "few_days", "week_or_more", "unknown"] as const;
export type Duration = (typeof DURATIONS)[number];

/** `unknown` is valid everywhere and is never treated as severe (spec section 7). */
export type Unknown = "unknown";
export type PeopleAffected = number | Unknown;
export type ServesSchoolOrClinic = boolean | Unknown;

/** Spec section 7: stored complaint status. `needs_review` is a separate flag. */
export const COMPLAINT_STATUSES = ["open", "passed_on", "fixed"] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

/** WP-2 */
export const VERIFICATION_STATES = ["unverified", "verified", "merged", "archived"] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

export const LOCATION_SOURCES = ["landmark_only", "map_pin", "gps", "geocoded"] as const;
export type LocationSource = (typeof LOCATION_SOURCES)[number];

/** Spec section 5: `phone` now, `web` soon. */
export const CHANNELS = ["phone", "web"] as const;
export type Channel = (typeof CHANNELS)[number];

/** Spec section 2. */
export const ROLES = ["org_admin", "responder", "viewer"] as const;
export type Role = (typeof ROLES)[number];

/**
 * UNKNOWN in the spec: the real reason values. These four follow the cases in
 * spec section 7 and 10; `unknown` is used when no reason is available.
 */
export const NEEDS_REVIEW_REASONS = [
  "ambiguous_match",
  "unusable_location",
  "incomplete_report",
  "off_topic",
  "unknown",
] as const;
export type NeedsReviewReason = (typeof NEEDS_REVIEW_REASONS)[number];

/** Spec section 5, rule 1: every record has an organization and region. */
export interface Scoped {
  organizationId: string;
  regionId: string;
}

/** Spec section 15: a well, hand pump, tap, or borehole. */
export interface WaterPoint extends Scoped {
  id: string;
  type: WaterPointType;
  /** The spoken or entered description, e.g. village plus landmark. */
  locationText: string;
  /** Null means "Needs location" (WP-3): no map pin. */
  latitude: number | null;
  longitude: number | null;
  locationSource: LocationSource;
  verificationState: VerificationState;
  /** Spec section 5, rule 7: a merged point keeps its ID pointing at the survivor. */
  mergedIntoId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Spec section 15: one caller's description of a problem. Holds no caller identity. */
export interface Report extends Scoped {
  id: string;
  channel: Channel;
  /** Null when the report could not be matched (needs review). */
  waterPointId: string | null;
  complaintId: string | null;
  locationText: string;
  waterPointType: WaterPointType;
  problem: Problem;
  peopleAffected: PeopleAffected;
  servesSchoolOrClinic: ServesSchoolOrClinic;
  duration: Duration;
  callerConfirmed: boolean;
  /** One plain sentence. */
  summary: string;
  languageSpoken: string;
  /** Visible only to signed-in users in the region. Null if none was captured. */
  transcript: string | null;
  needsReview: boolean;
  needsReviewReason: NeedsReviewReason | null;
  /** Several possible matches: never pick one (spec section 7). */
  candidateWaterPointIds: string[];
  receivedAt: string;
}

/** Spec section 15: a water point's current problem, combining reports. */
export interface Complaint extends Scoped {
  id: string;
  waterPointId: string;
  status: ComplaintStatus;
  problem: Problem;
  peopleAffected: PeopleAffected;
  servesSchoolOrClinic: ServesSchoolOrClinic;
  duration: Duration;
  reportCount: number;
  /** Higher is more urgent. */
  priorityScore: number;
  /** Always stored with the score (PR-6). UNKNOWN: whether the API returns text or parts. */
  scoreReason: string;
  needsReview: boolean;
  needsReviewReason: NeedsReviewReason | null;
  /** Recorded step only; nothing is sent (spec section 11). */
  passedOnPartnerId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Spec section 5, rule 6 and DB-2: every change is an event. */
export const HISTORY_EVENT_TYPES = [
  "created",
  "report_added",
  "status_changed",
  "passed_on",
  "reopened",
  "note_added",
  "edited",
  "pin_moved",
  "verified",
  "merged",
] as const;
export type HistoryEventType = (typeof HISTORY_EVENT_TYPES)[number];

export interface HistoryEvent extends Scoped {
  id: string;
  complaintId: string | null;
  waterPointId: string | null;
  type: HistoryEventType;
  /** Staff label (a signed-in user), or "system". Never a caller. */
  actor: string;
  /** Short plain description, e.g. "Status changed from open to passed_on". */
  detail: string;
  at: string;
}

export interface Note extends Scoped {
  id: string;
  complaintId: string;
  /** Staff label. Never a caller. */
  author: string;
  text: string;
  createdAt: string;
}

/** Spec section 15: an organization that can fix a problem. */
export interface Partner extends Scoped {
  id: string;
  name: string;
  /** UNKNOWN: the real partner types. Free text for now. */
  type: string;
  /** UNKNOWN: contact format. Mock data uses none. */
  contact: string | null;
}

/** Spec PR-8: when the last report arrived. */
export interface LastReportReceived {
  receivedAt: string | null;
}
