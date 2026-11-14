/**
 * PROVISIONAL tests for lib/data/complaints.ts. Run with:
 *   npx tsx --test tests/unit/data-layer.test.ts
 * (No package.json yet; wire into the real test runner after S3.)
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MOCK_CONTEXT,
  getComplaint,
  getLastReportReceived,
  listComplaints,
  listNeedsLocation,
  listNeedsReview,
  listWaterPoints,
  type DataContext,
} from "../../lib/data/complaints";

const otherOrg: DataContext = { organizationId: "org-other", regionIds: ["region-demo"] };
const otherRegion: DataContext = { organizationId: "org-demo", regionIds: ["region-elsewhere"] };

/** Phone-like numbers, emails, and key names that suggest contact details. */
const PHONE = /(\+?\d[\d\s().-]{7,}\d)/;
const EMAIL = /[^\s@"]+@[^\s@"]+\.[^\s@"]+/;
const FORBIDDEN_KEY = /phone|email|contact/i;

function scan(value: unknown, path = "$"): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string") {
    const text = value.replace(/\d{4}-\d{2}-\d{2}/g, ""); // ISO dates are not phone numbers
    return [PHONE, EMAIL].some((re) => re.test(text)) ? [`${path}: ${value}`] : [];
  }
  if (Array.isArray(value)) return value.flatMap((v, i) => scan(v, `${path}[${i}]`));
  if (typeof value === "object")
    return Object.entries(value).flatMap(([k, v]) => [...(FORBIDDEN_KEY.test(k) ? [`${path}.${k}: forbidden key`] : []), ...scan(v, `${path}.${k}`)]);
  return [];
}

test("list is sorted by priority, highest first", async () => {
  const r = await listComplaints(MOCK_CONTEXT);
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  const scores = r.data.map((i) => i.complaint.priorityScore);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
});

test("another organization or region sees nothing (empty, not an error)", async () => {
  for (const ctx of [otherOrg, otherRegion]) {
    assert.equal((await listComplaints(ctx)).status, "empty");
    assert.equal((await listNeedsReview(ctx)).status, "empty");
    assert.equal((await listNeedsLocation(ctx)).status, "empty");
    assert.equal((await listWaterPoints(ctx)).status, "empty");
    assert.equal((await getLastReportReceived(ctx)).status, "empty");
  }
});

test("missing and cross-organization complaints look identical", async () => {
  const missing = await getComplaint(MOCK_CONTEXT, "c-does-not-exist");
  const crossOrg = await getComplaint(otherOrg, "c-1");
  assert.deepEqual(missing, { status: "error", error: "not_found_or_denied" });
  assert.deepEqual(crossOrg, missing);
});

test("detail has reports, timeline in order, and a partner view without contact", async () => {
  const r = await getComplaint(MOCK_CONTEXT, "c-3");
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.equal(r.data.passedOnTo?.name, "Demo Pump Repair Co-op");
  assert.ok(!("contact" in (r.data.passedOnTo ?? {})));
  const times = r.data.history.map((h) => h.at);
  assert.deepEqual(times, [...times].sort());
});

test("ambiguous report lists candidates and never picks one", async () => {
  const r = await listNeedsReview(MOCK_CONTEXT);
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  const ambiguous = r.data.find((i) => i.report.needsReviewReason === "ambiguous_match");
  assert.equal(ambiguous?.report.waterPointId, null);
  assert.deepEqual(ambiguous?.candidates.map((c) => c.id).sort(), ["wp-7", "wp-8"]);
});

test("needs-location excludes pinned, merged and archived points", async () => {
  const r = await listNeedsLocation(MOCK_CONTEXT);
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.deepEqual(r.data.map((w) => w.id).sort(), ["wp-5", "wp-6"]);
});

test("merged and archived points are hidden unless asked for", async () => {
  const def = await listWaterPoints(MOCK_CONTEXT);
  const all = await listWaterPoints(MOCK_CONTEXT, { includeInactive: true });
  assert.ok(def.status === "ok" && all.status === "ok");
  if (def.status !== "ok" || all.status !== "ok") return;
  assert.ok(def.data.every((w) => w.verificationState !== "merged" && w.verificationState !== "archived"));
  assert.ok(all.data.length > def.data.length);
});

test("last report received returns the newest report time", async () => {
  const r = await getLastReportReceived(MOCK_CONTEXT);
  assert.deepEqual(r, { status: "ok", data: { receivedAt: "2026-11-13T14:30:00Z" } });
});

test("nothing returned contains phone numbers, emails, or contact fields", async () => {
  const ids = ["c-1", "c-2", "c-3", "c-4", "c-5", "c-6", "c-7"];
  const outputs = await Promise.all([
    listComplaints(MOCK_CONTEXT),
    listNeedsReview(MOCK_CONTEXT),
    listNeedsLocation(MOCK_CONTEXT),
    listWaterPoints(MOCK_CONTEXT, { includeInactive: true }),
    getLastReportReceived(MOCK_CONTEXT),
    ...ids.map((id) => getComplaint(MOCK_CONTEXT, id)),
  ]);
  assert.deepEqual(scan(outputs), []);
});
