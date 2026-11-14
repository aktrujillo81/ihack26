import { Panel } from "@/components/ui/Panel";
import { StatusShape } from "@/components/ui/StatusChip";
import { t } from "@/lib/i18n/strings";

import "./list.css";
import type { SummaryCounts } from "./listQuery";

/**
 * One bordered panel split into equal cells: Open, Passed on, Fixed and Needs
 * review. The numbers are counts of the rows the list loaded (whatever the
 * filter says), so they are real; each cell has a shape or icon and a word,
 * never color alone. Captions describe a state, never a promise.
 */
export function SummaryStrip({ counts }: { counts: SummaryCounts }) {
  const cells = [
    { key: "open", label: t("status.open"), caption: t("list.summary.open"), value: counts.open, icon: <StatusShape kind="open" /> },
    { key: "passed_on", label: t("status.passed_on"), caption: t("list.summary.passed_on"), value: counts.passed_on, icon: <StatusShape kind="passed_on" /> },
    { key: "fixed", label: t("status.fixed"), caption: t("list.summary.fixed"), value: counts.fixed, icon: <StatusShape kind="fixed" /> },
    {
      key: "needsReview",
      label: t("common.needsReview"),
      caption: t("list.summary.needsReview"),
      value: counts.needsReview,
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M5 21V4m0 0h11l-2 4 2 4H5" />
        </svg>
      ),
    },
  ] as const;
  return (
    <Panel as="section" padded={false} className="ww-summary" aria-label={t("list.summary.title")}>
      {cells.map((cell) => (
        <div key={cell.key} className={`ww-summary-cell ww-summary-${cell.key}`}>
          <div className="ww-summary-label">
            {cell.icon}
            {cell.label}
          </div>
          <div className="ww-summary-value">{cell.value}</div>
          <div className="ww-summary-caption">{cell.caption}</div>
        </div>
      ))}
    </Panel>
  );
}
