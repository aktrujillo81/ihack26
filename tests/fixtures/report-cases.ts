/**
 * Named report cases for D3b tests (docs/tasks/D3b.md, "How we will test it").
 * Every value is built at runtime by `fake-report-builder.ts`. No raw Vapi
 * payload and no phone-like text appears here.
 */
import type { WaterPointType } from "@/lib/domain/types";
import type { ValidatedReport } from "@/lib/ingest/report-input";

import { buildFakeReport, fakeCallRef } from "./fake-report-builder";

/** A normal, valid, confirmed report. */
export function normalReport(): ValidatedReport {
  return buildFakeReport();
}

/**
 * Nothing usable: unknown location (`unusable_location`, no water point), every
 * field `unknown` or null. A missing field is `unknown`; caller_confirmed is null.
 */
export function blankReport(): ValidatedReport {
  return buildFakeReport({
    locationText: "unknown",
    waterPointType: "unknown",
    problem: "unknown",
    peopleAffected: null,
    servesSchoolOrClinic: null,
    duration: "unknown",
    callerConfirmed: null,
    summary: "",
    languageSpoken: null,
    endedReason: null,
    needsReview: true,
    needsReviewReason: "unusable_location",
  });
}

/**
 * The caller said "unknown" to everything but gave a usable place and confirmed.
 * A caller's own "unknown" alone never sets needs-review (contracts 5.2), and
 * unknown values score 0 or +1 (5.6).
 */
export function unknownAnswersReport(): ValidatedReport {
  return buildFakeReport({
    waterPointType: "unknown",
    problem: "unknown",
    peopleAffected: null,
    servesSchoolOrClinic: null,
    duration: "unknown",
  });
}

/** Valid place, but the caller did not confirm the read-back: `not_confirmed`, still attached. */
export function notConfirmedReport(): ValidatedReport {
  return buildFakeReport({ callerConfirmed: null, needsReview: true, needsReviewReason: "not_confirmed" });
}

/**
 * The wire value `handpump` and the report it becomes after the alias (D3a
 * applies the alias before the report reaches D3b; decision 3).
 */
export function handpumpAliasCase(): { wireValue: string; expectedType: WaterPointType; report: ValidatedReport } {
  return { wireValue: "handpump", expectedType: "hand_pump", report: buildFakeReport({ waterPointType: "hand_pump" }) };
}

/**
 * The same call delivered twice: same scope, same `providerCallRef`. The second
 * save is a no-op (same result, no second row, code `repeat`).
 */
export function duplicateCallCase(): { first: ValidatedReport; repeat: ValidatedReport } {
  const first = buildFakeReport({ providerCallRef: fakeCallRef() });
  return { first, repeat: { ...first } };
}

/** A water point that already exists in the scope, described without ids. */
export interface ExistingPointSeed {
  locationText: string;
  waterPointType: WaterPointType;
}

/**
 * A report whose place fits two existing points: `ambiguous_match`, candidates
 * stored, no pick (red line 7). The caller seeds the two points in the report's
 * own organization and region (ids come from the report, not from this fixture).
 */
export function ambiguousMatchCase(): { report: ValidatedReport; existingPoints: ExistingPointSeed[] } {
  const locationText = "Eastgate Village by the old school";
  return {
    report: buildFakeReport({ locationText, waterPointType: "hand_pump" }),
    existingPoints: [
      { locationText, waterPointType: "hand_pump" },
      { locationText, waterPointType: "unknown" }, // type "unknown" is compatible (contracts 5.3)
    ],
  };
}
