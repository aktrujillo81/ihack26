import { describe, expect, it } from "vitest";

import { deriveComplaintFacts, isUuid, toCoordinate, type ReportFacts } from "@/lib/data/derive";

const report = (over: Partial<ReportFacts> = {}): ReportFacts => ({
  problem: "unknown",
  peopleAffected: null,
  servesSchoolOrClinic: null,
  duration: "unknown",
  ...over,
});

describe("deriveComplaintFacts: the most severe known values across reports", () => {
  it("no reports means everything is unknown, never zero or false", () => {
    expect(deriveComplaintFacts([])).toEqual({ problem: "unknown", peopleAffected: "unknown", servesSchoolOrClinic: "unknown", duration: "unknown" });
  });

  it("problem: no water and broken beat slow, dirty, other and unknown", () => {
    for (const [problems, expected] of [
      [["slow", "no_water", "dirty"], "no_water"],
      [["other", "broken"], "broken"],
      [["broken", "no_water"], "no_water"],
      [["dirty", "slow"], "slow"],
      [["other", "unknown"], "other"],
      [["unknown", "unknown"], "unknown"],
    ] as const) {
      expect(deriveComplaintFacts(problems.map((problem) => report({ problem }))).problem, problems.join(",")).toBe(expected);
    }
  });

  it("people affected: the largest known number; null is ignored; zero is a real known value", () => {
    expect(deriveComplaintFacts([report({ peopleAffected: 20 }), report({ peopleAffected: null }), report({ peopleAffected: 150 })]).peopleAffected).toBe(150);
    expect(deriveComplaintFacts([report({ peopleAffected: null })]).peopleAffected).toBe("unknown");
    expect(deriveComplaintFacts([report({ peopleAffected: 0 })]).peopleAffected).toBe(0);
    expect(deriveComplaintFacts([report({ peopleAffected: Number.NaN })]).peopleAffected).toBe("unknown");
  });

  it("school or clinic: any true wins, then a known false, then unknown", () => {
    expect(deriveComplaintFacts([report({ servesSchoolOrClinic: false }), report({ servesSchoolOrClinic: true })]).servesSchoolOrClinic).toBe(true);
    expect(deriveComplaintFacts([report({ servesSchoolOrClinic: null }), report({ servesSchoolOrClinic: false })]).servesSchoolOrClinic).toBe(false);
    expect(deriveComplaintFacts([report({ servesSchoolOrClinic: null })]).servesSchoolOrClinic).toBe("unknown");
  });

  it("duration: the longest known", () => {
    expect(deriveComplaintFacts([report({ duration: "today" }), report({ duration: "week_or_more" }), report({ duration: "few_days" })]).duration).toBe("week_or_more");
    expect(deriveComplaintFacts([report({ duration: "unknown" }), report({ duration: "today" })]).duration).toBe("today");
    expect(deriveComplaintFacts([report({ duration: "unknown" })]).duration).toBe("unknown");
  });

  it("does not depend on the order of the reports", () => {
    const reports = [report({ problem: "slow", peopleAffected: 5, duration: "today" }), report({ problem: "no_water", peopleAffected: 90, servesSchoolOrClinic: true, duration: "few_days" })];
    expect(deriveComplaintFacts(reports)).toEqual(deriveComplaintFacts([...reports].reverse()));
  });
});

describe("toCoordinate", () => {
  it("turns the driver's numeric text into a number", () => {
    expect(toCoordinate("-1.292100")).toBeCloseTo(-1.2921, 6);
    expect(toCoordinate("36.8219")).toBeCloseTo(36.8219, 6);
    expect(toCoordinate(0)).toBe(0);
    expect(toCoordinate("0")).toBe(0);
  });

  it("anything that is not a finite number is null", () => {
    for (const bad of [null, undefined, "", "abc", "NaN", "Infinity", Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(toCoordinate(bad as never), String(bad)).toBeNull();
    }
  });
});

describe("isUuid", () => {
  it("accepts uuids in either case and nothing else", () => {
    expect(isUuid("0b6f1d1e-0000-4000-8000-0000000000a1")).toBe(true);
    expect(isUuid("0B6F1D1E-0000-4000-8000-0000000000A1")).toBe(true);
    for (const bad of ["", " ", "c-1", "org-demo", "0b6f1d1e-0000-4000-8000-0000000000a1 ", " 0b6f1d1e-0000-4000-8000-0000000000a1", "0b6f1d1e00004000800000000000a1", "' or 1=1 --", null, undefined, 5, {}, []]) {
      expect(isUuid(bad), String(bad)).toBe(false);
    }
  });
});
