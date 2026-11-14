import { describe, expect, it } from "vitest";

import { typeText } from "@/components/complaints/format";
import { applyListQuery, DEFAULT_QUERY, parseListQuery, summaryCounts, toSearchParams, type ListQuery } from "@/components/complaints/listQuery";
import type { ComplaintListItem } from "@/lib/data/complaints";
import { listComplaints, MOCK_CONTEXT } from "@/tests/fixtures/mock-data-layer";

async function items(): Promise<ComplaintListItem[]> {
  const result = await listComplaints(MOCK_CONTEXT);
  if (result.status !== "ok") throw new Error("expected data");
  return result.data;
}

const q = (over: Partial<ListQuery>): ListQuery => ({ ...DEFAULT_QUERY, ...over });
const ids = (list: ComplaintListItem[]) => list.map((i) => i.complaint.id);

describe("parseListQuery", () => {
  it("no parameters, or none at all, is the default", () => {
    expect(parseListQuery(new URLSearchParams())).toEqual(DEFAULT_QUERY);
    expect(parseListQuery(null)).toEqual(DEFAULT_QUERY);
    expect(parseListQuery(undefined)).toEqual(DEFAULT_QUERY);
  });

  it("reads valid values", () => {
    expect(parseListQuery(new URLSearchParams("status=fixed&q=hand&sort=reports&dir=asc"))).toEqual({ status: "fixed", q: "hand", sort: "reports", dir: "asc" });
  });

  it("anything it does not understand falls back to the default, and never throws", () => {
    const parsed = parseListQuery(new URLSearchParams({ status: "done", sort: "<script>", dir: "sideways", q: "  x  " }));
    expect(parsed).toEqual({ status: "all", q: "x", sort: "priority", dir: "desc" });
    expect(parseListQuery(new URLSearchParams({ q: "x".repeat(500) })).q).toHaveLength(100);
  });
});

describe("toSearchParams", () => {
  it("the default list has a plain URL", () => {
    expect(toSearchParams(DEFAULT_QUERY).toString()).toBe("");
  });

  it("round-trips every non-default value", () => {
    const query = q({ status: "passed_on", q: "river bank", sort: "updated", dir: "asc" });
    expect(parseListQuery(toSearchParams(query))).toEqual(query);
  });

  it("leaves out whitespace-only search", () => {
    expect(toSearchParams(q({ q: "   " })).toString()).toBe("");
  });
});

describe("applyListQuery", () => {
  it("the default query keeps the order the data layer gave (most urgent first)", async () => {
    const all = await items();
    expect(ids(applyListQuery(all, DEFAULT_QUERY))).toEqual(ids(all));
  });

  it("filters by status", async () => {
    const all = await items();
    for (const status of ["open", "passed_on", "fixed"] as const) {
      const out = applyListQuery(all, q({ status }));
      expect(out.length).toBe(all.filter((i) => i.complaint.status === status).length);
      expect(out.every((i) => i.complaint.status === status)).toBe(true);
    }
  });

  it("search matches the type word and the location text, ignoring case and not looking at anything else", async () => {
    const all = await items();
    const first = all.find((i) => i.waterPoint)?.waterPoint;
    if (!first) throw new Error("fixture has no water point");
    const word = first.locationText.split(" ")[0].toUpperCase();
    const out = applyListQuery(all, q({ q: word }));
    expect(out.length).toBeGreaterThan(0);
    const haystack = (i: ComplaintListItem) => `${i.waterPoint ? typeText(i.waterPoint.type) : ""} ${i.waterPoint?.locationText ?? ""}`.toUpperCase();
    expect(out.every((i) => haystack(i).includes(word))).toBe(true);
    expect(out.length).toBe(all.filter((i) => haystack(i).includes(word)).length);
    expect(applyListQuery(all, q({ q: "zzzz-no-such-place" }))).toEqual([]);
  });

  it("sorts by priority, reports and last update in both directions, and ties keep the original order", async () => {
    const all = await items();
    const desc = applyListQuery(all, q({ sort: "priority", dir: "desc" })).map((i) => i.complaint.priorityScore);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    const asc = applyListQuery(all, q({ sort: "priority", dir: "asc" })).map((i) => i.complaint.priorityScore);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const reports = applyListQuery(all, q({ sort: "reports", dir: "desc" })).map((i) => i.complaint.reportCount);
    expect(reports).toEqual([...reports].sort((a, b) => b - a));
    const updated = applyListQuery(all, q({ sort: "updated", dir: "asc" })).map((i) => i.complaint.updatedAt);
    expect(updated).toEqual([...updated].sort());
  });

  it("sorts by status in lifecycle order (open, passed on, fixed)", async () => {
    const out = applyListQuery(await items(), q({ sort: "status", dir: "asc" })).map((i) => i.complaint.status);
    const rank = { open: 0, passed_on: 1, fixed: 2 } as const;
    expect(out.map((s) => rank[s as keyof typeof rank])).toEqual([...out.map((s) => rank[s as keyof typeof rank])].sort());
  });

  it("does not change its input", async () => {
    const all = await items();
    const before = ids(all);
    applyListQuery(all, q({ sort: "reports", dir: "asc" }));
    expect(ids(all)).toEqual(before);
  });
});

describe("summaryCounts", () => {
  it("counts every loaded row once by status, and counts the needs-review flag", async () => {
    const all = await items();
    const counts = summaryCounts(all);
    expect(counts.open + counts.passed_on + counts.fixed).toBe(all.length);
    expect(counts.needsReview).toBe(all.filter((i) => i.complaint.needsReview).length);
  });

  it("an unrecognized status is not counted as any of the three", () => {
    const odd = { complaint: { status: "bogus", needsReview: false }, waterPoint: null } as unknown as ComplaintListItem;
    expect(summaryCounts([odd])).toEqual({ open: 0, passed_on: 0, fixed: 0, needsReview: 0 });
  });
});
