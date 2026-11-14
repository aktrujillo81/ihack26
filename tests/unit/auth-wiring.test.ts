/**
 * The session wiring: Better Auth's session, then the D1 `users` row, through
 * A1's adapter (lib/auth/adapter.ts), then `sessionFromUser` and `parseSession`.
 * Better Auth and the database are mocked, so no test here can reach a database.
 * The adapter itself is Asher's (A1); these tests prove what it hands to the app
 * is refused or accepted the way the app requires.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findStaffUser: vi.fn(),
  hasActiveAccess: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({ getAuth: () => ({ api: { getSession: mocks.getSession } }) }));
vi.mock("@/lib/auth/users", () => ({ findStaffUser: mocks.findStaffUser, hasActiveAccess: mocks.hasActiveAccess }));
vi.mock("next/headers", () => ({ headers: mocks.headers, cookies: vi.fn() }));

import { getSessionFromHeaders } from "@/lib/auth/adapter";
import { getCurrentSession, parseSession } from "@/lib/auth/session";
import { MAX_SESSION_LIFETIME_MS } from "@/lib/auth/session";
import { SESSION_LIFETIME_SECONDS } from "@/lib/config/auth";

const ORG = "0b6f1d1e-0000-4000-8000-0000000000a1";
const REGION = "0b6f1d1e-0000-4000-8000-0000000000b1";
const STAFF_ID = "0b6f1d1e-0000-4000-8000-000000000001";
const AUTH_USER_ID = "auth-user-id-from-better-auth";

const hoursFromNow = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000);
const row = (over: Record<string, unknown> = {}) => ({ id: STAFF_ID, organizationId: ORG, regionId: REGION, role: "responder", active: true, ...over });
const authSession = (expiresAt: unknown = hoursFromNow(6), user: Record<string, unknown> = {}) => ({
  user: { id: AUTH_USER_ID, ...user },
  session: { expiresAt },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers({ cookie: "better-auth.session_token=abc" }));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("the 12-hour value has one source", () => {
  it("the cap parseSession enforces is the value Better Auth is configured with", () => {
    expect(MAX_SESSION_LIFETIME_MS).toBe(SESSION_LIFETIME_SECONDS * 1000);
    expect(MAX_SESSION_LIFETIME_MS).toBe(12 * 60 * 60 * 1000);
  });
});

describe("a valid Better Auth session plus an active D1 user gives a session", () => {
  it("returns the staff row's id, role, organization and one region, which parseSession accepts", async () => {
    mocks.getSession.mockResolvedValue(authSession());
    mocks.findStaffUser.mockResolvedValue(row());
    const raw = await getSessionFromHeaders(new Headers());
    const session = parseSession(raw);
    expect(session).toMatchObject({ userId: STAFF_ID, role: "responder", organizationId: ORG, regionIds: [REGION] });
    expect(mocks.findStaffUser).toHaveBeenCalledWith(AUTH_USER_ID);
  });

  it("reads the session row every time: cookie cache and refresh are off", async () => {
    mocks.getSession.mockResolvedValue(authSession());
    mocks.findStaffUser.mockResolvedValue(row());
    await getSessionFromHeaders(new Headers());
    expect(mocks.getSession.mock.calls[0][0].query).toEqual({ disableCookieCache: true, disableRefresh: true });
  });

  it("role, organization and region come from the database row, never from the Better Auth user", async () => {
    mocks.getSession.mockResolvedValue(authSession(hoursFromNow(6), { role: "org_admin", organizationId: "other-org", regionId: "other-region" }));
    mocks.findStaffUser.mockResolvedValue(row({ role: "viewer" }));
    const session = parseSession(await getSessionFromHeaders(new Headers()));
    expect(session?.role).toBe("viewer");
    expect(session?.organizationId).toBe(ORG);
    expect(session?.regionIds).toEqual([REGION]);
  });
});

describe("anything unclear is refused (fails closed)", () => {
  const cases: [string, () => void][] = [
    ["no Better Auth session (no cookie, forged cookie or signed out)", () => mocks.getSession.mockResolvedValue(null)],
    ["no staff row for the user", () => {
      mocks.getSession.mockResolvedValue(authSession());
      mocks.findStaffUser.mockResolvedValue(null);
    }],
    ["an inactive user", () => {
      mocks.getSession.mockResolvedValue(authSession());
      mocks.findStaffUser.mockResolvedValue(row({ active: false }));
    }],
    ["an unknown role", () => {
      mocks.getSession.mockResolvedValue(authSession());
      mocks.findStaffUser.mockResolvedValue(row({ role: "superuser" }));
    }],
    ["a missing role", () => {
      mocks.getSession.mockResolvedValue(authSession());
      mocks.findStaffUser.mockResolvedValue(row({ role: undefined }));
    }],
    ["a missing region", () => {
      mocks.getSession.mockResolvedValue(authSession());
      mocks.findStaffUser.mockResolvedValue(row({ regionId: null }));
    }],
    ["an expired session", () => {
      mocks.getSession.mockResolvedValue(authSession(hoursFromNow(-1)));
      mocks.findStaffUser.mockResolvedValue(row());
    }],
    ["a session expiring right now", () => {
      mocks.getSession.mockResolvedValue(authSession(new Date()));
      mocks.findStaffUser.mockResolvedValue(row());
    }],
    ["a session claiming more than 12 hours", () => {
      mocks.getSession.mockResolvedValue(authSession(hoursFromNow(13)));
      mocks.findStaffUser.mockResolvedValue(row());
    }],
    ["a session with no expiry", () => {
      // Built by hand: a default parameter would replace an `undefined` argument with a valid expiry.
      mocks.getSession.mockResolvedValue({ user: { id: AUTH_USER_ID }, session: {} });
      mocks.findStaffUser.mockResolvedValue(row());
    }],
    ["a session whose expiry is not a date", () => {
      mocks.getSession.mockResolvedValue({ user: { id: AUTH_USER_ID }, session: { expiresAt: "tomorrow" } });
      mocks.findStaffUser.mockResolvedValue(row());
    }],
    ["Better Auth throwing", () => mocks.getSession.mockRejectedValue(new Error("db down"))],
    ["the user lookup throwing", () => {
      mocks.getSession.mockResolvedValue(authSession());
      mocks.findStaffUser.mockRejectedValue(new Error("db down"));
    }],
  ];

  for (const [name, arrange] of cases) {
    it(`refuses ${name}`, async () => {
      arrange();
      expect(parseSession(await getSessionFromHeaders(new Headers()))).toBeNull();
    });
  }

  it("an error never leaks details to the log", async () => {
    mocks.getSession.mockRejectedValue(new Error("postgres://user:secret@host/db"));
    await getSessionFromHeaders(new Headers());
    expect(JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls)).not.toContain("secret");
  });
});

describe("getCurrentSession reads the current request", () => {
  it("returns the session for a valid cookie", async () => {
    mocks.getSession.mockResolvedValue(authSession());
    mocks.findStaffUser.mockResolvedValue(row({ role: "org_admin" }));
    expect(parseSession(await getCurrentSession())?.role).toBe("org_admin");
  });

  it("returns null with no session, an inactive user, an archived region, or any error", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect(await getCurrentSession()).toBeNull();

    mocks.getSession.mockResolvedValue(authSession());
    mocks.findStaffUser.mockResolvedValue(row({ active: false }));
    expect(parseSession(await getCurrentSession())).toBeNull();

    mocks.findStaffUser.mockResolvedValue(null); // archived region or organization, or no row
    expect(parseSession(await getCurrentSession())).toBeNull();

    mocks.headers.mockRejectedValue(new Error("no request scope"));
    expect(await getCurrentSession()).toBeNull();
  });

  it("has no mock user: with nothing to read it returns nothing, whatever the environment", async () => {
    mocks.getSession.mockResolvedValue(null);
    for (const env of ["development", "test", "production"]) {
      vi.stubEnv("NODE_ENV", env);
      expect(await getCurrentSession(), env).toBeNull();
    }
    vi.unstubAllEnvs();
  });
});
