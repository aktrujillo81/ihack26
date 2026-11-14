"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "./server";

/**
 * Ends the current session on the server and goes to the sign-in page. Better
 * Auth deletes the session row and expires the cookie (the nextCookies plugin
 * copies Set-Cookie into the response of a server action). Server actions check
 * the request origin, so another site cannot trigger this.
 *
 * If ending the session fails, the failure is logged (code only) and the user
 * still lands on the sign-in page; since that page sends a still-valid session
 * on to the complaint list, a failed sign-out is visible, not hidden.
 * `redirect` throws, so it stays outside the try block.
 */
export async function signOutAction(): Promise<void> {
  try {
    await getAuth().api.signOut({ headers: await headers() });
  } catch {
    console.error("[auth] sign_out_failed");
  }
  redirect("/sign-in");
}
