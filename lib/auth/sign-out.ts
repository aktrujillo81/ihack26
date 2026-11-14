"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "./server";
import type { SignOutState } from "./sign-out-state";

/**
 * Ends the current session on the server and goes to the sign-in page. Better
 * Auth deletes the session row and expires the cookie (the nextCookies plugin
 * copies Set-Cookie into the response of a server action). Server actions check
 * the request origin, so another site cannot trigger this. It reads nothing
 * from the form, so nothing in a request can change what it does.
 *
 * If ending the session fails, the failure is logged (a fixed code only) and a
 * state comes back so the screen can say sign-out did not work. The user is NOT
 * sent to the sign-in page, because their session may still be valid.
 * `redirect` throws, so it stays outside the try block.
 */
export async function signOutAction(_previous: SignOutState): Promise<SignOutState> {
  try {
    await getAuth().api.signOut({ headers: await headers() });
  } catch {
    console.error("[auth] sign_out_failed");
    return { status: "error" };
  }
  redirect("/sign-in");
}
