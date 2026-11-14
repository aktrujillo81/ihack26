import { t } from "@/lib/i18n/strings";

/** Shown while a map loads: use as the Suspense fallback. Its own file, so the public page does not import the authenticated map code. */
export function MapLoading() {
  return <p role="status">{t("common.loading")}</p>;
}
