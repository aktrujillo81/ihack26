import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import {
  AUTH_BASE_PATH,
  CLIENT_IP_HEADER,
  DEV_ORIGIN,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  SESSION_LIFETIME_SECONDS,
  SIGN_IN_RATE_LIMIT,
} from "@/lib/config/auth";
import { serverEnv } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { authAccount, authSession, authUser, authVerification } from "@/lib/db/schema";
import { hasActiveAccess } from "./users";
import { deleteExpiredSessions } from "./session-cleanup";

/**
 * Better Auth server (task A1). Server only: holds the secret and the database.
 * Only app/api/auth/[...all]/route.ts and lib/auth/adapter.ts use it.
 * Documented in docs/contracts.md ("Authentication").
 */
function createAuth() {
  const baseURL = serverEnv.betterAuthUrl;
  const isProduction = serverEnv.isProduction;

  return betterAuth({
    appName: "Well Watch",
    baseURL,
    basePath: AUTH_BASE_PATH,
    secret: serverEnv.betterAuthSecret,
    trustedOrigins: serverEnv.isDevelopment ? [baseURL, DEV_ORIGIN] : [baseURL],
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      // Keys are the model names below (auth_*), not Better Auth's defaults.
      schema: {
        auth_user: authUser,
        auth_session: authSession,
        auth_account: authAccount,
        auth_verification: authVerification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      // Accounts come only from the seed script (docs/decisions.md, 2026-11-14).
      disableSignUp: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      autoSignIn: false,
      // No sendResetPassword: there is no password reset flow.
    },
    user: {
      modelName: "auth_user",
      changeEmail: { enabled: false },
      deleteUser: { enabled: false },
    },
    account: { modelName: "auth_account" },
    verification: { modelName: "auth_verification" },
    session: {
      modelName: "auth_session",
      expiresIn: SESSION_LIFETIME_SECONDS,
      // A fixed 12-hour session: never extended by use.
      disableSessionRefresh: true,
      // Off, so a signed-out, archived or demoted user is refused on the next request (AC-7).
      cookieCache: { enabled: false },
    },
    rateLimit: {
      // On in every environment (Better Auth's default is production only).
      enabled: true,
      storage: "memory",
      customRules: {
        "/sign-in/email": { window: SIGN_IN_RATE_LIMIT.windowSeconds, max: SIGN_IN_RATE_LIMIT.max },
      },
    },
    advanced: {
      useSecureCookies: isProduction || baseURL.startsWith("https://"),
      // Explicit, because Better Auth skips the Origin check when NODE_ENV=test by default.
      disableOriginCheck: false,
      ipAddress: {
        // Behind the Cloudflare Tunnel every request comes from 127.0.0.1; Cloudflare sets the real IP here.
        ipAddressHeaders: [CLIENT_IP_HEADER],
      },
      database: { generateId: "uuid" },
    },
    databaseHooks: {
      session: {
        create: {
          // Runs after the password check. No session unless exactly one active D1 `users` row
          // (auth_subject = this user) has a live region, and never longer than the configured lifetime.
          before: async (data) => {
            if (!(await hasActiveAccess(data.userId))) return false;
            const latest = new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000);
            const expiresAt = data.expiresAt < latest ? data.expiresAt : latest;
            return { data: { ...data, expiresAt } };
          },
          // Sweep expired rows (everyone's) on each successful sign-in. Never fails the sign-in.
          after: async () => {
            try {
              await deleteExpiredSessions();
            } catch {
              console.error("[auth] expired_session_cleanup_failed");
            }
          },
        },
      },
    },
    telemetry: { enabled: false },
    logger: {
      // Never log request bodies, cookies, tokens or error objects: only the level and the first line of the message.
      log: (level, message) => {
        const line = String(message).split("\n", 1)[0].slice(0, 200);
        console[level === "error" ? "error" : "warn"](`[auth] ${level}: ${line}`);
      },
      level: "warn",
    },
    // Must stay last: copies Set-Cookie into Next.js cookies() for server actions.
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { wellWatchAuth?: Auth };

/** Created on first use, so importing this module (for example during `next build`) never needs the secret. */
export function getAuth(): Auth {
  globalForAuth.wellWatchAuth ??= createAuth();
  return globalForAuth.wellWatchAuth;
}
