import type { Loadable } from "@/lib/data/complaints";
import { t, type PlainKey } from "@/lib/i18n/strings";

import "./complaints.css";

/**
 * Loading, empty and error messages shared by the complaint screens, with the
 * wording from docs/ux-screen-notes.md. A missing record and another
 * organization's record share one message so existence is never revealed.
 */
export function StateMessage({
  state,
  emptyKey,
  retryHref,
}: {
  state: Exclude<Loadable<unknown>, { status: "ok" }>;
  emptyKey: PlainKey;
  retryHref?: string;
}) {
  if (state.status === "loading") return <p role="status">{t("common.loading")}</p>;
  if (state.status === "empty") return <p>{t(emptyKey)}</p>;

  const key: PlainKey =
    state.error === "denied" ? "common.denied" : state.error === "not_found_or_denied" ? "detail.notFoundOrDenied" : "common.error";
  return (
    <div role="alert" className="ww-state-error">
      <p>{t(key)}</p>
      {state.error === "failed" && retryHref && <a href={retryHref}>{t("common.retry")}</a>}
    </div>
  );
}
