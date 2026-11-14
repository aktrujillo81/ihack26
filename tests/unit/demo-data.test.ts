import { describe, expect, it } from "vitest";

import { DEMO_COMPLAINTS, DEMO_NOTES, DEMO_PARTNERS, DEMO_POINTS, DEMO_REPORTS } from "@/db/seed/demo-data";
import { deriveComplaintFacts } from "@/lib/data/derive";
import { PROBLEMS } from "@/lib/domain/types";

const reportsOf = (complaint: string) => DEMO_REPORTS.filter((r) => r.complaint === complaint);

/** The priority score exactly as docs/spec.md section 7 defines it (the real scorer, D5, reads these weights from configuration). */
function specScore(complaint: string): number {
  const facts = deriveComplaintFacts(reportsOf(complaint).map((r) => ({ problem: r.problem, peopleAffected: r.people, servesSchoolOrClinic: r.school, duration: r.duration })));
  const problem = facts.problem === "no_water" || facts.problem === "broken" ? 3 : 1;
  const school = facts.servesSchoolOrClinic === true ? 3 : 0;
  const people = typeof facts.peopleAffected === "number" ? (facts.peopleAffected >= 100 ? 2 : facts.peopleAffected >= 20 ? 1 : 0) : 0;
  const duration = facts.duration === "week_or_more" ? 2 : facts.duration === "few_days" ? 1 : 0;
  const extra = Math.min(Math.max(reportsOf(complaint).length - 1, 0), 3);
  return problem + school + people + duration + extra;
}

describe("the demo data covers every case the demo and the screens need", () => {
  it("has every complaint status", () => {
    expect(new Set(DEMO_COMPLAINTS.map((c) => c.status))).toEqual(new Set(["open", "passed_on", "fixed"]));
  });

  it("has every problem type, as the complaints show them (the most severe across reports)", () => {
    const shown = DEMO_COMPLAINTS.map((c) =>
      deriveComplaintFacts(reportsOf(c.key).map((r) => ({ problem: r.problem, peopleAffected: r.people, servesSchoolOrClinic: r.school, duration: r.duration }))).problem,
    );
    for (const problem of PROBLEMS) expect(shown, problem).toContain(problem);
  });

  it("has every water point state, with and without coordinates, and a point with no complaint", () => {
    expect(new Set(DEMO_POINTS.map((p) => p.verification))).toEqual(new Set(["verified", "unverified", "merged", "archived"]));
    expect(DEMO_POINTS.some((p) => p.lat === null && p.lng === null && p.verification === "unverified")).toBe(true); // needs location
    expect(DEMO_POINTS.some((p) => p.verification === "unverified" && p.lat !== null)).toBe(true); // unverified but placed (public-map filter)
    const withComplaint = new Set(DEMO_COMPLAINTS.map((c) => c.point));
    expect(DEMO_POINTS.some((p) => p.verification === "verified" && p.lat !== null && !withComplaint.has(p.key))).toBe(true); // "no open complaint"
  });

  it("has needs-review cases: a flagged complaint and reports that matched nothing", () => {
    expect(DEMO_COMPLAINTS.some((c) => c.needsReview)).toBe(true);
    const unmatched = DEMO_REPORTS.filter((r) => r.point === null && r.complaint === null);
    expect(unmatched.length).toBeGreaterThanOrEqual(3);
    expect(unmatched.every((r) => r.needsReview)).toBe(true);
  });

  it("has unknown values that must stay unknown, a note, a partner, a merge and a pass-on", () => {
    expect(DEMO_REPORTS.some((r) => r.people === null && r.school === null && r.duration === "unknown")).toBe(true);
    expect(DEMO_NOTES.length).toBeGreaterThan(0);
    expect(DEMO_PARTNERS.length).toBeGreaterThan(0);
    expect(DEMO_POINTS.some((p) => p.mergedInto)).toBe(true);
    expect(DEMO_COMPLAINTS.some((c) => c.status === "passed_on" && c.partner && c.passedOnNote)).toBe(true);
  });

  it("looks recent: the newest report arrived within a few hours", () => {
    expect(Math.min(...DEMO_REPORTS.map((r) => r.hoursAgo))).toBeLessThanOrEqual(3);
    for (const r of DEMO_REPORTS) expect(r.hoursAgo).toBeGreaterThanOrEqual(0);
  });
});

