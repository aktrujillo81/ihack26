/**
 * Outcomes of complaint actions and their wording. Client-safe: no secrets and
 * no server imports. The logic that produces an outcome is in ./complaints.ts
 * (server only).
 */
import type { PlainKey } from "../i18n/strings";

export type ActionState =
  | { status: "idle" }
  | { status: "unauthenticated" }
  | { status: "denied" }
  | { status: "not_found" }
  | { status: "invalid" }
  | { status: "not_available" }
  | { status: "error" };

export const INITIAL_ACTION_STATE: ActionState = { status: "idle" };

/** The wording for a result, or null for the initial state. */
export function actionMessageKey(state: ActionState): PlainKey | null {
  switch (state.status) {
    case "idle":
      return null;
    case "unauthenticated":
      return "signIn.expired";
    case "denied":
      return "common.denied";
    case "not_found":
      return "detail.notFoundOrDenied";
    case "invalid":
      return "detail.invalidInput";
    case "not_available":
      return "detail.notAvailable";
    default:
      return "detail.saveFailed";
  }
}
