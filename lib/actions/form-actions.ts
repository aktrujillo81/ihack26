"use server";

import { revalidatePath } from "next/cache";

import { getCurrentSession } from "../auth/session";
import { isUuid } from "../data/derive";
import { addComplaintNote, archiveComplaintNote, changeComplaintStatus, editComplaintNote, updateComplaintLocation } from "./complaints";
import type { ActionState } from "./state";

/**
 * Server actions the complaint screens call. They read the session on the
 * server, never from the form, and hand it to the checked functions in
 * ./complaints.ts, which run `requireActionInScope` before anything else and
 * then write the change and its history event in one transaction.
 *
 * After a successful save the complaint's pages are refreshed so the screen shows
 * the new status, timeline and version. Only a validated uuid is ever put in a
 * path.
 */
function refresh(complaintId: FormDataEntryValue | null): void {
  revalidatePath("/complaints");
  if (typeof complaintId === "string" && isUuid(complaintId)) revalidatePath(`/complaints/${complaintId}`);
}

export async function changeStatusAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const state = await changeComplaintStatus(await getCurrentSession(), {
    complaintId: formData.get("complaintId"),
    status: formData.get("status"),
    passedOnTo: formData.get("passedOnTo"),
    partnerId: formData.get("partnerId"),
    version: formData.get("version"),
  });
  if (state.status === "saved") refresh(formData.get("complaintId"));
  return state;
}

export async function editNoteAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const state = await editComplaintNote(await getCurrentSession(), { complaintId: formData.get("complaintId"), noteId: formData.get("noteId"), text: formData.get("text") });
  if (state.status === "saved") refresh(formData.get("complaintId")); return state;
}
export async function archiveNoteAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const state = await archiveComplaintNote(await getCurrentSession(), { complaintId: formData.get("complaintId"), noteId: formData.get("noteId") });
  if (state.status === "saved") refresh(formData.get("complaintId")); return state;
}
export async function updateLocationAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const state = await updateComplaintLocation(await getCurrentSession(), { complaintId: formData.get("complaintId"), version: formData.get("version"), locationText: formData.get("locationText"), latitude: formData.get("latitude"), longitude: formData.get("longitude"), verify: formData.get("verify") === "true" });
  if (state.status === "saved") refresh(formData.get("complaintId")); return state;
}

export async function addNoteAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const state = await addComplaintNote(await getCurrentSession(), {
    complaintId: formData.get("complaintId"),
    text: formData.get("text"),
  });
  if (state.status === "saved") refresh(formData.get("complaintId"));
  return state;
}
