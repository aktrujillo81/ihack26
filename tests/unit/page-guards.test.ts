/**
 * Every protected page validates the session itself (the proxy and the layout
 * are not enough). Better Auth and the database are mocked, so nothing here can
 * reach a database.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readSessionFromHeaders: vi.fn(),
  cookieNames: new Set<string>(),
  redirect: vi.fn((to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { to });
  }),
  notFound: vi.fn(() => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true });
  }),
}));

vi.mock("@/lib/auth/adapter", () => ({ readSessionFromHeaders: mocks.readSessionFromHeaders, signInWithPassword: vi.fn() }));
vi.mock("@/lib/auth/sign-out", () => ({ signOutAction: vi.fn() }));
vi.mock("@/lib/data/complaints", async () => await import("@/tests/fixtures/mock-data-layer"));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ has: (name: string) => mocks.cookieNames.has(name) }),
  headers: async () => new Headers(),
}));

import DashboardLayout from "@/app/(dashboard)/layout";
import ComplaintsPage from "@/app/(dashboard)/complaints/page";
import ComplaintDetailPage from "@/app/(dashboard)/complaints/[id]/page";
import SignedInMapPage from "@/app/(dashboard)/dashboard/map/page";
import HomePage from "@/app/page";
import SignInPage from "@/app/(auth)/sign-in/page";
import { AppNav } from "@/components/nav/AppNav";
import { requirePageSession } from "@/lib/auth/page-guard";
import { ComplaintListView } from "@/components/complaints/ComplaintListView";
import { listComplaints } from "@/lib/data/complaints";
import { MOCK_CONTEXT } from "@/tests/fixtures/mock-data-layer";
import { ROLES } from "@/lib/domain/types";
import { t } from "@/lib/i18n/strings";

const hoursFromNow = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
const session = (over: Record<string, unknown> = {}) => ({
  userId: "u-1",
  role: "responder",
  organizationId: MOCK_CONTEXT.organizationId,
  regionIds: [...MOCK_CONTEXT.regionIds],
  expiresAt: hoursFromNow(6),
  ...over,
});

/** Calls an async function and returns the redirect target it threw, or "rendered" if it returned. */
async function outcome(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "rendered";
  } catch (e) {
    const to = (e as { to?: string }).to;
    if (to) return `redirect:${to}`;
    if ((e as { notFound?: boolean }).notFound) return "notFound";
    throw e;
  }
}

const detailArgs = { params: Promise.resolve({ id: "c-1" }) };
const protectedPages: [string, () => Promise<unknown>][] = [
  ["/complaints", () => ComplaintsPage()],
  ["/complaints/[id]", () => ComplaintDetailPage(detailArgs)],
  ["/dashboard/map", () => SignedInMapPage()],
  ["the protected layout", () => DashboardLayout({ children: createElement("div") })],
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookieNames.clear();
});

describe("unauthenticated users are redirected from every protected route", () => {
  for (const [name, call] of protectedPages) {
    it(`${name}: no session and no cookie goes to plain /sign-in`, async () => {
      mocks.readSessionFromHeaders.mockResolvedValue(null);
      expect(await outcome(call)).toBe("redirect:/sign-in");
    });

    it(`${name}: a cookie that is no longer valid goes to /sign-in with the session-ended message`, async () => {
      mocks.cookieNames.add("better-auth.session_token");
      mocks.readSessionFromHeaders.mockResolvedValue(null);
      expect(await outcome(call)).toBe("redirect:/sign-in?reason=expired");
      mocks.cookieNames.clear();
      mocks.cookieNames.add("__Secure-better-auth.session_token");
      expect(await outcome(call)).toBe("redirect:/sign-in?reason=expired");
    });

    it(`${name}: expired, over-long, inactive-looking or malformed sessions are refused`, async () => {
      const bad: unknown[] = [
        session({ expiresAt: hoursFromNow(-1) }),
        session({ expiresAt: hoursFromNow(13) }),
        session({ expiresAt: undefined }),
        session({ role: "superuser" }),
        session({ role: undefined }),
        session({ regionIds: [] }),
        session({ organizationId: "" }),
        "a-token",
        [],
        {},
      ];
      for (const raw of bad) {
        mocks.readSessionFromHeaders.mockResolvedValue(raw);
        expect(await outcome(call), JSON.stringify(raw)).toMatch(/^redirect:\/sign-in/);
      }
    });

    it(`${name}: reading the session failing is a refusal, never a pass`, async () => {
      mocks.readSessionFromHeaders.mockRejectedValue(new Error("db down"));
      expect(await outcome(call)).toBe("redirect:/sign-in");
    });

    it(`${name}: a valid session is let in`, async () => {
      mocks.readSessionFromHeaders.mockResolvedValue(session());
      expect(await outcome(call)).toBe("rendered");
    });
  }

  it("a forged cookie passes the proxy but not the page: the cookie alone proves nothing", async () => {
    mocks.cookieNames.add("better-auth.session_token");
    mocks.readSessionFromHeaders.mockResolvedValue(null); // Better Auth found no such session
    for (const [name, call] of protectedPages) expect(await outcome(call), name).toBe("redirect:/sign-in?reason=expired");
  });
});

