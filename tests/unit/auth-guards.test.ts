import { describe, expect, it } from "vitest";

import {
  AuthError,
  failureMessageKey,
  requireAction,
  requireActionInScope,
  requireRole,
  requireScope,
  requireSession,
  toDataContext,
} from "@/lib/auth/guards";
import { getCurrentSession, parseSession } from "@/lib/auth/session";
import { ACTIONS } from "@/lib/permissions/matrix";
import { ROLES, type Role } from "@/lib/domain/types";
import { t } from "@/lib/i18n/strings";

const NOW = Date.parse("2026-11-14T12:00:00Z");
const FUTURE = "2026-11-14T20:00:00Z"; // 8 hours after NOW, inside the 12-hour cap
const PAST = "2026-11-13T12:00:00Z";

const session = (role: Role, extra: Record<string, unknown> = {}) => ({
  userId: "u-1",
  role,
  organizationId: "org-a",
  regionIds: ["r1"],
  expiresAt: FUTURE,
  ...extra,
});

/** Runs `fn` and returns the AuthError kind it threw, or null if it did not throw. */
function failure(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof AuthError ? e.kind : `other:${String(e)}`;
  }
}

describe("parseSession fails closed", () => {
  it("accepts a well-formed, unexpired session", () => {
    expect(parseSession(session("responder"), NOW)).toMatchObject({ userId: "u-1", role: "responder", organizationId: "org-a" });
  });

  it("refuses missing and malformed sessions", () => {
    const bad: unknown[] = [undefined, null, "", "token", 0, true, [], [session("viewer")], {}];
    for (const raw of bad) expect(parseSession(raw, NOW), JSON.stringify(raw)).toBeNull();
  });

  it("refuses each missing or wrong field", () => {
    const cases: Record<string, unknown>[] = [
      { userId: undefined },
      { userId: "" },
      { userId: 5 },
      { role: undefined },
      { role: "admin" },
      { role: "ORG_ADMIN" },
      { role: { name: "org_admin" } },
      { organizationId: undefined },
      { organizationId: "" },
      { regionIds: undefined },
      { regionIds: [] },
      { regionIds: [""] },
      { regionIds: [1] },
      { regionIds: "r1" },
      { expiresAt: undefined },
      { expiresAt: "" },
      { expiresAt: "not a date" },
      { expiresAt: 12345 },
    ];
    for (const override of cases) expect(parseSession(session("org_admin", override), NOW), JSON.stringify(override)).toBeNull();
  });

  it("refuses an expired session, and one that expires right now", () => {
    expect(parseSession(session("viewer", { expiresAt: PAST }), NOW)).toBeNull();
    expect(parseSession(session("viewer", { expiresAt: new Date(NOW).toISOString() }), NOW)).toBeNull();
  });

  it("copies the regions so the caller cannot change them afterwards", () => {
    const raw = session("viewer");
    const parsed = parseSession(raw, NOW);
    raw.regionIds.push("r-extra");
    expect(parsed?.regionIds).toEqual(["r1"]);
  });

  it("has no session until Better Auth is wired: the seam returns nothing and there is no mock user", async () => {
    expect(await getCurrentSession()).toBeNull();
  });
});

describe("guards refuse when there is no valid session", () => {
  it("every guard throws unauthenticated for a missing or malformed session", () => {
    const record = { organizationId: "org-a", regionId: "r1" };
    for (const raw of [undefined, null, {}, "x", session("org_admin", { role: "root" }), session("org_admin", { expiresAt: PAST })]) {
      expect(failure(() => requireSession(raw, NOW))).toBe("unauthenticated");
      expect(failure(() => requireRole(raw, "viewer", "responder", "org_admin"))).toBe("unauthenticated");
      expect(failure(() => requireAction(raw, "view"))).toBe("unauthenticated");
      expect(failure(() => requireScope(raw, record))).toBe("unauthenticated");
      expect(failure(() => requireActionInScope(raw, "view", record))).toBe("unauthenticated");
    }
  });
});

describe("requireRole", () => {
  it("allows a listed role and refuses others", () => {
    expect(failure(() => requireRole(session("responder"), "responder", "org_admin"))).toBeNull();
    expect(failure(() => requireRole(session("viewer"), "responder", "org_admin"))).toBe("forbidden");
  });

  it("an empty list of roles allows nobody", () => {
    for (const role of ROLES) expect(failure(() => requireRole(session(role)))).toBe("forbidden");
  });
});

describe("Viewer is refused on every non-view action, server-side", () => {
  const viewer = session("viewer");
  const record = { organizationId: "org-a", regionId: "r1" };

  it("requireAction", () => {
    for (const action of ACTIONS.filter((a) => a !== "view")) expect(failure(() => requireAction(viewer, action)), action).toBe("forbidden");
    expect(failure(() => requireAction(viewer, "view"))).toBeNull();
  });

  it("requireActionInScope, for a record in the Viewer's own scope", () => {
    for (const action of ACTIONS.filter((a) => a !== "view")) expect(failure(() => requireActionInScope(viewer, action, record)), action).toBe("forbidden");
    expect(failure(() => requireActionInScope(viewer, "view", record))).toBeNull();
  });

  it("a role claimed by the client cannot raise a Viewer: only the parsed session role counts", () => {
    const spoofed = { ...viewer, isAdmin: true, permissions: ["manage_users"], claimedRole: "org_admin" };
    expect(failure(() => requireAction(spoofed, "manage_users"))).toBe("forbidden");
    // The same payload with a changed `role` is a different (still validated) session, never a pass-through.
    expect(failure(() => requireAction({ ...viewer, role: "superuser" }, "view"))).toBe("unauthenticated");
  });
});

