import type { ComplaintListItem, Loadable } from "@/lib/data/complaints";

import { ComplaintListTable } from "./ComplaintListTable";
import "./complaints.css";
import { summaryCounts } from "./listQuery";
import { StateMessage } from "./StateMessage";
import { SummaryStrip } from "./SummaryStrip";

/**
 * Presentational complaint list (W2). Everything it shows comes in as `result`,
 * so every state is renderable and testable. It reads no session. The list
 * holds no transcripts: `ComplaintListItem` has none.
 *
 * The summary strip counts all the rows loaded; the table below it filters,
 * searches and sorts those same rows in the browser (ComplaintListTable).
 *
 * Columns are PROVISIONAL (spec DB-1; docs/contracts.md defines none).
 */
export function ComplaintListView({ result, retryHref }: { result: Loadable<ComplaintListItem[]>; retryHref?: string }) {
  if (result.status !== "ok") {
    return <StateMessage state={result} emptyKey="list.empty" retryHref={retryHref} />;
  }
  return (
    <div className="ww-list-stack">
      <SummaryStrip counts={summaryCounts(result.data)} />
      <ComplaintListTable items={result.data} />
    </div>
  );
}
