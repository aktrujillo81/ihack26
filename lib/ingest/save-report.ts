import "server-only";

import type { ValidatedReport } from "./types";

export type SaveReportResult = { ok: true; repeat: boolean } | { ok: false; reason: "store_failed" };

/**
 * STUB (task D3a). D3b replaces this function's body: store the report, answer
 * `repeat: true` for a repeat delivery, then match and score (contracts 2).
 * Until then nothing is stored, so it never answers ok (red line 7: no silent
 * success). The webhook turns this result into 503 `{ "ok": false }`.
 */
export async function saveReport(report: ValidatedReport): Promise<SaveReportResult> {
  void report;
  return { ok: false, reason: "store_failed" };
}
