/**
 * Defaults for the `intake.textMaxLength` configuration key (docs/contracts.md
 * section 8). Used when the configuration row is missing or a value is unusable.
 * Settings live here and in `configuration` rows, not scattered in code
 * (red line 10).
 *
 * Whether the real seed shares this module is unknown (contracts section 8 says
 * "one defaults module, shared with the seed"; none exists yet).
 */
export interface TextMaxLength {
  location: number;
  summary: number;
  language: number;
}

export const DEFAULT_TEXT_MAX_LENGTH: Readonly<TextMaxLength> = Object.freeze({
  location: 300,
  summary: 500,
  language: 50,
});
