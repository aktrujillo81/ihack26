import { describe, expect, it } from "vitest";

import { MAX_SESSION_LIFETIME_MS } from "@/lib/auth/session";
import { SESSION_LIFETIME_SECONDS } from "@/lib/config/auth";

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
/** The value main had before W1's PR #28 (chore/w1-prep) set the 12-hour cap. */
const PRE_PR28_MAX_MS = 7 * 24 * 60 * 60 * 1000;

describe("session lifetime: one 12-hour value (decided by the humans)", () => {
  it("lib/config/auth.ts holds 12 hours", () => {
    expect(SESSION_LIFETIME_SECONDS * 1000).toBe(TWELVE_HOURS_MS);
  });

  it("a Better Auth session is never longer than parseSession accepts", () => {
    expect(SESSION_LIFETIME_SECONDS * 1000).toBeLessThanOrEqual(MAX_SESSION_LIFETIME_MS);
  });

  // Until W1 imports SESSION_LIFETIME_SECONDS in session.ts. Skipped (visibly) only
  // while session.ts still has the pre-PR #28 7-day value; runs as soon as #28 merges.
  it.skipIf(MAX_SESSION_LIFETIME_MS === PRE_PR28_MAX_MS)(
    "equals MAX_SESSION_LIFETIME_MS in lib/auth/session.ts (pending PR #28 while skipped)",
    () => {
      expect(SESSION_LIFETIME_SECONDS * 1000).toBe(MAX_SESSION_LIFETIME_MS);
    },
  );
});
