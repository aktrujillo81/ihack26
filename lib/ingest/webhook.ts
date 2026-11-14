/**
 * Handler factory for POST /api/vapi/webhook (task D3a). The steps and their
 * order, the response codes and the fixed log codes are defined in
 * docs/contracts.md section 2; the value rules are in section 5.1. The route
 * file stays thin: it only builds this handler with the real dependencies.
 *
 * Logs are fixed codes only: never the body, the secret, the call id or a field
 * value. Errors are caught without being logged (they can carry body text).
 */
import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import { INTAKE_BAD_SECRET_LIMIT, INTAKE_MAX_BODY_BYTES } from "@/lib/config/intake";
import { malformedReport, normalizeMessage, type ReportScope } from "./normalize";
import { matchedSecretHeader } from "./secret";
import type { SaveReportResult } from "./save-report";
import type { ValidatedReport } from "./types";

export type ScopeResult = ({ ok: true } & ReportScope) | { ok: false };

export type LogCode =
  | "stored"
  | "repeat"
  | "ignored_type"
  | "rejected"
  | "too_large"
  | "rate_limited"
  | "no_scope"
  | "store_failed"
  | "auth_bearer"
  | "auth_x_vapi_secret";

export interface WebhookDeps {
  /** VAPI_WEBHOOK_SECRET. Unset or empty: every request is refused. */
  secret: string | undefined;
  /** VAPI_CALL_REF_KEY, already checked to be 32 or more characters (lib/config/env.ts). Undefined: 503. */
  callRefKey: string | undefined;
  /** The one `intake.phone` row, or `{ ok: false }` when there are none or several. */
  loadScope: () => Promise<ScopeResult>;
  /** D3b's function (a stub until D3b lands). */
  saveReport: (report: ValidatedReport) => Promise<SaveReportResult>;
  maxBodyBytes?: number;
  badSecretLimit?: { max: number; windowSeconds: number };
  /** Receives fixed codes only. Default: console, prefixed `[vapi-webhook]`. */
  log?: (code: LogCode) => void;
  now?: () => number;
  /** The header that carries the client IP (behind the Cloudflare Tunnel). */
  clientIpHeader?: string;
}

const NO_STORE = { "Cache-Control": "no-store" };
const empty = (status: number) => new Response(null, { status, headers: NO_STORE });
const json = (body: { ok: boolean }, status: number) => Response.json(body, { status, headers: NO_STORE });

const MESSAGE_TYPE = "end-of-call-report";

/** Failed-secret attempts per client IP, in memory. Only failures are recorded. */
class FailureLimiter {
  private readonly failures = new Map<string, number[]>();
  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  private recent(key: string, now: number): number[] {
    const kept = (this.failures.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (kept.length === 0) this.failures.delete(key);
    else this.failures.set(key, kept);
    return kept;
  }

  isLimited(key: string, now: number): boolean {
    return this.recent(key, now).length >= this.max;
  }

  recordFailure(key: string, now: number): void {
    if (this.failures.size > 10_000) {
      for (const k of [...this.failures.keys()]) this.recent(k, now);
      if (this.failures.size > 10_000) this.failures.clear();
    }
    this.failures.set(key, [...this.recent(key, now), now]);
  }
}

/** One valid IP in the header, else one shared bucket (same rule as sign-in). */
function clientKey(headers: Headers, headerName: string): string {
  const value = headers.get(headerName)?.trim();
  return value && isIP(value) !== 0 ? value : "shared";
}

/** Reads the body while counting bytes; stops as soon as the limit is passed. Returns null when over it. */
async function readLimited(request: Request, limit: number): Promise<Uint8Array | null> {
  // A declared length is only an early exit. The streamed count below is what is enforced.
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!request.body) return new Uint8Array(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    body.set(c, offset);
    offset += c.byteLength;
  }
  return body;
}

type Parsed =
  | { kind: "malformed" }
  | { kind: "ignored" }
  | { kind: "report"; message: Record<string, unknown> };

function parseBody(body: Uint8Array): Parsed {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return { kind: "malformed" };
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { kind: "malformed" };
  const message = (value as Record<string, unknown>).message;
  if (typeof message !== "object" || message === null || Array.isArray(message)) return { kind: "malformed" };
  const type = (message as Record<string, unknown>).type;
  if (typeof type !== "string") return { kind: "malformed" };
  return type === MESSAGE_TYPE ? { kind: "report", message: message as Record<string, unknown> } : { kind: "ignored" };
}

/** Keyed HMAC-SHA-256 (hex) of the call id, or null when there is no usable id. The raw id is never returned. */
function callRef(message: Record<string, unknown>, key: string): string | null {
  const call = message.call;
  if (typeof call !== "object" || call === null || Array.isArray(call)) return null;
  const id = (call as Record<string, unknown>).id;
  if (typeof id !== "string" || id === "") return null;
  return createHmac("sha256", key).update(id, "utf8").digest("hex");
}

export function createWebhookHandler(deps: WebhookDeps) {
  const maxBytes = deps.maxBodyBytes ?? INTAKE_MAX_BODY_BYTES;
  const limit = deps.badSecretLimit ?? INTAKE_BAD_SECRET_LIMIT;
  const limiter = new FailureLimiter(limit.max, limit.windowSeconds * 1000);
  const log = deps.log ?? ((code: LogCode) => console.log(`[vapi-webhook] ${code}`));
  const now = deps.now ?? Date.now;
  const ipHeader = deps.clientIpHeader ?? "cf-connecting-ip";

  return async function handle(request: Request): Promise<Response> {
    // 0. Rate limit first. Only failed attempts count; a correct secret never adds to it.
    const client = clientKey(request.headers, ipHeader);
    if (limiter.isLimited(client, now())) {
      log("rate_limited");
      return empty(429);
    }

    // 1. Secret, before the body is read.
    const matched = deps.secret ? matchedSecretHeader(request.headers, deps.secret) : null;
    if (matched === null) {
      limiter.recordFailure(client, now());
      log("rejected");
      return empty(401);
    }
    log(matched === "bearer" ? "auth_bearer" : "auth_x_vapi_secret");

    try {
      // 2. Size, enforced while streaming.
      const body = await readLimited(request, maxBytes);
      if (body === null) {
        log("too_large");
        return empty(413);
      }

      // 3. Scope from the one `intake.phone` row. Never from the request.
      const scope = await deps.loadScope();
      if (!scope.ok) {
        log("no_scope");
        return json({ ok: false }, 503);
      }

      // 4. Parse. A different event type is ignored on purpose.
      const parsed = parseBody(body);
      if (parsed.kind === "ignored") {
        log("ignored_type");
        return json({ ok: true }, 200);
      }

      // Without the HMAC key nothing is stored: never a report with a null ref because of a missing key.
      if (!deps.callRefKey) {
        log("store_failed");
        return json({ ok: false }, 503);
      }

      // 5 and 6. Normalize, hand over.
      const report: ValidatedReport =
        parsed.kind === "malformed"
          ? { ...malformedReport(scope), providerCallRef: null }
          : {
              ...normalizeMessage(parsed.message, scope),
              providerCallRef: callRef(parsed.message, deps.callRefKey),
            };

      const saved = await deps.saveReport(report);
      if (!saved.ok) {
        log("store_failed");
        return json({ ok: false }, 503);
      }
      log(saved.repeat ? "repeat" : "stored");
      // A repeat and a first delivery answer identically.
      return json({ ok: true }, 200);
    } catch {
      // No error text: it can carry body or database details.
      log("store_failed");
      return json({ ok: false }, 500);
    }
  };
}
