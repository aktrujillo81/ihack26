/**
 * isSampleData against Postgres: the "Sample data" tag is shown only while the
 * demo seed's marker row exists in the user's OWN organization and regions.
 * Development database only (the integration setup refuses anything else).
 */
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { runDemoSeed } from "@/db/seed/demo";
import { runSeed } from "@/db/seed/seed";
import { DEMO_DATA_MARKER_KEY } from "@/lib/config/demo";
import { isSampleData, type DataContext } from "@/lib/data/complaints";
import { configuration, organizations, regions } from "@/lib/db/schema";
import { getDb } from "@/lib/db";

import { createOrg, resetDb } from "./helpers";

const TEST_PORTS = { allowedPorts: ["5434", "5432"] } as const;

let demo: DataContext;
let other: DataContext;
let otherOrgId: string;
let otherRegionId: string;

beforeAll(async () => {
  await resetDb();
  const unrelated = await createOrg("Unrelated Org");
  otherOrgId = unrelated.org.id;
  otherRegionId = unrelated.region.id;
  other = { organizationId: unrelated.org.id, regionIds: [unrelated.region.id] };
  await runSeed();
  const db = getDb();
  const [org] = await db.select().from(organizations).where(eq(organizations.name, "Demo Organization"));
  const [region] = await db.select().from(regions).where(eq(regions.organizationId, org.id));
  demo = { organizationId: org.id, regionIds: [region.id] };
});

describe("isSampleData", () => {
  it("is false before the demo data exists (accounts only)", async () => {
    expect(await isSampleData(demo)).toBe(false);
  });

  it("is true once the demo seed has run, for the demo organization only", async () => {
    await runDemoSeed(new Date(), TEST_PORTS);
    expect(await isSampleData(demo)).toBe(true);
    expect(await isSampleData(other)).toBe(false);
  });

  it("the key it reads is the key the seed writes", async () => {
    const rows = await getDb().select().from(configuration).where(eq(configuration.organizationId, demo.organizationId));
    expect(rows.map((r) => r.key)).toContain(DEMO_DATA_MARKER_KEY);
  });

  it("another organization's marker never counts for this one, and a region outside the user's scope never counts", async () => {
    await getDb().insert(configuration).values({ organizationId: otherOrgId, regionId: otherRegionId, key: DEMO_DATA_MARKER_KEY, value: {} });
    expect(await isSampleData(other)).toBe(true); // its own marker
    expect(await isSampleData(demo)).toBe(true); // unchanged
    // The demo organization asked about with only a region it does not hold: no scope, no answer.
    expect(await isSampleData({ organizationId: demo.organizationId, regionIds: [otherRegionId] })).toBe(false);
  });

  it("a missing, empty or malformed context answers false and reads nothing", async () => {
    for (const ctx of [{ organizationId: "x", regionIds: ["y"] }, { organizationId: demo.organizationId, regionIds: [] }, null, undefined, {}] as unknown as DataContext[]) {
      expect(await isSampleData(ctx)).toBe(false);
    }
  });
});
