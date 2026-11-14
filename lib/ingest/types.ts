/**
 * The validated report: the closed shape the Vapi webhook (D3a) hands to the
 * save function (D3b). Documented in docs/contracts.md section 3.
 *
 * Closed on purpose: no free-form object, no raw body, no raw call id, no
 * caller name or number (red line 3). `transcript` is always null in P0.
 * `receivedAt` is not here: the database default is used.
 */

export const REPORT_CHANNELS = ["phone", "web", "other"] as const;
export type ReportChannel = (typeof REPORT_CHANNELS)[number];

export const WATER_POINT_TYPES = ["well", "hand_pump", "tap", "borehole", "other", "unknown"] as const;
export type WaterPointType = (typeof WATER_POINT_TYPES)[number];

export const PROBLEMS = ["no_water", "broken", "dirty", "slow", "other", "unknown"] as const;
export type Problem = (typeof PROBLEMS)[number];

export const DURATIONS = ["today", "few_days", "week_or_more", "unknown"] as const;
export type Duration = (typeof DURATIONS)[number];

/** Known Vapi end reasons; any other value Vapi sends is stored as `other`. */
export const ENDED_REASONS = ["customer-ended-call", "assistant-said-end-call-phrase", "other"] as const;
export type EndedReason = (typeof ENDED_REASONS)[number];

/**
 * Review reasons in priority order (contracts 5.2). D3a sets `malformed_payload`,
 * `no_structured_data`, `unusable_location`, `invalid_fields` and `not_confirmed`;
 * D3b and D4 set `processing_error` and `ambiguous_match`.
 */
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

export interface ValidatedReport {
  /** From the one `intake.phone` configuration row, never from the request. */
  organizationId: string;
  regionId: string;
  /** Keyed HMAC-SHA-256 (hex) of the Vapi call id, or null. The raw id never appears here. */
  providerCallRef: string | null;
  channel: ReportChannel;
  /** Scrubbed and capped text, or the text `unknown`. */
  locationText: string;
  waterPointType: WaterPointType;
  problem: Problem;
  /** Integer 0 to 9,999,999, or null when unknown. */
  peopleAffected: number | null;
  servesSchoolOrClinic: boolean | null;
  duration: Duration;
  /** True or false as sent; null when missing or not a boolean (never false by default). */
  callerConfirmed: boolean | null;
  /** Scrubbed and capped, or null. */
  summary: string | null;
  /** Scrubbed and capped, or null. */
  languageSpoken: string | null;
  /** Always null in P0 (no transcript is stored). */
  transcript: null;
  /** Null when Vapi sent none; any unknown value is `other`. */
  endedReason: EndedReason | null;
  needsReview: boolean;
  /** Not null whenever `needsReview` is true. */
  needsReviewReason: NeedsReviewReason | null;
}
