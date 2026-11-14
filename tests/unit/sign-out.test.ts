import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { to });
  }),
}));

vi.mock("@/lib/auth/server", () => ({ getAuth: () => ({ api: { signOut: mocks.signOut } }) }));
vi.mock("next/headers", () => ({ headers: mocks.headers, cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { SignOutButton } from "@/components/nav/SignOutButton";
import { signOutAction } from "@/lib/auth/sign-out";
import { INITIAL_SIGN_OUT_STATE, type SignOutState } from "@/lib/auth/sign-out-state";
import { t } from "@/lib/i18n/strings";

/** Runs the action. Returns the redirect target it threw, or the state it returned. */
async function run(previous: SignOutState = INITIAL_SIGN_OUT_STATE): Promise<{ to?: string; state?: SignOutState }> {
  try {
    return { state: await signOutAction(previous) };
  } catch (e) {
    const to = (e as { to?: string }).to;
    if (to) return { to };
    throw e;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers({ cookie: "better-auth.session_token=abc" }));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("sign out", () => {
  it("ends the session with the request's own headers and goes to the sign-in page", async () => {
    mocks.signOut.mockResolvedValue({ success: true });
    expect(await run()).toEqual({ to: "/sign-in" });
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    const arg = mocks.signOut.mock.calls[0][0] as { headers: Headers };
    expect(arg.headers.get("cookie")).toContain("better-auth.session_token");
  });

  it("the destination is fixed", async () => {
    mocks.signOut.mockResolvedValue({ success: true });
    await run();
    expect(mocks.redirect).toHaveBeenCalledWith("/sign-in");
  });

  it("when ending the session fails it does NOT redirect: it returns an error so the user is told", async () => {
    mocks.signOut.mockRejectedValue(new Error("postgres://user:secret@host/db token=abc"));
    expect(await run()).toEqual({ state: { status: "error" } });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("a failure logs a fixed code only and leaks nothing", async () => {
    mocks.signOut.mockRejectedValue(new Error("postgres://user:secret@host/db token=abc"));
    await run();
    const logged = JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls);
    expect(logged).toContain("sign_out_failed");
    expect(logged).not.toContain("secret");
    expect(logged).not.toContain("token=abc");
  });

  it("nothing in the request can change what it does: the previous state is ignored", async () => {
    mocks.signOut.mockResolvedValue({ success: true });
    for (const previous of [INITIAL_SIGN_OUT_STATE, { status: "error" } as const]) {
      expect(await run(previous)).toEqual({ to: "/sign-in" });
    }
  });
});

describe("the sign-out button", () => {
  it("shows the button, and no error message until a sign-out fails", () => {
    const html = renderToStaticMarkup(createElement(SignOutButton));
    expect(html).toContain(t("nav.signOut"));
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain(t("nav.signOutFailed"));
  });

  it("the failure wording is text, plain and makes no promise", () => {
    expect(t("nav.signOutFailed")).toBe("Sign-out did not work. Please try again.");
    expect(t("nav.signOutFailed")).not.toMatch(/safe|fixed|repair/i);
  });
});
