import "server-only";

import { MAX_PASSWORD_LENGTH } from "../config/auth";
import type { SignInState } from "./sign-in-state";

/**
 * Sign-in logic. It calls Better Auth through lib/auth/adapter.ts
 * (`signInWithPassword`), which checks the password, applies the sign-in rate
 * limit, refuses a user with no live region, and sets the session cookie ONLY
 * when a session is created. Nothing here sets a cookie or creates a session
 * itself, and every failure returns a state with no cookie.
 *
 * What it must never do: say whether an email exists, log or return the
 * password, or report success for a failure. An unknown email and a wrong
 * password give the same outcome.
 *
 * Still to do (not here): a lockout per account. The adapter limits by client
 * address only.
 */

/** What the provider reports. The same values as `SignInResult` in lib/auth/adapter.ts. */
export type SignInProviderResult = "ok" | "invalid" | "no_region" | "rate_limited" | "error";

export type SignInProvider = (email: string, password: string) => Promise<SignInProviderResult>;

/** The real provider. Imported here so importing this module never loads Better Auth or the database. */
const betterAuthProvider: SignInProvider = async (email, password) => {
  const { signInWithPassword } = await import("./adapter");
  return signInWithPassword(email, password);
};

/** A sign-in that worked. The action redirects; it is never shown as a state. */
export type SignInOutcome = SignInState | { status: "signed_in" };

const MAX_EMAIL = 254;

/** Input comes straight from a form, so it is `unknown`. The password is never returned, logged or stored. */
export async function attemptSignIn(
  input: { email: unknown; password: unknown },
  provider: SignInProvider = betterAuthProvider,
): Promise<SignInOutcome> {
  const { email, password } = input;
  if (typeof email !== "string" || typeof password !== "string") return { status: "invalid" };
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_EMAIL || !trimmed.includes("@")) return { status: "invalid" };
  if (password.length === 0 || password.length > MAX_PASSWORD_LENGTH) return { status: "invalid" };

  let result: SignInProviderResult;
  try {
    result = await provider(trimmed, password);
  } catch {
    return { status: "error" };
  }

  switch (result) {
    case "ok":
      return { status: "signed_in" };
    case "invalid":
      return { status: "invalid" };
    case "no_region":
      return { status: "no_region" };
    case "rate_limited":
      return { status: "rate_limited" };
    default:
      // Anything unrecognised is a failure, never a success.
      return { status: "error" };
  }
}
