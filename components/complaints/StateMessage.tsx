import type { Loadable } from "@/lib/data/complaints";
import { t, type PlainKey } from "@/lib/i18n/strings";

import "./complaints.css";

/**
 * A retry link must be a same-site path: it starts with one slash and holds
 * only plain URL characters. Anything else (another site, "//host", a
 * "javascript:" URL, a backslash) is not rendered, so a route that builds this
 * from user input cannot make an open redirect.
 */
export function isSafeRetryHref(href: string | undefined): href is string {
  return typeof href === "string" && /^\/(?!\/)[A-Za-z0-9\-_.~/?=&%#]*$/.test(href);
}

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
  if (state.status === "loading") return <p role="status" className="ww-state">{t("common.loading")}</p>;
  if (state.status === "empty") return <p className="ww-state">{t(emptyKey)}</p>;

  const key: PlainKey =
    state.error === "denied" ? "common.denied" : state.error === "not_found_or_denied" ? "detail.notFoundOrDenied" : "common.error";
  return (
    <div role="alert" className="ww-state-error">
      <p>{t(key)}</p>
      {state.error === "failed" && isSafeRetryHref(retryHref) && <a href={retryHref} className="ww-btn">{t("common.retry")}</a>}
    </div>
  );
}
