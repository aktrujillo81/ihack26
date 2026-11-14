/**
 * Alias map for water point types (docs/tasks/D3b.md, decision 3: `handpump`
 * to `hand_pump`). Pure. The map is applied by the normalizer (D3a) before a
 * report reaches D3b; it lives here so the rule and its tests are in one place.
 *
 * Only the one alias the brief names exists. Any other alias: unknown.
 * Keys are the value after contracts 5.1 normalizing (trimmed, lowercased,
 * spaces and hyphens turned into `_`), so `Hand-Pump` is already `hand_pump`.
 */
import type { WaterPointType } from "@/lib/domain/types";

export const WATER_POINT_TYPE_ALIASES: Readonly<Record<string, WaterPointType>> = Object.freeze({
  handpump: "hand_pump",
});

/** Returns the canonical type for a known alias, else the input unchanged. */
export function applyWaterPointTypeAlias(normalized: string): string {
  return Object.hasOwn(WATER_POINT_TYPE_ALIASES, normalized) ? WATER_POINT_TYPE_ALIASES[normalized] : normalized;
}
