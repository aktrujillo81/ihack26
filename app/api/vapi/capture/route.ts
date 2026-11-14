/**
 * TEMPORARY (task S5a): POST /api/vapi/capture, documented in docs/contracts.md.
 * Saves the raw body of a Vapi request after checking the shared secret.
 * Delete when the real Vapi endpoint (D3) lands.
 */
import path from "node:path";

import { serverEnv } from "@/lib/config/env";
import { vapiCaptureConfig } from "@/lib/config/vapi-capture";
import { createCaptureHandler } from "@/lib/vapi/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const handle = createCaptureHandler({
    secret: serverEnv.vapiWebhookSecret,
    directory: path.resolve(process.cwd(), vapiCaptureConfig.directory),
    maxBodyBytes: vapiCaptureConfig.maxBodyBytes,
    maxFiles: vapiCaptureConfig.maxFiles,
  });
  return handle(request);
}
