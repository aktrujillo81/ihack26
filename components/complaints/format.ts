/**
 * Small display helpers shared by the complaint screens. They turn data values
 * into wording through lib/i18n/strings.ts. `unknown` is shown honestly and is
 * never turned into a number or a severe-looking value.
 */
import type { Duration, PeopleAffected, Problem, ServesSchoolOrClinic, WaterPointType } from "@/lib/domain/types";
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
