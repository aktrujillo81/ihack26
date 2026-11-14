"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/Button";
import { addNoteAction } from "@/lib/actions/form-actions";
import { INITIAL_ACTION_STATE, actionMessageKey, type ActionState } from "@/lib/actions/state";
import { MAX_NOTE_LENGTH } from "@/lib/config/limits";
import { t } from "@/lib/i18n/strings";

import "./complaints.css";

/**
 * Add-a-note form. Only rendered for roles the matrix allows; the server
 * action refuses everyone else. The helper text warns against caller details.
 *
 * The text is kept in state, so a refused or failed save never wipes what the
 * person typed. It is cleared only after a real save, and typing works again
 * straight away. The note's author is the signed-in user, set on the server.
 */
export function NoteForm({ complaintId }: { complaintId: string }) {
  const [text, setText] = useState("");
  const [state, formAction, pending] = useActionState(
    async (previous: ActionState, formData: FormData): Promise<ActionState> => {
      const next = await addNoteAction(previous, formData);
      if (next.status === "saved") setText("");
      return next;
    },
    INITIAL_ACTION_STATE,
  );
  const messageKey = actionMessageKey(state);
  const saved = state.status === "saved";
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
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <p>{t("detail.noteHelp")}</p>
      <Button type="submit" variant="primary" disabled={pending}>
        {t("detail.addNote")}
      </Button>
      {messageKey !== null && (
        <p role={saved ? "status" : "alert"} className={saved ? "ww-saved" : "ww-state-error"}>
          {t(messageKey)}
        </p>
      )}
    </form>
  );
}