describe("scope guards", () => {
  const raw = session("org_admin");

  it("allows a record in scope", () => {
    expect(failure(() => requireScope(raw, { organizationId: "org-a", regionId: "r1" }))).toBeNull();
  });

  it("refuses another organization and another region", () => {
    expect(failure(() => requireScope(raw, { organizationId: "org-b", regionId: "r1" }))).toBe("out_of_scope");
    expect(failure(() => requireScope(raw, { organizationId: "org-a", regionId: "r2" }))).toBe("out_of_scope");
  });

  it("refuses a malformed record", () => {
    for (const record of [undefined, null, {}, "r1", { organizationId: "org-a" }]) expect(failure(() => requireScope(raw, record))).toBe("out_of_scope");
  });

  it("checks scope before role, so another organization is never reported as a role problem", () => {
    const other = { organizationId: "org-b", regionId: "r1" };
    expect(failure(() => requireActionInScope(session("viewer"), "change_status", other))).toBe("out_of_scope");
    expect(failure(() => requireActionInScope(session("org_admin"), "change_status", other))).toBe("out_of_scope");
  });

  it("builds the data layer context only from the validated session", () => {
    const ctx = toDataContext(requireSession(session("viewer", { regionIds: ["r1", "r2"] })));
    expect(ctx).toEqual({ organizationId: "org-a", regionIds: ["r1", "r2"] });
  });
});

describe("messages", () => {
  it("not found and out of scope show the identical message", () => {
    const a = failureMessageKey(new AuthError("not_found"));
    const b = failureMessageKey(new AuthError("out_of_scope"));
    expect(a).toBe(b);
    expect(t(a)).toBe(t(b));
    expect(t(a)).toBe("This complaint was not found or you can't view it.");
  });

  it("maps the other failures to the notes' wording", () => {
    expect(t(failureMessageKey(new AuthError("forbidden")))).toBe("You don't have permission to do that.");
    expect(t(failureMessageKey(new AuthError("unauthenticated")))).toBe("Your session ended. Please sign in again.");
  });

  it("anything that is not an AuthError is a generic error, never a success or a denial detail", () => {
    for (const e of [new Error("boom"), "x", null, undefined, 5]) expect(t(failureMessageKey(e))).toBe("Something went wrong. Please try again.");
  });
});

describe("expiry must be strict ISO and not too far away", () => {
  it("refuses loose date strings that Date.parse would accept", () => {
    for (const loose of ["Dec 25 2099", "2099", "2026-11-15", "2026-11-15 12:00:00", "11/15/2026", "2026-11-15T12:00:00"]) {
      expect(parseSession(session("viewer", { expiresAt: loose }), NOW), loose).toBeNull();
    }
  });

  it("accepts ISO with Z or an offset, and with fractions", () => {
    for (const ok of ["2026-11-14T20:00:00Z", "2026-11-14T20:00:00.250Z", "2026-11-14T22:00:00+02:00"]) {
      expect(parseSession(session("viewer", { expiresAt: ok }), NOW), ok).not.toBeNull();
    }
  });

  it("refuses a session that claims to last longer than the maximum", () => {
    expect(parseSession(session("viewer", { expiresAt: "2099-01-01T00:00:00Z" }), NOW)).toBeNull();
    expect(parseSession(session("viewer", { expiresAt: FUTURE }), NOW, 60 * 60 * 1000)).toBeNull();
    expect(parseSession(session("viewer", { expiresAt: FUTURE }), NOW, 48 * 60 * 60 * 1000)).not.toBeNull();
  });
});

describe("default maximum session lifetime", () => {
  it("is 12 hours: 11 hours is accepted, exactly 12 hours is accepted, 12 hours and a second is refused", async () => {
    const { MAX_SESSION_LIFETIME_MS } = await import("@/lib/auth/session");
    expect(MAX_SESSION_LIFETIME_MS).toBe(12 * 60 * 60 * 1000);
    const hours = (n: number) => new Date(NOW + n * 60 * 60 * 1000).toISOString();
    expect(parseSession(session("viewer", { expiresAt: hours(11) }), NOW)).not.toBeNull();
    expect(parseSession(session("viewer", { expiresAt: hours(12) }), NOW)).not.toBeNull();
    expect(parseSession(session("viewer", { expiresAt: new Date(NOW + 12 * 60 * 60 * 1000 + 1000).toISOString() }), NOW)).toBeNull();
    expect(parseSession(session("viewer", { expiresAt: hours(24) }), NOW)).toBeNull();
    expect(parseSession(session("viewer", { expiresAt: hours(7 * 24) }), NOW)).toBeNull();
  });
});
