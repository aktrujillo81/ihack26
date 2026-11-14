import { spawnSync } from "node:child_process";

import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { GET, POST } from "@/app/api/auth/[...all]/route";
import { getSessionFromHeaders, signInWithPassword } from "@/lib/auth/adapter";
import { deleteExpiredSessions } from "@/lib/auth/session-cleanup";
import { getAuth } from "@/lib/auth/server";
import { parseSession } from "@/lib/auth/session";
import { SESSION_LIFETIME_SECONDS } from "@/lib/config/auth";
import { getDb } from "@/lib/db";
import { authSession, authUser, organizations, regions, users } from "@/lib/db/schema";
import {
  BASE,
  PASSWORD,
  addStaff,
  cookieHeaderFrom,
  createAuthUser,
  createMember,
  createOrg,
  freshIp,
  resetDb,
  signInRequest,
} from "./helpers";

beforeEach(resetDb);

async function signInOverHttp(email: string, password = PASSWORD, ip = freshIp()) {
  const res = await POST(signInRequest(email, password, ip));
  return { res, cookie: cookieHeaderFrom(res) };
}

const withCookie = (cookie: string) => new Headers({ cookie });

/** Postgres error code from a failed Drizzle query (the cause carries it). */
async function pgErrorCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } };
    return e.cause?.code ?? e.code;
  }
}

describe("sign-in and session read", () => {
  it("signs in over HTTP and the adapter returns the session shape", async () => {
    const { authUser: au, staff, org, region } = await createMember("responder@example.com", "responder");
    const ip = freshIp();
    const { res, cookie } = await signInOverHttp("responder@example.com", PASSWORD, ip);
    expect(res.status).toBe(200);
    expect(cookie).toContain("better-auth.session_token=");
    // The token travels only in the HttpOnly cookie, never in the body.
    const body = await res.json();
    expect(body).not.toHaveProperty("token");
    expect(body.user.email).toBe("responder@example.com");
    expect(JSON.stringify(body)).not.toContain(cookie.split("=")[1].split(".")[0]);
    expect(res.headers.getSetCookie().join(";")).not.toContain("session_data");
    // Cookie attributes (http in tests, so no Secure here; see the https test below).
    const setCookie = res.headers.getSetCookie().find((c) => c.startsWith("better-auth.session_token="))!;
    const attrs = setCookie.split(";").slice(1).map((a) => a.trim().toLowerCase());
    expect(attrs).toEqual(expect.arrayContaining(["httponly", "samesite=lax", "path=/", `max-age=${SESSION_LIFETIME_SECONDS}`]));
    expect(attrs).not.toContain("secure");

    const s = (await getSessionFromHeaders(withCookie(cookie))) as Record<string, unknown>;
    expect(s).toEqual({
      userId: staff.id, // the D1 users.id, not the Better Auth id
      role: "responder",
      organizationId: org.id,
      regionIds: [region.id],
      expiresAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    });
    // W1's parseSession accepts it unchanged.
    expect(parseSession(s)).toEqual(s);
    const lifetimeMs = Date.parse(s.expiresAt as string) - Date.now();
    expect(lifetimeMs).toBeGreaterThan(0);
    expect(lifetimeMs).toBeLessThanOrEqual(SESSION_LIFETIME_SECONDS * 1000);
    expect(lifetimeMs).toBeGreaterThan(SESSION_LIFETIME_SECONDS * 1000 - 60_000);

    // The session row holds the staff member's IP (from cf-connecting-ip) and user agent.
    const [row] = await getDb().select().from(authSession).where(eq(authSession.userId, au.id));
    expect(row.ipAddress).toBe(ip);
    expect(row.userAgent).toBe("vitest");
  });

  it("returns null with no cookie, a forged cookie, or a malformed cookie", async () => {
    await createMember("a@example.com");
    expect(await getSessionFromHeaders(new Headers())).toBeNull();
    expect(await getSessionFromHeaders(withCookie("better-auth.session_token=abc.def"))).toBeNull();
    expect(await getSessionFromHeaders(withCookie("better-auth.session_token=%%%"))).toBeNull();
  });

  it("sign-out deletes the session row and the old cookie stops working", async () => {
    const { authUser: u } = await createMember("b@example.com");
    const { cookie } = await signInOverHttp("b@example.com");
    expect(await getSessionFromHeaders(withCookie(cookie))).not.toBeNull();

    const out = await POST(
      new Request(`${BASE}/api/auth/sign-out`, { method: "POST", headers: { cookie, origin: BASE } }),
    );
    expect(out.status).toBe(200);
    expect(await getDb().select().from(authSession).where(eq(authSession.userId, u.id))).toHaveLength(0);
    expect(await getSessionFromHeaders(withCookie(cookie))).toBeNull();
  });

  it("an expired session is refused", async () => {
    const { authUser: u } = await createMember("c@example.com");
    const { cookie } = await signInOverHttp("c@example.com");
    await getDb()
      .update(authSession)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(authSession.userId, u.id));
    expect(await getSessionFromHeaders(withCookie(cookie))).toBeNull();
  });
});

