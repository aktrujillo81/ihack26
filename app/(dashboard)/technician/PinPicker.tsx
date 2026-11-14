"use client";

import { useEffect, useRef, useState } from "react";
import type { LeafletMouseEvent, Map, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

import { t } from "@/lib/i18n/strings";

export function PinPicker() {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let active = true;
    import("leaflet").then((L) => {
      if (!active || !ref.current) return;
      const map = L.map(ref.current).setView([-1.2921, 36.8219], 12);
      mapRef.current = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors" }).addTo(map);
      map.on("click", (event: LeafletMouseEvent) => {
        markerRef.current?.remove();
        markerRef.current = L.marker(event.latlng).addTo(map);
        setPoint({ lat: event.latlng.lat, lng: event.latlng.lng });
      });
    });
    return () => {
      active = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="ww-tech-picker">
      <p>{t("technician.pinHelp")}</p>
      <div ref={ref} className="ww-tech-map" />
      {point && <p>{t("technician.pin", { lat: point.lat.toFixed(6), lng: point.lng.toFixed(6) })}</p>}
      <input name="latitude" type="hidden" value={point?.lat ?? ""} />
      <input name="longitude" type="hidden" value={point?.lng ?? ""} />
    </div>
  );
}
