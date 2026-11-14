"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMapInstance, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

import { LOCATION_EDITOR_CENTER, TILE_SOURCE } from "@/lib/config/map";
import { t } from "@/lib/i18n/strings";

import "./map-picker.css";

export function LocationPicker({ latitude, longitude, onChange }: { latitude: string; longitude: string; onChange: (latitude: string, longitude: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const markerRef = useRef<Marker | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let cleanup = () => {};
    import("leaflet").then((L) => {
      if (disposed) return;
      const parsedLat = Number(latitude);
      const parsedLon = Number(longitude);
      const hasPosition = latitude.trim() !== "" && longitude.trim() !== "" && Number.isFinite(parsedLat) && Number.isFinite(parsedLon);
      const initialCenter: [number, number] = hasPosition ? [parsedLat, parsedLon] : [LOCATION_EDITOR_CENTER[0], LOCATION_EDITOR_CENTER[1]];
      const initialZoom = hasPosition ? 14 : 13;
      const map = L.map(container, { zoomControl: true, attributionControl: true });
      map.setView(initialCenter, initialZoom);
      const writeCenter = () => {
        const center = map.getCenter();
        container.dataset.mapCenterLatitude = center.lat.toFixed(6);
        container.dataset.mapCenterLongitude = center.lng.toFixed(6);
      };
      writeCenter();
      map.on("moveend", writeCenter);
      if (TILE_SOURCE) L.tileLayer(TILE_SOURCE.urlTemplate, { attribution: TILE_SOURCE.attribution, maxZoom: TILE_SOURCE.maxZoom }).addTo(map);
      const icon = L.divIcon({ className: "ww-location-marker", html: "", iconSize: [22, 22], iconAnchor: [11, 11] });
      const placeMarker = (lat: number, lon: number) => {
        if (!markerRef.current) {
          markerRef.current = L.marker([lat, lon], { icon, draggable: true }).addTo(map);
          markerRef.current.on("dragend", () => {
            const position = markerRef.current?.getLatLng();
            if (position) onChange(position.lat.toFixed(6), position.lng.toFixed(6));
          });
        } else markerRef.current.setLatLng([lat, lon]);
      };
      if (hasPosition) placeMarker(parsedLat, parsedLon);
      const handleClick = (event: { latlng: { lat: number; lng: number } }) => {
        placeMarker(event.latlng.lat, event.latlng.lng);
        onChange(event.latlng.lat.toFixed(6), event.latlng.lng.toFixed(6));
      };
      map.on("click", handleClick);
      mapRef.current = map;
      cleanup = () => { map.off("click", handleClick); map.off("moveend", writeCenter); markerRef.current?.remove(); markerRef.current = null; map.remove(); mapRef.current = null; };
    }).catch(() => {});
    return () => { disposed = true; cleanup(); };
  // The map is created once; coordinate changes are applied by the second effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    const lat = Number(latitude); const lon = Number(longitude);
    if (map && marker && Number.isFinite(lat) && Number.isFinite(lon)) marker.setLatLng([lat, lon]);
  }, [latitude, longitude]);

  return <div className="ww-location-picker-wrap">
    <div ref={containerRef} className="ww-location-picker" role="application" aria-label={t("detail.locationPickerLabel")} />
    <p className="ww-card-note-text">{t("detail.locationPickerHelp")}</p>
  </div>;
}
