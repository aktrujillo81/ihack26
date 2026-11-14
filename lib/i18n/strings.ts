/**
 * All user-facing text lives here (spec section 5, rule 4). Components call
 * `t("some.key")` and never contain literal wording.
 *
 * Wording and keys come from docs/ux-screen-notes.md. Do not add wording that
 * is not in those notes. No safety advice, no repair promises, no caller
 * details.
 *
 * Adding a language: add its code to `LOCALES` and a complete table to
 * `TABLES`. The compiler fails until every key is translated. Components do
 * not change.
 */

export const LOCALES = ["en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

const en = {
  // App shell. PROVISIONAL: placeholder home page from S3 until the dashboard (W2) exists; not yet in docs/ux-screen-notes.md.
  "app.name": "Well Watch",
  "app.tagline": "Water point reports from a phone call, for NGO coordinators.",
  "home.placeholder": "The coordinator web app is being built. Sign-in, complaints, and the map are coming next.",

  // Shared
  "common.loading": "Loading…",
  "common.error": "Something went wrong. Please try again.",
  "common.retry": "Try again",
  "common.confirm": "Confirm",
  "common.cancel": "Cancel",
  "common.denied": "You don't have permission to do that.",
  "common.unknown": "Unknown",
  "common.unverified": "Unverified",
  "common.needsReview": "Needs review",
  "common.needsLocation": "Needs location",

  // Status
  "status.open": "Open",
  "status.passed_on": "Passed on",
  "status.fixed": "Fixed",

  // Problem
  "problem.no_water": "No water",
  "problem.broken": "Broken",
  "problem.slow": "Slow",
  "problem.dirty": "Dirty",
  "problem.other": "Other",
  "problem.unknown": "Unknown",

  // Water point type
  "type.well": "Well",
  "type.hand_pump": "Hand pump",
  "type.tap": "Tap",
  "type.borehole": "Borehole",
  "type.other": "Other",
  "type.unknown": "Unknown",

  // Duration
  "duration.today": "Today",
  "duration.few_days": "A few days",
  "duration.week_or_more": "A week or more",
  "duration.unknown": "Unknown",

  // School or clinic. Callers build the key with `String(value)`; the `unknown` value maps to schoolClinic.unknown.
  "schoolClinic.true": "Serves a school or clinic",
  "schoolClinic.false": "Does not serve a school or clinic",
  "schoolClinic.unknown": "Unknown",

  // Sign-in
  "signIn.title": "Well Watch",
  "signIn.email": "Email",
  "signIn.password": "Password",
  "signIn.submit": "Sign in",
  "signIn.submitting": "Signing in…",
  "signIn.invalid": "That email or password is not right.",
  "signIn.noRegion": "Your account is not set up for any region yet. Ask your organization's admin.",
  "signIn.expired": "Your session ended. Please sign in again.",
  // PROPOSED (not in the original notes; added to docs/ux-screen-notes.md in the same PR):
  "signIn.notConfigured": "Sign-in is not set up yet.",
  "nav.complaints": "Complaints",
  "nav.map": "Map",
  "nav.signOut": "Sign out",

  // Complaint list
  "list.empty": "No complaints yet. When someone reports a problem, it will appear here.",
  "list.showing": "Showing {n} of {total}",
  // PROVISIONAL: the notes only give "8: {reason}" as an example, and the reason format is unknown.
  "list.priorityReason": "{score}: {reason}",

  // Complaint detail
  "detail.notesEmpty": "No notes yet.",
  "detail.transcriptEmpty": "No transcript was captured for this report.",
  "detail.notFoundOrDenied": "This complaint was not found or you can't view it.",
  "detail.needsReviewBanner": "Needs review: the system couldn't match this to a water point with confidence.",
  "detail.unverifiedBanner": "This water point has not been verified yet.",
  "detail.confirmStatus": "Change status to {status}?",
  "detail.passedOnTo": "Who is it passed to?",
  "detail.passedOnHelp": "This records the hand-off. It does not send a message.",
  "detail.markFixed": "Mark fixed",
  "detail.reopen": "Reopen",
  "detail.saveFailed": "Your change was not saved. Please try again.",
  "detail.copySummary": "Copy summary",
  "detail.copied": "Copied",
  "detail.noteHelp": "Don't enter caller names or phone numbers.",
  // PROPOSED (not in the original notes; added to docs/ux-screen-notes.md in the same PR):
  "list.col.waterPoint": "Water point",
  "list.col.problem": "Problem",
  "list.col.people": "People affected",
  "list.col.schoolClinic": "School or clinic",
  "list.col.duration": "How long",
  "list.col.reports": "Reports",
  "list.col.priority": "Priority",
  "list.col.status": "Status",
  "list.col.updated": "Last update",
  "common.timeUtc": "{time} UTC",
  "detail.reportsTitle": "Reports",
  "detail.notesTitle": "Notes",
  "detail.timelineTitle": "Timeline",
  "detail.passOn": "Pass on",
  "detail.addNote": "Add note",
  "detail.noteLabel": "Note",
  "detail.notAvailable": "This action is not available yet.",
  "detail.invalidInput": "Please check what you entered.",
  "detail.saved": "Saved.",

  // Map
  "map.empty": "No water points with a location yet.",
  "map.tilesFailed": "The map background could not load. Water points are still listed below.",
  "map.updated": "Updated",
  "map.needsLocationCount": "{n} water points need a location",
  // PROPOSED (not in the original notes; added to docs/ux-screen-notes.md in the same PR):
  "map.noOpenComplaint": "No open complaint",
  "map.legend": "Map key",
  "map.reports": "Reports: {n}",
  "map.listTitle": "Water points on the map",
  "map.zoomIn": "Zoom in",
  "map.zoomOut": "Zoom out",

  // Needs review list
  "review.empty": "Nothing needs review right now.",
  "review.reasonAmbiguous": "Several water points could match",
  "review.reasonUnusable": "Location could not be understood",
  "review.reasonIncomplete": "Report was incomplete",
  "review.reasonOffTopic": "Not about water",
  "review.reasonUnknown": "Reason unknown",
  "review.candidates": "Possible matches: {names}",

  // Needs location list
  "location.empty": "Every water point has a location.",
  "location.placePin": "Place pin",

  // Last report received. {timeAgo} and {time} are formatted by the caller. Any relative-time
  // wording such as "5 minutes ago" is user-facing text and must come from this file when it is added.
  "lastReport.loading": "Checking for reports…",
  "lastReport.ago": "Last report received {timeAgo}, at {time}",
  "lastReport.none": "No reports received yet.",
  "lastReport.stale": "Last report received {timeAgo}. If you expected more, check that the phone line is working.",
  "lastReport.error": "Couldn't check for new reports.",
} as const;

export type StringKey = keyof typeof en;

/** Extracts `{name}` placeholders from a string type. */
type Placeholders<S extends string> = S extends `${string}{${infer P}}${infer Rest}`
  ? P | Placeholders<Rest>
  : never;

/** Params required for a key: none for plain text, one entry per `{placeholder}` otherwise. */
export type ParamsFor<K extends StringKey> = [Placeholders<(typeof en)[K]>] extends [never]
  ? undefined
  : Record<Placeholders<(typeof en)[K]>, string | number>;

/** Keys whose text has no `{placeholder}`, so they can be chosen at runtime and passed to `t(key)`. */
export type PlainKey = { [K in StringKey]: ParamsFor<K> extends undefined ? K : never }[StringKey];

/** Every locale must define every key. */
type Table = Record<StringKey, string>;

const TABLES: Record<Locale, Table> = { en };

function format(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ""));
}

/** Type-checked lookup: a missing key, or missing or extra placeholder params, fails at typecheck. */
export function t<K extends StringKey>(
  key: K,
  ...args: ParamsFor<K> extends undefined ? [] : [params: ParamsFor<K>]
): string {
  return translate(DEFAULT_LOCALE, key, ...args);
}

/** Same as `t` for a chosen locale. */
export function translate<K extends StringKey>(
  locale: Locale,
  key: K,
  ...args: ParamsFor<K> extends undefined ? [] : [params: ParamsFor<K>]
): string {
  return format(TABLES[locale][key], args[0] as Record<string, string | number> | undefined);
}
