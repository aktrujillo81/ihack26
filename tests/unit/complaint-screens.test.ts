import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ComplaintDetail } from "@/components/complaints/ComplaintDetail";
import { ComplaintDetailView } from "@/components/complaints/ComplaintDetailView";
import { ComplaintList } from "@/components/complaints/ComplaintList";
import { ComplaintListView } from "@/components/complaints/ComplaintListView";
import { buildSummary } from "@/components/complaints/summary";
import { MOCK_CONTEXT, getComplaint, listComplaints, type ComplaintDetail as Detail, type ComplaintListItem } from "@/lib/data/complaints";
import { mockReports } from "@/lib/domain/mock";
import { ROLES } from "@/lib/domain/types";
import { t } from "@/lib/i18n/strings";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

async function items(): Promise<ComplaintListItem[]> {
  const r = await listComplaints(MOCK_CONTEXT);
  if (r.status !== "ok") throw new Error("expected data");
  return r.data;
}
async function detail(id: string): Promise<Detail> {
  const r = await getComplaint(MOCK_CONTEXT, id);
  if (r.status !== "ok") throw new Error("expected data");
  return r.data;
}

/** Every transcript in the mock data, to prove none leaks outside the detail page. */
const TRANSCRIPTS = mockReports.map((r) => r.transcript).filter((x): x is string => !!x);

describe("complaint list: states and wording", () => {
  it("loading", () => {
    expect(html(createElement(ComplaintListView, { result: { status: "loading" } }))).toContain("Loading…");
  });

  it("empty", () => {
    expect(html(createElement(ComplaintListView, { result: { status: "empty" } }))).toContain(
      "No complaints yet. When someone reports a problem, it will appear here.",
    );
  });

  it("error, with a retry link only when the read failed", () => {
    const failed = html(createElement(ComplaintListView, { result: { status: "error", error: "failed" }, retryHref: "/complaints" }));
    expect(failed).toContain("Something went wrong. Please try again.");
    expect(failed).toContain("Try again");
    expect(html(createElement(ComplaintListView, { result: { status: "error", error: "denied" } }))).toContain("You don&#x27;t have permission to do that.");
  });

  it("shows every column with a header and the priority as text with its reason", async () => {
    const out = html(createElement(ComplaintListView, { result: { status: "ok", data: await items() } }));
    for (const key of ["list.col.priority", "list.col.waterPoint", "list.col.problem", "list.col.people", "list.col.schoolClinic", "list.col.duration", "list.col.reports", "list.col.status", "list.col.updated"] as const) {
      expect(out).toContain(t(key));
    }
    expect(out).toContain("12: No water (+3)"); // c-1: number plus its reason, not a color
  });

  it("shows a status word on every row, not only a color", async () => {
    const out = html(createElement(ComplaintListView, { result: { status: "ok", data: await items() } }));
    for (const word of [t("status.open"), t("status.passed_on"), t("status.fixed")]) expect(out).toContain(word);
  });

  it("marks needs-review rows with the words and unverified rows with the word and a dashed style", async () => {
    const out = html(createElement(ComplaintListView, { result: { status: "ok", data: await items() } }));
    expect(out).toContain(t("common.needsReview"));
    expect(out).toContain(t("common.unverified"));
    expect(out).toContain("ww-row-unverified");
  });

  it("shows unknown values as Unknown, never as 0", async () => {
    const out = html(createElement(ComplaintListView, { result: { status: "ok", data: await items() } }));
    expect(out).toContain(t("common.unknown"));
    expect(out).not.toMatch(/<td>0<\/td>/);
  });

  it("holds no transcripts and no report text", async () => {
    const out = html(createElement(ComplaintListView, { result: { status: "ok", data: await items() } }));
    for (const transcript of TRANSCRIPTS) expect(out).not.toContain(transcript.slice(0, 30));
    expect(out).not.toContain("Assistant:");
  });

  it("says how many are shown", async () => {
    const data = await items();
    expect(html(createElement(ComplaintListView, { result: { status: "ok", data } }))).toContain(`Showing ${data.length} of ${data.length}`);
  });

  it("the server wrapper reads through the data layer with the given context only", async () => {
    const own = html(await ComplaintList({ ctx: MOCK_CONTEXT }));
    expect(own).toContain("ww-table");
    const other = html(await ComplaintList({ ctx: { organizationId: "org-other", regionIds: ["region-demo"] } }));
    expect(other).toContain("No complaints yet.");
    expect(other).not.toContain("ww-table");
  });
});

