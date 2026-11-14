"use client";

import { useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { LayerGroup, Map as LeafletMapInstance } from "leaflet";
import "leaflet/dist/leaflet.css";

import { TILE_ERROR_LIMIT } from "@/lib/config/map";
import { t } from "@/lib/i18n/strings";

import "./map.css";
import { PinMarker, pinLabelLines } from "./PinMarker";
import type { MapRendererProps } from "./types";

type LeafletModule = typeof import("leaflet");

/**
 * Leaflet implementation of `MapRenderer`. It receives pins and a tile source
 * as props. It reads no session and fetches nothing except map tiles from the
 * configured source, and only the tiles for the current view (no prefetching).
 *
 * The map is created once. Pin changes only replace the markers, so live
 * updates (MP-4) will not reset the zoom or refetch tiles. The view is fitted
 * to the pins only when the set of pins changes.
 *
 * If tiles fail repeatedly it drops them and keeps the plain background, so a
 * rate limit or block can never blank the pins. The text list below the map
 * carries the same information.
 */
export function LeafletMap({ pins, tileSource }: MapRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ L: LeafletModule; map: LeafletMapInstance; markers: LayerGroup } | null>(null);
  const fittedFor = useRef<string>("");
  const [ready, setReady] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  // Create the map (and its tile layer) once per tile source.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let dispose = () => {};

    import("leaflet")
      .then((L) => {
        if (disposed) return;
        const map = L.map(container, {
          attributionControl: true,
          zoomControl: false,
          // The map pans and zooms with the keyboard. Pins themselves are not tab stops until they
          // do something (MP-7); the text list below the map is the keyboard path to the same information.
          keyboard: true,
        });
        L.control.zoom({ zoomInTitle: t("map.zoomIn"), zoomOutTitle: t("map.zoomOut") }).addTo(map);
        // The library's own scale bar (metric). Styled in map.css; it reads no data.
        L.control.scale({ imperial: false }).addTo(map);
        map.attributionControl.setPrefix(false);

        setTilesFailed(false);
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
            if (loaded === 0 && errors >= TILE_ERROR_LIMIT && !disposed) {
              map.removeLayer(layer);
              setTilesFailed(true);
            }
          });
          layer.addTo(map);
        }

        mapRef.current = { L, map, markers: L.layerGroup().addTo(map) };
        fittedFor.current = "";
        dispose = () => {
          mapRef.current = null;
          map.remove();
        };
        setReady(true);
      })
      .catch(() => {
        if (!disposed) setLoadFailed(true);
      });

    return () => {
      disposed = true;
      setReady(false);
      dispose();
    };
  }, [tileSource]);

  // Replace markers whenever the pins change. Keep the user's zoom unless the set of pins changed.
  useEffect(() => {
    const current = mapRef.current;
    if (!ready || !current) return;
    const { L, map, markers } = current;
    markers.clearLayers();

    for (const pin of pins) {
      const icon = L.divIcon({
        className: "ww-pin-marker",
        html: renderToStaticMarkup(<PinMarker pin={pin} />),
        // The marker is just the pin glyph, centered on the point; its label chip sits beside it (map.css).
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      // No `title`: it would be a hover-only tooltip. The label is always visible.
      const marker = L.marker([pin.lat, pin.lng], { icon, keyboard: false });
      const name = [pin.locationText, ...pinLabelLines(pin)].filter(Boolean).join(". ");
      marker.once("add", () => marker.getElement()?.setAttribute("aria-label", name));
      marker.addTo(markers);
    }

    const key = pins.map((p) => p.id).sort().join("|");
    if (key !== fittedFor.current) {
      fittedFor.current = key;
      if (pins.length === 1) map.setView([pins[0].lat, pins[0].lng], 15);
      else if (pins.length > 1) map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])), { padding: [80, 80] });
    }
  }, [pins, ready]);

  return (
    <>
      {loadFailed && (
        <p className="ww-map-notice" role="alert">
          {t("common.error")}
        </p>
      )}
      {tilesFailed && (
        <p className="ww-map-notice" role="status">
          {t("map.tilesFailed")}
        </p>
      )}
      <div className="ww-map-frame">
        <div ref={containerRef} className="ww-map" />
        {/* Said only when the plain grid is what is showing: no tile source, or the tiles failed. */}
        {(!tileSource || tilesFailed) && <span className="ww-map-tag">{t("map.basemapPlaceholder")}</span>}
      </div>
    </>
  );
}
