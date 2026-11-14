/**
 * Outcomes of complaint actions and their wording. Client-safe: no secrets and
 * no server imports. The logic that produces an outcome is in ./complaints.ts
 * (server only).
 */
import type { PlainKey } from "../i18n/strings";

export type ActionState =
  | { status: "idle" }
  /** The change was written, with its history event. */
  | { status: "saved" }
  /** The complaint changed since the screen loaded it. Nothing was written. */
  | { status: "conflict" }
  | { status: "unauthenticated" }
  | { status: "denied" }
  | { status: "not_found" }
  | { status: "invalid" }
  | { status: "error" };

export const INITIAL_ACTION_STATE: ActionState = { status: "idle" };

/** The wording for a result, or null for the initial state. */
export function actionMessageKey(state: ActionState): PlainKey | null {
  switch (state.status) {
    case "idle":
      return null;
    case "saved":
      return "detail.saved";
    case "unauthenticated":
      return "signIn.expired";
    case "denied":
      return "common.denied";
    case "not_found":
      return "detail.notFoundOrDenied";
    case "invalid":
      return "detail.invalidInput";
    case "conflict":
      return "detail.conflict";
    default:
      return "detail.saveFailed";
  }
}
