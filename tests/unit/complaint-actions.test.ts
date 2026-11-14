import { describe, expect, it } from "vitest";

import { addComplaintNote, changeComplaintStatus } from "@/lib/actions/complaints";
import { INITIAL_ACTION_STATE, actionMessageKey, type ActionState } from "@/lib/actions/state";
import { ALLOWED_TRANSITIONS, nextStatuses } from "@/lib/actions/transitions";
import { mockComplaints, mockHistoryEvents, mockNotes } from "@/lib/domain/mock";
import { COMPLAINT_STATUSES, type Role } from "@/lib/domain/types";
import { t } from "@/lib/i18n/strings";

const soon = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();
const session = (role: Role | string, extra: Record<string, unknown> = {}) => ({
  userId: "u-1",
  role,
  organizationId: "org-demo",
  regionIds: ["region-demo"],
  expiresAt: soon(),
  ...extra,
});

// c-1 open, c-3 passed_on, c-4 fixed (all org-demo / region-demo)
const ok = (status: ActionState["status"]) => ({ status });

describe("actions need a valid session", () => {
  it("no session, a malformed session or an expired session is unauthenticated, before anything else", async () => {
    const bad: unknown[] = [undefined, null, {}, "token", session("responder", { expiresAt: "2020-01-01T00:00:00Z" }), session("root")];
    for (const raw of bad) {
      expect(await changeComplaintStatus(raw, { complaintId: "c-1", status: "fixed" })).toEqual(ok("unauthenticated"));
      expect(await addComplaintNote(raw, { complaintId: "c-1", text: "hello" })).toEqual(ok("unauthenticated"));
    }
  });
});

describe("Viewer is refused every write, server-side, whatever the payload", () => {
  const viewer = session("viewer");

  it("status changes and pass-ons", async () => {
    for (const status of ["open", "passed_on", "fixed", "nonsense", undefined, 5]) {
      expect(await changeComplaintStatus(viewer, { complaintId: "c-1", status, passedOnTo: "Demo Pump Repair Co-op" }), String(status)).toEqual(ok("denied"));
    }
    expect(await changeComplaintStatus(viewer, { complaintId: "c-4", status: "open" })).toEqual(ok("denied"));
  });

  it("notes", async () => {
    for (const text of ["a note", "", undefined, "x".repeat(5000)]) {
      expect(await addComplaintNote(viewer, { complaintId: "c-1", text })).toEqual(ok("denied"));
    }
  });

  it("a role claimed in the payload cannot raise a Viewer", async () => {
    const spoofed = { ...viewer, isAdmin: true, claimedRole: "org_admin", permissions: ["change_status"] };
    expect(await changeComplaintStatus(spoofed, { complaintId: "c-1", status: "fixed" })).toEqual(ok("denied"));
  });
});

describe("scope is checked before role", () => {
  it("another organization's complaint is not found for every role, never denied", async () => {
    for (const role of ["viewer", "responder", "org_admin"]) {
      const s = session(role, { organizationId: "org-other" });
      expect(await changeComplaintStatus(s, { complaintId: "c-1", status: "fixed" }), role).toEqual(ok("not_found"));
      expect(await addComplaintNote(s, { complaintId: "c-1", text: "hi" }), role).toEqual(ok("not_found"));
    }
  });

  it("another region in the same organization is not found", async () => {
    const s = session("org_admin", { regionIds: ["region-elsewhere"] });
    expect(await changeComplaintStatus(s, { complaintId: "c-1", status: "fixed" })).toEqual(ok("not_found"));
  });

  it("a missing, malformed or hostile id is not found, the same answer as another organization", async () => {
    const s = session("responder");
    const other = await changeComplaintStatus(session("responder", { organizationId: "org-other" }), { complaintId: "c-1", status: "fixed" });
    for (const complaintId of ["c-nope", "", undefined, null, 5, {}, [], "x".repeat(500), "c-1 ", "../c-1", "c-1;drop"]) {
      expect(await changeComplaintStatus(s, { complaintId, status: "fixed" }), JSON.stringify(complaintId)).toEqual(other);
    }
  });
});