describe("the sign-in page and the home page", () => {
  const args = { searchParams: Promise.resolve({}) };

  it("an anonymous user sees the sign-in form; a signed-in user goes to the list", async () => {
    mocks.readSessionFromHeaders.mockResolvedValue(null);
    expect(await outcome(() => SignInPage(args))).toBe("rendered");
    mocks.readSessionFromHeaders.mockResolvedValue(session());
    expect(await outcome(() => SignInPage(args))).toBe("redirect:/complaints");
  });

  it("an invalid session on the sign-in page is treated as signed out", async () => {
    mocks.readSessionFromHeaders.mockResolvedValue(session({ expiresAt: hoursFromNow(-2) }));
    expect(await outcome(() => SignInPage(args))).toBe("rendered");
  });

  it("the home page sends everyone to a fixed place", async () => {
    mocks.readSessionFromHeaders.mockResolvedValue(null);
    expect(await outcome(() => HomePage())).toBe("redirect:/sign-in");
    mocks.readSessionFromHeaders.mockResolvedValue(session());
    expect(await outcome(() => HomePage())).toBe("redirect:/complaints");
  });
});

describe("the protected layout and navigation", () => {
  it("every role gets the Complaints and Map links, pointing at the signed-in routes, plus sign-out", () => {
    for (const role of ROLES) {
      const html = renderToStaticMarkup(createElement(AppNav, { role }));
      expect(html, role).toContain(`href="/complaints"`);
      expect(html, role).toContain(`href="/dashboard/map"`);
      expect(html, role).not.toContain(`href="/map"`);
      expect(html, role).toContain(t("nav.signOut"));
      expect(html, role).toContain(t("nav.complaints"));
    }
  });

  it("no link points at a page that does not exist yet", () => {
    const html = renderToStaticMarkup(createElement(AppNav, { role: "org_admin" }));
    expect(html).not.toContain("needs-review");
    expect(html).not.toContain("needs-location");
  });

  it("an unknown or missing role gets no links (default deny)", () => {
    for (const role of [undefined, null, "", "admin", 1]) {
      const html = renderToStaticMarkup(createElement(AppNav, { role }));
      expect(html, String(role)).not.toContain("<a ");
    }
  });

  it("the layout takes its role from the validated session", async () => {
    mocks.readSessionFromHeaders.mockResolvedValue(session({ role: "viewer" }));
    const element = (await DashboardLayout({ children: createElement("div") })) as { props: { children: { props: { role: string } }[] } };
    expect(element.props.children[0].props.role).toBe("viewer");
  });
});

