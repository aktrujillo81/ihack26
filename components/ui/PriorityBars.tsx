import type { PriorityLevel } from "@/lib/domain/priority";
import { t } from "@/lib/i18n/strings";

import "./ui.css";

export type { PriorityLevel };

const FILLED: Record<PriorityLevel, number> = { low: 1, medium: 2, high: 3 };

/** Rising bars: x, y, height for each of the three. */
const BARS = [
  { x: 0, y: 9, height: 5 },
  { x: 7, y: 5, height: 9 },
  { x: 14, y: 0, height: 14 },
] as const;

/**
 * Priority as three rising bars plus the word (High 3 filled, Medium 2, Low 1).
 * The word is always shown. Priority never uses the status colors.
 *
 * It takes a level, not a score: how a numeric score maps to a level is a
 * decision for the screens that show it, not for this component.
 */
export function PriorityBars({ level }: { level: PriorityLevel }) {
  const filled = FILLED[level];
  return (
    <span className="ww-priority">
      <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true" focusable="false">
        {BARS.map((bar, index) => (
          <rect key={bar.x} className={index < filled ? "ww-bar-on" : "ww-bar-off"} x={bar.x} y={bar.y} width="4" height={bar.height} rx="1" />
        ))}
      </svg>
      {t(`priority.${level}`)}
    </span>
  );
}
