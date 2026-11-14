/**
 * TEST-ONLY stand-in for lib/data/complaint-writes.ts. Unit tests replace the real
 * module with this one (vi.mock("@/lib/data/complaint-writes", () => import(...))), so
 * they check what the ACTIONS pass to the write, without a database. The real writes
 * (the transaction, the version check, the history event) are tested against Postgres
 * in tests/integration/complaint-writes.test.ts.
 *
 * Never import this from app/, components/ or lib/ (a lint rule forbids it).
 */
import { vi } from "vitest";

import type { ComplaintHead, WriteResult } from "@/lib/data/complaint-writes";
import type { DataContext, DataResult } from "@/lib/data/complaints";

import { mockComplaints } from "./mock-data";

/** The scope and status of a mock complaint, in the caller's scope only. An unknown id and another organization's id answer identically. */
export async function getComplaintHead(ctx: DataContext, id: string): Promise<DataResult<ComplaintHead>> {
  const found = mockComplaints.find((c) => c.id === id);
  if (!found || found.organizationId !== ctx.organizationId || !ctx.regionIds.includes(found.regionId)) {
    return { status: "error", error: "not_found_or_denied" };
  }
  return { status: "ok", data: { id: found.id, organizationId: found.organizationId, regionId: found.regionId, status: found.status } };
}

const saved: WriteResult = { status: "saved", version: "2026-11-14T12:00:00.000000Z" };

/** Replace with `.mockResolvedValue(...)` per test. The default is a successful save. */
export const applyStatusChange = vi.fn(async (): Promise<WriteResult> => saved);
export const addNote = vi.fn(async (): Promise<WriteResult> => saved);
