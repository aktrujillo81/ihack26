"use client";

import { useActionState, useState } from "react";

import { addNoteAction } from "@/lib/actions/form-actions";
import { INITIAL_ACTION_STATE, actionMessageKey } from "@/lib/actions/state";
import { MAX_NOTE_LENGTH } from "@/lib/config/limits";
import { t } from "@/lib/i18n/strings";

import "./complaints.css";

/**
 * Add-a-note form. Only rendered for roles the matrix allows; the server
 * action refuses everyone else. The helper text warns against caller details.
 *
 * The text is kept in state, so a refused or failed save never wipes what the
 * person typed. It is cleared only after a real save (the "saved" outcome,
 * which nothing returns until the complaint API is connected).
 */
export function NoteForm({ complaintId }: { complaintId: string }) {
  const [state, formAction, pending] = useActionState(addNoteAction, INITIAL_ACTION_STATE);
  const [text, setText] = useState("");
  const messageKey = actionMessageKey(state);
  const shown = state.status === "saved" ? "" : text;
  return (
    <form action={formAction} className="ww-note-form" aria-busy={pending}>
      <input type="hidden" name="complaintId" value={complaintId} />
      <label htmlFor="note-text">{t("detail.noteLabel")}</label>
      <textarea
        id="note-text"
        name="text"
        rows={3}
        maxLength={MAX_NOTE_LENGTH}
        required
        disabled={pending}
        value={shown}
        onChange={(event) => setText(event.target.value)}
      />
      <p>{t("detail.noteHelp")}</p>
      <button type="submit" disabled={pending}>
        {t("detail.addNote")}
      </button>
      {messageKey !== null && (
        <p role={state.status === "saved" ? "status" : "alert"} className={state.status === "saved" ? undefined : "ww-state-error"}>
          {t(messageKey)}
        </p>
      )}
    </form>
  );
}
