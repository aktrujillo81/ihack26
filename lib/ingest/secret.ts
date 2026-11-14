import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The one shared secret comparison for Vapi routes: hash both sides with
 * SHA-256 (so they have the same length), then compare in constant time.
 * An empty candidate or an empty or missing secret never matches.
 */
export function secretMatches(candidate: string | null | undefined, secret: string | null | undefined): boolean {
  if (!candidate || !secret) return false;
  const a = createHash("sha256").update(candidate, "utf8").digest();
  const b = createHash("sha256").update(secret, "utf8").digest();
  return timingSafeEqual(a, b);
}

export type SecretHeader = "bearer" | "x_vapi_secret";

/**
 * Which header carried the right secret, or null. Accepts `Authorization: Bearer <secret>`
 * and `X-Vapi-Secret: <secret>` (contracts 2: which one Vapi sends is unknown).
 * Both are always compared, so timing does not reveal which one was present.
 */
export function matchedSecretHeader(headers: Headers, secret: string | undefined): SecretHeader | null {
  const auth = headers.get("authorization");
  const bearer = auth !== null && /^Bearer /i.test(auth) ? auth.slice(7).trim() : null;
  const okBearer = secretMatches(bearer, secret);
  const okLegacy = secretMatches(headers.get("x-vapi-secret")?.trim() ?? null, secret);
  if (okBearer) return "bearer";
  if (okLegacy) return "x_vapi_secret";
  return null;
}