describe("the demo data is internally consistent", () => {
  it("every reference points at something that exists, and keys are unique", () => {
    const points = new Set(DEMO_POINTS.map((p) => p.key));
    const complaints = new Set(DEMO_COMPLAINTS.map((c) => c.key));
    const partners = new Set(DEMO_PARTNERS.map((p) => p.key));
    for (const keys of [DEMO_POINTS.map((p) => p.key), DEMO_COMPLAINTS.map((c) => c.key), DEMO_REPORTS.map((r) => r.key), DEMO_PARTNERS.map((p) => p.key)]) {
      expect(new Set(keys).size).toBe(keys.length);
    }
    for (const c of DEMO_COMPLAINTS) {
      expect(points.has(c.point), c.key).toBe(true);
      if (c.partner) expect(partners.has(c.partner), c.key).toBe(true);
    }
    for (const r of DEMO_REPORTS) {
      if (r.point) expect(points.has(r.point), r.key).toBe(true);
      if (r.complaint) expect(complaints.has(r.complaint), r.key).toBe(true);
    }
    for (const p of DEMO_POINTS) if (p.mergedInto) expect(points.has(p.mergedInto), p.key).toBe(true);
    for (const n of DEMO_NOTES) expect(complaints.has(n.complaint), n.complaint).toBe(true);
  });

  it("a report is linked to a complaint only if it is linked to that complaint's water point", () => {
    for (const r of DEMO_REPORTS) {
      if (!r.complaint) continue;
      expect(DEMO_COMPLAINTS.find((c) => c.key === r.complaint)?.point, r.key).toBe(r.point);
    }
  });

  it("every complaint has at least one report", () => {
    for (const c of DEMO_COMPLAINTS) expect(reportsOf(c.key).length, c.key).toBeGreaterThan(0);
  });

  it("every score equals the spec's formula applied to the complaint's reports, so the numbers cannot drift", () => {
    for (const c of DEMO_COMPLAINTS) expect(c.score, c.key).toBe(specScore(c.key));
  });

  it("every complaint keeps a reason with its score", () => {
    for (const c of DEMO_COMPLAINTS) expect(c.reason.length, c.key).toBeGreaterThan(10);
  });

  it("a fixed complaint has a fixed time, and only a fixed one does", () => {
    for (const c of DEMO_COMPLAINTS) expect(c.fixedHoursAgo !== undefined, c.key).toBe(c.status === "fixed");
  });

  it("coordinates are valid latitudes and longitudes, as text", () => {
    for (const p of DEMO_POINTS) {
      expect(p.lat === null, p.key).toBe(p.lng === null);
      if (p.lat !== null && p.lng !== null) {
        expect(Math.abs(Number(p.lat)), p.key).toBeLessThanOrEqual(90);
        expect(Math.abs(Number(p.lng)), p.key).toBeLessThanOrEqual(180);
      }
    }
  });
});

describe("the demo data holds no caller details and no credentials (red lines 3 and 16)", () => {
  const allText = (): string[] => [
    ...DEMO_POINTS.map((p) => p.locationText),
    ...DEMO_COMPLAINTS.flatMap((c) => [c.reason, c.passedOnNote ?? ""]),
    ...DEMO_REPORTS.flatMap((r) => [r.locationText, r.summary, r.transcript]),
    ...DEMO_NOTES.map((n) => n.text),
    ...DEMO_PARTNERS.flatMap((p) => [p.name, p.type]),
  ];

  it("no phone-number-like or email-like text anywhere", () => {
    for (const text of allText()) {
      expect(text, text).not.toMatch(/(\+\d[\d\s().-]{7,}\d)|(\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4})/);
      expect(text, text).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
      expect(text, text).not.toMatch(/\d{7,}/);
    }
  });

  it("transcripts hold only the assistant and an unnamed caller", () => {
    for (const r of DEMO_REPORTS) {
      const speakers = [...r.transcript.matchAll(/(?:^|\s)([A-Z][a-z]+):/g)].map((m) => m[1]);
      expect(speakers.length, r.key).toBeGreaterThan(0);
      for (const speaker of speakers) expect(["Assistant", "Caller"], `${r.key}: ${speaker}`).toContain(speaker);
    }
  });

  it("partners have no contact details in the seed data", () => {
    for (const p of DEMO_PARTNERS) expect(Object.keys(p).sort()).toEqual(["key", "name", "type"]);
  });

  it("no credential-like text, and no safety advice or repair promises", () => {
    for (const text of allText()) {
      expect(text, text).not.toMatch(/password|secret|token|api[_ -]?key/i);
      expect(text, text).not.toMatch(/safe to drink|is safe|unsafe|will be fixed|within \d+ (hours|days)|we will repair/i);
    }
  });
});
