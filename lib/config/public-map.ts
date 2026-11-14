import "server-only";

import type { PublicScope } from "../data/complaints";

/**
 * Which organization and regions the PUBLIC map shows. This is a decision, not
 * a user: nothing is public unless it is set here, so the default is an empty
 * map (fail closed). The public map is "cut from this build" in docs/spec.md
 * section 4; turning it on needs a human decision.
 *
 * Server environment variables (names only; see .env.example):
 *   PUBLISHED_MAP_ORGANIZATION_ID   one organization id
 *   PUBLISHED_MAP_REGION_IDS        comma-separated region ids of that organization
 *
 * PROVISIONAL: the real configuration lives in the `configuration` table (D1).
 */
export function publicMapScope(env: Record<string, string | undefined> = process.env): PublicScope | null {
  const organizationId = env.PUBLISHED_MAP_ORGANIZATION_ID?.trim();
  const regionIds = (env.PUBLISHED_MAP_REGION_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  if (!organizationId || regionIds.length === 0) return null;
  return { organizationId, regionIds };
}

/**
 * PROPOSED, NOT APPROVED. Whether water points that nobody has verified yet are
 * shown on the public map. Off by default: such a point comes straight from a
 * caller's words and has an exact location, so a home or private well could be
 * reported and published. A human decision (and ideally a per-point publish
 * flag, D1) is needed before turning this on.
 */
export const PUBLIC_MAP_INCLUDES_UNVERIFIED = false;
