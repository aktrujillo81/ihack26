import "server-only";

import type { SignInState } from "./sign-in-state";

/**
 * Sign-in logic. Better Auth is not wired yet (D1 tables do not exist), so
 * sign-in never succeeds: valid-looking input gets `not_configured`, and no
 * session or cookie is ever created here. It must not be made to "work" with a
 * hardcoded user.
 *
 * WIRING POINT (W1, after D1): when Better Auth is configured, set
 * `AUTH_CONFIGURED` from real configuration, call its email and password
 * sign-in in the branch marked below, and redirect on success.
 *
 * Still to do when wiring (not done here): rate limiting and lockout; use the
 * trimmed email; make an unknown email and a wrong password indistinguishable
 * in message and timing; validate any return-to parameter as a same-origin
 * relative path.
 */
export const AUTH_CONFIGURED = false;

const MAX_EMAIL = 254;
const MAX_PASSWORD = 1024;

/** Input comes straight from a form, so it is `unknown`. The password is never returned, logged or stored. */
export function attemptSignIn(
  input: { email: unknown; password: unknown },
  configured: boolean = AUTH_CONFIGURED,
): SignInState {
  const { email, password } = input;
  if (typeof email !== "string" || typeof password !== "string") return { status: "invalid" };
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_EMAIL || !trimmed.includes("@")) return { status: "invalid" };
  if (password.length === 0 || password.length > MAX_PASSWORD) return { status: "invalid" };

  if (!configured) return { status: "not_configured" };

  // WIRING POINT: call Better Auth here. On a refused sign-in return { status: "invalid" },
  // on a user with no region return { status: "no_region" }, on any thrown error { status: "error" }.
  // Until that exists, fail closed: never report success.
  return { status: "error" };
}
