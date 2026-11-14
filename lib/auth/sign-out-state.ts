/**
 * The result of a sign-out attempt. Client-safe. A successful sign-out never
 * returns: the action redirects to the sign-in page. Only a failure comes back,
 * so the user is told it did not work instead of being bounced back signed in
 * with no explanation.
 */
export type SignOutState = { status: "idle" } | { status: "error" };

export const INITIAL_SIGN_OUT_STATE: SignOutState = { status: "idle" };
