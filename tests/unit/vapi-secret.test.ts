import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Wrap the real timingSafeEqual so a test can prove the helper uses it.
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, timingSafeEqual: vi.fn((a: NodeJS.ArrayBufferView, b: NodeJS.ArrayBufferView) => actual.timingSafeEqual(a, b)) };
});

import * as crypto from "node:crypto";

import { matchedSecretHeader, secretMatches } from "@/lib/ingest/secret";

const SECRET = `s-${randomUUID()}`;

beforeEach(() => {
  vi.mocked(crypto.timingSafeEqual).mockClear();
});

describe("the shared secret helper", () => {
  it("compares SHA-256 digests with timingSafeEqual, so lengths never differ", () => {
    expect(secretMatches(SECRET, SECRET)).toBe(true);
    expect(secretMatches("short", SECRET)).toBe(false);
    expect(secretMatches(`${SECRET}-and-much-longer`, SECRET)).toBe(false);
    const calls = vi.mocked(crypto.timingSafeEqual).mock.calls;
    expect(calls.length).toBe(3);
    for (const [a, b] of calls) {
      expect((a as Buffer).byteLength).toBe(32);
      expect((b as Buffer).byteLength).toBe(32);
    }
  });

  it("never matches empty or missing values", () => {
    for (const [c, s] of [["", ""], [null, SECRET], [SECRET, undefined], [undefined, undefined], ["", SECRET]] as const) {
      expect(secretMatches(c, s)).toBe(false);
    }
  });

  it("matchedSecretHeader uses it for both header types", () => {
    expect(matchedSecretHeader(new Headers({ authorization: `Bearer ${SECRET}` }), SECRET)).toBe("bearer");
    expect(matchedSecretHeader(new Headers({ "x-vapi-secret": SECRET }), SECRET)).toBe("x_vapi_secret");
    expect(matchedSecretHeader(new Headers({ authorization: `bearer ${SECRET}` }), SECRET)).toBe("bearer");
    expect(matchedSecretHeader(new Headers({ authorization: SECRET }), SECRET)).toBeNull();
    expect(matchedSecretHeader(new Headers({ authorization: `Bearer ${SECRET}` }), undefined)).toBeNull();
    expect(vi.mocked(crypto.timingSafeEqual)).toHaveBeenCalled();
  });
});
