import { NextResponse, type NextRequest } from "next/server";

import { hasSessionCookie } from "@/lib/auth/cookie";
import { decideProxy } from "@/lib/permissions/proxy-rules";

/**
 * Quick redirect for signed-out visitors (Next.js 16 "proxy", the old
 * middleware). It checks only that a session cookie EXISTS; it does not
 * validate it. Every protected page, route handler and action still validates
 * the session itself (lib/auth/page-guard.ts, lib/auth/guards.ts). The rules
 * are in lib/permissions/proxy-rules.ts.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const decision = decideProxy(pathname, hasSessionCookie((name) => request.cookies.has(name)));

  if (decision === "pass") return NextResponse.next();
  if (decision === "unauthorized") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  // A fixed destination: nothing from the request (path or query) is copied into it. Built from the
  // request's own URL so the host and port stay whatever the client used.
  const target = request.nextUrl.clone();
  target.pathname = "/sign-in";
  target.search = "";
  return NextResponse.redirect(target);
}

export const config = {
  // Everything except Next.js internals (static files, images, dev hot reload) and the favicon.
  matcher: ["/((?!_next/|favicon.ico).*)"],
};
