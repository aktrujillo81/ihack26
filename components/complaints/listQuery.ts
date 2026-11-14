/**
 * Filter, search, sort and summary counts for the complaint list. Pure
 * functions over the rows the page already loaded: nothing here reads data,
 * and the data layer's query is unchanged. Anything that is not understood in
 * the URL falls back to the default, so a bad link shows the normal list.
 *
 * The URL parameters (all optional, defaults omitted): `status`, `q`, `sort`, `dir`.
 */
import type { ComplaintListItem } from "@/lib/data/complaints";
import { COMPLAINT_STATUSES, type ComplaintStatus } from "@/lib/domain/types";

import { typeText } from "./format";

export type StatusFilter = "all" | ComplaintStatus;
export const SORT_KEYS = ["priority", "waterPoint", "status", "reports", "updated"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

export interface ListQuery {
  status: StatusFilter;
  q: string;
  sort: SortKey;
  dir: SortDir;
}

/** Most urgent first: the order the data layer already returns (score, then newest). */
export const DEFAULT_QUERY: ListQuery = { status: "all", q: "", sort: "priority", dir: "desc" };

export const MAX_SEARCH_LENGTH = 100;

/** The least that `URLSearchParams` and Next's `ReadonlyURLSearchParams` both offer. */
export interface ParamSource {
  get(name: string): string | null;
}

const isStatus = (value: string | null): value is ComplaintStatus => value !== null && (COMPLAINT_STATUSES as readonly string[]).includes(value);
const isSortKey = (value: string | null): value is SortKey => value !== null && (SORT_KEYS as readonly string[]).includes(value);

export function parseListQuery(params: ParamSource | null | undefined): ListQuery {
  if (!params) return DEFAULT_QUERY;
  const status = params.get("status");
  const sort = params.get("sort");
  const dir = params.get("dir");
  return {
    status: isStatus(status) ? status : "all",
    q: (params.get("q") ?? "").trim().slice(0, MAX_SEARCH_LENGTH),
    sort: isSortKey(sort) ? sort : DEFAULT_QUERY.sort,
    dir: dir === "asc" || dir === "desc" ? dir : DEFAULT_QUERY.dir,
  };
}

/** The URL parameters for a query. A value equal to its default is left out, so the plain list has a plain URL. */
export function toSearchParams(query: ListQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.status !== "all") params.set("status", query.status);
  if (query.q.trim() !== "") params.set("q", query.q.trim().slice(0, MAX_SEARCH_LENGTH));
  if (query.sort !== DEFAULT_QUERY.sort || query.dir !== DEFAULT_QUERY.dir) {
    params.set("sort", query.sort);
    params.set("dir", query.dir);
  }
  return params;
}

/** The text a search looks in: the water point's type word and its location text. Nothing from reports or transcripts. */
function searchText({ waterPoint }: ComplaintListItem): string {
  return waterPoint ? `${typeText(waterPoint.type)} ${waterPoint.locationText}`.toLowerCase() : "";
}

const STATUS_ORDER: Record<string, number> = { open: 0, passed_on: 1, fixed: 2 };

function compare(a: ComplaintListItem, b: ComplaintListItem, sort: SortKey): number {
  switch (sort) {
    case "priority":
      return a.complaint.priorityScore - b.complaint.priorityScore;
    case "reports":
      return a.complaint.reportCount - b.complaint.reportCount;
    case "updated":
      return a.complaint.updatedAt < b.complaint.updatedAt ? -1 : a.complaint.updatedAt > b.complaint.updatedAt ? 1 : 0;
    case "status":
      return (STATUS_ORDER[a.complaint.status] ?? 99) - (STATUS_ORDER[b.complaint.status] ?? 99);
    case "waterPoint": {
      const name = (item: ComplaintListItem) => (item.waterPoint ? `${typeText(item.waterPoint.type)} ${item.waterPoint.locationText}` : "");
      return name(a).localeCompare(name(b));
    }
  }
}

/** Filters by status and search, then sorts. Ties keep the order the data layer gave (a stable sort), in either direction. */
export function applyListQuery(items: readonly ComplaintListItem[], query: ListQuery): ComplaintListItem[] {
  const needle = query.q.trim().toLowerCase();
  const kept = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => (query.status === "all" || item.complaint.status === query.status) && (needle === "" || searchText(item).includes(needle)));
  const sign = query.dir === "asc" ? 1 : -1;
  kept.sort((a, b) => sign * compare(a.item, b.item, query.sort) || a.index - b.index);
  return kept.map(({ item }) => item);
}

export interface SummaryCounts {
  open: number;
  passed_on: number;
  fixed: number;
  /** Complaints flagged for staff review (the same flag the rows show). */
  needsReview: number;
}

/** Counts over ALL loaded rows, whatever the filter says. */
export function summaryCounts(items: readonly ComplaintListItem[]): SummaryCounts {
  const counts: SummaryCounts = { open: 0, passed_on: 0, fixed: 0, needsReview: 0 };
  for (const { complaint } of items) {
    if (complaint.status === "open" || complaint.status === "passed_on" || complaint.status === "fixed") counts[complaint.status] += 1;
    if (complaint.needsReview) counts.needsReview += 1;
  }
  return counts;
}
