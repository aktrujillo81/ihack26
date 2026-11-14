"use client";

import { useActionState, useCallback, useState } from "react";

import { Button } from "@/components/ui/Button";
import type { WaterPoint } from "@/lib/domain/types";
import { updateLocationAction } from "@/lib/actions/form-actions";
import { INITIAL_ACTION_STATE, actionMessageKey, type ActionState } from "@/lib/actions/state";
import { t } from "@/lib/i18n/strings";
import { LocationPicker } from "./LocationPicker";

import "./complaints.css";

export function LocationEditor({ complaintId, version, waterPoint }: { complaintId: string; version: string; waterPoint: WaterPoint }) {
  const [locationText, setLocationText] = useState(waterPoint.locationText);
  const [latitude, setLatitude] = useState(waterPoint.latitude === null ? "" : String(waterPoint.latitude));
  const [longitude, setLongitude] = useState(waterPoint.longitude === null ? "" : String(waterPoint.longitude));
  const [state, formAction, pending] = useActionState(
    async (previous: ActionState, formData: FormData) => updateLocationAction(previous, formData),
    INITIAL_ACTION_STATE,
  );
  const messageKey = actionMessageKey(state);
  const updateCoordinates = useCallback((nextLatitude: string, nextLongitude: string) => { setLatitude(nextLatitude); setLongitude(nextLongitude); }, []);

  return (
    <form action={formAction} className="ww-note-form" aria-busy={pending}>
      <input type="hidden" name="complaintId" value={complaintId} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="verify" value="false" />
      <label htmlFor="location-text">{t("detail.locationTextLabel")}</label>
      <input id="location-text" name="locationText" value={locationText} onChange={(event) => setLocationText(event.target.value)} disabled={pending} required maxLength={500} />
      <label htmlFor="location-latitude">{t("detail.latitude")}</label>
      <input id="location-latitude" name="latitude" inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} disabled={pending} placeholder={t("common.unknown")} />
      <label htmlFor="location-longitude">{t("detail.longitude")}</label>
      <input id="location-longitude" name="longitude" inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} disabled={pending} placeholder={t("common.unknown")} />
      <LocationPicker latitude={latitude} longitude={longitude} onChange={updateCoordinates} />
      <div className="ww-controls">
        <Button type="submit" variant="primary" disabled={pending}>{t("detail.saveLocation")}</Button>
        <Button type="submit" name="verify" value="true" disabled={pending}>{t("detail.verifyLocation")}</Button>
      </div>
      {messageKey !== null && <p role={state.status === "saved" ? "status" : "alert"} className={state.status === "saved" ? "ww-saved" : "ww-state-error"}>{t(messageKey)}</p>}
    </form>
  );
}
