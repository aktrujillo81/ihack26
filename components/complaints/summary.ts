/**
 * The copyable hand-off summary for a complaint (DB-5).
 *
 * It NEVER includes transcript text, report summaries, or notes, and has no
 * field that could hold a caller name or number. It contains only the water
 * point, its spoken location text, the problem facts, the priority reason, the
 * status and who it was passed to. (The spoken location is free text; whether
 * names are scrubbed from it is unknown, PR-3.)
 */
import type { ComplaintDetail } from "@/lib/data/complaints";
import { t } from "@/lib/i18n/strings";

import { durationText, peopleText, problemText, schoolClinicText, typeText } from "./format";

/** One line each: a newline in free text must not be able to forge another line of the summary. */
const oneLine = (text: string): string => text.replace(/[\r\n\u2028\u2029]+/g, " ").trim();

export function buildSummary(detail: ComplaintDetail): string {
  const { complaint, waterPoint, passedOnTo } = detail;
  const lines = [
    `${t("list.col.waterPoint")}: ${waterPoint ? `${typeText(waterPoint.type)}, ${oneLine(waterPoint.locationText)}` : t("common.unknown")}`,
    `${t("list.col.status")}: ${t(`status.${complaint.status}`)}`,
    `${t("list.col.problem")}: ${problemText(complaint.problem)}`,
    `${t("list.col.people")}: ${peopleText(complaint.peopleAffected)}`,
    `${t("list.col.schoolClinic")}: ${schoolClinicText(complaint.servesSchoolOrClinic)}`,
    `${t("list.col.duration")}: ${durationText(complaint.duration)}`,
    `${t("list.col.reports")}: ${complaint.reportCount}`,
    `${t("list.col.priority")}: ${t("list.priorityReason", { score: complaint.priorityScore, reason: oneLine(complaint.scoreReason) })}`,
  ];
  if (passedOnTo) lines.push(`${t("detail.passedOnTo")} ${oneLine(passedOnTo.name)}`);
  return lines.join("\n");
}
