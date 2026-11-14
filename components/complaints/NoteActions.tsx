"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/Button";
import type { Note } from "@/lib/domain/types";
import { archiveNoteAction, editNoteAction } from "@/lib/actions/form-actions";
import { INITIAL_ACTION_STATE, actionMessageKey, type ActionState } from "@/lib/actions/state";
import { MAX_NOTE_LENGTH } from "@/lib/config/limits";
import { t } from "@/lib/i18n/strings";

import "./complaints.css";

export function NoteActions({ complaintId, note }: { complaintId: string; note: Note }) {
  const [editing, setEditing] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [text, setText] = useState(note.text);
  const [editState, editFormAction, editPending] = useActionState(
    async (previous: ActionState, formData: FormData) => {
      const next = await editNoteAction(previous, formData);
      if (next.status === "saved") setEditing(false);
      return next;
    },
    INITIAL_ACTION_STATE,
  );
  const [archiveState, archiveFormAction, archivePending] = useActionState(archiveNoteAction, INITIAL_ACTION_STATE);
  const editMessageKey = actionMessageKey(editState);
  const archiveMessageKey = actionMessageKey(archiveState);

  if (editing) {
    return (
      <form action={editFormAction} className="ww-note-form" aria-busy={editPending}>
        <input type="hidden" name="complaintId" value={complaintId} />
        <input type="hidden" name="noteId" value={note.id} />
        <label htmlFor={`edit-note-${note.id}`}>{t("detail.noteLabel")}</label>
        <textarea id={`edit-note-${note.id}`} name="text" rows={3} maxLength={MAX_NOTE_LENGTH} required value={text} onChange={(event) => setText(event.target.value)} disabled={editPending} />
        <p>{t("detail.noteHelp")}</p>
        <div className="ww-controls">
          <Button type="submit" variant="primary" disabled={editPending}>{t("detail.saveNote")}</Button>
          <Button onClick={() => setEditing(false)} disabled={editPending}>{t("common.cancel")}</Button>
        </div>
        {editMessageKey !== null && <p role={editState.status === "saved" ? "status" : "alert"} className={editState.status === "saved" ? "ww-saved" : "ww-state-error"}>{t(editMessageKey)}</p>}
      </form>
    );
  }

  return (
    <div className="ww-controls">
      <Button onClick={() => setEditing(true)}>{t("detail.editNote")}</Button>
      {!confirmingArchive ? (
        <Button onClick={() => setConfirmingArchive(true)}>{t("detail.archiveNote")}</Button>
      ) : (
        <form action={archiveFormAction} className="ww-controls" aria-busy={archivePending}>
          <input type="hidden" name="complaintId" value={complaintId} />
          <input type="hidden" name="noteId" value={note.id} />
          <span>{t("detail.archiveNoteConfirm")}</span>
          <Button type="submit" variant="primary" disabled={archivePending}>{t("detail.confirmArchiveNote")}</Button>
          <Button onClick={() => setConfirmingArchive(false)} disabled={archivePending}>{t("common.cancel")}</Button>
        </form>
      )}
      {archiveMessageKey !== null && <p role={archiveState.status === "saved" ? "status" : "alert"} className={archiveState.status === "saved" ? "ww-saved" : "ww-state-error"}>{t(archiveMessageKey)}</p>}
    </div>
  );
}