describe("cookie on https", () => {
  it("BETTER_AUTH_URL https: __Secure- prefix with Secure, HttpOnly, SameSite=Lax, Path=/", async () => {
    const g = globalThis as unknown as { wellWatchAuth?: unknown };
    const savedAuth = g.wellWatchAuth;
    const savedUrl = process.env.BETTER_AUTH_URL;
    const httpsBase = "https://wellwatch.example.com";
    try {
      process.env.BETTER_AUTH_URL = httpsBase;
      g.wellWatchAuth = undefined; // a fresh Better Auth instance with the https URL
      await createMember("https@example.com");
      const res = await POST(
        new Request(`${httpsBase}/api/auth/sign-in/email`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: httpsBase, "cf-connecting-ip": freshIp() },
          body: JSON.stringify({ email: "https@example.com", password: PASSWORD }),
        }),
      );
      expect(res.status).toBe(200);
      const setCookie = res.headers.getSetCookie().find((c) => c.startsWith("__Secure-better-auth.session_token="));
      expect(setCookie).toBeDefined();
      const attrs = setCookie!.split(";").slice(1).map((a) => a.trim().toLowerCase());
      expect(attrs).toEqual(expect.arrayContaining(["secure", "httponly", "samesite=lax", "path=/"]));
    } finally {
      process.env.BETTER_AUTH_URL = savedUrl;
      g.wellWatchAuth = savedAuth;
    }
  });
});

describe("D1 users row: access rules", () => {
  const h = () => new Headers({ "cf-connecting-ip": freshIp() });

  it.each(["org_admin", "responder", "viewer"] as const)("%s: adapter output is accepted by parseSession", async (role) => {
    const { staff, org, region } = await createMember(`${role}@example.com`, role);
    const { cookie } = await signInOverHttp(`${role}@example.com`);
    const s = await getSessionFromHeaders(withCookie(cookie));
    expect(parseSession(s)).toEqual({
      userId: staff.id,
      role,
      organizationId: org.id,
      regionIds: [region.id],
      expiresAt: expect.any(String),
    });
  });

  it("no users row: sign-in is refused after the password check, adapter gives no_region", async () => {
    await createAuthUser("nostaff@example.com");
    const http = await signInOverHttp("nostaff@example.com");
    expect(http.res.status).toBe(401);
    expect(http.cookie).toBe("");
    expect(await signInWithPassword("nostaff@example.com", PASSWORD, h())).toBe("no_region");
    // Wrong password for the same account is "invalid", not "no_region".
    expect(await signInWithPassword("nostaff@example.com", "wrong password 123", h())).toBe("invalid");
  });

  it("inactive user: no session at sign-in (no_region), and an existing session is refused", async () => {
    const { staff } = await createMember("inactive@example.com");
    const { cookie } = await signInOverHttp("inactive@example.com");
    expect(await getSessionFromHeaders(withCookie(cookie))).not.toBeNull();
    await getDb().update(users).set({ active: false }).where(eq(users.id, staff.id));
    expect(await getSessionFromHeaders(withCookie(cookie))).toBeNull();
    expect(await signInWithPassword("inactive@example.com", PASSWORD, h())).toBe("no_region");
  });

  it("archived region or archived organization: refused at sign-in and on the next request", async () => {
    const { region, org } = await createMember("arch@example.com");
    const { cookie } = await signInOverHttp("arch@example.com");
    expect(await getSessionFromHeaders(withCookie(cookie))).not.toBeNull();

    await getDb().update(regions).set({ archivedAt: new Date() }).where(eq(regions.id, region.id));
    expect(await getSessionFromHeaders(withCookie(cookie))).toBeNull();
    expect(await signInWithPassword("arch@example.com", PASSWORD, h())).toBe("no_region");

    await getDb().update(regions).set({ archivedAt: null }).where(eq(regions.id, region.id));
    expect(await getSessionFromHeaders(withCookie(cookie))).not.toBeNull();

    await getDb().update(organizations).set({ archivedAt: new Date() }).where(eq(organizations.id, org.id));
    expect(await getSessionFromHeaders(withCookie(cookie))).toBeNull();
    expect(await signInWithPassword("arch@example.com", PASSWORD, h())).toBe("no_region");
  });

  it("a role change and a deactivation show on the very next request (read from the DB every time)", async () => {
    const { staff } = await createMember("f@example.com", "responder");
    const { cookie } = await signInOverHttp("f@example.com");
    await getDb().update(users).set({ role: "viewer" }).where(eq(users.id, staff.id));
    expect(await getSessionFromHeaders(withCookie(cookie))).toMatchObject({ role: "viewer" });
    await getDb().update(users).set({ active: false }).where(eq(users.id, staff.id));
    expect(await getSessionFromHeaders(withCookie(cookie))).toBeNull();
  });

  it("a users row with a region from another organization cannot exist (D1 composite FK)", async () => {
    const { org } = await createOrg("Org X");
    const { region: otherRegion } = await createOrg("Org Y");
    const au = await createAuthUser("cross@example.com");
    const code = await pgErrorCode(addStaff(au.id, org.id, otherRegion.id, "viewer", "cross@example.com"));
    expect(code).toBe("23503"); // foreign_key_violation
  });

  it("the auth_subject link is unique (D1 index), so one Better Auth user maps to at most one staff row", async () => {
    const { authUser: au } = await createMember("dup@example.com");
    const { org, region } = await createOrg("Org D");
    const code = await pgErrorCode(addStaff(au.id, org.id, region.id, "viewer", "dup@example.com"));
    expect(code).toBe("23505"); // unique_violation
  });

  it("the DB refuses an unknown role", async () => {
    const { org, region } = await createOrg("Org R");
    const au = await createAuthUser("role@example.com");
    const code = await pgErrorCode(
      getDb().execute(
        sql`insert into users (organization_id, region_id, auth_subject, email, display_name, role) values (${org.id}, ${region.id}, ${au.id}, 'role@example.com', 'x', 'owner')`,
      ),
    );
    expect(code).toBe("22P02"); // invalid_text_representation (enum)
  });
});

