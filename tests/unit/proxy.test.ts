import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, proxy } from "@/proxy";
import { hasSessionCookie } from "@/lib/auth/cookie";
import { decideProxy } from "@/lib/permissions/proxy-rules";
import { PUBLIC_PATHS, ROUTE_RULES, SELF_AUTHENTICATING_PREFIXES, isSelfAuthenticatingPath } from "@/lib/permissions/routes";

const COOKIE = "better-auth.session_token=anything";
const request = (path: string, cookie?: string) =>
  new NextRequest(`http://127.0.0.1:3162${path}`, cookie ? { headers: { cookie } } : undefined);

describe("without a session cookie, only the public and self-authenticating routes get through", () => {
  it("the public routes pass", () => {
    for (const path of ["/", "/sign-in", "/map", "/api/health", "/sign-in/", "/map?x=1", "/sign-in?reason=expired"]) {
      expect(decideProxy(path, false), path).toBe("pass");
    }
  });

  it("the Better Auth and Vapi routes pass, because their own handlers authenticate", () => {
    for (const path of ["/api/auth/sign-in/email", "/api/auth/sign-out", "/api/auth/anything", "/api/vapi/webhook"]) {
      expect(decideProxy(path, false), path).toBe("pass");
    }
  });

  it("every protected page redirects to sign-in", () => {
    const pages = [...ROUTE_RULES.map((r) => r.path), "/complaints/c-1", "/complaints/anything/else", "/dashboard", "/dashboard/map", "/dashboard/map/x", "/admin", "/users"];
    for (const path of pages) expect(decideProxy(path, false), path).toBe("sign_in");
  });

  it("every other API route is 401", () => {
    for (const path of ["/api", "/api/secret", "/api/complaints", "/api/auth", "/api/vapi", "/api/authx/y", "/api/vapix/capture"]) {
      expect(decideProxy(path, false), path).toBe("unauthorized");
    }
  });

  it("odd, encoded and traversal paths never get a free pass", () => {
    const bs = String.fromCharCode(92);
    for (const path of ["/map/extra", "/mapx", "//map", "/map//", "/Map", "/sign-in/extra", "/api/auth/../complaints", "/api/auth/%2e%2e/complaints", `/api/auth${bs}x`, "/api/vapi/../secret", "/map%2f", "/map;x", "/api//auth/x"]) {
      expect(decideProxy(path, false), path).not.toBe("pass");
    }
  });

  it("a path that is public or self-authenticating is never also a protected rule", () => {
    for (const rule of ROUTE_RULES) {
      expect(PUBLIC_PATHS).not.toContain(rule.path);
      expect(isSelfAuthenticatingPath(rule.path), rule.path).toBe(false);
    }
    expect([...SELF_AUTHENTICATING_PREFIXES].sort()).toEqual(["/api/auth/", "/api/vapi/"]);
  });
});

describe("with a session cookie the proxy only lets the request reach the page, which still checks the session", () => {
  it("passes protected paths", () => {
    for (const path of ["/complaints", "/complaints/c-1", "/dashboard/map", "/api/anything"]) expect(decideProxy(path, true), path).toBe("pass");
  });

  it("recognises both cookie names, and nothing else", () => {
    expect(hasSessionCookie((n) => n === "better-auth.session_token")).toBe(true);
    expect(hasSessionCookie((n) => n === "__Secure-better-auth.session_token")).toBe(true);
    expect(hasSessionCookie((n) => n === "session")).toBe(false);
    expect(hasSessionCookie((n) => n === "better-auth.session_data")).toBe(false);
    expect(hasSessionCookie(() => false)).toBe(false);
  });
});

describe("the proxy itself", () => {
  it("redirects an anonymous page request to /sign-in, to a fixed address that copies nothing from the request", () => {
    const res = proxy(request("/complaints/c-1?next=https://evil.example"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/sign-in");
    expect(res.headers.get("location")).not.toContain("evil");
    expect(res.headers.get("location")).not.toContain("complaints");
  });

  it("answers an anonymous API request with 401 and no detail", async () => {
    const res = proxy(request("/api/complaints"));
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("lets public and self-authenticating requests through untouched", () => {
    for (const path of ["/sign-in", "/map", "/api/health", "/api/auth/sign-in/email", "/api/vapi/webhook"]) {
      const res = proxy(request(path));
      expect(res.headers.get("x-middleware-next"), path).toBe("1");
      expect(res.status, path).toBe(200);
    }
  });

  it("lets a request with a session cookie through to the page (which validates it)", () => {
    const res = proxy(request("/complaints", COOKIE));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("a cookie with the wrong name does not count", () => {
    for (const cookie of ["session=abc", "better-auth.session_data=abc", "other=better-auth.session_token"]) {
      expect(proxy(request("/complaints", cookie)).status, cookie).toBe(307);
    }
  });

  it("covers everything except Next.js internals and the favicon", () => {
    expect(config.matcher).toEqual(["/((?!_next/|favicon.ico).*)"]);
  });
});
