import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DURATIONS, PROBLEMS, WATER_POINT_TYPES } from "@/lib/domain/types";
import { ENDED_REASONS, NEEDS_REVIEW_REASONS, type ValidatedReport } from "@/lib/ingest/types";

import { buildFakeReport, fakeCallRef, fakeName, fakePhoneNumbers, plantPersonalData } from "../fixtures/fake-report-builder";
import {
  ambiguousMatchCase,
  blankReport,
  duplicateCallCase,
  handpumpAliasCase,
  normalReport,
  notConfirmedReport,
  unknownAnswersReport,
} from "../fixtures/report-cases";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Seven or more digits, with or without separators (contracts 5.1). */
const phoneLike = /\d(?:[\s.\-()+]*\d){6}/;

function assertShape(report: ValidatedReport) {
  expect(report.organizationId).toMatch(UUID);
  expect(report.regionId).toMatch(UUID);
  expect(report.channel).toBe("phone");
  expect(WATER_POINT_TYPES).toContain(report.waterPointType);
  expect(PROBLEMS).toContain(report.problem);
  expect(DURATIONS).toContain(report.duration);
  expect(report.transcript).toBeNull();
  if (report.endedReason !== null) expect(ENDED_REASONS).toContain(report.endedReason);
  // Invariant: needs review means a reason (contracts 5.2).
  if (report.needsReview) expect(NEEDS_REVIEW_REASONS).toContain(report.needsReviewReason);
  else expect(report.needsReviewReason).toBeNull();
}

describe("fake report builder", () => {
  it("builds a valid report with fresh scope ids and a fresh ref each time", () => {
    const a = buildFakeReport();
    const b = buildFakeReport();
    assertShape(a);
    expect(a.organizationId).not.toBe(b.organizationId);
    expect(a.providerCallRef).not.toBe(b.providerCallRef);
  });

  it("makes phone numbers in several formats, each with 7 or more digits, different every run", () => {
    const phones = fakePhoneNumbers();
    expect(new Set(phones.map((p) => p.replace(/\d/g, "#"))).size).toBeGreaterThanOrEqual(6);
    for (const phone of phones) expect(phone).toMatch(phoneLike);
    expect(fakePhoneNumbers()).not.toEqual(phones);
  });

  it("makes call refs with letters only, so a digit check never trips on it", () => {
    const ref = fakeCallRef();
    expect(ref).toHaveLength(64);
    expect(ref).not.toMatch(/\d/);
  });

  it("plants phones and a name in the free-text fields only", () => {
    const base = normalReport();
    const { report, planted } = plantPersonalData(base);
    expect(planted.phones.length).toBeGreaterThanOrEqual(6);
    expect(planted.name).toMatch(/^\S+ \S+$/);
    expect(report.locationText).toContain(planted.phones[0]);
    expect(report.summary).toContain(planted.name);
    expect(report.languageSpoken).toContain(planted.phones[5]);
    expect({ ...report, locationText: "", summary: "", languageSpoken: null }).toEqual({
      ...base,
      locationText: "",
      summary: "",
      languageSpoken: null,
    });
    expect(fakeName()).toMatch(/^\S+ \S+$/);
  });

  it("keeps a null language null when planting", () => {
    const { report } = plantPersonalData(buildFakeReport({ languageSpoken: null }));
    expect(report.languageSpoken).toBeNull();
  });
});

describe("report cases", () => {
  it("normal: valid, confirmed, no review, text has no phone-like digits", () => {
    const report = normalReport();
    assertShape(report);
    expect(report.needsReview).toBe(false);
    expect(report.callerConfirmed).toBe(true);
    expect(`${report.locationText} ${report.summary} ${report.languageSpoken}`).not.toMatch(phoneLike);
  });

  it("blank: unknown location and fields, unusable_location, null confirmation", () => {
    const report = blankReport();
    assertShape(report);
    expect(report.locationText).toBe("unknown");
    expect(report.needsReviewReason).toBe("unusable_location");
    expect(report.callerConfirmed).toBeNull();
    expect(report.peopleAffected).toBeNull();
    expect(report.servesSchoolOrClinic).toBeNull();
  });

  it("unknown answers: all unknown but a usable place, no review", () => {
    const report = unknownAnswersReport();
    assertShape(report);
    expect(report.needsReview).toBe(false);
    expect(report.locationText).not.toBe("unknown");
    expect([report.waterPointType, report.problem, report.duration]).toEqual(["unknown", "unknown", "unknown"]);
  });

  it("not confirmed: flagged but attachable", () => {
    const report = notConfirmedReport();
    assertShape(report);
    expect(report.needsReviewReason).toBe("not_confirmed");
  });

  it("handpump alias: wire value and expected type", () => {
    const { wireValue, expectedType, report } = handpumpAliasCase();
    expect(wireValue).toBe("handpump");
    expect(expectedType).toBe("hand_pump");
    expect(report.waterPointType).toBe(expectedType);
    assertShape(report);
  });

  it("duplicate call: same scope and ref, a separate object", () => {
    const { first, repeat } = duplicateCallCase();
    expect(repeat).toEqual(first);
    expect(repeat).not.toBe(first);
    expect(first.providerCallRef).not.toBeNull();
  });

  it("ambiguous match: two existing points that both fit the report", () => {
    const { report, existingPoints } = ambiguousMatchCase();
    assertShape(report);
    expect(existingPoints).toHaveLength(2);
    for (const point of existingPoints) {
      expect(point.locationText).toBe(report.locationText);
      expect([report.waterPointType, "unknown"]).toContain(point.waterPointType);
    }
  });
});

describe("no phone-like text is written in these files", () => {
  const root = path.resolve(__dirname, "../..");
  const files = [
    "lib/ingest/types.ts",
    "lib/ingest/text-caps.ts",
    "lib/ingest/aliases.ts",
    "lib/config/intake-defaults.ts",
    "tests/fixtures/fake-report-builder.ts",
    "tests/fixtures/report-cases.ts",
    "tests/unit/ingest-text-caps.test.ts",
    "tests/unit/ingest-aliases.test.ts",
    "tests/unit/ingest-fixtures.test.ts",
  ];
  it.each(files)("%s", (file) => {
    const text = readFileSync(path.join(root, file), "utf8");
    // The pattern above is itself source text; strip its own line before scanning.
    const scanned = text
      .split("\n")
      .filter((line) => !line.includes("const phoneLike"))
      .join("\n");
    expect(scanned).not.toMatch(phoneLike);
  });
});
