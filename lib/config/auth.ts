/**
 * Sign-in and session settings (task A1). Settings live here, not scattered in
 * code (red line 10). No secrets: those are read through lib/config/env.ts.
 */

/**
 * Staff sessions last 12 hours from sign-in, then the user signs in again (decided by the humans, 2026-11-14).
 * The one source for this value: W1 imports it into lib/auth/session.ts (MAX_SESSION_LIFETIME_MS).
 */
export const SESSION_LIFETIME_SECONDS = 12 * 60 * 60;

/** Shortest password Better Auth and the seed accept. */
export const MIN_PASSWORD_LENGTH = 12;

/** Longest password accepted (Better Auth's default is 128). */
export const MAX_PASSWORD_LENGTH = 128;

/** Sign-in attempts allowed per client IP in one window. The next attempt gets 429 / "rate_limited". */
export const SIGN_IN_RATE_LIMIT = { windowSeconds: 60, max: 5 } as const;

/** Header Cloudflare sets to the real client IP. The only IP header trusted behind the tunnel. */
export const CLIENT_IP_HEADER = "cf-connecting-ip";

/** The local `npm run dev` origin, trusted in development only. */
export const DEV_ORIGIN = "http://127.0.0.1:3162";

/** Better Auth's mount point, served by app/api/auth/[...all]/route.ts. */
export const AUTH_BASE_PATH = "/api/auth";

/**
 * The only Better Auth endpoints the route handler serves (deny by default).
 * Everything else (sign-up, password reset, change email, delete user, social,
 * account linking, get-session) answers 404. Sessions are read on the server
 * only (lib/auth/adapter.ts). Keys are paths below AUTH_BASE_PATH.
 */
export const ALLOWED_AUTH_ENDPOINTS: Readonly<Record<string, readonly string[]>> = {
  "/sign-in/email": ["POST"],
  "/sign-out": ["POST"],
};
