import { t } from "@/lib/i18n/strings";

import "./ui.css";

/** Dashed-border tag for the page header whenever the data shown is not live. */
export function SampleDataTag() {
  return <span className="ww-sample-tag">{t("common.sampleData")}</span>;
}
