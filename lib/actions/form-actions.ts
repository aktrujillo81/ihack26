"use server";

import { getCurrentSession } from "../auth/session";
import { addComplaintNote, changeComplaintStatus } from "./complaints";
import type { ActionState } from "./state";

/**
 * Server actions the complaint screens call. They read the session on the
 * server, never from the form, and hand it to the checked functions in
 * ./complaints.ts, which run `requireActionInScope` before anything else.
 * Until Better Auth is wired `getCurrentSession()` returns nothing, so every
 * call is refused as unauthenticated.
 */
export async function changeStatusAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  return changeComplaintStatus(await getCurrentSession(), {
    complaintId: formData.get("complaintId"),
    status: formData.get("status"),
    passedOnTo: formData.get("passedOnTo"),
  });
}

export async function addNoteAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  return addComplaintNote(await getCurrentSession(), {
    complaintId: formData.get("complaintId"),
    text: formData.get("text"),
  });
}