describe("Responder and Org Admin: authorized but nothing is written yet", () => {
  it("a valid change returns not_available, never done", async () => {
    for (const role of ["responder", "org_admin"]) {
      const s = session(role);
      expect(await changeComplaintStatus(s, { complaintId: "c-1", status: "fixed" }), role).toEqual(ok("not_available"));
      expect(await changeComplaintStatus(s, { complaintId: "c-1", status: "passed_on", passedOnTo: "Demo Pump Repair Co-op" }), role).toEqual(ok("not_available"));
      expect(await changeComplaintStatus(s, { complaintId: "c-3", status: "fixed" }), role).toEqual(ok("not_available"));
      expect(await changeComplaintStatus(s, { complaintId: "c-4", status: "open" }), role).toEqual(ok("not_available"));
      expect(await addComplaintNote(s, { complaintId: "c-1", text: "Checked with the committee." }), role).toEqual(ok("not_available"));
    }
  });

  it("never changes the data", async () => {
    const before = JSON.stringify([mockComplaints, mockNotes, mockHistoryEvents]);
    const s = session("org_admin");
    await changeComplaintStatus(s, { complaintId: "c-1", status: "fixed" });
    await addComplaintNote(s, { complaintId: "c-1", text: "note" });
    expect(JSON.stringify([mockComplaints, mockNotes, mockHistoryEvents])).toBe(before);
  });
});

describe("input is checked after authorization", () => {
  const s = session("responder");

  it("refuses transitions the spec does not allow", async () => {
    expect(await changeComplaintStatus(s, { complaintId: "c-1", status: "open" })).toEqual(ok("invalid")); // same status
    expect(await changeComplaintStatus(s, { complaintId: "c-4", status: "fixed" })).toEqual(ok("invalid"));
    expect(await changeComplaintStatus(s, { complaintId: "c-4", status: "passed_on", passedOnTo: "x" })).toEqual(ok("invalid")); // fixed to passed on
    expect(await changeComplaintStatus(s, { complaintId: "c-3", status: "open" })).toEqual(ok("invalid")); // passed on back to open: unknown in spec
  });

  it("refuses unknown statuses", async () => {
    for (const status of ["done", "OPEN", "", undefined, null, 1, {}, "__proto__"]) {
      expect(await changeComplaintStatus(s, { complaintId: "c-1", status }), String(status)).toEqual(ok("invalid"));
    }
  });

  it("passing on needs a note of who, and not too long", async () => {
    for (const passedOnTo of [undefined, null, "", "   ", 5, "x".repeat(201)]) {
      expect(await changeComplaintStatus(s, { complaintId: "c-1", status: "passed_on", passedOnTo }), String(passedOnTo)).toEqual(ok("invalid"));
    }
  });

  it("notes must be non-empty text, and not too long", async () => {
    for (const text of [undefined, null, "", "   ", 5, {}, "x".repeat(1001)]) {
      expect(await addComplaintNote(s, { complaintId: "c-1", text }), String(text)).toEqual(ok("invalid"));
    }
  });

  it("a Responder cannot do what only the matrix gives to others: pass-on and status are separate actions", async () => {
    // Both are allowed for Responder today; this guards the mapping used by the server.
    expect(await changeComplaintStatus(s, { complaintId: "c-1", status: "passed_on", passedOnTo: "Demo Pump Repair Co-op" })).toEqual(ok("not_available"));
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
    for (const status of ["unauthenticated", "denied", "not_found", "invalid", "not_available", "error"] as const) {
      expect(actionMessageKey({ status })).not.toBeNull();
    }
  });

  it("not found and another organization share one message", () => {
    expect(t(actionMessageKey({ status: "not_found" })!)).toBe("This complaint was not found or you can't view it.");
  });

  it("never claims success", () => {
    for (const status of ["unauthenticated", "denied", "not_found", "invalid", "not_available", "error"] as const) {
      expect(t(actionMessageKey({ status })!)).not.toMatch(/successfully|\bdone\b|\bupdated\b|(?<!not )saved/i);
    }
  });
});
