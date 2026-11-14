import { t } from "@/lib/i18n/strings";

import type { MapPin, PinColor, PinShape } from "./pins";

/** Shape plus color. Shape and the text label carry the meaning; color is secondary. */
export function PinGlyph({ shape, color, dashed = false }: { shape: PinShape; color: PinColor; dashed?: boolean }) {
  const common = {
    className: `ww-fill-${color}`,
    stroke: "#000",
    strokeWidth: 3,
    strokeDasharray: dashed ? "5 3" : undefined,
  };
  return (
    <svg className="ww-glyph" viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" focusable="false">
      {shape === "circle" && <circle cx="20" cy="20" r="16" {...common} />}
      {shape === "diamond" && <polygon points="20,2 38,20 20,38 2,20" {...common} />}
      {shape === "square" && <rect x="5" y="5" width="30" height="30" {...common} />}
      {shape === "check" && (
        <>
          <rect x="5" y="5" width="30" height="30" rx="6" {...common} />
          <path d="M12 21 l6 6 l11 -13" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

/** Always-visible text for a pin: status, then flags, then report count. Never hover-only. */
export function pinLabelLines(pin: MapPin): string[] {
  const lines = [t(pin.statusKey)];
  const flags = [pin.unverified ? t("common.unverified") : null, pin.needsReview ? t("common.needsReview") : null].filter(
    (f): f is string => f !== null,
  );
  if (flags.length > 0) lines.push(flags.join(" · "));
  if (pin.reportCount > 0) lines.push(t("map.reports", { n: pin.reportCount }));
  return lines;
}

export function PinMarker({ pin }: { pin: MapPin }) {
  return (
    <div className="ww-pin">
      <PinGlyph shape={pin.shape} color={pin.color} dashed={pin.unverified} />
      <div className="ww-pin-label">
        {pinLabelLines(pin).map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    </div>
  );
}
