import { TILE_SOURCE } from "@/lib/config/map";
import { listComplaints, listNeedsLocation, listWaterPoints, type DataContext } from "@/lib/data/complaints";
import { t } from "@/lib/i18n/strings";

import { MapLegend } from "./MapLegend";
import { PinList } from "./PinList";
import { buildPins, type MapViewKind } from "./pins";
import { Renderer } from "./renderer";

/**
 * Server component. The caller passes the user's `DataContext` (taken from the
 * verified session by the route; W1 provides it). This component reads no
 * session itself and never builds a context. All reads go through
 * lib/data/complaints.ts.
 *
 * View built: "authenticated". The "public" shaping (status and report count
 * only) exists in `buildPins`, but no public route uses it; a public map is
 * cut from this build.
 */
export async function MapView({ ctx, view = "authenticated" }: { ctx: DataContext; view?: MapViewKind }) {
  const [waterPoints, complaints, needsLocation] = await Promise.all([
    listWaterPoints(ctx),
    listComplaints(ctx),
    listNeedsLocation(ctx),
  ]);

  const failure = [waterPoints, complaints].find((r) => r.status === "error");
  if (failure?.status === "error") {
    return <p role="alert">{failure.error === "denied" ? t("common.denied") : t("common.error")}</p>;
  }

  const pins = buildPins(
    waterPoints.status === "ok" ? waterPoints.data : [],
    complaints.status === "ok" ? complaints.data.map((i) => i.complaint) : [],
    view,
  );
  const needsLocationCount = needsLocation.status === "ok" ? needsLocation.data.length : 0;

  return (
    <div>
      {needsLocationCount > 0 && <p>{t("map.needsLocationCount", { n: needsLocationCount })}</p>}
      {pins.length === 0 ? (
        <p>{t("map.empty")}</p>
      ) : (
        <>
          <Renderer pins={pins} tileSource={TILE_SOURCE} />
          <MapLegend />
          <PinList pins={pins} />
        </>
      )}
    </div>
  );
}

export { MapLoading } from "./MapLoading";
