import { spawnSync } from "node:child_process";

import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { GET, POST } from "@/app/api/auth/[...all]/route";
import { getSessionFromHeaders, signInWithPassword } from "@/lib/auth/adapter";
import { decideAccess } from "@/lib/auth/memberships";
import { deleteExpiredSessions } from "@/lib/auth/session-cleanup";
import { getAuth } from "@/lib/auth/server";
import { SESSION_LIFETIME_SECONDS } from "@/lib/config/auth";
import { getDb } from "@/lib/db";
import { membershipRegions, memberships, regions, session, user } from "@/lib/db/schema";
import {
  BASE,
  PASSWORD,
  addMembership,
  cookieHeaderFrom,
  createMember,
  createOrg,
  createUser,
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
    const { user: u, org, region } = await createMember("responder@test.example", "responder");
    const ip = freshIp();
    const { res, cookie } = await signInOverHttp("responder@test.example", PASSWORD, ip);
    expect(res.status).toBe(200);
    expect(cookie).toContain("better-auth.session_token=");
    // The token travels only in the HttpOnly cookie, never in the body.
    const body = await res.json();
    expect(body).not.toHaveProperty("token");
    expect(body.user.email).toBe("responder@test.example");
    expect(JSON.stringify(body)).not.toContain(cookie.split("=")[1].split(".")[0]);
    expect(res.headers.getSetCookie().join(";")).not.toContain("session_data");

    const s = (await getSessionFromHeaders(withCookie(cookie))) as Record<string, unknown>;
    expect(s).toEqual({
      userId: u.id,
      role: "responder",
      organizationId: org.id,
      regionIds: [region.id],
      expiresAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    });
    // auth-prep's parseSession is not on this branch yet; until it merges the shape is asserted directly.
    const lifetimeMs = Date.parse(s.expiresAt as string) - Date.now();
    expect(lifetimeMs).toBeGreaterThan(0);
    expect(lifetimeMs).toBeLessThanOrEqual(SESSION_LIFETIME_SECONDS * 1000);
    expect(lifetimeMs).toBeGreaterThan(SESSION_LIFETIME_SECONDS * 1000 - 60_000);

    // The session row holds the staff member's IP (from cf-connecting-ip) and user agent.
    const [row] = await getDb().select().from(session).where(eq(session.userId, u.id));
    expect(row.ipAddress).toBe(ip);
    expect(row.userAgent).toBe("vitest");
  });

  it("returns null with no cookie, a forged cookie, or a malformed cookie", async () => {
    await createMember("a@test.example");
    expect(await getSessionFromHeaders(new Headers())).toBeNull();
    expect(await getSessionFromHeaders(withCookie("better-auth.session_token=abc.def"))).toBeNull();
    expect(await getSessionFromHeaders(withCookie("better-auth.session_token=%%%"))).toBeNull();
  });

  it("sign-out deletes the session row and the old cookie stops working", async () => {
    const { user: u } = await createMember("b@test.example");
    const { cookie } = await signInOverHttp("b@test.example");
    expect(await getSessionFromHeaders(withCookie(cookie))).not.toBeNull();

    const out = await POST(
      new Request(`${BASE}/api/auth/sign-out`, { method: "POST", headers: { cookie, origin: BASE } }),
    );
    expect(out.status).toBe(200);
    expect(await getDb().select().from(session).where(eq(session.userId, u.id))).toHaveLength(0);
    expect(await getSessionFromHeaders(withCookie(cookie))).toBeNull();
  });

  it("an expired session is refused", async () => {
    const { user: u } = await createMember("c@test.example");
    const { cookie } = await signInOverHttp("c@test.example");
    await getDb()
      .update(session)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(session.userId, u.id));
    expect(await getSessionFromHeaders(withCookie(cookie))).toBeNull();
  });
});

