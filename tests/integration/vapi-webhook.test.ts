import { randomBytes, randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { runSeed } from "@/db/seed/seed";
import { DEFAULT_CONFIGURATION, INTAKE_PHONE_KEY } from "@/lib/config/intake";
import { getDb } from "@/lib/db";
import { configuration } from "@/lib/db/schema";
import { createOrg, resetDb } from "./helpers";

// Throwaway values for this run (not secrets).
const SECRET = randomUUID();
const KEY = randomBytes(24).toString("hex");

let POST: (request: Request) => Promise<Response>;

const body = JSON.stringify({ message: { type: "end-of-call-report", endedReason: "customer-ended-call", call: { id: randomUUID() } } });
const call = (headers: Record<string, string>) =>
  POST(new Request("http://localhost/api/vapi/webhook", { method: "POST", headers, body }));
const authed = { authorization: `Bearer ${SECRET}` };
const reportCount = async () => {
  const [row] = (await getDb().execute(sql`select count(*)::int as n from reports`)) as unknown as { n: number }[];
  return row.n;
};

beforeAll(async () => {
  process.env.VAPI_WEBHOOK_SECRET = SECRET;
  process.env.VAPI_CALL_REF_KEY = KEY;
  ({ POST } = await import("@/app/api/vapi/webhook/route"));
  await resetDb();
  await runSeed();
});

describe("seed rows for D3a (contracts 4.1 item 4 and section 8)", () => {
  it("creates exactly one intake.phone row and every default key, once per scope", async () => {
    const rows = await getDb().select().from(configuration);
    expect(rows.filter((r) => r.key === INTAKE_PHONE_KEY)).toHaveLength(1);
    expect(rows.map((r) => r.key).sort()).toEqual(Object.keys(DEFAULT_CONFIGURATION).sort());
    const phone = rows.find((r) => r.key === INTAKE_PHONE_KEY)!;
    expect(phone.value).toEqual({ enabled: true });
  });

  it("running the seed again adds nothing and never overwrites a changed value", async () => {
    await getDb().update(configuration).set({ value: { enabled: false } }).where(eq(configuration.key, INTAKE_PHONE_KEY));
    await runSeed();
    const rows = await getDb().select().from(configuration);
    expect(rows).toHaveLength(Object.keys(DEFAULT_CONFIGURATION).length);
    expect(rows.find((r) => r.key === INTAKE_PHONE_KEY)!.value).toEqual({ enabled: false });
    await getDb().update(configuration).set({ value: { enabled: true } }).where(eq(configuration.key, INTAKE_PHONE_KEY));
  });
});

describe("POST /api/vapi/webhook against the real database, with the real save", () => {
  it("401 with no secret, and with a wrong one", async () => {
    expect((await call({})).status).toBe(401);
    expect((await call({ authorization: "Bearer wrong" })).status).toBe(401);
  });

  it("with the secret and a fake body: 200, one flagged report stored (the real save)", async () => {
    const res = await call(authed);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(await reportCount()).toBe(1);
    const [row] = (await getDb().execute(sql`select needs_review as r, needs_review_reason as why from reports`)) as unknown as { r: boolean; why: string }[];
    expect(row).toEqual({ r: true, why: "no_structured_data" });
  });

  it("503 when there is no intake.phone row (nothing new stored)", async () => {
    const before = await reportCount();
    await getDb().delete(configuration).where(eq(configuration.key, INTAKE_PHONE_KEY));
    expect((await call(authed)).status).toBe(503);
    expect(await reportCount()).toBe(before);
  });

  it("503 when there are two intake.phone rows (never guesses a scope)", async () => {
    const before = await reportCount();
    const { org, region } = await createOrg("Second line");
    const [first] = await getDb().select().from(configuration).limit(1);
    await getDb().insert(configuration).values({ organizationId: org.id, regionId: region.id, key: INTAKE_PHONE_KEY, value: { enabled: true } });
    await getDb().insert(configuration).values({ organizationId: first.organizationId, regionId: first.regionId, key: INTAKE_PHONE_KEY, value: { enabled: true } });
    const rows = await getDb().select().from(configuration).where(eq(configuration.key, INTAKE_PHONE_KEY));
    expect(rows).toHaveLength(2);
    expect((await call(authed)).status).toBe(503);
    expect(await reportCount()).toBe(before);
    await getDb().delete(configuration).where(and(eq(configuration.key, INTAKE_PHONE_KEY), eq(configuration.organizationId, org.id)));
  });
});
