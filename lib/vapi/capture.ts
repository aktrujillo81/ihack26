/**
 * TEMPORARY (task S5a). Catches the raw body of the first Vapi calls so the
 * contract (S6) can be written from real data. Delete this file, the route,
 * and lib/config/vapi-capture.ts when the real Vapi endpoint (D3) lands.
 *
 * It does not parse, validate, or clean the body. The saved files contain the
 * caller's phone number: they stay in the gitignored folder and are never
 * committed. Logs use fixed codes only: never the body or the secret.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface CaptureOptions {
  /** Shared secret from the Vapi credential. Undefined or empty means every request is refused. */
  secret: string | undefined;
  /** Absolute folder where raw bodies are written. */
  directory: string;
  maxBodyBytes: number;
  maxFiles: number;
}

const FILE_PREFIX = "capture-";

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Constant-time comparison. Hashing first makes both sides the same length. */
function matches(candidate: string | null, secret: string): boolean {
  if (candidate === null || candidate === "") return false;
  return timingSafeEqual(digest(candidate), digest(secret));
}

/** Accepts `Authorization: Bearer <secret>` (or a bare value) and `X-Vapi-Secret: <secret>`. */
export function isAuthorized(headers: Headers, secret: string | undefined): boolean {
  if (!secret) return false;
  const auth = headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : auth;
  const okAuth = matches(bearer ?? null, secret);
  const okLegacy = matches(headers.get("x-vapi-secret"), secret);
  return okAuth || okLegacy;
}

/** Reads the body up to `limit` bytes. Returns null as soon as the limit is passed. */
async function readLimited(request: Request, limit: number): Promise<Buffer | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!request.body) return Buffer.alloc(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

function fileName(now: Date): string {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return `${FILE_PREFIX}${stamp}-${randomBytes(4).toString("hex")}.json`;
}

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export function createCaptureHandler(options: CaptureOptions) {
  return async function handle(request: Request): Promise<Response> {
    if (!isAuthorized(request.headers, options.secret)) {
      console.error("[vapi-capture] rejected");
      return new Response(null, { status: 401, headers: { "Cache-Control": "no-store" } });
    }

    const body = await readLimited(request, options.maxBodyBytes);
    if (body === null) {
      console.error("[vapi-capture] too_large");
      return new Response(null, { status: 413, headers: { "Cache-Control": "no-store" } });
    }

    try {
      await mkdir(options.directory, { recursive: true, mode: 0o700 });
      const existing = (await readdir(options.directory)).filter((name) => name.startsWith(FILE_PREFIX));
      if (existing.length >= options.maxFiles) {
        console.error("[vapi-capture] limit_reached");
        return json({ ok: true }, 200);
      }
      await writeFile(path.join(options.directory, fileName(new Date())), body, { mode: 0o600, flag: "wx" });
      console.log("[vapi-capture] saved");
      return json({ ok: true }, 200);
    } catch {
      console.error("[vapi-capture] save_failed");
      return json({ ok: false }, 500);
    }
  };
}
