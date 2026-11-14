import type { Metadata } from "next";
import { Suspense } from "react";

import { MapLoading } from "@/components/map/MapLoading";
import { MapView } from "@/components/map/MapView";
import { toDataContext } from "@/lib/auth/guards";
import { requirePageSession } from "@/lib/auth/page-guard";
import { t } from "@/lib/i18n/strings";

export const metadata: Metadata = { title: t("nav.map") };

// Per-user data: never cached or shared between users.
export const dynamic = "force-dynamic";

/**
 * The SIGNED-IN map. The public, status-only map is a different page at /map
 * and shows no detail. This one uses the session's scope.
 */
export default async function SignedInMapPage() {
  // Checked here as well as in the layout: layouts do not re-run on navigation.
  const session = await requirePageSession();
  return (
    <main>
      <h1>{t("nav.map")}</h1>
      <Suspense fallback={<MapLoading />}>
        <MapView ctx={toDataContext(session)} />
      </Suspense>
    </main>
  );
}
