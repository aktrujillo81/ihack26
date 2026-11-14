/**
 * Small display helpers shared by the complaint screens. They turn data values
 * into wording through lib/i18n/strings.ts. `unknown` is shown honestly and is
 * never turned into a number or a severe-looking value.
 */
import { COMPLAINT_STATUSES, type Duration, type HistoryEvent, type PeopleAffected, type Problem, type ServesSchoolOrClinic, type WaterPointType } from "@/lib/domain/types";
import { t } from "@/lib/i18n/strings";

export const problemText = (problem: Problem): string => t(`problem.${problem}`);
export const typeText = (type: WaterPointType): string => t(`type.${type}`);
export const durationText = (duration: Duration): string => t(`duration.${duration}`);
export const schoolClinicText = (value: ServesSchoolOrClinic): string =>
  value === "unknown" ? t("schoolClinic.unknown") : value ? t("schoolClinic.true") : t("schoolClinic.false");
export const peopleText = (people: PeopleAffected): string => (people === "unknown" ? t("common.unknown") : String(people));

/** "2026-11-13T14:30:00Z" becomes "2026-11-13 14:30 UTC". Anything unparseable is shown as unknown. */
export function timeText(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return t("common.unknown");
  return t("common.timeUtc", { time: new Date(parsed).toISOString().slice(0, 16).replace("T", " ") });
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A field of a history event's before or after data, or undefined. Reads nothing it does not name. */
const field = (data: unknown, key: string): unknown => (isPlainObject(data) ? data[key] : undefined);

const statusText = (value: unknown): string =>
  typeof value === "string" && (COMPLAINT_STATUSES as readonly string[]).includes(value)
    ? t(`status.${value as (typeof COMPLAINT_STATUSES)[number]}`)
    : t("common.unknown");

/** Who made a change: the staff member's name, or "System". Never a caller. */
export const actorText = (actor: string | null): string => actor ?? t("history.system");

/**
 * What a history event says, in plain words, built from its type and data
 * (D1 stores `event_type`, `before_data` and `after_data`, not a sentence). An
 * event type this screen does not know is shown generically, never hidden.
 */
export function historyText(event: HistoryEvent): string {
  switch (event.type) {
    case "created":
      return t("history.created");
    case "report_added":
      return t("history.reportAdded");
    case "status_changed":
      return t("history.statusChanged", { from: statusText(field(event.before, "status")), to: statusText(field(event.after, "status")) });
    case "passed_on": {
      const who = field(event.after, "passedOnNote");
      return t("history.passedOn", { who: typeof who === "string" && who.length > 0 ? who : t("common.unknown") });
    }
    case "reopened":
      return t("history.reopened");
    case "note_added":
      return t("history.noteAdded");
    default:
      return t("history.other");
  }
}
