/**
 * Sign-in outcomes and their wording. Client-safe: no secrets, no server
 * imports, so the form component can use it. The logic that produces an
 * outcome lives in ./sign-in.ts (server only).
 */
import type { PlainKey } from "../i18n/strings";

export type SignInState =
  | { status: "idle" }
  /** Wrong or missing details. One outcome for an unknown email and a wrong password, so nothing is revealed. */
  | { status: "invalid" }
  /** The password was right but the account has no live region (denied). Returned only after the password is verified. */
  | { status: "no_region" }
  /** Too many attempts from this address in the current window. */
  | { status: "rate_limited" }
  | { status: "error" };

export const INITIAL_SIGN_IN_STATE: SignInState = { status: "idle" };

/** The wording key for a state, or null for the initial state. */
export function signInMessageKey(state: SignInState): PlainKey | null {
  switch (state.status) {
    case "idle":
      return null;
    case "invalid":
      return "signIn.invalid";
    case "no_region":
      return "signIn.noRegion";
    case "rate_limited":
      return "signIn.rateLimited";
    default:
      return "common.error";
  }
}
