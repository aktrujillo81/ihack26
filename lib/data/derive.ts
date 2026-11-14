/**
 * Pure helpers that turn D1 rows into the values the screens show. No database,
 * no session, no IO, so they are unit-tested directly.
 *
 * D1's `complaints` table has no problem, people-affected, school-or-clinic or
 * duration columns (those live on `reports`). The spec (section 7) says a
 * complaint's score uses "the most severe values reported", so the screens show
 * the most severe value across the complaint's reports. PROVISIONAL: the
 * report-to-complaint link and these rules wait for S6 and D4/D5
 * (docs/reviews/D1.md).
 *
 * `unknown` never counts as severe and never beats a known value.
 */
import { NEEDS_REVIEW_REASONS, type Duration, type NeedsReviewReason, type PeopleAffected, type Problem, type ServesSchoolOrClinic } from "../domain/types";

/** Most severe first. no_water and broken are the red problems (spec section 7). */
const PROBLEM_ORDER: readonly Problem[] = ["no_water", "broken", "slow", "dirty", "other", "unknown"];

/** Longest first. */
const DURATION_ORDER: readonly Duration[] = ["week_or_more", "few_days", "today", "unknown"];

export interface ReportFacts {
  problem: Problem;
  /** D1: nullable integer. Null means unknown. */
  peopleAffected: number | null;
  /** D1: nullable boolean. Null means unknown. */
  servesSchoolOrClinic: boolean | null;
  duration: Duration;
}

export interface ComplaintFacts {
  problem: Problem;
  peopleAffected: PeopleAffected;
  servesSchoolOrClinic: ServesSchoolOrClinic;
  duration: Duration;
}

const best = <T,>(values: readonly T[], order: readonly T[], fallback: T): T => {
  for (const candidate of order) if (values.includes(candidate)) return candidate;
  return fallback;
};

/** The most severe known values across a complaint's reports. No reports means everything is unknown. */
export function deriveComplaintFacts(reports: readonly ReportFacts[]): ComplaintFacts {
  const people = reports.map((r) => r.peopleAffected).filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  const school = reports.map((r) => r.servesSchoolOrClinic);
  return {
    problem: best(reports.map((r) => r.problem), PROBLEM_ORDER, "unknown"),
    // reduce, not Math.max(...people): a spread of a very large list can throw.
    peopleAffected: people.length > 0 ? people.reduce((a, b) => (b > a ? b : a)) : "unknown",
    servesSchoolOrClinic: school.includes(true) ? true : school.includes(false) ? false : "unknown",
    duration: best(reports.map((r) => r.duration), DURATION_ORDER, "unknown"),
  };
}

/** D1 stores coordinates as `numeric`, which the driver returns as text. Anything that is not a finite number is null. */
export function toCoordinate(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True only for a uuid. Used before any value from a URL or a session reaches a uuid column. */
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

/** The highest-priority stored reason among a complaint's reports (contracts 5.2 order), or null. */
export function topReviewReason(reasons: readonly (NeedsReviewReason | null)[]): NeedsReviewReason | null {
  for (const reason of NEEDS_REVIEW_REASONS) if (reasons.includes(reason)) return reason;
  return null;
}
