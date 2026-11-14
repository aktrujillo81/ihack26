"use client";

import { useActionState } from "react";

import { addNoteAction } from "@/lib/actions/form-actions";
import { INITIAL_ACTION_STATE, actionMessageKey } from "@/lib/actions/state";
import { t } from "@/lib/i18n/strings";

import "./complaints.css";

/**
 * Add-a-note form. Only rendered for roles the matrix allows; the server
 * action refuses everyone else. The helper text warns against caller details.
 */
export function NoteForm({ complaintId }: { complaintId: string }) {
  const [state, formAction, pending] = useActionState(addNoteAction, INITIAL_ACTION_STATE);
  const messageKey = actionMessageKey(state);
  return (
    <form action={formAction} className="ww-note-form" aria-busy={pending}>
      <input type="hidden" name="complaintId" value={complaintId} />
      <label htmlFor="note-text">{t("detail.noteLabel")}</label>
      <textarea id="note-text" name="text" rows={3} maxLength={1000} required disabled={pending} />
      <p>{t("detail.noteHelp")}</p>
      <button type="submit" disabled={pending}>
        {t("detail.addNote")}
      </button>
      {messageKey !== null && (
        <p role="alert" className="ww-state-error">
          {t(messageKey)}
        </p>
      )}
    </form>
  );
}
