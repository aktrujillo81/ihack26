/**
 * POST /api/vapi/webhook: Vapi's end-of-call report. Behaviour, response codes
 * and rules: docs/contracts.md sections 2 and 5.1. All logic is in
 * lib/ingest/webhook.ts; this file only supplies the real dependencies.
 */
import { eq } from "drizzle-orm";

import { INTAKE_PHONE_KEY } from "@/lib/config/intake";
import { serverEnv } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { configuration } from "@/lib/db/schema";
import { saveReport } from "@/lib/ingest/save-report";
import { createWebhookHandler, type ScopeResult } from "@/lib/ingest/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadScope(): Promise<ScopeResult> {
  const rows = await getDb()
    .select({ organizationId: configuration.organizationId, regionId: configuration.regionId })
    .from(configuration)
    .where(eq(configuration.key, INTAKE_PHONE_KEY))
    .limit(2);
  return rows.length === 1 ? { ok: true, ...rows[0] } : { ok: false };
}

// One handler for the life of the process, so the failed-attempt counter persists between requests.
let handler: ReturnType<typeof createWebhookHandler> | undefined;

export async function POST(request: Request): Promise<Response> {
  handler ??= createWebhookHandler({
    secret: serverEnv.vapiWebhookSecret,
    callRefKey: serverEnv.vapiCallRefKey,
    loadScope,
    saveReport,
  });
  return handler(request);
}