describe("the list links each row to its detail page", () => {
  it("renders one detail link per complaint, with the id encoded", async () => {
    const result = await listComplaints(MOCK_CONTEXT);
    if (result.status !== "ok") throw new Error("expected data");
    const html = renderToStaticMarkup(createElement(ComplaintListView, { result }));
    for (const { complaint } of result.data) expect(html).toContain(`href="/complaints/${encodeURIComponent(complaint.id)}"`);
    expect((html.match(/href="\/complaints\//g) ?? []).length).toBe(result.data.length);
  });

  it("an id with odd characters can not break out of the link", () => {
    const base = { complaint: { id: 'x"><script>', status: "open", problem: "broken", peopleAffected: 1, servesSchoolOrClinic: false, duration: "today", reportCount: 1, priorityScore: 1, scoreReason: "r", needsReview: false, needsReviewReason: null, passedOnPartnerId: null, organizationId: "o", regionId: "r", waterPointId: "w", createdAt: "2026-11-13T10:00:00Z", updatedAt: "2026-11-13T10:00:00Z" }, waterPoint: null };
    const html = renderToStaticMarkup(createElement(ComplaintListView, { result: { status: "ok", data: [base as never] } }));
    expect(html).not.toContain("<script>");
    expect(html).toContain(encodeURIComponent('x"><script>'));
  });
});

/** Every page and route handler under app/, so a new one can not be added unguarded by accident. */
describe("every page and route in app/ is guarded or on an explicit list", () => {
  const APP = "app";
  function files(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) files(full, out);
      else if (/^(page|route)\.tsx?$/.test(name)) out.push(relative(".", full).split(sep).join("/"));
    }
    return out;
  }
  const all = files(APP);

  /** Public on purpose, or authenticating itself. Anything else must call requirePageSession. */
  const EXPLICIT: Record<string, string> = {
    "app/page.tsx": "redirects by session; shows nothing (uses getOptionalSession)",
    "app/(auth)/sign-in/page.tsx": "public sign-in page",
    "app/map/page.tsx": "public status-only map (PROPOSED, not approved)",
    "app/api/health/route.ts": "public health check",
    "app/api/auth/[...all]/route.ts": "Better Auth, deny-by-default allowlist (A1)",
    "app/api/vapi/webhook/route.ts": "Vapi webhook, shared secret",
  };

  it("finds the pages we expect", () => {
    expect(all).toContain("app/(dashboard)/complaints/page.tsx");
    expect(all).toContain("app/(dashboard)/complaints/[id]/page.tsx");
    expect(all).toContain("app/(dashboard)/dashboard/map/page.tsx");
  });

  it("every page under (dashboard) calls requirePageSession itself", () => {
    const dashboard = all.filter((f) => f.startsWith("app/(dashboard)/") && f.endsWith("page.tsx"));
    expect(dashboard.length).toBeGreaterThan(0);
    for (const file of dashboard) expect(readFileSync(file, "utf8"), file).toMatch(/await requirePageSession\(\)/);
  });

  it("the layout also checks, and the list of exceptions has not grown without a decision", () => {
    expect(readFileSync("app/(dashboard)/layout.tsx", "utf8")).toMatch(/await requirePageSession\(\)/);
    const unguarded = all.filter((f) => !f.startsWith("app/(dashboard)/"));
    expect(unguarded.sort()).toEqual(Object.keys(EXPLICIT).sort());
  });

  it("no route handler or page outside the explicit list exists", () => {
    for (const file of all) {
      if (file.startsWith("app/(dashboard)/")) continue;
      expect(Object.keys(EXPLICIT), file).toContain(file);
    }
  });
});

describe("the page guard enforces the permission, not only the sign-in", () => {
  it("a valid session whose role lacks the permission gets 'not found', the same as a page that does not exist", async () => {
    // Every role has `view` today, so ask for an action a Viewer lacks, as a future route rule could.
    mocks.readSessionFromHeaders.mockResolvedValue(session({ role: "viewer" }));
    expect(await outcome(() => requirePageSession("manage_users"))).toBe("notFound");
    expect(await outcome(() => requirePageSession("change_status"))).toBe("notFound");
    expect(await outcome(() => requirePageSession("view"))).toBe("rendered");
    expect(await outcome(() => requirePageSession())).toBe("rendered");
  });

  it("a Responder lacks the admin actions, an Org Admin has them", async () => {
    mocks.readSessionFromHeaders.mockResolvedValue(session({ role: "responder" }));
    expect(await outcome(() => requirePageSession("manage_users"))).toBe("notFound");
    expect(await outcome(() => requirePageSession("change_status"))).toBe("rendered");
    mocks.readSessionFromHeaders.mockResolvedValue(session({ role: "org_admin" }));
    expect(await outcome(() => requirePageSession("manage_users"))).toBe("rendered");
  });

  it("no valid session still redirects, never 'not found', whatever the action", async () => {
    mocks.readSessionFromHeaders.mockResolvedValue(null);
    expect(await outcome(() => requirePageSession("manage_users"))).toBe("redirect:/sign-in");
  });

  it("an unknown action is refused", async () => {
    mocks.readSessionFromHeaders.mockResolvedValue(session({ role: "org_admin" }));
    expect(await outcome(() => requirePageSession("delete_everything" as never))).toBe("notFound");
  });
});
