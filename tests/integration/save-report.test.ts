import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { complaints, configuration, reportCandidates, reports, waterPoints } from "@/lib/db/schema";
import { saveReport } from "@/lib/ingest/save-report";
import { buildFakeReport, plantPersonalData } from "../fixtures/fake-report-builder";
import { createOrg, resetDb } from "./helpers";

async function configuredScope() {
  const scope = await createOrg("Save test organization");
  await getDb().insert(configuration).values({
    organizationId: scope.org.id,
    regionId: scope.region.id,
    key: "intake.phone",
    value: { enabled: true },
  });
  return scope;
}

beforeEach(resetDb);
afterEach(() => vi.restoreAllMocks());

describe("saveReport", () => {
  it("scrubs phone-like data and names from every stored column", async () => {
    const scope = await configuredScope();
    const base = buildFakeReport({ organizationId: scope.org.id, regionId: scope.region.id });
    const { report, planted } = plantPersonalData(base);
    await expect(saveReport(report)).resolves.toMatchObject({ ok: true, repeat: false });

    const rows = [
      ...(await getDb().select().from(reports)),
      ...(await getDb().select().from(waterPoints)),
      ...(await getDb().select().from(complaints)),
      ...(await getDb().select().from(reportCandidates)),
    ];
    const text = JSON.stringify(rows);
    expect(text).not.toContain(planted.name);
    for (const phone of planted.phones) expect(text).not.toContain(phone);
  });

  it("makes a duplicate a no-op and returns repeat", async () => {
    const scope = await configuredScope();
    const report = buildFakeReport({ organizationId: scope.org.id, regionId: scope.region.id });
    await expect(saveReport(report)).resolves.toMatchObject({ ok: true, repeat: false });
    const before = await getDb().execute(sql`select (select count(*) from reports) as reports, (select count(*) from complaints) as complaints`);
    await expect(saveReport({ ...report })).resolves.toEqual({ ok: true, repeat: true });
    const after = await getDb().execute(sql`select (select count(*) from reports) as reports, (select count(*) from complaints) as complaints`);
    expect(after).toEqual(before);
  });

  it("stores an ambiguous match without choosing a point", async () => {
    const scope = await configuredScope();
    const report = buildFakeReport({ organizationId: scope.org.id, regionId: scope.region.id, locationText: "Eastgate village old school" });
    await getDb().insert(waterPoints).values([
      { organizationId: scope.org.id, regionId: scope.region.id, locationText: report.locationText, waterPointType: "hand_pump", locationKey: "eastgate village old school" },
      { organizationId: scope.org.id, regionId: scope.region.id, locationText: report.locationText, waterPointType: "unknown", locationKey: "eastgate village old school" },
    ]);
    await expect(saveReport(report)).resolves.toMatchObject({ ok: true, repeat: false });
    const [stored] = await getDb().select().from(reports).where(eq(reports.providerCallRef, report.providerCallRef!));
    expect(stored).toMatchObject({ waterPointId: null, complaintId: null, needsReview: true, needsReviewReason: "ambiguous_match" });
    expect((await getDb().select().from(reportCandidates))).toHaveLength(2);
  });

  it("uses only fixed log codes during a save", async () => {
    const scope = await configuredScope();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await saveReport(buildFakeReport({ organizationId: scope.org.id, regionId: scope.region.id }));
    for (const call of [...error.mock.calls, ...log.mock.calls]) {
      expect(call.join(" ")).not.toMatch(/\d(?:[\s.\-()+]*\d){6}/);
    }
  });

  it("keeps the report and marks processing_error when both step-2 attempts fail", async () => {
    const scope = await configuredScope();
    const realDb = getDb();
    const fakeDb = { transaction: async () => { throw new Error("forced"); } } as unknown as ReturnType<typeof getDb>;
    const dbModule = await import("@/lib/db");
    let calls = 0;
    vi.spyOn(dbModule, "getDb").mockImplementation(() => {
      calls += 1;
      return calls === 1 || calls > 3 ? realDb : fakeDb;
    });
    const report = buildFakeReport({ organizationId: scope.org.id, regionId: scope.region.id });
    await expect(saveReport(report)).resolves.toEqual({ ok: true, repeat: false });
    const [stored] = await realDb.select().from(reports).where(eq(reports.providerCallRef, report.providerCallRef!));
    expect(stored).toMatchObject({ needsReview: true, needsReviewReason: "processing_error", complaintId: null, waterPointId: null });
  });
});
