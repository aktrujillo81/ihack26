import Link from "next/link";

import { COMPLAINT_LIST_PAGE_SIZE } from "@/lib/config/ui";
import type { ComplaintListItem, Loadable } from "@/lib/data/complaints";
import { t } from "@/lib/i18n/strings";

import "./complaints.css";
import { durationText, peopleText, problemText, schoolClinicText, timeText, typeText } from "./format";
import { StateMessage } from "./StateMessage";

/** Warning sign for the needs-review badge. It is decoration; the words carry the meaning. */
const WARNING = "⚠";

/**
 * Presentational complaint list (W2). Everything it shows comes in as `result`,
 * so every state is renderable and testable. It reads no session. The list
 * holds no transcripts: `ComplaintListItem` has none.
 *
 * Columns are PROVISIONAL (spec DB-1; docs/contracts.md defines none).
 */
export function ComplaintListView({ result, retryHref }: { result: Loadable<ComplaintListItem[]>; retryHref?: string }) {
  if (result.status !== "ok") {
    return <StateMessage state={result} emptyKey="list.empty" retryHref={retryHref} />;
  }
  const rows = result.data.slice(0, COMPLAINT_LIST_PAGE_SIZE);
  return (
    <section>
      <p>{t("list.showing", { n: rows.length, total: result.data.length })}</p>
      <table className="ww-table">
        <thead>
          <tr>
            <th scope="col">{t("list.col.priority")}</th>
            <th scope="col">{t("list.col.waterPoint")}</th>
            <th scope="col">{t("list.col.problem")}</th>
            <th scope="col">{t("list.col.people")}</th>
            <th scope="col">{t("list.col.schoolClinic")}</th>
            <th scope="col">{t("list.col.duration")}</th>
            <th scope="col">{t("list.col.reports")}</th>
            <th scope="col">{t("list.col.status")}</th>
            <th scope="col">{t("list.col.updated")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ complaint, waterPoint }) => {
            const unverified = waterPoint?.verificationState === "unverified";
            return (
              <tr key={complaint.id} className={unverified ? "ww-row-unverified" : undefined}>
                <td>{t("list.priorityReason", { score: complaint.priorityScore, reason: complaint.scoreReason })}</td>
                <td>
                  <Link
                    href={`/complaints/${encodeURIComponent(complaint.id)}`}
                    aria-label={waterPoint ? `${typeText(waterPoint.type)}, ${waterPoint.locationText}` : t("common.unknown")}
                  >
                    <strong>{waterPoint ? typeText(waterPoint.type) : t("common.unknown")}</strong>
                  </Link>
                  <div>{waterPoint?.locationText ?? t("common.unknown")}</div>
                  {unverified && <span className="ww-badge">{t("common.unverified")}</span>}
                </td>
                <td>{problemText(complaint.problem)}</td>
                <td>{peopleText(complaint.peopleAffected)}</td>
                <td>{schoolClinicText(complaint.servesSchoolOrClinic)}</td>
                <td>{durationText(complaint.duration)}</td>
                <td>{complaint.reportCount}</td>
                <td>
                  <span className="ww-badge">{t(`status.${complaint.status}`)}</span>
                  {complaint.needsReview && (
                    <span className="ww-badge ww-badge-review">
                      <span aria-hidden="true">{WARNING}</span>
                      {" "}
                      {t("common.needsReview")}
                    </span>
                  )}
                </td>
                <td>{timeText(complaint.updatedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
