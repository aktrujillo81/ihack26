/**
 * Turns the Vapi message into a ValidatedReport (rules: docs/contracts.md
 * section 5.1 and 5.2; aliases are listed there and in docs/vapi-prompt.md).
 * Pure: no database, no logging. Allowlist only: nothing outside the paths of
 * contracts section 1 is copied, and the raw call id never leaves the webhook.
 */
import { INTAKE_TEXT_MAX_LENGTH } from "@/lib/config/intake";
import { NUMBER_REMOVED_MARKER, scrubNumbers } from "./scrub";
import {
  DURATIONS,
  ENDED_REASONS,
  PROBLEMS,
  WATER_POINT_TYPES,
  type EndedReason,
  type NeedsReviewReason,
  type ValidatedReport,
} from "./types";

// One number scrubber for every ingest boundary lives in ./scrub; re-exported so existing imports keep working.
export { NUMBER_REMOVED_MARKER, scrubNumbers };
export const STRUCTURED_OUTPUT_NAME = "water_point_report";

/** Exact-match aliases applied to `water_point_type` only, after trimming and lowercasing (contracts 5.1). */
export const WATER_POINT_TYPE_ALIASES: Readonly<Record<string, string>> = {
  handpump: "hand_pump",
  bore_hole: "borehole",
};

export type ReportScope = Pick<ValidatedReport, "organizationId" | "regionId">;

/** What a caller of `normalizeMessage` gets: the report minus the call reference, which the webhook computes. */
export type NormalizedReport = Omit<ValidatedReport, "providerCallRef">;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Scrub first, then trim, then cap (by characters). Never the other way round. */
function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const scrubbed = scrubNumbers(value).trim();
  return Array.from(scrubbed).slice(0, max).join("").trim();
}

function enumKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function pickEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  aliases: Readonly<Record<string, string>> = {},
): { value: T | "unknown"; invalid: boolean } {
  const key = enumKey(value);
  if (key === null) return { value: "unknown" as T, invalid: true };
  const mapped = aliases[key] ?? key;
  return (allowed as readonly string[]).includes(mapped)
    ? { value: mapped as T, invalid: false }
    : { value: "unknown" as T, invalid: true };
}

function parsePeople(value: unknown): { value: number | null; invalid: boolean } {
  if (value === undefined || value === null) return { value: null, invalid: false };
  if (typeof value === "string") {
    const t = value.trim();
    if (t.toLowerCase() === "unknown") return { value: null, invalid: false };
    return /^\d{1,7}$/.test(t) ? { value: Number(t), invalid: false } : { value: null, invalid: true };
  }
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 9_999_999) {
    return { value, invalid: false };
  }
  return { value: null, invalid: true };
}

function parseSchoolOrClinic(value: unknown): { value: boolean | null; invalid: boolean } {
  if (value === true) return { value: true, invalid: false };
  if (value === false) return { value: false, invalid: false };
  if (typeof value === "string") {
    const t = value.trim().toLowerCase();
    if (t === "true") return { value: true, invalid: false };
    if (t === "false") return { value: false, invalid: false };
    if (t === "unknown") return { value: null, invalid: false };
  }
  return { value: null, invalid: true };
}

/** Known values stay; any other string is `other`; no string is null. */
export function normalizeEndedReason(value: unknown): EndedReason | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const t = value.trim();
  return (ENDED_REASONS as readonly string[]).includes(t) ? (t as EndedReason) : "other";
}

function blank(scope: ReportScope, endedReason: EndedReason | null, reason: NeedsReviewReason): NormalizedReport {
  return {
    organizationId: scope.organizationId,
    regionId: scope.regionId,
    channel: "phone",
    locationText: "unknown",
    waterPointType: "unknown",
    problem: "unknown",
    peopleAffected: null,
    servesSchoolOrClinic: null,
    duration: "unknown",
    callerConfirmed: null,
    summary: null,
    languageSpoken: null,
    transcript: null,
    endedReason,
    needsReview: true,
    needsReviewReason: reason,
  };
}

/** A body that is not a usable Vapi message. Nothing from the body is kept, not even the end reason. */
export function malformedReport(scope: ReportScope): NormalizedReport {
  return blank(scope, null, "malformed_payload");
}

/** The entries of `structuredOutputs` named `water_point_report`: exactly one with an object result, or null. */
export function findStructuredResult(message: Record<string, unknown>): Record<string, unknown> | null {
  const artifact = message.artifact;
  if (!isObject(artifact)) return null;
  const outputs = artifact.structuredOutputs;
  if (!isObject(outputs)) return null;
  const matches = Object.values(outputs).filter(
    (entry) => isObject(entry) && typeof entry.name === "string" && entry.name.trim().toLowerCase() === STRUCTURED_OUTPUT_NAME,
  ) as Record<string, unknown>[];
  if (matches.length !== 1) return null;
  const result = matches[0].result;
  return isObject(result) ? result : null;
}

/** Normalizes a parsed message whose `message.type` is `end-of-call-report`. */
export function normalizeMessage(message: Record<string, unknown>, scope: ReportScope): NormalizedReport {
  const endedReason = normalizeEndedReason(message.endedReason);
  const result = findStructuredResult(message);
  if (result === null) return blank(scope, endedReason, "no_structured_data");

  const type = pickEnum(result.water_point_type, WATER_POINT_TYPES, WATER_POINT_TYPE_ALIASES);
  const problem = pickEnum(result.problem, PROBLEMS);
  const duration = pickEnum(result.duration, DURATIONS);
  const people = parsePeople(result.people_affected);
  const school = parseSchoolOrClinic(result.serves_school_or_clinic);
  const invalidFields = type.invalid || problem.invalid || duration.invalid || people.invalid || school.invalid;

  const location = cleanText(result.location_text, INTAKE_TEXT_MAX_LENGTH.location);
  const readable = location.replaceAll(NUMBER_REMOVED_MARKER, "").trim();
  const unusableLocation = readable.length < 3 || readable.toLowerCase() === "unknown";

  const callerConfirmed = typeof result.caller_confirmed === "boolean" ? result.caller_confirmed : null;
  const summary = cleanText(result.summary, INTAKE_TEXT_MAX_LENGTH.summary);
  const language = cleanText(result.language_spoken, INTAKE_TEXT_MAX_LENGTH.language);

  // One reason, first that applies (contracts 5.2 order).
  const reason: NeedsReviewReason | null = unusableLocation
    ? "unusable_location"
    : invalidFields
      ? "invalid_fields"
      : callerConfirmed !== true
        ? "not_confirmed"
        : null;

  return {
    organizationId: scope.organizationId,
    regionId: scope.regionId,
    channel: "phone",
    locationText: unusableLocation ? "unknown" : location,
    waterPointType: type.value,
    problem: problem.value,
    peopleAffected: people.value,
    servesSchoolOrClinic: school.value,
    duration: duration.value,
    callerConfirmed,
    summary: summary === "" ? null : summary,
    languageSpoken: language === "" ? null : language,
    transcript: null,
    endedReason,
    needsReview: reason !== null,
    needsReviewReason: reason,
  };
}
