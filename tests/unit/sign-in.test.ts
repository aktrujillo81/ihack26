import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SignInView } from "@/app/(auth)/sign-in/SignInView";
import { AUTH_CONFIGURED, attemptSignIn } from "@/lib/auth/sign-in";
import { INITIAL_SIGN_IN_STATE, signInMessageKey, type SignInState } from "@/lib/auth/sign-in-state";
import { t } from "@/lib/i18n/strings";

const render = (state: SignInState, opts: { pending?: boolean; expired?: boolean } = {}) =>
  renderToStaticMarkup(createElement(SignInView, { state, pending: opts.pending ?? false, expired: opts.expired ?? false }));

describe("sign-in action logic", () => {
  it("is not configured, so it can never succeed", () => {
    expect(AUTH_CONFIGURED).toBe(false);
  });

  it("valid-looking details get 'not configured' and never a session", () => {
    const result = attemptSignIn({ email: "someone@example.org", password: "correct horse" });
    expect(result).toEqual({ status: "not_configured" });
    // The outcome carries nothing but a status: no session, token, user or the password.
    expect(Object.keys(result)).toEqual(["status"]);
  });

  it("never reports success, whatever the input and even if told it is configured before it is wired", () => {
    const inputs: { email: unknown; password: unknown }[] = [
      { email: "a@example.org", password: "x" },
      { email: "admin@example.org", password: "admin" },
      { email: "", password: "" },
      { email: undefined, password: undefined },
      { email: ["a@example.org"], password: ["x"] },
      { email: "a@example.org", password: "x".repeat(5000) },
    ];
    for (const input of inputs) {
      for (const configured of [false, true]) {
        const result = attemptSignIn(input, configured);
        expect(["not_configured", "invalid", "error"]).toContain(result.status);
      }
    }
  });

  it("missing or malformed fields are 'invalid', one outcome for all of them", () => {
    const bad: { email: unknown; password: unknown }[] = [
      { email: null, password: "x" },
      { email: "a@example.org", password: null },
      { email: "", password: "x" },
      { email: "   ", password: "x" },
      { email: "no-at-sign", password: "x" },
      { email: "a@example.org", password: "" },
      { email: "a".repeat(300) + "@example.org", password: "x" },
      { email: 42, password: "x" },
    ];
    for (const input of bad) expect(attemptSignIn(input), JSON.stringify(input)).toEqual({ status: "invalid" });
  });
});

describe("sign-in screen states and wording", () => {
  it("default: title, labelled fields and the submit button", () => {
    const html = render(INITIAL_SIGN_IN_STATE);
    for (const key of ["signIn.title", "signIn.email", "signIn.password", "signIn.submit"] as const) expect(html).toContain(t(key));
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('type="password"');
  });

  it("loading: the button says 'Signing in…' and the form is disabled", () => {
    const html = render(INITIAL_SIGN_IN_STATE, { pending: true });
    expect(html).toContain("Signing in…");
    expect(html).toContain("disabled");
    expect(html).toContain('aria-busy="true"');
  });

  it("error (wrong details) uses the exact wording and does not say which field", () => {
    const html = render({ status: "invalid" });
    expect(html).toContain("That email or password is not right.");
    expect(html).toContain('role="alert"');
  });

  it("error (server)", () => {
    expect(render({ status: "error" })).toContain("Something went wrong. Please try again.");
  });

  it("denied (no region)", () => {
    expect(render({ status: "no_region" })).toContain("Your account is not set up for any region yet. Ask your organization&#x27;s admin.");
  });

  it("session expired", () => {
    expect(render(INITIAL_SIGN_IN_STATE, { expired: true })).toContain("Your session ended. Please sign in again.");
  });

  it("not configured says so plainly", () => {
    expect(render({ status: "not_configured" })).toContain("Sign-in is not set up yet.");
  });

  it("every outcome has a message except the initial state", () => {
    expect(signInMessageKey(INITIAL_SIGN_IN_STATE)).toBeNull();
    for (const status of ["not_configured", "invalid", "no_region", "error"] as const) expect(signInMessageKey({ status })).not.toBeNull();
  });

  it("messages are text in a box, never only color: no color classes or inline colors in the markup", () => {
    const html = render({ status: "invalid" });
    expect(html).not.toMatch(/style=|color:|\bred\b|\bgreen\b/i);
  });

  it("contains no safety advice or repair promises", () => {
    const all = [render({ status: "invalid" }), render({ status: "no_region" }), render({ status: "not_configured" })].join(" ");
    expect(all).not.toMatch(/safe to drink|will be fixed|repair/i);
  });
});
