/**
 * The complaint actions: who may call them, in what order they check, and exactly
 * what they pass to the write. The write itself is replaced by a stand-in here
 * (tests/fixtures/mock-complaint-writes.ts); the real transaction, version check
 * and history event are tested against Postgres in tests/integration.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data/complaints", async () => await import("@/tests/fixtures/mock-data-layer"));
vi.mock("@/lib/data/complaint-writes", async () => await import("@/tests/fixtures/mock-complaint-writes"));

import { addComplaintNote, changeComplaintStatus } from "@/lib/actions/complaints";
import { INITIAL_ACTION_STATE, actionMessageKey, type ActionState } from "@/lib/actions/state";
import { ALLOWED_TRANSITIONS, nextStatuses } from "@/lib/actions/transitions";
import * as writes from "@/lib/data/complaint-writes";
import { COMPLAINT_STATUSES, type Role } from "@/lib/domain/types";
import { t } from "@/lib/i18n/strings";
import { mockComplaints, mockHistoryEvents, mockNotes } from "@/tests/fixtures/mock-data";

const applyStatusChange = vi.mocked(writes.applyStatusChange);
const addNote = vi.mocked(writes.addNote);

const soon = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();
const session = (role: Role | string, extra: Record<string, unknown> = {}) => ({
  userId: "u-1",
  role,
  organizationId: "org-demo",
  regionIds: ["region-demo"],
  expiresAt: soon(),
  ...extra,
});

const VERSION = "2026-11-14T12:00:00.123456Z";
// c-1 open, c-3 passed_on, c-4 fixed (all org-demo / region-demo)
const ok = (status: ActionState["status"]) => ({ status });
const neverWrote = () => {
  expect(applyStatusChange).not.toHaveBeenCalled();
  expect(addNote).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("actions need a valid session", () => {
  it("no session, a malformed session or an expired session is unauthenticated, before anything else", async () => {
    const bad: unknown[] = [undefined, null, {}, "token", session("responder", { expiresAt: "2020-01-01T00:00:00Z" }), session("root")];
    for (const raw of bad) {
      expect(await changeComplaintStatus(raw, { complaintId: "c-1", status: "fixed", version: VERSION })).toEqual(ok("unauthenticated"));
      expect(await addComplaintNote(raw, { complaintId: "c-1", text: "hello" })).toEqual(ok("unauthenticated"));
    }
    neverWrote();
  });
});

describe("Viewer is refused every write, server-side, whatever the payload", () => {
  const viewer = session("viewer");

  it("status changes and pass-ons, valid or not, with or without a version", async () => {
    for (const status of ["open", "passed_on", "fixed", "nonsense", undefined, 5]) {
      for (const version of [VERSION, "", undefined, "garbage"]) {
        expect(await changeComplaintStatus(viewer, { complaintId: "c-1", status, passedOnTo: "Demo Pump Repair Co-op", version }), `${String(status)} ${String(version)}`).toEqual(ok("denied"));
      }
    }
    expect(await changeComplaintStatus(viewer, { complaintId: "c-4", status: "open", version: VERSION })).toEqual(ok("denied"));
    neverWrote();
  });

  it("notes", async () => {
    for (const text of ["a note", "", undefined, "x".repeat(5000)]) {
      expect(await addComplaintNote(viewer, { complaintId: "c-1", text })).toEqual(ok("denied"));
    }
    neverWrote();
  });

  it("a role claimed in the payload cannot raise a Viewer", async () => {
    const spoofed = { ...viewer, isAdmin: true, permissions: ["change_status"], claimedRole: "org_admin" };
    expect(await changeComplaintStatus(spoofed, { complaintId: "c-1", status: "fixed", version: VERSION })).toEqual(ok("denied"));
    neverWrote();
  });
});

describe("scope is checked before role", () => {
  it("another organization's complaint is not found for every role, never denied", async () => {
    for (const role of ["viewer", "responder", "org_admin"]) {
      const s = session(role, { organizationId: "org-other" });
      expect(await changeComplaintStatus(s, { complaintId: "c-1", status: "fixed", version: VERSION }), role).toEqual(ok("not_found"));
      expect(await addComplaintNote(s, { complaintId: "c-1", text: "hi" }), role).toEqual(ok("not_found"));
    }
    neverWrote();
  });

  it("another region in the same organization is not found", async () => {
    const s = session("org_admin", { regionIds: ["region-elsewhere"] });
    expect(await changeComplaintStatus(s, { complaintId: "c-1", status: "fixed", version: VERSION })).toEqual(ok("not_found"));
    neverWrote();
  });

  it("a missing, malformed or hostile id is not found, the same answer as another organization", async () => {
    const s = session("responder");
    const other = await changeComplaintStatus(session("responder", { organizationId: "org-other" }), { complaintId: "c-1", status: "fixed", version: VERSION });
    for (const complaintId of ["c-nope", "", undefined, null, 5, {}, [], "x".repeat(500), "c-1 ", "../c-1", "c-1;drop"]) {
      expect(await changeComplaintStatus(s, { complaintId, status: "fixed", version: VERSION }), JSON.stringify(complaintId)).toEqual(other);
    }
    neverWrote();
  });
});

describe("what an authorized, valid request passes to the write", () => {
  it("a status change: the session's scope and user, the stored complaint id, the version the screen loaded", async () => {
    const s = session("responder", { userId: "11111111-1111-4111-8111-111111111111" });
    expect(await changeComplaintStatus(s, { complaintId: "c-1", status: "fixed", version: VERSION })).toEqual(ok("saved"));
    expect(applyStatusChange).toHaveBeenCalledTimes(1);
    expect(applyStatusChange).toHaveBeenCalledWith({
      ctx: { organizationId: "org-demo", regionIds: ["region-demo"] },
      actorUserId: "11111111-1111-4111-8111-111111111111",
      complaintId: "c-1",
      expectedVersion: VERSION,
      to: "fixed",
      passedOnNote: undefined,
    });
  });

  it("a pass-on carries who it was passed to; Org Admin may do the same", async () => {
    for (const role of ["responder", "org_admin"]) {
      applyStatusChange.mockClear();
      expect(await changeComplaintStatus(session(role), { complaintId: "c-1", status: "passed_on", passedOnTo: "Demo Pump Repair Co-op", version: VERSION }), role).toEqual(ok("saved"));
      expect(applyStatusChange.mock.calls[0]?.[0]).toMatchObject({ to: "passed_on", passedOnNote: "Demo Pump Repair Co-op" });
    }
  });

  it("a reopen, and a note", async () => {
    expect(await changeComplaintStatus(session("responder"), { complaintId: "c-4", status: "open", version: VERSION })).toEqual(ok("saved"));
    expect(applyStatusChange.mock.calls[0]?.[0]).toMatchObject({ to: "open" });
    expect(await addComplaintNote(session("responder", { userId: "22222222-2222-4222-8222-222222222222" }), { complaintId: "c-1", text: "Checked with the committee." })).toEqual(ok("saved"));
    expect(addNote).toHaveBeenCalledWith({
      ctx: { organizationId: "org-demo", regionIds: ["region-demo"] },
      actorUserId: "22222222-2222-4222-8222-222222222222",
      complaintId: "c-1",
      text: "Checked with the committee.",
    });
  });

  it("organization, region and author can not be set from the request", async () => {
    const spoof = { organizationId: "org-other", regionId: "region-other", authorUserId: "someone-else", actorUserId: "someone-else", userId: "someone-else" };
    await changeComplaintStatus(session("responder", { userId: "11111111-1111-4111-8111-111111111111" }), { complaintId: "c-1", status: "fixed", version: VERSION, ...spoof } as never);
    await addComplaintNote(session("responder", { userId: "11111111-1111-4111-8111-111111111111" }), { complaintId: "c-1", text: "hi", ...spoof } as never);
    for (const call of [applyStatusChange.mock.calls[0]?.[0], addNote.mock.calls[0]?.[0]] as { ctx: unknown; actorUserId: string }[]) {
      expect(call.ctx).toEqual({ organizationId: "org-demo", regionIds: ["region-demo"] });
      expect(call.actorUserId).toBe("11111111-1111-4111-8111-111111111111");
      expect(JSON.stringify(call)).not.toContain("someone-else");
      expect(JSON.stringify(call)).not.toContain("org-other");
    }
  });

  it("saves nothing in the mock data", async () => {
    const before = JSON.stringify([mockComplaints, mockNotes, mockHistoryEvents]);
    await changeComplaintStatus(session("org_admin"), { complaintId: "c-1", status: "fixed", version: VERSION });
    await addComplaintNote(session("org_admin"), { complaintId: "c-1", text: "note" });
    expect(JSON.stringify([mockComplaints, mockNotes, mockHistoryEvents])).toBe(before);
  });
});

describe("what the write says becomes the screen's state, and a failure is never shown as success", () => {
  const s = session("responder");

  it("each write result maps to its own state", async () => {
    for (const [result, state] of [
      [{ status: "conflict" }, "conflict"],
      [{ status: "not_found" }, "not_found"],
      [{ status: "invalid" }, "invalid"],
      [{ status: "denied" }, "denied"],
      [{ status: "error" }, "error"],
    ] as const) {
      applyStatusChange.mockResolvedValueOnce(result);
      expect(await changeComplaintStatus(s, { complaintId: "c-1", status: "fixed", version: VERSION }), state).toEqual(ok(state));
      addNote.mockResolvedValueOnce(result);
      expect(await addComplaintNote(s, { complaintId: "c-1", text: "hi" }), state).toEqual(ok(state));
    }
  });

  it("an unknown or odd write result is an error, never a success", async () => {
    for (const odd of [{ status: "ok" }, { status: "SAVED" }, {}, null, undefined, "saved"]) {
      applyStatusChange.mockResolvedValueOnce(odd as never);
      const state = await changeComplaintStatus(s, { complaintId: "c-1", status: "fixed", version: VERSION });
      expect(state.status, JSON.stringify(odd)).not.toBe("saved");
    }
  });

  it("a write that throws is an error", async () => {
    applyStatusChange.mockRejectedValueOnce(new Error("boom"));
    addNote.mockRejectedValueOnce(new Error("boom"));
    expect(await changeComplaintStatus(s, { complaintId: "c-1", status: "fixed", version: VERSION })).toEqual(ok("error"));
    expect(await addComplaintNote(s, { complaintId: "c-1", text: "hi" })).toEqual(ok("error"));
  });
});

describe("input is checked after authorization, and a bad request never reaches the write", () => {
  const s = session("responder");

  it("refuses transitions the spec does not allow", async () => {
    expect(await changeComplaintStatus(s, { complaintId: "c-1", status: "open", version: VERSION })).toEqual(ok("invalid")); // same status
    expect(await changeComplaintStatus(s, { complaintId: "c-4", status: "fixed", version: VERSION })).toEqual(ok("invalid"));
    expect(await changeComplaintStatus(s, { complaintId: "c-4", status: "passed_on", passedOnTo: "x", version: VERSION })).toEqual(ok("invalid")); // fixed to passed on
    expect(await changeComplaintStatus(s, { complaintId: "c-3", status: "open", version: VERSION })).toEqual(ok("invalid")); // passed on back to open: unknown in spec
    neverWrote();
  });

  it("refuses unknown statuses", async () => {
    for (const status of ["done", "OPEN", "", undefined, null, 1, {}, "__proto__"]) {
      expect(await changeComplaintStatus(s, { complaintId: "c-1", status, version: VERSION }), String(status)).toEqual(ok("invalid"));
    }
    neverWrote();
  });

  it("passing on needs a note of who, and not too long", async () => {
    for (const passedOnTo of [undefined, null, "", "   ", 5, "x".repeat(201)]) {
      expect(await changeComplaintStatus(s, { complaintId: "c-1", status: "passed_on", passedOnTo, version: VERSION }), String(passedOnTo)).toEqual(ok("invalid"));
    }
    neverWrote();
  });

  it("a status change needs the version the screen loaded", async () => {
    for (const version of [undefined, null, "", 5, {}, []]) {
      expect(await changeComplaintStatus(s, { complaintId: "c-1", status: "fixed", version }), String(version)).toEqual(ok("invalid"));
    }
    neverWrote();
  });

  it("notes must be non-empty text, and not too long", async () => {
    for (const text of [undefined, null, "", "   ", 5, {}, "x".repeat(1001)]) {
      expect(await addComplaintNote(s, { complaintId: "c-1", text }), String(text)).toEqual(ok("invalid"));
    }
    neverWrote();
  });
});

describe("transitions and wording", () => {
  it("every status has a list of next statuses, none to itself", () => {
    for (const status of COMPLAINT_STATUSES) {
      expect(ALLOWED_TRANSITIONS[status]).toBeDefined();
      expect(nextStatuses(status)).not.toContain(status);
    }
  });

  it("every outcome has wording except the initial state", () => {
    expect(actionMessageKey(INITIAL_ACTION_STATE)).toBeNull();
    for (const status of ["saved", "conflict", "unauthenticated", "denied", "not_found", "invalid", "error"] as const) {
      expect(actionMessageKey({ status })).not.toBeNull();
    }
  });

  it("saved and conflict have their own wording", () => {
    expect(t(actionMessageKey({ status: "saved" })!)).toBe("Saved.");
    expect(t(actionMessageKey({ status: "conflict" })!)).toBe("This complaint was changed by someone else. Reload the page and try again.");
  });

  it("not found and another organization share one message", () => {
    expect(t(actionMessageKey({ status: "not_found" })!)).toBe("This complaint was not found or you can't view it.");
  });

  it("no failure message claims success", () => {
    for (const status of ["conflict", "unauthenticated", "denied", "not_found", "invalid", "error"] as const) {
      expect(t(actionMessageKey({ status })!)).not.toMatch(/successfully|\bdone\b|\bupdated\b|(?<!not )saved/i);
    }
  });
});
