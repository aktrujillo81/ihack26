import { pingDb } from "@/lib/db";

// Always run on request; never cache a health check.
export const dynamic = "force-dynamic";

/**
 * GET /api/health — documented in docs/contracts.md.
 * Public, no auth. Returns no internal details (no errors, hosts, or versions).
 */
export async function GET() {
  const dbOk = await pingDb();
  return Response.json(
    { status: dbOk ? "ok" : "error", db: dbOk ? "ok" : "down" },
    { status: dbOk ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
