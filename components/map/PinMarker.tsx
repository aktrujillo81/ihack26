import { t } from "@/lib/i18n/strings";

import type { MapPin, PinColor, PinShape } from "./pins";

/**
 * A pin's drawing: three concentric outlines (ink ring, white ring, colored
 * fill) in the status shape. The shape and the label's words carry the meaning;
 * the color is secondary. The shapes match the status chips: circle is Open,
 * triangle is Passed on, square is Fixed (with a check) and "No open complaint"
 * (without one). The pin data names the triangle "diamond"; that name is
 * unchanged, only how it is drawn. An unverified point has a dashed ring.
 * Colors come from tokens through classes (map.css).
 */
export function PinGlyph({ shape, color, dashed = false, size = 30 }: { shape: PinShape; color: PinColor; dashed?: boolean; size?: number }) {
  const ring = dashed ? "ww-pin-dash" : "ww-pin-ring";
  const fill = `ww-fill-${color}`;
  return (
    <svg className="ww-glyph" viewBox="0 0 30 30" width={size} height={size} aria-hidden="true" focusable="false">
      {shape === "circle" && (
        <>
          <circle className={ring} cx="15" cy="15" r={dashed ? 12 : 13} />
          {!dashed && <circle className="ww-pin-halo" cx="15" cy="15" r="11" />}
          <circle className={fill} cx="15" cy="15" r={dashed ? 8 : 9} />
        </>
      )}
      {shape === "diamond" && (
        <>
          <polygon className={ring} points={dashed ? "15,3 27,26 3,26" : "15,1 29,27 1,27"} />
          {!dashed && <polygon className="ww-pin-halo" points="15,5.2 25.6,25 4.4,25" />}
          <polygon className={fill} points={dashed ? "15,9 22,22.5 8,22.5" : "15,9.4 22.2,23 7.8,23"} />
        </>
      )}
      {(shape === "square" || shape === "check") && (
        <>
          <rect className={ring} x={dashed ? 3 : 1} y={dashed ? 3 : 1} width={dashed ? 24 : 28} height={dashed ? 24 : 28} />
          {!dashed && <rect className="ww-pin-halo" x="3" y="3" width="24" height="24" />}
          <rect className={fill} x={dashed ? 7 : 5} y={dashed ? 7 : 5} width={dashed ? 16 : 20} height={dashed ? 16 : 20} />
          {shape === "check" && <path className="ww-pin-check" d="M9.5 15.5 l4 4 l7-8.5" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />}
        </>
      )}
    </svg>
  );
}

/** Always-visible text for a pin: status, then flags, then report count. Never hover-only. */
export function pinLabelLines(pin: MapPin): string[] {
  const lines = pin.title === null ? [t(pin.statusKey)] : [t(pin.title), t(pin.statusKey)];
  if (pin.problem !== null) lines.push(t(`problem.${pin.problem}`));
  const flags = [pin.unverified ? t("common.unverified") : null, pin.needsReview ? t("common.needsReview") : null].filter(
    (f): f is string => f !== null,
  );
  if (flags.length > 0) lines.push(flags.join(" · "));
  if (pin.reportCount > 0) lines.push(t("map.reports", { n: pin.reportCount }));
  return lines;
}

/**
 * The pin and its label chip beside it. The first line is "Type · Status" (the
 * public pins) or the status (signed-in pins, which carry no type); any further
 * lines (problem, flags, report count) follow in smaller text. All of it is
 * always visible.
 */
export function PinMarker({ pin }: { pin: MapPin }) {
  const lines = pinLabelLines(pin);
  const headCount = pin.title === null ? 1 : 2;
  return (
    <div className="ww-pin">
      <PinGlyph shape={pin.shape} color={pin.color} dashed={pin.unverified} />
      <div className="ww-pin-label">
        <div className="ww-pin-label-main">{lines.slice(0, headCount).join(" · ")}</div>
        {lines.length > headCount && <div className="ww-pin-label-sub">{lines.slice(headCount).join(" · ")}</div>}
      </div>
    </div>
  );
}