describe("complaint detail: states and wording", () => {
  it("loading and error states", () => {
    expect(html(createElement(ComplaintDetailView, { result: { status: "loading" }, role: "viewer" }))).toContain("Loading…");
    expect(html(createElement(ComplaintDetailView, { result: { status: "error", error: "failed" }, role: "viewer" }))).toContain(
      "Something went wrong. Please try again.",
    );
  });

  it("not found and another organization's record show the identical message", async () => {
    const missing = html(await ComplaintDetail({ ctx: MOCK_CONTEXT, role: "responder", id: "c-nope" }));
    const crossOrg = html(await ComplaintDetail({ ctx: { organizationId: "org-other", regionIds: ["region-demo"] }, role: "responder", id: "c-1" }));
    expect(missing).toBe(crossOrg);
    expect(missing).toContain("This complaint was not found or you can&#x27;t view it.");
  });

  it("shows reports with transcripts, the score reason, notes, the timeline and the copy button", async () => {
    const out = html(createElement(ComplaintDetailView, { result: { status: "ok", data: await detail("c-1") }, role: "viewer" }));
    expect(out).toContain(t("detail.reportsTitle"));
    expect(out).toContain("Assistant: Where is the water point? Caller: Riverside village");
    expect(out).toContain(t("detail.transcriptEmpty")); // r-3 has no transcript
    expect(out).toContain("No water (+3)");
    expect(out).toContain(t("detail.timelineTitle"));
    expect(out).toContain(t("detail.notesEmpty"));
    expect(out).toContain(t("detail.copySummary"));
  });

  it("shows notes when there are some", async () => {
    const out = html(createElement(ComplaintDetailView, { result: { status: "ok", data: await detail("c-3") }, role: "viewer" }));
    expect(out).toContain("Passed to the repair co-op.");
    expect(out).not.toContain(t("detail.notesEmpty"));
  });

  it("shows the needs-review and unverified banners", async () => {
    const out = html(createElement(ComplaintDetailView, { result: { status: "ok", data: await detail("c-6") }, role: "viewer" }));
    expect(out).toContain(t("detail.needsReviewBanner").replace("'", "&#x27;"));
    expect(out).toContain(t("detail.unverifiedBanner"));
  });

  it("shows unknown values as Unknown", async () => {
    const out = html(createElement(ComplaintDetailView, { result: { status: "ok", data: await detail("c-5") }, role: "viewer" }));
    expect(out).toContain(t("common.unknown"));
  });
});

describe("complaint detail: controls follow the role matrix", () => {
  const controlsFor = async (role: unknown, id = "c-1") =>
    html(createElement(ComplaintDetailView, { result: { status: "ok", data: await detail(id) }, role }));

  it("Viewer sees no status controls and no note form", async () => {
    const out = await controlsFor("viewer");
    expect(out).not.toContain(t("detail.passOn"));
    expect(out).not.toContain(t("detail.markFixed"));
    expect(out).not.toContain(t("detail.addNote"));
  });

  it("Responder and Org Admin see them", async () => {
    for (const role of ["responder", "org_admin"]) {
      const out = await controlsFor(role);
      expect(out, role).toContain(t("detail.passOn"));
      expect(out, role).toContain(t("detail.markFixed"));
      expect(out, role).toContain(t("detail.addNote"));
    }
  });

  it("a fixed complaint offers Reopen and nothing else", async () => {
    const out = await controlsFor("responder", "c-4");
    expect(out).toContain(t("detail.reopen"));
    expect(out).not.toContain(t("detail.markFixed"));
  });

  it("an unknown, missing or malformed role sees no controls (default deny)", async () => {
    for (const role of [undefined, null, "", "admin", "ORG_ADMIN", 1, {}, ["responder"]]) {
      const out = await controlsFor(role);
      expect(out, String(role)).not.toContain(t("detail.markFixed"));
      expect(out, String(role)).not.toContain(t("detail.addNote"));
    }
  });

  it("every known role renders without error", async () => {
    for (const role of ROLES) expect((await controlsFor(role)).length).toBeGreaterThan(0);
  });
});

describe("copyable summary", () => {
  it("has the hand-off facts", async () => {
    const text = buildSummary(await detail("c-3"));
    for (const part of ["Water point:", "Tap, Lakeside village, next to the clinic", "Status: Passed on", "Problem: Slow", "Demo Pump Repair Co-op"]) {
      expect(text).toContain(part);
    }
  });

  it("never includes transcript text, report summaries or notes, for any complaint", async () => {
    for (const id of ["c-1", "c-2", "c-3", "c-4", "c-5", "c-6", "c-7"]) {
      const data = await detail(id);
      const text = buildSummary(data);
      for (const r of data.reports) {
        if (r.transcript) expect(text, id).not.toContain(r.transcript.slice(0, 25));
        expect(text, id).not.toContain(r.summary);
      }
      for (const n of data.notes) expect(text, id).not.toContain(n.text);
      expect(text, id).not.toContain("Assistant:");
    }
  });

  it("holds no phone number or email", async () => {
    for (const id of ["c-1", "c-3", "c-5"]) {
      const text = buildSummary(await detail(id)).replace(/\d{4}-\d{2}-\d{2}/g, "");
      expect(text).not.toMatch(/\d{3}[\s.-]\d{3}[\s.-]\d{4}|\+\d{8,}/);
      expect(text).not.toMatch(/[\w.-]+@[\w-]+\.[a-z]{2,}/i);
    }
  });

  it("shows unknown values as Unknown", async () => {
    const text = buildSummary(await detail("c-5"));
    expect(text).toContain("People affected: Unknown");
    expect(text).toContain("School or clinic: Unknown");
  });
});
