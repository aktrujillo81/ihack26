"use server";

import { redirect } from "next/navigation";

import { attemptSignIn } from "@/lib/auth/sign-in";
import type { SignInState } from "@/lib/auth/sign-in-state";

/** Where a signed-in user lands. A fixed path: never taken from the request, so there is no open redirect. */

/**
 * Runs on the server. Reads the form, never trusts it, and returns an outcome.
 * The session cookie is set by Better Auth only when a session is created; a
 * failed sign-in returns a state and sets no cookie. On success it redirects to
 * a fixed path (`redirect` must stay outside any try block: it works by throwing).
 */
export async function signInAction(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const outcome = await attemptSignIn({ email: formData.get("email"), password: formData.get("password") });
  if (outcome.status === "signed_in") redirect("/complaints");
  return outcome;
}
