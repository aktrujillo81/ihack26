"use server";

import { attemptSignIn } from "@/lib/auth/sign-in";
import type { SignInState } from "@/lib/auth/sign-in-state";

/**
 * Runs on the server. Reads the form, never trusts it, and returns an outcome.
 * It creates no session and sets no cookie until Better Auth is wired (W1).
 */
export async function signInAction(_previous: SignInState, formData: FormData): Promise<SignInState> {
  return attemptSignIn({ email: formData.get("email"), password: formData.get("password") });
}
