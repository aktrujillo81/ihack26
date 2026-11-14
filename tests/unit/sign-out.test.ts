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

import { signOutAction } from "@/lib/auth/sign-out";

async function run(): Promise<string | undefined> {
  try {
    await signOutAction();
    return undefined;
  } catch (e) {
    return (e as { to?: string }).to;
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
    expect(await run()).toBe("/sign-in");
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    const arg = mocks.signOut.mock.calls[0][0] as { headers: Headers };
    expect(arg.headers.get("cookie")).toContain("better-auth.session_token");
  });

  it("the destination is fixed", async () => {
    mocks.signOut.mockResolvedValue({ success: true });
    expect(await run()).toBe("/sign-in");
    expect(mocks.redirect).toHaveBeenCalledWith("/sign-in");
  });

  it("when ending the session fails it still redirects, logs a fixed code only, and leaks nothing", async () => {
    mocks.signOut.mockRejectedValue(new Error("postgres://user:secret@host/db token=abc"));
    expect(await run()).toBe("/sign-in");
    const logged = JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls);
    expect(logged).toContain("sign_out_failed");
    expect(logged).not.toContain("secret");
    expect(logged).not.toContain("token=abc");
  });

  it("takes no input, so nothing in a request can change what it does", () => {
    expect(signOutAction.length).toBe(0);
  });
});
