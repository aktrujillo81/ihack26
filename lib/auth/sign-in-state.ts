/**
 * Sign-in outcomes and their wording. Client-safe: no secrets, no server
 * imports, so the form component can use it. The logic that produces an
 * outcome lives in ./sign-in.ts (server only).
 */
import type { PlainKey } from "../i18n/strings";

export type SignInState =
  | { status: "idle" }
  /** Better Auth is not wired yet. Never creates a session. */
  | { status: "not_configured" }
  /** Wrong or missing details. One outcome for all of them, so nothing is revealed. */
  | { status: "invalid" }
  /** Signed in but the account has no region (denied). */
  | { status: "no_region" }
  | { status: "error" };

export const INITIAL_SIGN_IN_STATE: SignInState = { status: "idle" };

/** The wording key for a state, or null for the initial state. */
export function signInMessageKey(state: SignInState): PlainKey | null {
  switch (state.status) {
    case "idle":
      return null;
    case "not_configured":
      return "signIn.notConfigured";
    case "invalid":
      return "signIn.invalid";
    case "no_region":
      return "signIn.noRegion";
    default:
      return "common.error";
  }
}
