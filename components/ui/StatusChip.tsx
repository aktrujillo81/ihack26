import { t } from "@/lib/i18n/strings";

import "./ui.css";

const KNOWN = ["open", "passed_on", "fixed"] as const;
type KnownStatus = (typeof KNOWN)[number];

const isKnown = (value: unknown): value is KnownStatus => typeof value === "string" && (KNOWN as readonly string[]).includes(value);

/** Shape per status (style guide section 3): circle, triangle, square, dashed diamond. */
function Shape({ kind }: { kind: KnownStatus | "unknown" }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      {kind === "open" && <circle className="ww-chip-shape" cx="6" cy="6" r="5" />}
      {kind === "passed_on" && <polygon className="ww-chip-shape" points="6,1 11.5,11 0.5,11" />}
      {kind === "fixed" && <rect className="ww-chip-shape" x="1" y="1" width="10" height="10" />}
      {kind === "unknown" && <polygon className="ww-chip-shape" points="6,1 11,6 6,11 1,6" />}
    </svg>
  );
}

/**
 * A complaint status as shape + word + color (never color alone, red line 11).
 * An unrecognized or missing value always shows as "Unknown", never blank.
 * The word comes from lib/i18n/strings.ts.
 */
export function StatusChip({ status }: { status: string | null | undefined }) {
  const kind = isKnown(status) ? status : "unknown";
  return (
    <span className={`ww-chip ww-chip--${kind}`}>
      <Shape kind={kind} />
      {kind === "unknown" ? t("common.unknown") : t(`status.${kind}`)}
    </span>
  );
}