describe("refused and unused endpoints", () => {
  it("POST /api/auth/sign-up/email is refused and creates no user", async () => {
    const res = await POST(
      new Request(`${BASE}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE },
        body: JSON.stringify({ email: "new@example.com", password: PASSWORD, name: "New" }),
      }),
    );
    expect(res.status).toBe(404);
    // Direct server calls are refused too (disableSignUp).
    await expect(
      getAuth().api.signUpEmail({ body: { email: "new@example.com", password: PASSWORD, name: "New" } }),
    ).rejects.toThrow();
    expect(await getDb().select().from(authUser).where(eq(authUser.email, "new@example.com"))).toHaveLength(0);
  });

  it.each([
    ["POST", "/request-password-reset"],
    ["POST", "/reset-password"],
    ["GET", "/reset-password/some-token"],
    ["POST", "/change-email"],
    ["POST", "/change-password"],
    ["POST", "/delete-user"],
    ["POST", "/update-user"],
    ["POST", "/sign-in/social"],
    ["GET", "/list-sessions"],
    ["GET", "/get-session"],
    ["GET", "/sign-in/email"],
    ["GET", "/__proto__"],
    ["GET", "/"],
  ])("%s %s answers 404", async (method, path) => {
    const res = await (method === "GET" ? GET : POST)(
      new Request(`${BASE}/api/auth${path}`, {
        method,
        headers: { "content-type": "application/json", origin: BASE },
        body: method === "POST" ? "{}" : undefined,
      }),
    );
    expect(res.status).toBe(404);
  });
});

describe("failed sign-ins", () => {
  it("untrusted Origin with a cookie gives 403, malformed email gives 400, sign-out answers success", async () => {
    await createMember("o@example.com");
    const evil = signInRequest("o@example.com", PASSWORD, freshIp());
    // Better Auth checks Origin only when the request carries a cookie (as a browser's would).
    const req = new Request(evil, {
      headers: { ...Object.fromEntries(evil.headers), origin: "https://evil.example", cookie: "x=1" },
    });
    expect((await POST(req)).status).toBe(403);
    // Preflight is not answered, so a cross-site browser cannot send JSON without a cookie either.
    expect("OPTIONS" in (await import("@/app/api/auth/[...all]/route"))).toBe(false);
    expect((await POST(signInRequest("not-an-email", PASSWORD, freshIp()))).status).toBe(400);
    const { cookie } = await signInOverHttp("o@example.com");
    const out = await POST(
      new Request(`${BASE}/api/auth/sign-out`, {
        method: "POST",
        headers: { cookie, origin: BASE, "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(await out.json()).toEqual({ success: true });
  });

  it("unknown email and wrong password give the same result on both paths", async () => {
    await createMember("known@example.com");
    const unknown = await POST(signInRequest("nobody@example.com", PASSWORD, freshIp()));
    const wrong = await POST(signInRequest("known@example.com", "not the password", freshIp()));
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(await unknown.json()).toEqual(await wrong.json());

    const h = () => new Headers({ "cf-connecting-ip": freshIp() });
    expect(await signInWithPassword("nobody@example.com", PASSWORD, h())).toBe("invalid");
    expect(await signInWithPassword("known@example.com", "not the password", h())).toBe("invalid");
    expect(await signInWithPassword(undefined, null, h())).toBe("invalid");
    expect(await signInWithPassword("not-an-email", PASSWORD, h())).toBe("invalid");
  });

  it("signInWithPassword succeeds for a member and creates one session row", async () => {
    const { authUser: u } = await createMember("ok@example.com", "org_admin");
    expect(await signInWithPassword("  OK@example.com ", PASSWORD, new Headers({ "cf-connecting-ip": freshIp() }))).toBe("ok");
    expect(await getDb().select().from(authSession).where(eq(authSession.userId, u.id))).toHaveLength(1);
  });
});

describe("rate limit (5 sign-ins per minute per IP)", () => {
  it("the 6th rapid sign-in over HTTP gets 429; another IP is unaffected", async () => {
    await createMember("rl@example.com");
    const ip = freshIp();
    for (let i = 0; i < 5; i++) {
      const res = await POST(signInRequest("rl@example.com", "wrong password!", ip));
      expect(res.status).toBe(401);
    }
    const sixth = await POST(signInRequest("rl@example.com", PASSWORD, ip));
    expect(sixth.status).toBe(429);
    const other = await POST(signInRequest("rl@example.com", PASSWORD, freshIp()));
    expect(other.status).toBe(200);
  });

  it("the 6th rapid signInWithPassword (server-action path) is rate_limited", async () => {
    await createMember("rl2@example.com");
    const ip = freshIp();
    for (let i = 0; i < 5; i++) {
      expect(await signInWithPassword("rl2@example.com", "wrong password!", new Headers({ "cf-connecting-ip": ip }))).toBe(
        "invalid",
      );
    }
    expect(await signInWithPassword("rl2@example.com", PASSWORD, new Headers({ "cf-connecting-ip": ip }))).toBe(
      "rate_limited",
    );
    expect(await signInWithPassword("rl2@example.com", PASSWORD, new Headers({ "cf-connecting-ip": freshIp() }))).toBe("ok");
  });

  it("evidence: Better Auth's own limiter does not cover direct auth.api calls (why the adapter has its own)", async () => {
    await createMember("rl3@example.com");
    const ip = freshIp();
    for (let i = 0; i < 7; i++) {
      await expect(
        getAuth().api.signInEmail({
          body: { email: "rl3@example.com", password: "wrong password!" },
          headers: new Headers({ "cf-connecting-ip": ip }),
        }),
      ).rejects.toMatchObject({ status: "UNAUTHORIZED" });
    }
  });
});

describe("expired session rows are deleted (decided by the humans)", () => {
  const expire = (userId: string) =>
    getDb().update(authSession).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(authSession.userId, userId));
  const rowsFor = (userId: string) => getDb().select().from(authSession).where(eq(authSession.userId, userId));

  it("a successful sign-in (HTTP or server action) removes every expired row, including other users'", async () => {
    const a = await createMember("exp-a@example.com");
    const b = await createMember("exp-b@example.com");
    await signInOverHttp("exp-a@example.com");
    await signInOverHttp("exp-b@example.com");
    await expire(a.authUser.id);
    await expire(b.authUser.id);

    await signInOverHttp("exp-a@example.com");
    const aRows = await rowsFor(a.authUser.id);
    expect(aRows).toHaveLength(1);
    expect(aRows[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(await rowsFor(b.authUser.id)).toHaveLength(0);

    await expire(a.authUser.id);
    expect(await signInWithPassword("exp-b@example.com", PASSWORD, new Headers({ "cf-connecting-ip": freshIp() }))).toBe("ok");
    expect(await rowsFor(a.authUser.id)).toHaveLength(0);
  });

  it("deleteExpiredSessions removes expired rows and keeps live ones", async () => {
    const a = await createMember("exp-c@example.com");
    const b = await createMember("exp-d@example.com");
    await signInOverHttp("exp-c@example.com");
    await signInOverHttp("exp-d@example.com");
    await expire(a.authUser.id);
    expect(await deleteExpiredSessions()).toBe(1);
    expect(await rowsFor(a.authUser.id)).toHaveLength(0);
    expect(await rowsFor(b.authUser.id)).toHaveLength(1);
  });

  it("npm run db:cleanup-sessions deletes expired rows and prints only a count", async () => {
    const a = await createMember("exp-e@example.com");
    await signInOverHttp("exp-e@example.com");
    await expire(a.authUser.id);
    const result = spawnSync("npm", ["run", "--silent", "db:cleanup-sessions"], {
      encoding: "utf8",
      env: { ...process.env },
      timeout: 60_000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("[db:cleanup-sessions] Deleted 1 expired session(s).");
    expect(await rowsFor(a.authUser.id)).toHaveLength(0);
  });
});
