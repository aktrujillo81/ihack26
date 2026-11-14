import { signInMessageKey, type SignInState } from "@/lib/auth/sign-in-state";
import { t } from "@/lib/i18n/strings";

import "./sign-in.css";

export interface SignInViewProps {
  state: SignInState;
  /** True while the form is being submitted. */
  pending: boolean;
  /** The user arrived because their session ended. */
  expired: boolean;
  /** The server action. Omitted when rendering for tests. */
  formAction?: (formData: FormData) => void;
}

/**
 * Presentational sign-in form: every state is a prop, so each can be rendered
 * and tested. Messages are text in a bordered box, never color alone. Wording: docs/ux-screen-notes.md, "Sign-in".
 */
export function SignInView({ state, pending, expired, formAction }: SignInViewProps) {
  const messageKey = signInMessageKey(state);
  return (
    <main className="signin">
      <h1>{t("signIn.title")}</h1>
      {expired && messageKey === null && (
        <p className="signin-message" role="status">
          {t("signIn.expired")}
        </p>
      )}
      {messageKey !== null && (
        <p className="signin-message" role="alert">
          {t(messageKey)}
        </p>
      )}
      <form action={formAction} className="signin-form" aria-busy={pending}>
        <label htmlFor="email">{t("signIn.email")}</label>
        <input id="email" name="email" type="email" autoComplete="username" required disabled={pending} />
        <label htmlFor="password">{t("signIn.password")}</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required disabled={pending} />
        <button type="submit" disabled={pending}>
          {pending ? t("signIn.submitting") : t("signIn.submit")}
        </button>
      </form>
    </main>
  );
}
