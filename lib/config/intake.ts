/**
 * Intake settings and the default `configuration` rows (docs/contracts.md
 * section 8). The one defaults module: the Vapi webhook reads its limits here
 * and the seed writes these same values as rows, so no value is repeated
 * (red line 10). No secrets, no server-only imports (the seed and tests use it).
 */
import { LAST_REPORT_STALE_AFTER_MINUTES } from "./ui";

/** The one configuration key that scopes the phone line (contracts 2, step 3). */
export const INTAKE_PHONE_KEY = "intake.phone";

/** Bodies larger than this are refused with 413 (real bodies are about 52 KB). */
export const INTAKE_MAX_BODY_BYTES = 1024 * 1024;

/** Failed-secret attempts per client IP per window before 429. Only failed attempts count. */
export const INTAKE_BAD_SECRET_LIMIT = { max: 5, windowSeconds: 60 } as const;

/** Text caps, applied after the number scrub. */
export const INTAKE_TEXT_MAX_LENGTH = { location: 300, summary: 500, language: 50 } as const;

/** Shortest HMAC key accepted (characters). */
export const CALL_REF_KEY_MIN_LENGTH = 32;

/** Default `configuration` rows, one per key of contracts section 8 (except `ui.colors`: unknown, UX picks). */
export const DEFAULT_CONFIGURATION: Readonly<Record<string, unknown>> = {
  [INTAKE_PHONE_KEY]: { enabled: true },
  "intake.maxBodyBytes": INTAKE_MAX_BODY_BYTES,
  "intake.badSecretLimit": INTAKE_BAD_SECRET_LIMIT,
  "intake.textMaxLength": INTAKE_TEXT_MAX_LENGTH,
  "scoring.weights": {
    problemSevere: 3,
    problemOther: 1,
    school: 3,
    people100: 2,
    people20: 1,
    weekOrMore: 2,
    fewDays: 1,
    extraReport: 1,
    extraReportCap: 3,
  },
  "matching.rule": { key: "normalized_location_text", typeCompatible: "equal_or_unknown" },
  "ui.staleReportMinutes": LAST_REPORT_STALE_AFTER_MINUTES,
  "polling.intervalSeconds": 5,
  "api.listLimit": { default: 100, max: 200 },
  "api.mapLimit": { default: 500, max: 1000 },
};
