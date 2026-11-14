import type { Metadata } from "next";
import { Suspense } from "react";

import { MapLoading } from "@/components/map/MapView";
import { PublicMapView } from "@/components/map/PublicMapView";
import { publicMapScope } from "@/lib/config/public-map";
import { t } from "@/lib/i18n/strings";

export const metadata: Metadata = { title: t("map.publicTitle") };

// The public scope comes from the server environment at request time.
export const dynamic = "force-dynamic";

/**
 * Public map: status only. No session, no sign-in, and no complaint or report
 * detail. See components/map/PublicMapView.tsx.
 */
export default function PublicMapPage() {
  return (
    <main>
      <h1>{t("map.publicTitle")}</h1>
      <Suspense fallback={<MapLoading />}>
        <PublicMapView scope={publicMapScope()} />
      </Suspense>
    </main>
  );
}
