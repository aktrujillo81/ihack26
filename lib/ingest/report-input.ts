/**
 * The validated report that D3a hands to D3b's save function (docs/tasks/D3b.md,
 * "Input"). A closed type: no free-form object, no transcript, no raw call ID,
 * no caller name or number.
 *
 * PROVISIONAL: the final type name and file are unknown. D3a freezes them first
 * (docs/tasks/D3b.md). Rename here only when D3a does.
 * Allowed values: docs/contracts.md section 3 and 5.1.
 */
import type { Duration, Problem, WaterPointType } from "@/lib/domain/types";

/** `endedReason` values D3a may pass (contracts 4.1 item 3). */
export const ENDED_REASONS = ["customer-ended-call", "assistant-said-end-call-phrase", "other"] as const;
export type EndedReason = (typeof ENDED_REASONS)[number];

/**
 * Reasons D3a sets before the save (docs/tasks/D3b.md, "Input"). D3b/D4 add
 * `ambiguous_match` and `processing_error` themselves; they are never input.
 */
export const INTAKE_REVIEW_REASONS = [
  "malformed_payload",
  "no_structured_data",
  "unusable_location",
  "invalid_fields",
  "not_confirmed",
] as const;
export type IntakeReviewReason = (typeof INTAKE_REVIEW_REASONS)[number];

export interface ValidatedReport {
  /** uuid. Read by D3a from the `intake.phone` configuration row. Never from the payload. */
  organizationId: string;
  /** uuid. Same source as `organizationId`. */
  regionId: string;
  /** HMAC of `message.call.id`, computed by D3a; null means no duplicate check. D3b never sees the raw ID. */
  providerCallRef: string | null;
  channel: "phone";

  /** Scrubbed and capped; the text `unknown` if unusable. */
  locationText: string;
  waterPointType: WaterPointType;
  problem: Problem;
  /** Integer, or null when unknown. */
  peopleAffected: number | null;
  servesSchoolOrClinic: boolean | null;
  duration: Duration;
  /** null when missing or not a boolean (never false by default). */
  callerConfirmed: boolean | null;
  /** Scrubbed and capped. */
  summary: string;
  /** Scrubbed and capped, or null. */
  languageSpoken: string | null;
  /** Always null in P0 (human decision, contracts 5.1). */
  transcript: null;
  endedReason: EndedReason | null;

  needsReview: boolean;
  /** Not null whenever `needsReview` is true (contracts 4.1 item 2, 5.2). */
  needsReviewReason: IntakeReviewReason | null;
}
