/**
 * Length caps for free text (docs/contracts.md 5.1, config `intake.textMaxLength`).
 * Longer text is shortened; the report is still stored. Pure: no database.
 *
 * ORDER MATTERS: apply the caps AFTER D3a's number scrub. Cutting first could
 * leave a 6-digit stub of a longer number that the scrub would no longer catch.
 *
 * Unknown (not in the contract): whether the cap counts UTF-16 units or
 * characters, and whether a cut adds a marker. This counts code points (never
 * splits a surrogate pair) and adds no marker.
 */
import { DEFAULT_TEXT_MAX_LENGTH, type TextMaxLength } from "@/lib/config/intake-defaults";

/** Trim, then keep at most `max` code points (trailing space removed after the cut). */
export function capText(value: string, max: number): string {
  const trimmed = value.trim();
  const points = Array.from(trimmed);
  if (points.length <= max) return trimmed;
  return points.slice(0, max).join("").trimEnd();
}

/** Same as `capText`, but null stays null. */
export function capTextOrNull(value: string | null, max: number): string | null {
  return value === null ? null : capText(value, max);
}

function positiveInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

/**
 * Reads a `configuration` value for `intake.textMaxLength`. A missing row, a
 * non-object, or an unusable number falls back to the default for that key
 * (contracts section 8); it never throws.
 */
export function resolveTextCaps(config: unknown): TextMaxLength {
  const row = typeof config === "object" && config !== null ? (config as Record<string, unknown>) : {};
  return {
    location: positiveInt(row.location, DEFAULT_TEXT_MAX_LENGTH.location),
    summary: positiveInt(row.summary, DEFAULT_TEXT_MAX_LENGTH.summary),
    language: positiveInt(row.language, DEFAULT_TEXT_MAX_LENGTH.language),
  };
}

export interface FreeTextFields {
  locationText: string;
  summary: string;
  languageSpoken: string | null;
}

/** Caps the three free-text fields of a report. Other fields are not touched. */
export function capFreeText(fields: FreeTextFields, caps: TextMaxLength = DEFAULT_TEXT_MAX_LENGTH): FreeTextFields {
  return {
    locationText: capText(fields.locationText, caps.location),
    summary: capText(fields.summary, caps.summary),
    languageSpoken: capTextOrNull(fields.languageSpoken, caps.language),
  };
}
