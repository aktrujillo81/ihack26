import { beforeEach, describe, expect, it, vi } from "vitest";

const pingDb = vi.fn<() => Promise<boolean>>();
vi.mock("@/lib/db", () => ({ pingDb }));

const { GET } = await import("@/app/api/health/route");

describe("GET /api/health", () => {
  beforeEach(() => pingDb.mockReset());

  it("returns 200 when the database answers", async () => {
    pingDb.mockResolvedValue(true);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", db: "ok" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 503 without internal details when the database is down", async () => {
    pingDb.mockResolvedValue(false);
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "error", db: "down" });
  });
});