describe("membership and region rules", () => {
  it("no membership: sign-in is refused after the password check, adapter gives no_region", async () => {
    await createUser("nomember@test.example");
    const http = await signInOverHttp("nomember@test.example");
    expect(http.res.status).toBe(401);
    expect(http.cookie).toBe("");
    expect(await signInWithPassword("nomember@test.example", PASSWORD, new Headers({ "cf-connecting-ip": freshIp() }))).toBe(
      "no_region",
    );
    // Wrong password for the same account is "invalid", not "no_region".
    expect(
      await signInWithPassword("nomember@test.example", "wrong password 123", new Headers({ "cf-connecting-ip": freshIp() })),
    ).toBe("invalid");
  });

  it("membership with no regions: no_region", async () => {
    const { org } = await createOrg("Org NR");
    const u = await createUser("noregion@test.example");
    await addMembership(u.id, org.id, "viewer", []);
    expect(await signInWithPassword("noregion@test.example", PASSWORD, new Headers({ "cf-connecting-ip": freshIp() }))).toBe(
      "no_region",
    );
  });

  it("an existing session is refused once the membership is archived or its only region is archived", async () => {
    const { membership, region } = await createMember("e@test.example");
    const { cookie } = await signInOverHttp("e@test.example");
    expect(await getSessionFromHeaders(withCookie(cookie))).not.toBeNull();

    await getDb().update(regions).set({ archivedAt: new Date() }).where(eq(regions.id, region.id));
    expect(await getSessionFromHeaders(withCookie(cookie))).toBeNull();

    await getDb().update(regions).set({ archivedAt: null }).where(eq(regions.id, region.id));
    expect(await getSessionFromHeaders(withCookie(cookie))).not.toBeNull();

    await getDb().update(memberships).set({ archivedAt: new Date() }).where(eq(memberships.id, membership.id));
    expect(await getSessionFromHeaders(withCookie(cookie))).toBeNull();
  });

  it("a role change shows on the very next request (read from the DB every time)", async () => {
    const { membership } = await createMember("f@test.example", "responder");
    const { cookie } = await signInOverHttp("f@test.example");
    await getDb().update(memberships).set({ role: "viewer" }).where(eq(memberships.id, membership.id));
    expect(await getSessionFromHeaders(withCookie(cookie))).toMatchObject({ role: "viewer" });
  });

  it("the DB refuses a second active membership for one user", async () => {
    const { user: u, org } = await createMember("g@test.example");
    const code = await pgErrorCode(getDb().insert(memberships).values({ userId: u.id, organizationId: org.id, role: "viewer" }));
    expect(code).toBe("23505"); // unique_violation
  });

  it("several active memberships give no access (the adapter never picks one)", () => {
    const row = { membershipId: "m1", role: "responder", organizationId: "o1" };
    expect(decideAccess([row, { ...row, membershipId: "m2", organizationId: "o2" }], ["r1"])).toBeNull();
    expect(decideAccess([], ["r1"])).toBeNull();
    expect(decideAccess([row], [])).toBeNull();
    expect(decideAccess([{ ...row, role: "superuser" }], ["r1"])).toBeNull();
    expect(decideAccess([row], ["r1"])).toEqual({ membershipId: "m1", role: "responder", organizationId: "o1", regionIds: ["r1"] });
  });

  it("the DB refuses a region from another organization", async () => {
    const { membership, org } = await createMember("h@test.example");
    const { region: otherRegion } = await createOrg("Other Org");
    const code = await pgErrorCode(
      getDb().insert(membershipRegions).values({ membershipId: membership.id, regionId: otherRegion.id, organizationId: org.id }),
    );
    expect(code).toBe("23503"); // foreign_key_violation
    const code2 = await pgErrorCode(
      getDb()
        .insert(membershipRegions)
        .values({ membershipId: membership.id, regionId: otherRegion.id, organizationId: otherRegion.organizationId }),
    );
    expect(code2).toBe("23503");
  });

  it("the DB refuses an unknown role", async () => {
    const { org } = await createOrg("Org R");
    const u = await createUser("role@test.example");
    const code = await pgErrorCode(
      getDb().execute(sql`insert into memberships (user_id, organization_id, role) values (${u.id}, ${org.id}, 'owner')`),
    );
    expect(code).toBe("23514"); // check_violation
  });
});

