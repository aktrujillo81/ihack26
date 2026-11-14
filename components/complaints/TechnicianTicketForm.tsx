"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/Button";
import type { WaterPoint } from "@/lib/domain/types";
import { createComplaintTechnicianTicketAction } from "@/lib/actions/technician";
import { INITIAL_ACTION_STATE, actionMessageKey, type ActionState } from "@/lib/actions/state";
import { MAX_TICKET_ISSUE_LENGTH, MAX_TICKET_LOCATION_LENGTH, MAX_TICKET_NOTES_LENGTH } from "@/lib/config/limits";
import { t } from "@/lib/i18n/strings";

export function TechnicianTicketForm({ complaintId, waterPoint }: { complaintId: string; waterPoint: WaterPoint }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (previous: ActionState, formData: FormData) => createComplaintTechnicianTicketAction(previous, formData),
    INITIAL_ACTION_STATE,
  );
  const messageKey = actionMessageKey(state);
  if (!open && state.status !== "saved") return <Button onClick={() => setOpen(true)}>{t("detail.addTechnicianTicket")}</Button>;
  return (
    <div className="ww-technician-ticket-form">
      {state.status === "saved" ? (
        <p className="ww-saved" role="status">{t("detail.saved")}</p>
      ) : (
        <form action={formAction} aria-busy={pending}>
          <input type="hidden" name="complaintId" value={complaintId} />
          <label>{t("detail.technicianTicketLocation")}<input name="locationText" defaultValue={waterPoint.locationText} maxLength={MAX_TICKET_LOCATION_LENGTH} required disabled={pending} /></label>
          <label>{t("detail.technicianTicketIssue")}<textarea name="issueSummary" maxLength={MAX_TICKET_ISSUE_LENGTH} required disabled={pending} /></label>
          <label>{t("detail.technicianTicketNotes")}<textarea name="notes" maxLength={MAX_TICKET_NOTES_LENGTH} disabled={pending} /></label>
          <label>{t("detail.technicianTicketLatitude")}<input name="latitude" type="number" step="0.000001" min="-90" max="90" defaultValue={waterPoint.latitude ?? ""} required disabled={pending} /></label>
          <label>{t("detail.technicianTicketLongitude")}<input name="longitude" type="number" step="0.000001" min="-180" max="180" defaultValue={waterPoint.longitude ?? ""} required disabled={pending} /></label>
          <p>{t("detail.technicianTicketHelp")}</p>
          <div className="ww-controls"><Button type="submit" variant="primary" disabled={pending}>{t("detail.createTechnicianTicket")}</Button><Button onClick={() => setOpen(false)} disabled={pending}>{t("common.cancel")}</Button></div>
          {messageKey && <p role="alert" className="ww-state-error">{t(messageKey)}</p>}
        </form>
      )}
    </div>
  );
}
