import { describe, expect, it } from "vitest";

import { ROLES } from "@/lib/domain/types";
import {
  ACTIONS,
  PERMISSIONS,
  can,
  inScope,
  isValidScope,
  type Action,
} from "@/lib/permissions/matrix";
import { accessForPath, isPublicPath, navItemsFor, requiredActionForPath, type RouteRule } from "@/lib/permissions/routes";

/** The spec section 7 table, written out by hand. The code must match it exactly. */
const EXPECTED: Record<(typeof ROLES)[number], readonly Action[]> = {
  viewer: ["view"],
  responder: [
    "view",
    "change_status",
    "add_note",
    "pass_on",
    "create_water_point",
    "verify_water_point",
    "edit_water_point",
    "place_pin",
    "merge_water_points",
  ],
  org_admin: [...ACTIONS],
};

describe("permission matrix", () => {
  it("matches the spec for every role and every action", () => {
    for (const role of ROLES) {
      for (const action of ACTIONS) {
        expect(can(role, action), `${role} / ${action}`).toBe(EXPECTED[role].includes(action));
      }
    }
  });

  it("Viewer is refused every action except view", () => {
    for (const action of ACTIONS.filter((a) => a !== "view")) expect(can("viewer", action), action).toBe(false);
    expect(can("viewer", "view")).toBe(true);
  });

  it("Responder cannot manage partners, regions or users; Org Admin can", () => {
    for (const action of ["manage_partners", "manage_regions", "manage_users"] as const) {
      expect(can("responder", action)).toBe(false);
      expect(can("org_admin", action)).toBe(true);
    }
  });

  it("every role has an entry and every listed permission is a known action", () => {
    expect(Object.keys(PERMISSIONS).sort()).toEqual([...ROLES].sort());
    for (const role of ROLES) for (const a of PERMISSIONS[role]) expect(ACTIONS).toContain(a);
  });

  it("denies unknown, missing or malformed roles", () => {
    const bad: unknown[] = [undefined, null, "", " ", "admin", "ORG_ADMIN", "org_admin ", "owner", 0, 1, true, {}, [], ["viewer"], "__proto__", "constructor", "toString"];
    for (const role of bad) for (const action of ACTIONS) expect(can(role, action), String(role)).toBe(false);
  });

  it("denies unknown, missing or malformed actions, even for Org Admin", () => {
    const bad: unknown[] = [undefined, null, "", "delete_everything", "VIEW", "view ", "export_data", 0, {}, [], "__proto__", "constructor", "hasOwnProperty"];
    for (const action of bad) for (const role of ROLES) expect(can(role, action), String(action)).toBe(false);
  });
});

describe("scope", () => {
  const scope = { organizationId: "org-a", regionIds: ["r1", "r2"] };

  it("allows a record in the same organization and one of the regions", () => {
    expect(inScope(scope, { organizationId: "org-a", regionId: "r1" })).toBe(true);
    expect(inScope(scope, { organizationId: "org-a", regionId: "r2" })).toBe(true);
  });

  it("refuses another organization, even with a matching region id", () => {
    expect(inScope(scope, { organizationId: "org-b", regionId: "r1" })).toBe(false);
  });

  it("refuses another region in the same organization", () => {
    expect(inScope(scope, { organizationId: "org-a", regionId: "r3" })).toBe(false);
  });

  it("refuses when the scope has no regions or is malformed", () => {
    const record = { organizationId: "org-a", regionId: "r1" };
    const badScopes: unknown[] = [
      undefined,
      null,
      "org-a",
      [],
      {},
      { organizationId: "org-a" },
      { organizationId: "org-a", regionIds: [] },
      { organizationId: "", regionIds: ["r1"] },
      { organizationId: "org-a", regionIds: [""] },
      { organizationId: "org-a", regionIds: [1] },
      { organizationId: "org-a", regionIds: "r1" },
      { organizationId: 1, regionIds: ["r1"] },
    ];
    for (const s of badScopes) expect(inScope(s, record), JSON.stringify(s)).toBe(false);
    for (const s of badScopes) expect(isValidScope(s)).toBe(false);
  });

  it("refuses when the record is missing an organization or region", () => {
    const badRecords: unknown[] = [undefined, null, "r1", [], {}, { organizationId: "org-a" }, { regionId: "r1" }, { organizationId: "", regionId: "r1" }, { organizationId: "org-a", regionId: "" }];
    for (const r of badRecords) expect(inScope(scope, r), JSON.stringify(r)).toBe(false);
  });
});

describe("routes and navigation", () => {
  it("public paths are exact matches only", () => {
    expect(isPublicPath("/sign-in")).toBe(true);
    expect(isPublicPath("/sign-in/")).toBe(true);
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/sign-in/extra")).toBe(false);
    expect(isPublicPath("/complaints")).toBe(false);
  });

  it("every role may open the view routes; unknown roles may not", () => {
    for (const role of ROLES) {
      expect(accessForPath("/complaints", role)).toBe("allowed");
      expect(accessForPath("/complaints/c-1", role)).toBe("allowed");
      expect(accessForPath("/map", role)).toBe("allowed");
    }
    for (const role of [undefined, null, "", "admin", 1]) expect(accessForPath("/complaints", role)).toBe("denied");
  });

  it("a route that is not listed is denied, even for Org Admin", () => {
    for (const path of ["/admin", "/users", "/complaintsx", "/Complaints", "/map/../admin", "//map", "/complaints//x", "/api/secret"]) {
      expect(accessForPath(path, "org_admin"), path).toBe("denied");
    }
  });

  it("query strings and hashes do not change the decision", () => {
    expect(requiredActionForPath("/complaints?x=1#top")).toBe("view");
    expect(accessForPath("/admin?next=/complaints", "org_admin")).toBe("denied");
  });

  it("navigation is derived from the same rules that guard the routes", () => {
    const rules: RouteRule[] = [
      { path: "/complaints", action: "view", navLabelKey: "nav.complaints" },
      { path: "/people", action: "manage_users", navLabelKey: "nav.map" },
      { path: "/hidden", action: "view" },
    ];
    expect(navItemsFor("viewer", rules).map((i) => i.href)).toEqual(["/complaints"]);
    expect(navItemsFor("responder", rules).map((i) => i.href)).toEqual(["/complaints"]);
    expect(navItemsFor("org_admin", rules).map((i) => i.href)).toEqual(["/complaints", "/people"]);
    expect(navItemsFor(undefined, rules)).toEqual([]);
    expect(navItemsFor("owner", rules)).toEqual([]);
  });

  it("a link is shown only if its route would be allowed", () => {
    for (const role of [...ROLES, "nobody"]) {
      for (const item of navItemsFor(role)) expect(accessForPath(item.href, role), `${role} ${item.href}`).toBe("allowed");
    }
  });
});
