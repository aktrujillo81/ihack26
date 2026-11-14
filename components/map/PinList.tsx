import { t } from "@/lib/i18n/strings";

import { PinGlyph, pinLabelLines } from "./PinMarker";
import type { MapPin } from "./pins";

/**
 * The same pins as readable text. This is the fallback if the map or its
 * tiles do not load ("Water points are still listed below"), and it works
 * without a pointer.
 */
export function PinList({ pins }: { pins: MapPin[] }) {
  return (
    <section aria-label={t("map.listTitle")}>
      <h2 className="ww-list-title">{t("map.listTitle")}</h2>
      <ul className="ww-pin-list">
        {pins.map((pin) => (
          <li key={pin.id}>
            <PinGlyph shape={pin.shape} color={pin.color} dashed={pin.unverified} />
            <div>
              {pin.locationText !== null && <strong>{pin.locationText}</strong>}
              {pinLabelLines(pin).map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
