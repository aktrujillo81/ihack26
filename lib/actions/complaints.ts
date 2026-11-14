import "server-only";

import { AuthError, requireActionInScope, requireSession, toDataContext } from "../auth/guards";
import { getComplaint } from "../data/complaints";
import { COMPLAINT_STATUSES, type ComplaintStatus } from "../domain/types";
import type { Action } from "../permissions/matrix";
import { MAX_COMPLAINT_ID_LENGTH, MAX_NOTE_LENGTH, MAX_PASSED_ON_TO_LENGTH } from "../config/limits";
import type { ActionState } from "./state";
import { ALLOWED_TRANSITIONS } from "./transitions";

/**
 * Complaint actions (status change, add note). Each one:
 *   1. needs a valid session (else "unauthenticated"),
 *   2. loads the complaint through the data layer, scoped to that session,
 *   3. runs `requireActionInScope`: scope first, then the role matrix,
 *   4. only then looks at the input.
 * A Viewer is refused whatever the payload. Another organization's record is
 * reported as not found, the same as a missing one.
 *
 * PROVISIONAL: the outcome set, the transitions (./transitions.ts), the length limits
 * (lib/config/limits.ts, PROPOSED) and the rule that "passed_on" needs the
 * pass_on action while every other change needs change_status. docs/contracts.md
 * defines none of them yet.
 *
 * NOTHING IS WRITTEN. The complaint API (D6) and the history events do not
 * exist yet, so a fully authorized and valid request returns `not_available`.
 * There are no fake writes and the mock data is never changed.
 *
 * WIRING POINT (D6): replace the marked line with the real write, in one
 * transaction with its history event (red line 9: history is never overwritten).
 */

const isText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;

type Authorized = { ok: true } | { ok: false; state: ActionState };

async function authorize(raw: unknown, action: Action, complaintId: unknown): Promise<Authorized & { current?: ComplaintStatus }> {
  let session;
  try {
    session = requireSession(raw);
  } catch {
    return { ok: false, state: { status: "unauthenticated" } };
  }
  // The id is untrusted. A malformed id cannot match a record, so it is "not found".
  if (typeof complaintId !== "string" || complaintId.length === 0 || complaintId.length > MAX_COMPLAINT_ID_LENGTH) {
    return { ok: false, state: { status: "not_found" } };
  }
  const found = await getComplaint(toDataContext(session), complaintId);
  if (found.status === "error" && found.error === "failed") return { ok: false, state: { status: "error" } };
  if (found.status !== "ok") return { ok: false, state: { status: "not_found" } };
  try {
    requireActionInScope(raw, action, found.data.complaint);
  } catch (e) {
    if (e instanceof AuthError && e.kind === "forbidden") return { ok: false, state: { status: "denied" } };
    return { ok: false, state: { status: "not_found" } };
  }
  return { ok: true, current: found.data.complaint.status };
}

export async function changeComplaintStatus(
  raw: unknown,
  input: { complaintId: unknown; status: unknown; passedOnTo?: unknown },
): Promise<ActionState> {
  try {
    // "passed_on" is a pass-on; "fixed" and "open" are status changes. The matrix has a separate action for each.
    const wanted = input.status === "passed_on" ? "pass_on" : "change_status";
    const auth = await authorize(raw, wanted, input.complaintId);
    if (!auth.ok) return auth.state;

    const target = COMPLAINT_STATUSES.find((s) => s === input.status);
    if (!target || auth.current === undefined || !ALLOWED_TRANSITIONS[auth.current].includes(target)) return { status: "invalid" };
    if (target === "passed_on" && !isText(input.passedOnTo, MAX_PASSED_ON_TO_LENGTH)) return { status: "invalid" };

    // WIRING POINT (D6): write the new status and its history event here. Never overwrite history.
    return { status: "not_available" };
  } catch {
    return { status: "error" };
  }
}

export async function addComplaintNote(raw: unknown, input: { complaintId: unknown; text: unknown }): Promise<ActionState> {
  try {
    const auth = await authorize(raw, "add_note", input.complaintId);
    if (!auth.ok) return auth.state;
    if (!isText(input.text, MAX_NOTE_LENGTH)) return { status: "invalid" };

    // WIRING POINT (D6): save the note and its history event here.
    return { status: "not_available" };
  } catch {
    return { status: "error" };
  }
}

