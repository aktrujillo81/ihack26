"use client";

import { useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "leaflet/dist/leaflet.css";

import { TILE_ERROR_LIMIT } from "@/lib/config/map";
import { t } from "@/lib/i18n/strings";

import "./map.css";
import { PinMarker, pinLabelLines } from "./PinMarker";
import type { MapRendererProps } from "./types";

/**
 * Leaflet implementation of `MapRenderer`. It receives pins and a tile source
 * as props. It reads no session and fetches nothing except map tiles from the
 * configured source, and only the tiles for the current view (no prefetching).
 *
 * If tiles fail repeatedly it drops them and keeps the plain background, so a
 * rate limit or block can never blank the pins.
 */
export function LeafletMap({ pins, tileSource }: MapRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tilesFailed, setTilesFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let cleanup = () => {};

    void import("leaflet").then((L) => {
      if (disposed) return;
      const map = L.map(container, { attributionControl: true, zoomControl: true, keyboard: true });
      map.attributionControl.setPrefix(false);

      if (tileSource) {
        let errors = 0;
        let loaded = 0;
        // Do not set referrerPolicy: the tile policy expects a valid Referer.
        const layer = L.tileLayer(tileSource.urlTemplate, {
          attribution: tileSource.attribution,
          maxZoom: tileSource.maxZoom,
        });
        layer.on("tileload", () => {
          loaded += 1;
        });
        layer.on("tileerror", () => {
          errors += 1;
          if (loaded === 0 && errors >= TILE_ERROR_LIMIT) {
            map.removeLayer(layer);
            setTilesFailed(true);
          }
        });
        layer.addTo(map);
      }

      const bounds = L.latLngBounds([]);
      for (const pin of pins) {
        const icon = L.divIcon({
          className: "ww-pin-marker",
          html: renderToStaticMarkup(<PinMarker pin={pin} />),
          iconSize: [160, 100],
          iconAnchor: [80, 20],
        });
        // No `title`: it would create a hover-only tooltip. The label is always visible.
        const marker = L.marker([pin.lat, pin.lng], { icon, keyboard: true }).addTo(map);
        marker.getElement()?.setAttribute("aria-label", [pin.locationText, ...pinLabelLines(pin)].filter(Boolean).join(". "));
        bounds.extend([pin.lat, pin.lng]);
      }
      if (pins.length === 1) map.setView([pins[0].lat, pins[0].lng], 15);
      else if (bounds.isValid()) map.fitBounds(bounds, { padding: [80, 80] });

      cleanup = () => map.remove();
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [pins, tileSource]);

  return (
    <>
      {tilesFailed && (
        <p className="ww-map-notice" role="status">
          {t("map.tilesFailed")}
        </p>
      )}
      <div ref={containerRef} className="ww-map" />
    </>
  );
}
