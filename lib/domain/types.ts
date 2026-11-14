/**
 * The shapes the web app works with. They follow docs/spec.md sections 6 to 8
 * and D1's tables (lib/db/schema.ts), with the differences listed in
 * lib/data/complaints.ts. Still PROVISIONAL: the `reports` table and the
 * report-to-complaint link wait for S6 (docs/reviews/D1.md), and
 * docs/contracts.md does not name these types yet.
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
export const COMPLAINT_STATUSES = ["open", "accepted", "denied", "in_progress", "passed_on", "fixed", "completed"] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

/** WP-2 */
export const VERIFICATION_STATES = ["unverified", "verified", "merged", "archived"] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

export const LOCATION_SOURCES = ["landmark_only", "map_pin", "gps", "geocoded"] as const;
export type LocationSource = (typeof LOCATION_SOURCES)[number];

/** Spec section 5: `phone` now, `web` soon. D1's `report_channel` enum also has `other`. */
export const CHANNELS = ["phone", "web", "other"] as const;
export type Channel = (typeof CHANNELS)[number];

/** Spec section 2. */
export const ROLES = ["org_admin", "responder", "viewer"] as const;
export type Role = (typeof ROLES)[number];

/** Contracts 5.2, in priority order (the same seven values as the database enum). */
export const NEEDS_REVIEW_REASONS = [
  "malformed_payload",
  "no_structured_data",
  "processing_error",
  "unusable_location",
  "ambiguous_match",
  "invalid_fields",
  "not_confirmed",
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
  /** Free text of who it was passed to (D1: `passed_on_note`), until the partner directory is used. */
  passedOnNote: string | null;
  assignedPartnerId?: string | null;
  assignedAt?: string | null;
  /**
   * An opaque token for the row's current version (D1: `updated_at`, kept to the
   * microsecond). A change must send it back; if the row changed since, the
   * change is refused instead of overwriting (task D6).
   */
  version: string;
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
  "note_edited",
  "note_archived",
  "location_edited",
  "provider_assigned",
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
  /** D1: `event_type` is free text. Known values are in HISTORY_EVENT_TYPES; the screen shows anything else generically. */
  type: string;
  /** The staff member's name (a signed-in user), or null for the system. Never a caller. */
  actor: string | null;
  /** D1: `before_data` and `after_data`. The screen reads only the fields it knows. */
  before: unknown;
  after: unknown;
  note: string | null;
  at: string;
}

export interface Note extends Scoped {
  id: string;
  complaintId: string;
  /** The staff member's name. Never a caller. Null if the author is not in this organization (nothing is shown). */
  author: string | null;
  text: string;
  createdAt: string;
  archivedAt?: string | null;
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
