import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  readSessionFromHeaders: vi.fn(),
  cookies: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { to });
  }),
}));

vi.mock("@/lib/auth/adapter", () => ({
  signInWithPassword: mocks.signInWithPassword,
  readSessionFromHeaders: mocks.readSessionFromHeaders,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies, headers: vi.fn() }));

import { SignInView } from "@/app/(auth)/sign-in/SignInView";
import { signInAction } from "@/app/(auth)/sign-in/actions";
import { attemptSignIn, type SignInProvider } from "@/lib/auth/sign-in";
import { INITIAL_SIGN_IN_STATE, signInMessageKey, type SignInState } from "@/lib/auth/sign-in-state";
import { t } from "@/lib/i18n/strings";

const render = (state: SignInState, opts: { pending?: boolean; expired?: boolean } = {}) =>
  renderToStaticMarkup(createElement(SignInView, { state, pending: opts.pending ?? false, expired: opts.expired ?? false }));

const PASSWORD = "a-long-demo-password-1";

/** Runs the action and returns what it returned, or the redirect target it threw. */
async function runAction(fields: Record<string, string>): Promise<{ state?: SignInState; redirectedTo?: string }> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  try {
    return { state: await signInAction(INITIAL_SIGN_IN_STATE, form) };
  } catch (e) {
    const to = (e as { to?: string }).to;
    if (to) return { redirectedTo: to };
    throw e;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("attemptSignIn calls the provider and maps every result", () => {
  it("passes the trimmed email and the password to the provider exactly once, and reports success only for ok", async () => {
    const provider = vi.fn<SignInProvider>().mockResolvedValue("ok");
    const outcome = await attemptSignIn({ email: "  someone@example.org  ", password: PASSWORD }, provider);
    expect(outcome).toEqual({ status: "signed_in" });
    expect(provider).toHaveBeenCalledTimes(1);
    expect(provider).toHaveBeenCalledWith("someone@example.org", PASSWORD);
  });

  it("maps each failure to its own state, and never to success", async () => {
    const cases = [
      ["invalid", "invalid"],
      ["no_region", "no_region"],
      ["rate_limited", "rate_limited"],
      ["error", "error"],
    ] as const;
    for (const [result, status] of cases) {
      const outcome = await attemptSignIn({ email: "a@example.org", password: PASSWORD }, async () => result);
      expect(outcome, result).toEqual({ status });
    }
  });

  it("anything the provider returns that is not ok is a failure, never a success", async () => {
    for (const odd of ["OK", "success", "signed_in", "", undefined, null, 1, true, {}, "ok "]) {
      const outcome = await attemptSignIn({ email: "a@example.org", password: PASSWORD }, async () => odd as never);
      expect(outcome.status, String(odd)).not.toBe("signed_in");
    }
  });

  it("a provider that throws is an error, not a success and not an uncaught exception", async () => {
    const outcome = await attemptSignIn({ email: "a@example.org", password: PASSWORD }, async () => {
      throw new Error("boom with " + PASSWORD);
    });
    expect(outcome).toEqual({ status: "error" });
    expect(JSON.stringify(outcome)).not.toContain(PASSWORD);
  });

  it("malformed input is 'invalid' and never reaches the provider", async () => {
    const provider = vi.fn<SignInProvider>().mockResolvedValue("ok");
    const bad: { email: unknown; password: unknown }[] = [
      { email: null, password: PASSWORD },
      { email: "a@example.org", password: null },
      { email: "", password: PASSWORD },
      { email: "   ", password: PASSWORD },
      { email: "no-at-sign", password: PASSWORD },
      { email: "a@example.org", password: "" },
      { email: "a".repeat(300) + "@example.org", password: PASSWORD },
      { email: "a@example.org", password: "x".repeat(129) },
      { email: 42, password: PASSWORD },
      { email: ["a@example.org"], password: [PASSWORD] },
      { email: undefined, password: undefined },
    ];
    for (const input of bad) expect(await attemptSignIn(input, provider), JSON.stringify(input)).toEqual({ status: "invalid" });
    expect(provider).not.toHaveBeenCalled();
  });

  it("an unknown email and a wrong password give the identical outcome and the identical screen", async () => {
    // Better Auth gives "invalid" for both; this proves nothing on our side tells them apart.
    const unknownEmail = await attemptSignIn({ email: "nobody@example.org", password: PASSWORD }, async () => "invalid");
    const wrongPassword = await attemptSignIn({ email: "admin@example.org", password: "wrong-password-123" }, async () => "invalid");
    expect(unknownEmail).toEqual(wrongPassword);
    expect(render(unknownEmail as SignInState)).toBe(render(wrongPassword as SignInState));
  });

  it("the password is never in the outcome or in any log", async () => {
    const spies = [vi.spyOn(console, "log"), vi.spyOn(console, "warn"), vi.spyOn(console, "error"), vi.spyOn(console, "info")];
    for (const result of ["ok", "invalid", "no_region", "rate_limited", "error"] as const) {
      const outcome = await attemptSignIn({ email: "a@example.org", password: PASSWORD }, async () => result);
      expect(JSON.stringify(outcome)).not.toContain(PASSWORD);
    }
    for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toContain(PASSWORD);
    spies.forEach((s) => s.mockRestore());
  });
});

describe("the sign-in action", () => {
  it("success redirects to the fixed landing page", async () => {
    mocks.signInWithPassword.mockResolvedValue("ok");
    expect(await runAction({ email: "a@example.org", password: PASSWORD })).toEqual({ redirectedTo: "/complaints" });
  });

  it("the destination can not be changed from the form: next, redirect, returnTo and callbackUrl fields are ignored", async () => {
    mocks.signInWithPassword.mockResolvedValue("ok");
    for (const field of ["next", "redirect", "returnTo", "callbackUrl", "redirectTo"]) {
      const result = await runAction({ email: "a@example.org", password: PASSWORD, [field]: "https://evil.example/steal" });
      expect(result.redirectedTo, field).toBe("/complaints");
    }
  });

  it("a failed sign-in returns a state, does not redirect, and sets no cookie", async () => {
    for (const result of ["invalid", "no_region", "rate_limited", "error"] as const) {
      mocks.signInWithPassword.mockResolvedValue(result);
      const out = await runAction({ email: "a@example.org", password: PASSWORD });
      expect(out.redirectedTo, result).toBeUndefined();
      expect(out.state?.status, result).toBe(result);
    }
    // The only thing that can set the session cookie is the provider, and only when it returns ok.
    expect(mocks.cookies).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("a provider that throws gives an error state, no redirect and no cookie", async () => {
    mocks.signInWithPassword.mockRejectedValue(new Error("db down"));
    const out = await runAction({ email: "a@example.org", password: PASSWORD });
    expect(out).toEqual({ state: { status: "error" } });
    expect(mocks.cookies).not.toHaveBeenCalled();
  });

  it("missing form fields never reach the provider", async () => {
    expect(await runAction({})).toEqual({ state: { status: "invalid" } });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it("the temporary 'not set up yet' outcome is gone", async () => {
    const { readFileSync } = await import("node:fs");
    for (const file of ["lib/auth/sign-in.ts", "lib/auth/sign-in-state.ts", "lib/i18n/strings.ts", "app/(auth)/sign-in/SignInView.tsx"]) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/not_configured|notConfigured|AUTH_CONFIGURED|not set up yet/);
    }
  });
});

describe("sign-in screen states and wording", () => {
  it("default: title, labelled fields and the submit button, and no message", () => {
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

  it("wrong details: the exact wording, in an alert, without saying which field", () => {
    const html = render({ status: "invalid" });
    expect(html).toContain("That email or password is not right.");
    expect(html).toContain('role="alert"');
  });

  it("server error", () => {
    expect(render({ status: "error" })).toContain("Something went wrong. Please try again.");
  });

  it("denied: a user with no region sees the denied message", () => {
    expect(render({ status: "no_region" })).toContain("Your account is not set up for any region yet. Ask your organization&#x27;s admin.");
  });

  it("too many attempts", () => {
    expect(render({ status: "rate_limited" })).toContain("Too many sign-in attempts. Please wait a minute and try again.");
  });

  it("session expired", () => {
    expect(render(INITIAL_SIGN_IN_STATE, { expired: true })).toContain("Your session ended. Please sign in again.");
  });

  it("every state except the initial one has a message", () => {
    expect(signInMessageKey(INITIAL_SIGN_IN_STATE)).toBeNull();
    for (const status of ["invalid", "no_region", "rate_limited", "error"] as const) expect(signInMessageKey({ status })).not.toBeNull();
  });

  it("messages are text in a box, never only color", () => {
    expect(render({ status: "invalid" })).not.toMatch(/style=|color:|\bred\b|\bgreen\b/i);
  });

  it("no message makes a safety claim or a repair promise", () => {
    const all = (["invalid", "no_region", "rate_limited", "error"] as const).map((s) => render({ status: s })).join(" ");
    expect(all).not.toMatch(/safe to drink|will be fixed|repair/i);
  });
});
