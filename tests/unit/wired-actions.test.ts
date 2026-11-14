/**
 * The server actions run through the REAL wiring: getCurrentSession() reads the
 * session through the adapter (mocked here, so no database), parseSession
 * validates it, and the guards decide. A session is never passed in by the test
 * as a shortcut to the action; it comes only through the adapter.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ readSessionFromHeaders: vi.fn() }));

vi.mock("@/lib/auth/adapter", () => ({ readSessionFromHeaders: mocks.readSessionFromHeaders, signInWithPassword: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/data/complaints", async () => await import("@/tests/fixtures/mock-data-layer"));

import { ComplaintDetail } from "@/components/complaints/ComplaintDetail";
import { requireAction, toDataContext } from "@/lib/auth/guards";
import { getCurrentSession, parseSession } from "@/lib/auth/session";
import { addNoteAction, changeStatusAction } from "@/lib/actions/form-actions";
import { INITIAL_ACTION_STATE, actionMessageKey } from "@/lib/actions/state";
import { MOCK_CONTEXT } from "@/tests/fixtures/mock-data-layer";
import { mockComplaints, mockHistoryEvents, mockNotes } from "@/tests/fixtures/mock-data";
import { ACTIONS } from "@/lib/permissions/matrix";
import { t } from "@/lib/i18n/strings";

const hoursFromNow = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
const sessionFor = (role: string, over: Record<string, unknown> = {}) => ({
  userId: "u-1",
  role,
  organizationId: MOCK_CONTEXT.organizationId,
  regionIds: [...MOCK_CONTEXT.regionIds],
  expiresAt: hoursFromNow(6),
  ...over,
});

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const status = (id: string, to: unknown, extra: Record<string, string> = {}) =>
  changeStatusAction(INITIAL_ACTION_STATE, form({ complaintId: id, status: String(to), ...extra }));
const note = (id: string, text: string) => addNoteAction(INITIAL_ACTION_STATE, form({ complaintId: id, text }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("a Viewer is refused on every non-view action, server-side, whatever the payload", () => {
  beforeEach(() => mocks.readSessionFromHeaders.mockResolvedValue(sessionFor("viewer")));

  it("status changes and pass-ons, for every status and a garbage one", async () => {
    for (const to of ["open", "passed_on", "fixed", "done", "", "__proto__"]) {
      expect(await status("c-1", to, { passedOnTo: "Demo Pump Repair Co-op" }), String(to)).toEqual({ status: "denied" });
      expect(await status("c-4", to), String(to)).toEqual({ status: "denied" });
    }
  });

  it("notes, valid and invalid", async () => {
    for (const text of ["a note", "", "   ", "x".repeat(5000)]) expect(await note("c-1", text)).toEqual({ status: "denied" });
  });

  it("every action in the matrix other than view is refused by the guard", async () => {
    const raw = await getCurrentSession();
    for (const action of ACTIONS.filter((a) => a !== "view")) {
      expect(() => requireAction(raw, action), action).toThrow();
    }
    expect(() => requireAction(raw, "view")).not.toThrow();
  });

  it("claiming a higher role in the form changes nothing", async () => {
    const spoof = { role: "org_admin", isAdmin: "true", organizationId: "org-other" };
    expect(await status("c-1", "fixed", spoof)).toEqual({ status: "denied" });
    expect(await note("c-1", "hi")).toEqual({ status: "denied" });
  });

  it("no data changes", async () => {
    const before = JSON.stringify([mockComplaints, mockNotes, mockHistoryEvents]);
    await status("c-1", "fixed");
    await note("c-1", "hello");
    expect(JSON.stringify([mockComplaints, mockNotes, mockHistoryEvents])).toBe(before);
  });
});

describe("with no valid session every action is unauthenticated", () => {
  it("none, expired, over-long, unknown role, no region, adapter failure", async () => {
    const bad: unknown[] = [
      null,
      undefined,
      sessionFor("responder", { expiresAt: hoursFromNow(-1) }),
      sessionFor("responder", { expiresAt: hoursFromNow(13) }),
      sessionFor("superuser"),
      sessionFor("responder", { regionIds: [] }),
    ];
    for (const raw of bad) {
      mocks.readSessionFromHeaders.mockResolvedValue(raw);
      expect(await status("c-1", "fixed"), JSON.stringify(raw)).toEqual({ status: "unauthenticated" });
      expect(await note("c-1", "hi"), JSON.stringify(raw)).toEqual({ status: "unauthenticated" });
    }
    mocks.readSessionFromHeaders.mockRejectedValue(new Error("db down"));
    expect(await status("c-1", "fixed")).toEqual({ status: "unauthenticated" });
  });
});

describe("a Responder is authorized, and nothing is written yet", () => {
  it("valid requests get 'not available' (the writes are D6), never success", async () => {
    mocks.readSessionFromHeaders.mockResolvedValue(sessionFor("responder"));
    expect(await status("c-1", "fixed")).toEqual({ status: "not_available" });
    expect(await status("c-1", "passed_on", { passedOnTo: "Demo Pump Repair Co-op" })).toEqual({ status: "not_available" });
    expect(await note("c-1", "Checked with the committee.")).toEqual({ status: "not_available" });
  });

  it("another organization's record is 'not found' for every role, never 'denied'", async () => {
    for (const role of ["viewer", "responder", "org_admin"]) {
      mocks.readSessionFromHeaders.mockResolvedValue(sessionFor(role, { organizationId: "org-other" }));
      expect(await status("c-1", "fixed"), role).toEqual({ status: "not_found" });
      expect(await note("c-1", "hi"), role).toEqual({ status: "not_found" });
    }
  });
});

describe("denied and not-found show the identical message", () => {
  it("another organization's complaint and a missing complaint render the same page", async () => {
    const other = parseSession(sessionFor("responder", { organizationId: "org-other" }));
    const own = parseSession(sessionFor("responder"));
    if (!other || !own) throw new Error("expected sessions");
    const crossOrg = renderToStaticMarkup(await ComplaintDetail({ ctx: toDataContext(other), role: other.role, id: "c-1" }));
    const missing = renderToStaticMarkup(await ComplaintDetail({ ctx: toDataContext(own), role: own.role, id: "c-does-not-exist" }));
    expect(crossOrg).toBe(missing);
    expect(missing).toContain("This complaint was not found or you can&#x27;t view it.");
  });

  it("the action messages for not found and cross-organization are the same wording", async () => {
    mocks.readSessionFromHeaders.mockResolvedValue(sessionFor("responder"));
    const missing = await status("c-nope", "fixed");
    mocks.readSessionFromHeaders.mockResolvedValue(sessionFor("responder", { organizationId: "org-other" }));
    const crossOrg = await status("c-1", "fixed");
    expect(missing).toEqual(crossOrg);
    const key = actionMessageKey(missing);
    expect(key).not.toBeNull();
    expect(t(key!)).toBe("This complaint was not found or you can't view it.");
  });
});
