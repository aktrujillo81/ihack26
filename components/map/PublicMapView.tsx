import { TILE_SOURCE } from "@/lib/config/map";
import { listPublicWaterPoints, type PublicScope } from "@/lib/data/complaints";
import { t } from "@/lib/i18n/strings";

import { MapLegend } from "./MapLegend";
import { PinList } from "./PinList";
import { toPublicMapPins } from "./publicPins";
import { Renderer } from "./renderer";

/**
 * Server component for the PUBLIC map: status only. Shows each water point's
 * type, a status shape with its text label, and whether it is unverified. It
 * shows no report details, no transcripts, no spoken location text, no counts
 * and nothing about callers, because the only data it can receive is
 * `PublicPin` from the separate public read in lib/data/complaints.ts.
 *
 * It reads no session and has no user. `scope` is the configured public scope
 * (lib/config/public-map.ts); when it is null the map is empty.
 */
export async function PublicMapView({ scope }: { scope: PublicScope | null }) {
  const result = await listPublicWaterPoints(scope);
  if (result.status === "error") return <p role="alert">{t("common.error")}</p>;
  if (result.status === "empty") return <p>{t("map.empty")}</p>;

  const pins = toPublicMapPins(result.data);
  return (
    <div>
      <Renderer pins={pins} tileSource={TILE_SOURCE} />
      <MapLegend />
      <PinList pins={pins} />
    </div>
  );
}
