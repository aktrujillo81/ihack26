"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { PriorityBars } from "@/components/ui/PriorityBars";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StatusChip } from "@/components/ui/StatusChip";
import { COMPLAINT_LIST_PAGE_SIZE } from "@/lib/config/ui";
import type { ComplaintListItem } from "@/lib/data/complaints";
import { priorityLevel } from "@/lib/domain/priority";
import { t, type PlainKey } from "@/lib/i18n/strings";

import { durationText, peopleText, problemText, schoolClinicText, timeText, typeText } from "./format";
import "./list.css";
import { applyListQuery, DEFAULT_QUERY, parseListQuery, toSearchParams, type ListQuery, type SortKey, type StatusFilter } from "./listQuery";

const FILTER_OPTIONS: readonly { value: StatusFilter; label: string }[] = [
  { value: "all", label: t("list.filter.all") },
  { value: "open", label: t("status.open") },
  { value: "passed_on", label: t("status.passed_on") },
  { value: "fixed", label: t("status.fixed") },
];

/** Columns in order. `sort` is set when the header can sort. */
const COLUMNS: readonly { key: string; label: PlainKey; sort?: SortKey; className: string }[] = [
  { key: "waterPoint", label: "list.col.waterPoint", sort: "waterPoint", className: "ww-col-point" },
  { key: "status", label: "list.col.status", sort: "status", className: "ww-col-status" },
  { key: "priority", label: "list.col.priority", sort: "priority", className: "ww-col-priority" },
  { key: "problem", label: "list.col.problem", className: "ww-col-problem" },
  { key: "people", label: "list.col.people", className: "ww-col-people" },
  { key: "schoolClinic", label: "list.col.schoolClinic", className: "ww-col-school" },
  { key: "duration", label: "list.col.duration", className: "ww-col-duration" },
  { key: "reports", label: "list.col.reports", sort: "reports", className: "ww-col-count" },
  { key: "updated", label: "list.col.updated", sort: "updated", className: "ww-col-time" },
];

function SortIcon({ dir }: { dir: "asc" | "desc" }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={dir === "asc" ? "M6 10V2M2.5 5.5 6 2l3.5 3.5" : "M6 2v8M2.5 6.5 6 10l3.5-3.5"} />
    </svg>
  );
}

/**
 * The complaint table with its status filter, search and sortable headers.
 * Everything works on the rows the page already loaded: no query changes. The
 * state lives in the URL (`status`, `q`, `sort`, `dir`) so a view can be shared
 * or reloaded; the URL is updated in place, without a navigation. Cells never
 * wrap (long text ends in an ellipsis, and the full text is still in the page).
 * The list holds no transcripts: `ComplaintListItem` has none.
 */
export function ComplaintListTable({ items }: { items: readonly ComplaintListItem[] }) {
  const params = useSearchParams();
  const [query, setQuery] = useState<ListQuery>(() => parseListQuery(params));

  function update(next: ListQuery) {
    setQuery(next);
    const qs = toSearchParams(next).toString();
    window.history.replaceState(window.history.state, "", qs === "" ? window.location.pathname : `${window.location.pathname}?${qs}`);
  }

  const matching = applyListQuery(items, query);
  const rows = matching.slice(0, COMPLAINT_LIST_PAGE_SIZE);

  function sortBy(sort: SortKey) {
    // The same column flips direction; a new column starts descending for numbers and times, ascending for words.
    const wordsFirst = sort === "waterPoint" || sort === "status";
    update({ ...query, sort, dir: query.sort === sort ? (query.dir === "asc" ? "desc" : "asc") : wordsFirst ? "asc" : "desc" });
  }

  return (
    <Panel as="section" padded={false} className="ww-list">
      <div className="ww-list-toolbar">
        <SegmentedControl label={t("list.filter.label")} options={FILTER_OPTIONS} value={query.status} onChange={(status) => update({ ...query, status })} />
        <div className="ww-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            name="q"
            value={query.q}
            maxLength={100}
            placeholder={t("list.search.label")}
            aria-label={t("list.search.label")}
            onChange={(event) => update({ ...query, q: event.target.value })}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="ww-list-nomatch">
          <p>{t("list.noMatches")}</p>
          <Button onClick={() => update(DEFAULT_QUERY)}>{t("list.clearFilters")}</Button>
        </div>
      ) : (
        <div className="ww-table-scroll">
          <table className="ww-table ww-list-table">
            <thead>
              <tr>
                {COLUMNS.map((column) => {
                  const sort = column.sort;
                  const active = sort !== undefined && query.sort === sort;
                  return (
                    <th key={column.key} scope="col" className={column.className} aria-sort={active ? (query.dir === "asc" ? "ascending" : "descending") : undefined}>
                      {sort ? (
                        <button type="button" className="ww-sort" onClick={() => sortBy(sort)} aria-label={t("list.sortBy", { column: t(column.label) })}>
                          {t(column.label)}
                          {active && <SortIcon dir={query.dir} />}
                        </button>
                      ) : (
                        t(column.label)
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ complaint, waterPoint }) => {
                const unverified = waterPoint?.verificationState === "unverified";
                const priority = t("list.priorityReason", { score: complaint.priorityScore, reason: complaint.scoreReason });
                return (
                  <tr key={complaint.id} className={unverified ? "ww-row-unverified" : undefined}>
                    <td className="ww-col-point">
                      <div className="ww-cell-line">
                        <Link
                          href={`/complaints/${encodeURIComponent(complaint.id)}`}
                          className="ww-row-link"
                          aria-label={waterPoint ? `${typeText(waterPoint.type)}, ${waterPoint.locationText}` : t("common.unknown")}
                        >
                          {waterPoint ? typeText(waterPoint.type) : t("common.unknown")}
                        </Link>
                        {unverified && <span className="ww-tag ww-tag--dashed">{t("common.unverified")}</span>}
                        {complaint.needsReview && (
                          <span className="ww-tag">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                              <path d="M5 21V4m0 0h11l-2 4 2 4H5" />
                            </svg>
                            {complaint.needsReviewReason ? t("common.needsReviewWithReason", { reason: complaint.needsReviewReason }) : t("common.needsReview")}
                          </span>
                        )}
                      </div>
                      <div className="ww-cell-sub" title={waterPoint?.locationText}>
                        {waterPoint?.locationText ?? t("common.unknown")}
                      </div>
                    </td>
                    <td className="ww-col-status">
                      <StatusChip status={complaint.status} />
                    </td>
                    <td className="ww-col-priority">
                      <PriorityBars level={priorityLevel(complaint.priorityScore)} />
                      <div className="ww-cell-sub" title={priority}>
                        {priority}
                      </div>
                    </td>
                    <td className="ww-col-problem" title={problemText(complaint.problem)}>
                      {problemText(complaint.problem)}
                    </td>
                    <td className="ww-col-people">{peopleText(complaint.peopleAffected)}</td>
                    <td className="ww-col-school" title={schoolClinicText(complaint.servesSchoolOrClinic)}>
                      {schoolClinicText(complaint.servesSchoolOrClinic)}
                    </td>
                    <td className="ww-col-duration" title={durationText(complaint.duration)}>
                      {durationText(complaint.duration)}
                    </td>
                    <td className="ww-col-count">{complaint.reportCount}</td>
                    <td className="ww-col-time">{timeText(complaint.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="ww-list-footer" role="status">
        {t("list.showing", { n: rows.length, total: matching.length })}
      </div>
    </Panel>
  );
}
