import { describe, expect, it } from "vitest";

import {
  requireAction,
  requireActionInScope,
  requireScope,
  requireSession,
  toDataContext,
} from "@/lib/auth/guards";
import { sessionFromUser, type UserRow } from "@/lib/auth/user-session";
import { ROLES } from "@/lib/domain/types";
import { ACTIONS, PERMISSIONS } from "@/lib/permissions/matrix";

const NOW = Date.parse("2026-11-14T12:00:00Z");
const FUTURE = "2026-11-15T12:00:00Z";

/** Copied from the D1 draft: `pgEnum("user_role", [...])` in origin/feat/database-migrations lib/db/schema.ts. */
const D1_USER_ROLES = ["org_admin", "responder", "viewer"] as const;

const row = (over: Partial<Record<keyof UserRow, unknown>> = {}) => ({
  id: "0b6f1d1e-0000-4000-8000-000000000001",
  organizationId: "0b6f1d1e-0000-4000-8000-0000000000a1",
  regionId: "0b6f1d1e-0000-4000-8000-0000000000b1",
  role: "responder",
  active: true,
  ...over,
});

describe("D1 role values and the permission matrix agree", () => {
  it("D1's enum equals the roles the matrix and the types know, exactly", () => {
    expect([...D1_USER_ROLES].sort()).toEqual([...ROLES].sort());
    expect(Object.keys(PERMISSIONS).sort()).toEqual([...D1_USER_ROLES].sort());
  });

  it("every D1 role maps to a session with that role", () => {
    for (const role of D1_USER_ROLES) {
      expect(sessionFromUser(row({ role }), FUTURE, NOW)?.role).toBe(role);
    }
  });
});

describe("a D1 user row becomes a session", () => {
  it("maps the one region_id to a one-item region list, and keeps organization and ids", () => {
    const s = sessionFromUser(row(), FUTURE, NOW);
    expect(s).toEqual({
      userId: "0b6f1d1e-0000-4000-8000-000000000001",
      role: "responder",
      organizationId: "0b6f1d1e-0000-4000-8000-0000000000a1",
      regionIds: ["0b6f1d1e-0000-4000-8000-0000000000b1"],
      expiresAt: FUTURE,
    });
    expect(s?.regionIds).toHaveLength(1);
  });

  it("the data layer context is built from that session only", () => {
    const s = sessionFromUser(row(), FUTURE, NOW);
    if (!s) throw new Error("expected a session");
    expect(toDataContext(s)).toEqual({
      organizationId: "0b6f1d1e-0000-4000-8000-0000000000a1",
      regionIds: ["0b6f1d1e-0000-4000-8000-0000000000b1"],
    });
  });
});

describe("a user row that is not clearly valid gets no session", () => {
  it("an inactive user, or one whose active flag is not exactly true", () => {
    for (const active of [false, undefined, null, "true", 1, 0, "", {}]) {
      expect(sessionFromUser(row({ active }), FUTURE, NOW), String(active)).toBeNull();
    }
  });

  it("a user with no region is refused (the denied state), whatever else is valid", () => {
    for (const regionId of [undefined, null, "", 5, {}, []]) {
      expect(sessionFromUser(row({ regionId }), FUTURE, NOW), String(regionId)).toBeNull();
    }
  });

  it("a missing organization or id is refused", () => {
    for (const over of [{ organizationId: undefined }, { organizationId: "" }, { id: undefined }, { id: "" }, { id: 7 }]) {
      expect(sessionFromUser(row(over), FUTURE, NOW), JSON.stringify(over)).toBeNull();
    }
  });

  it("an unknown, missing or differently cased role is refused", () => {
    for (const role of [undefined, null, "", "admin", "owner", "ORG_ADMIN", "Viewer", "viewer ", 1, {}]) {
      expect(sessionFromUser(row({ role }), FUTURE, NOW), String(role)).toBeNull();
    }
  });

  it("anything that is not a user object is refused", () => {
    for (const user of [undefined, null, "user", 5, [], [row()]]) expect(sessionFromUser(user, FUTURE, NOW)).toBeNull();
  });

  it("a missing, loose, past or too distant expiry is refused", () => {
    for (const expiresAt of [undefined, null, "", "Dec 25 2099", "2020-01-01T00:00:00Z", "2099-01-01T00:00:00Z", 12345]) {
      expect(sessionFromUser(row(), expiresAt, NOW), String(expiresAt)).toBeNull();
    }
  });

  it("extra fields on the row (a password hash, a client-claimed role) change nothing", () => {
    const s = sessionFromUser({ ...row({ role: "viewer" }), passwordHash: "x", isAdmin: true, claimedRole: "org_admin" }, FUTURE, NOW);
    expect(s?.role).toBe("viewer");
    expect(Object.keys(s ?? {}).sort()).toEqual(["expiresAt", "organizationId", "regionIds", "role", "userId"]);
  });
});

describe("a session built from a D1 row works with the guards, server-side", () => {
  const viewer = sessionFromUser(row({ role: "viewer" }), FUTURE, NOW);
  const responder = sessionFromUser(row({ role: "responder" }), FUTURE, NOW);
  const admin = sessionFromUser(row({ role: "org_admin" }), FUTURE, NOW);
  const own = { organizationId: "0b6f1d1e-0000-4000-8000-0000000000a1", regionId: "0b6f1d1e-0000-4000-8000-0000000000b1" };

  /** Guards are given the session as the raw value, as a route would. */
  const failure = (fn: () => unknown) => {
    try {
      fn();
      return null;
    } catch (e) {
      return (e as { kind?: string }).kind ?? "other";
    }
  };

  it("Viewer is refused every non-view action, in and out of scope handling", () => {
    for (const action of ACTIONS.filter((a) => a !== "view")) {
      expect(failure(() => requireAction(viewer, action)), action).toBe("forbidden");
      expect(failure(() => requireActionInScope(viewer, action, own)), action).toBe("forbidden");
    }
    expect(failure(() => requireAction(viewer, "view"))).toBeNull();
  });

  it("a record in another region of the same organization, or another organization, is out of scope", () => {
    for (const s of [viewer, responder, admin]) {
      expect(failure(() => requireScope(s, { ...own, regionId: "0b6f1d1e-0000-4000-8000-0000000000b2" }))).toBe("out_of_scope");
      expect(failure(() => requireScope(s, { ...own, organizationId: "0b6f1d1e-0000-4000-8000-0000000000a2" }))).toBe("out_of_scope");
      expect(failure(() => requireScope(s, own))).toBeNull();
    }
  });

  it("no session (user row refused) means every guard says unauthenticated", () => {
    const none = sessionFromUser(row({ active: false }), FUTURE, NOW);
    expect(none).toBeNull();
    expect(failure(() => requireSession(none))).toBe("unauthenticated");
    expect(failure(() => requireAction(none, "view"))).toBe("unauthenticated");
  });
});
