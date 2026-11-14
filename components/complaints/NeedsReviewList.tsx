import { listNeedsReview, type DataContext, type NeedsReviewItem } from "@/lib/data/complaints";
import { t } from "@/lib/i18n/strings";

import { StateMessage } from "./StateMessage";
import { problemText, timeText } from "./format";

import "./complaints.css";

/** The rows only. Safe fields: reason code, received time, problem, spoken location. No transcript, no summary, no caller details. */
export function NeedsReviewTable({ items }: { items: readonly NeedsReviewItem[] }) {
  return (
    <>
      <p className="ww-state" role="status">{t("needsReview.count", { count: items.length })}</p>
      <div className="ww-table-scroll">
        <table className="ww-table">
          <thead>
            <tr>
              <th scope="col">{t("needsReview.col.reason")}</th>
              <th scope="col">{t("needsReview.col.received")}</th>
              <th scope="col">{t("needsReview.col.problem")}</th>
              <th scope="col">{t("needsReview.col.location")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ report }) => (
              <tr key={report.id}>
                <td>
                  <span className="ww-tag">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                      <path d="M5 21V4m0 0h11l-2 4 2 4H5" />
                    </svg>
                    {report.needsReviewReason ? t("common.needsReviewWithReason", { reason: report.needsReviewReason }) : t("common.needsReview")}
                  </span>
                </td>
                <td>{timeText(report.receivedAt)}</td>
                <td>{problemText(report.problem)}</td>
                <td>{report.locationText}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Server component. The route passes the user's `DataContext`; this reads only through lib/data/complaints.ts. */
export async function NeedsReviewList({ ctx, retryHref }: { ctx: DataContext; retryHref?: string }) {
  const result = await listNeedsReview(ctx);
  if (result.status !== "ok") return <StateMessage state={result} emptyKey="needsReview.empty" retryHref={retryHref} />;
  return <NeedsReviewTable items={result.data} />;
}
