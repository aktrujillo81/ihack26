"use client";

import { useActionState } from "react";

import { signOutAction } from "@/lib/auth/sign-out";
import { INITIAL_SIGN_OUT_STATE } from "@/lib/auth/sign-out-state";
import { t } from "@/lib/i18n/strings";

import "./nav.css";

/** The sign-out button. If sign-out fails it says so, in text, next to the button. */
export function SignOutButton() {
  const [state, formAction, pending] = useActionState(signOutAction, INITIAL_SIGN_OUT_STATE);
  return (
    <form action={formAction} aria-busy={pending}>
      <button type="submit" className="ww-signout" disabled={pending}>
        {t("nav.signOut")}
      </button>
      {state.status === "error" && (
        <p role="alert" className="ww-signout-error">
          {t("nav.signOutFailed")}
        </p>
      )}
    </form>
  );
}
