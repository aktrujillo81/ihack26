"use client";

import { useActionState } from "react";

import { signOutAction } from "@/lib/auth/sign-out";
import { INITIAL_SIGN_OUT_STATE } from "@/lib/auth/sign-out-state";
import { t } from "@/lib/i18n/strings";

import "./nav.css";

/**
 * The sign-out control: an icon-only button (named for screen readers) in the
 * user block. If sign-out fails it says so, in text, below the block.
 */
export function SignOutButton() {
  const [state, formAction, pending] = useActionState(signOutAction, INITIAL_SIGN_OUT_STATE);
  return (
    <form action={formAction} aria-busy={pending} className="ww-signout-form">
      <button type="submit" className="ww-signout" aria-label={t("nav.signOut")} title={t("nav.signOut")} disabled={pending}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" />
        </svg>
      </button>
      {state.status === "error" && (
        <p role="alert" className="ww-signout-error">
          {t("nav.signOutFailed")}
        </p>
      )}
    </form>
  );
}
