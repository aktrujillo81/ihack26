import { t, type PlainKey } from "@/lib/i18n/strings";

import { PinGlyph } from "./PinMarker";
import type { PinColor, PinShape } from "./pins";

const ENTRIES: { shape: PinShape; color: PinColor; key: PlainKey }[] = [
  { shape: "circle", color: "red", key: "status.open" },
  { shape: "diamond", color: "red", key: "status.passed_on" },
  { shape: "check", color: "green", key: "status.fixed" },
  { shape: "square", color: "green", key: "map.noOpenComplaint" },
];

/** Every shape with its word. Color is secondary. */
export function MapLegend() {
  return (
    <section className="ww-legend" aria-label={t("map.legend")}>
      <h2 className="ww-legend-title">{t("map.legend")}</h2>
      <ul>
        {ENTRIES.map((e) => (
          <li key={e.key}>
            <PinGlyph shape={e.shape} color={e.color} />
            <span>{t(e.key)}</span>
          </li>
        ))}
        <li>
          <PinGlyph shape="circle" color="yellow" dashed />
          <span>{t("common.unverified")}</span>
        </li>
      </ul>
    </section>
  );
}
