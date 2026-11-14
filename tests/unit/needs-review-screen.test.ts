import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NeedsReviewTable } from "@/components/complaints/NeedsReviewList";
import { topReviewReason } from "@/lib/data/derive";
import { NEEDS_REVIEW_REASONS } from "@/lib/domain/types";
import type { NeedsReviewItem } from "@/lib/data/complaints";

const item = (over: Record<string, unknown>): NeedsReviewItem => ({
  report: {
    id: "r1", organizationId: "o", regionId: "g", channel: "phone", waterPointId: null, complaintId: null,
    locationText: "Near the market", waterPointType: "tap", problem: "broken", peopleAffected: "unknown",
    servesSchoolOrClinic: "unknown", duration: "today", callerConfirmed: true, languageSpoken: "unknown",
    needsReview: true, needsReviewReason: "unusable_location", candidateWaterPointIds: [], receivedAt: "2026-11-13T14:30:00Z",
    ...over,
  } as NeedsReviewItem["report"],
  candidates: [],
});

describe("the Needs review table", () => {
  it("shows the reason as words, the time, the problem and the spoken location", () => {
    const html = renderToStaticMarkup(createElement(NeedsReviewTable, { items: [item({})] }));
    expect(html).toContain("Needs review: unusable_location");
    expect(html).toContain("2026-11-13 14:30 UTC");
    expect(html).toContain("Broken");
    expect(html).toContain("Near the market");
    expect(html).not.toMatch(/<(a|button|form|input)\b/);
  });
  it("falls back to the plain label when no reason is stored", () => {
    const html = renderToStaticMarkup(createElement(NeedsReviewTable, { items: [item({ needsReviewReason: null })] }));
    expect(html).toContain("Needs review");
    expect(html).not.toContain("Needs review:");
  });
  it("renders no transcript or summary even if a row carried one", () => {
    const html = renderToStaticMarkup(createElement(NeedsReviewTable, { items: [item({ transcript: "TRANSCRIPT-TEXT", summary: "SUMMARY-TEXT" })] }));
    expect(html).not.toContain("TRANSCRIPT-TEXT");
    expect(html).not.toContain("SUMMARY-TEXT");
  });
});

describe("topReviewReason", () => {
  it("picks the earliest reason in contracts 5.2 priority order", () => {
    expect(topReviewReason([null, "not_confirmed", "ambiguous_match"])).toBe("ambiguous_match");
    expect(topReviewReason(["invalid_fields", "malformed_payload"])).toBe("malformed_payload");
    expect(topReviewReason([null, null])).toBeNull();
    expect(topReviewReason([])).toBeNull();
  });
  it("uses the seven stored reason codes", () => {
    expect([...NEEDS_REVIEW_REASONS]).toEqual(["malformed_payload", "no_structured_data", "processing_error", "unusable_location", "ambiguous_match", "invalid_fields", "not_confirmed"]);
  });
});