describe("refused and unused endpoints", () => {
  it("POST /api/auth/sign-up/email is refused and creates no user", async () => {
    const res = await POST(
      new Request(`${BASE}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE },
        body: JSON.stringify({ email: "new@test.example", password: PASSWORD, name: "New" }),
      }),
    );
    expect(res.status).toBe(404);
    // Direct server calls are refused too (disableSignUp).
    await expect(
      getAuth().api.signUpEmail({ body: { email: "new@test.example", password: PASSWORD, name: "New" } }),
    ).rejects.toThrow();
    expect(await getDb().select().from(user).where(eq(user.email, "new@test.example"))).toHaveLength(0);
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
    await createMember("o@test.example");
    const evil = signInRequest("o@test.example", PASSWORD, freshIp());
    // Better Auth checks Origin only when the request carries a cookie (as a browser's would).
    const req = new Request(evil, {
      headers: { ...Object.fromEntries(evil.headers), origin: "https://evil.example", cookie: "x=1" },
    });
    expect((await POST(req)).status).toBe(403);
    // Preflight is not answered, so a cross-site browser cannot send JSON without a cookie either.
    expect("OPTIONS" in (await import("@/app/api/auth/[...all]/route"))).toBe(false);
    expect((await POST(signInRequest("not-an-email", PASSWORD, freshIp()))).status).toBe(400);
    const { cookie } = await signInOverHttp("o@test.example");
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
    await createMember("known@test.example");
    const unknown = await POST(signInRequest("nobody@test.example", PASSWORD, freshIp()));
    const wrong = await POST(signInRequest("known@test.example", "not the password", freshIp()));
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(await unknown.json()).toEqual(await wrong.json());

    const h = () => new Headers({ "cf-connecting-ip": freshIp() });
    expect(await signInWithPassword("nobody@test.example", PASSWORD, h())).toBe("invalid");
    expect(await signInWithPassword("known@test.example", "not the password", h())).toBe("invalid");
    expect(await signInWithPassword(undefined, null, h())).toBe("invalid");
    expect(await signInWithPassword("not-an-email", PASSWORD, h())).toBe("invalid");
  });

  it("signInWithPassword succeeds for a member and creates one session row", async () => {
    const { user: u } = await createMember("ok@test.example", "org_admin");
    expect(await signInWithPassword("  OK@test.example ", PASSWORD, new Headers({ "cf-connecting-ip": freshIp() }))).toBe("ok");
    expect(await getDb().select().from(session).where(eq(session.userId, u.id))).toHaveLength(1);
  });
});

describe("rate limit (5 sign-ins per minute per IP)", () => {
  it("the 6th rapid sign-in over HTTP gets 429; another IP is unaffected", async () => {
    await createMember("rl@test.example");
    const ip = freshIp();
    for (let i = 0; i < 5; i++) {
      const res = await POST(signInRequest("rl@test.example", "wrong password!", ip));
      expect(res.status).toBe(401);
    }
    const sixth = await POST(signInRequest("rl@test.example", PASSWORD, ip));
    expect(sixth.status).toBe(429);
    const other = await POST(signInRequest("rl@test.example", PASSWORD, freshIp()));
    expect(other.status).toBe(200);
  });

  it("the 6th rapid signInWithPassword (server-action path) is rate_limited", async () => {
    await createMember("rl2@test.example");
    const ip = freshIp();
    for (let i = 0; i < 5; i++) {
      expect(await signInWithPassword("rl2@test.example", "wrong password!", new Headers({ "cf-connecting-ip": ip }))).toBe(
        "invalid",
      );
    }
    expect(await signInWithPassword("rl2@test.example", PASSWORD, new Headers({ "cf-connecting-ip": ip }))).toBe(
      "rate_limited",
    );
    expect(await signInWithPassword("rl2@test.example", PASSWORD, new Headers({ "cf-connecting-ip": freshIp() }))).toBe("ok");
  });

  it("evidence: Better Auth's own limiter does not cover direct auth.api calls (why the adapter has its own)", async () => {
    await createMember("rl3@test.example");
    const ip = freshIp();
    for (let i = 0; i < 7; i++) {
      await expect(
        getAuth().api.signInEmail({
          body: { email: "rl3@test.example", password: "wrong password!" },
          headers: new Headers({ "cf-connecting-ip": ip }),
        }),
      ).rejects.toMatchObject({ status: "UNAUTHORIZED" });
    }
  });
});

describe("expired session rows are deleted (decided by the humans)", () => {
  const expire = (userId: string) =>
    getDb().update(session).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(session.userId, userId));
  const rowsFor = (userId: string) => getDb().select().from(session).where(eq(session.userId, userId));

  it("a successful sign-in (HTTP or server action) removes every expired row, including other users'", async () => {
    const a = await createMember("exp-a@test.example");
    const b = await createMember("exp-b@test.example");
    await signInOverHttp("exp-a@test.example");
    await signInOverHttp("exp-b@test.example");
    await expire(a.user.id);
    await expire(b.user.id);

    await signInOverHttp("exp-a@test.example");
    const aRows = await rowsFor(a.user.id);
    expect(aRows).toHaveLength(1);
    expect(aRows[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(await rowsFor(b.user.id)).toHaveLength(0);

    await expire(a.user.id);
    expect(await signInWithPassword("exp-b@test.example", PASSWORD, new Headers({ "cf-connecting-ip": freshIp() }))).toBe("ok");
    expect(await rowsFor(a.user.id)).toHaveLength(0);
  });

  it("deleteExpiredSessions removes expired rows and keeps live ones", async () => {
    const a = await createMember("exp-c@test.example");
    const b = await createMember("exp-d@test.example");
    await signInOverHttp("exp-c@test.example");
    await signInOverHttp("exp-d@test.example");
    await expire(a.user.id);
    expect(await deleteExpiredSessions()).toBe(1);
    expect(await rowsFor(a.user.id)).toHaveLength(0);
    expect(await rowsFor(b.user.id)).toHaveLength(1);
  });

  it("npm run db:cleanup-sessions deletes expired rows and prints only a count", async () => {
    const a = await createMember("exp-e@test.example");
    await signInOverHttp("exp-e@test.example");
    await expire(a.user.id);
    const result = spawnSync("npm", ["run", "--silent", "db:cleanup-sessions"], {
      encoding: "utf8",
      env: { ...process.env },
      timeout: 60_000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("[db:cleanup-sessions] Deleted 1 expired session(s).");
    expect(await rowsFor(a.user.id)).toHaveLength(0);
  });
});
