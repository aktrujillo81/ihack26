import { t, type PlainKey } from "@/lib/i18n/strings";

import { PinGlyph } from "./PinMarker";
import type { PinColor, PinShape } from "./pins";

interface Entry {
  shape: PinShape;
  color: PinColor;
  key: PlainKey;
}

/** Signed-in map: red or yellow follows the problem (spec section 7), so passed on is shown red here. */
const AUTHENTICATED: Entry[] = [
  { shape: "circle", color: "red", key: "status.open" },
  { shape: "diamond", color: "red", key: "status.passed_on" },
  { shape: "check", color: "green", key: "status.fixed" },
  { shape: "square", color: "green", key: "map.noOpenComplaint" },
];

/** Public map: color follows the status only (see publicPins.ts), so passed on is yellow. The key must match the pins. */
export const PUBLIC: Entry[] = [
  { shape: "circle", color: "red", key: "status.open" },
  { shape: "diamond", color: "yellow", key: "status.passed_on" },
  { shape: "check", color: "green", key: "status.fixed" },
  { shape: "square", color: "green", key: "map.noOpenComplaint" },
];

/**
 * Every shape with its word. Color is secondary. The public variant lists the
 * unverified style only when unverified points are shown at all.
 */
export function MapLegend({
  variant = "authenticated",
  includeUnverified = true,
}: {
  variant?: "authenticated" | "public";
  includeUnverified?: boolean;
}) {
  const entries = variant === "public" ? PUBLIC : AUTHENTICATED;
  return (
    <section className="ww-legend" aria-label={t("map.legend")}>
      <h2 className="ww-legend-title">{t("map.legend")}</h2>
      <ul>
        {entries.map((e) => (
          <li key={e.key}>
            <PinGlyph shape={e.shape} color={e.color} size={20} />
            <span>{t(e.key)}</span>
          </li>
        ))}
        {includeUnverified && (
          <li>
            <PinGlyph shape="circle" color="yellow" dashed size={20} />
            <span>{t("common.unverified")}</span>
          </li>
        )}
      </ul>
    </section>
  );
}
