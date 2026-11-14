import "server-only";

import { getIP, isAPIError } from "better-auth/api";
import { eq } from "drizzle-orm";

import { CLIENT_IP_HEADER, MAX_PASSWORD_LENGTH, SIGN_IN_RATE_LIMIT } from "@/lib/config/auth";
import { getDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { loadActiveAccess } from "./memberships";
import { getAuth } from "./server";

/**
 * The seam between Better Auth and the app (task A1). W1 wires these into
 * lib/auth/session.ts (getCurrentSession) and lib/auth/sign-in.ts
 * (attemptSignIn) from feat/auth-prep. Documented in docs/contracts.md.
 */

/** The raw session shape that auth-prep's `parseSession` validates. */
export interface AdapterSession {
  userId: string;
  role: string;
  organizationId: string;
  regionIds: string[];
  /** ISO 8601, UTC. */
  expiresAt: string;
}

/**
 * Reads the session for these request headers, or null. Pure apart from the
 * database: no next/headers, so it is testable. On every call it reads the
 * session row (Better Auth verifies the signed cookie; the cookie cache is off)
 * and the user's single active membership and regions. Zero or several active
 * memberships, no regions, or any error give null (fail closed).
 */
export async function getSessionFromHeaders(h: Headers): Promise<unknown> {
  try {
    const result = await getAuth().api.getSession({
      headers: h,
      query: { disableCookieCache: true, disableRefresh: true },
    });
    if (!result) return null;
    const expiresAt = new Date(result.session.expiresAt);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) return null;
    const access = await loadActiveAccess(result.user.id);
    if (!access) return null;
    const session: AdapterSession = {
      userId: result.user.id,
      role: access.role,
      organizationId: access.organizationId,
      regionIds: access.regionIds,
      expiresAt: expiresAt.toISOString(),
    };
    return session;
  } catch {
    console.error("[auth] session_read_failed");
    return null;
  }
}

/** For server components, route handlers and actions: reads the current request's headers. */
export async function readSessionFromHeaders(): Promise<unknown> {
  // Imported here so tests can load this module without a Next.js request scope.
  const { headers } = await import("next/headers");
  return getSessionFromHeaders(await headers());
}

export type SignInResult = "ok" | "invalid" | "no_region" | "rate_limited" | "error";

// --- Rate limit for the server-action path -------------------------------
// Better Auth's limiter runs only for HTTP requests to /api/auth, not for
// direct auth.api calls (checked in better-auth 1.7.23 source: the limiter is
// in the router's onRequest). So this path enforces the same rule itself,
// keyed by the IP Cloudflare reports. In-memory, per server process.

const globalForLimit = globalThis as unknown as { wellWatchSignInLimit?: Map<string, { count: number; start: number }> };
const attempts = (globalForLimit.wellWatchSignInLimit ??= new Map());

function clientKey(h: Headers): string {
  // Same rule as Better Auth: a single valid IP in cf-connecting-ip; 127.0.0.1 in development
  // and tests; otherwise one shared bucket (fails safe: limits everyone rather than no one).
  return getIP(h, { advanced: { ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] } } }) ?? "no-trusted-ip";
}

/** Counts this attempt; false when the limit for this IP is already used up in the current window. */
function takeSignInAttempt(h: Headers, now = Date.now()): boolean {
  const windowMs = SIGN_IN_RATE_LIMIT.windowSeconds * 1000;
  for (const [key, entry] of attempts) if (now - entry.start >= windowMs) attempts.delete(key);
  const key = clientKey(h);
  const entry = attempts.get(key);
  if (!entry) {
    attempts.set(key, { count: 1, start: now });
    return true;
  }
  if (entry.count >= SIGN_IN_RATE_LIMIT.max) return false;
  entry.count += 1;
  return true;
}

function logFailure(reason: Exclude<SignInResult, "ok">) {
  // Never the email, password, IP or any token.
  console.warn(`[auth] sign_in_failed reason=${reason}`);
}

/**
 * Email and password sign-in for the sign-in server action. On "ok" the
 * session cookie is set through Next.js cookies() (nextCookies plugin).
 * Unknown email and wrong password both give "invalid" (Better Auth also
 * hashes for an unknown email, so timing matches). "no_region" is returned
 * only after the password was accepted. Pass `requestHeaders` in tests;
 * otherwise the current request's headers are used.
 */
export async function signInWithPassword(
  email: unknown,
  password: unknown,
  requestHeaders?: Headers,
): Promise<SignInResult> {
  let h: Headers;
  try {
    h = requestHeaders ?? new Headers(await (await import("next/headers")).headers());
  } catch {
    logFailure("error");
    return "error";
  }

  if (!takeSignInAttempt(h)) {
    logFailure("rate_limited");
    return "rate_limited";
  }

  if (typeof email !== "string" || typeof password !== "string") return fail("invalid");
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length === 0 || password.length === 0 || password.length > MAX_PASSWORD_LENGTH) return fail("invalid");

  try {
    await getAuth().api.signInEmail({ body: { email: trimmed, password }, headers: h });
    return "ok";
  } catch (error) {
    if (isAPIError(error)) {
      const code = (error.body as { code?: unknown } | undefined)?.code;
      if (code === "FAILED_TO_CREATE_SESSION") {
        // Our session hook refused after the password was accepted. Confirm it was for lack of access.
        return fail((await hasNoAccess(trimmed)) ? "no_region" : "error");
      }
      if (error.status === "UNAUTHORIZED" || error.status === "BAD_REQUEST") return fail("invalid");
    }
    return fail("error");
  }
}

function fail(reason: Exclude<SignInResult, "ok">): SignInResult {
  logFailure(reason);
  return reason;
}

async function hasNoAccess(email: string): Promise<boolean> {
  try {
    const [row] = await getDb().select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
    return !!row && !(await loadActiveAccess(row.id));
  } catch {
    return false;
  }
}
