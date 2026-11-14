"use client";

import { useActionState } from "react";

import { INITIAL_SIGN_IN_STATE } from "@/lib/auth/sign-in-state";

import { signInAction } from "./actions";
import { SignInView } from "./SignInView";

/** Client wrapper: connects the form to the server action and shows the pending state. */
export function SignInForm({ expired }: { expired: boolean }) {
  const [state, formAction, pending] = useActionState(signInAction, INITIAL_SIGN_IN_STATE);
  return <SignInView state={state} pending={pending} expired={expired} formAction={formAction} />;
}
