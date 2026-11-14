import "server-only";

import { AuthError, requireActionInScope, requireSession, toDataContext } from "../auth/guards";
import type { Session } from "../auth/session";
import { MAX_COMPLAINT_ID_LENGTH, MAX_NOTE_LENGTH, MAX_PASSED_ON_TO_LENGTH } from "../config/limits";
import { addNote, applyStatusChange, getComplaintHead, type WriteResult } from "../data/complaint-writes";
import { COMPLAINT_STATUSES, type ComplaintStatus } from "../domain/types";
import type { Action } from "../permissions/matrix";
import type { ActionState } from "./state";
import { ALLOWED_TRANSITIONS } from "./transitions";

/**
 * Complaint actions (status change, pass on, reopen, add note). Each one:
 *   1. needs a valid session (else "unauthenticated"),
 *   2. finds the complaint's scope and status, in that session's organization and
 *      regions only, without loading anything else (`getComplaintHead`),
 *   3. runs `requireActionInScope`: scope first, then the role matrix,
 *   4. only then looks at the input, and
 *   5. calls the write in lib/data/complaint-writes.ts, which does the change and
 *      appends its history event in ONE transaction, and refuses a stale version.
 * A Viewer is refused whatever the payload. Another organization's or region's
 * record, a missing id and a malformed id all answer "not found", identically.
 * The author is ALWAYS the session's user, and the organization and region are
 * ALWAYS taken from the stored complaint: none of them is read from the request.
 *
 * PROVISIONAL: the outcome set, the transitions (./transitions.ts), the length
 * limits (lib/config/limits.ts, PROPOSED) and the rule that "passed_on" needs the
 * pass_on action while every other change needs change_status. They are listed in
 * docs/contracts.md ("Complaint writes").
 *
 * Passing on is a RECORDED STEP only: nothing is sent to anyone (spec section 11,
 * red line 5: a human confirms every action; nothing auto-dispatches).
 */

const isText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;

type Authorized = { ok: true; session: Session; current: ComplaintStatus } | { ok: false; state: ActionState };

async function authorize(raw: unknown, action: Action, complaintId: unknown): Promise<Authorized> {
  let session: Session;
  try {
    session = requireSession(raw);
  } catch {
    return { ok: false, state: { status: "unauthenticated" } };
  }
  // The id is untrusted. A malformed id cannot match a record, so it is "not found".
  if (typeof complaintId !== "string" || complaintId.length === 0 || complaintId.length > MAX_COMPLAINT_ID_LENGTH) {
    return { ok: false, state: { status: "not_found" } };
  }
  const head = await getComplaintHead(toDataContext(session), complaintId);
  if (head.status === "error" && head.error === "failed") return { ok: false, state: { status: "error" } };
  if (head.status !== "ok") return { ok: false, state: { status: "not_found" } };
  try {
    requireActionInScope(raw, action, head.data);
  } catch (e) {
    if (e instanceof AuthError && e.kind === "forbidden") return { ok: false, state: { status: "denied" } };
    return { ok: false, state: { status: "not_found" } };
  }
  return { ok: true, session, current: head.data.status };
}

/** What the write said, as the screen's state. A successful write is "saved". */
function toState(result: WriteResult): ActionState {
  switch (result.status) {
    case "saved":
      return { status: "saved" };
    case "conflict":
      return { status: "conflict" };
    case "not_found":
      return { status: "not_found" };
    case "invalid":
      return { status: "invalid" };
    case "denied":
      return { status: "denied" };
    default:
      return { status: "error" };
  }
}

export async function changeComplaintStatus(
  raw: unknown,
  input: { complaintId: unknown; status: unknown; passedOnTo?: unknown; version?: unknown },
): Promise<ActionState> {
  try {
    // "passed_on" is a pass-on; "fixed" and "open" are status changes. The matrix has a separate action for each.
    const wanted = input.status === "passed_on" ? "pass_on" : "change_status";
    const auth = await authorize(raw, wanted, input.complaintId);
    if (!auth.ok) return auth.state;

    const target = COMPLAINT_STATUSES.find((s) => s === input.status);
    if (!target || !ALLOWED_TRANSITIONS[auth.current].includes(target)) return { status: "invalid" };
    if (target === "passed_on" && !isText(input.passedOnTo, MAX_PASSED_ON_TO_LENGTH)) return { status: "invalid" };
    // The caller must say which version it loaded; the write refuses a stale one.
    if (typeof input.version !== "string" || input.version.length === 0) return { status: "invalid" };

    return toState(
      await applyStatusChange({
        ctx: toDataContext(auth.session),
        actorUserId: auth.session.userId,
        complaintId: input.complaintId as string,
        expectedVersion: input.version,
        to: target,
        passedOnNote: target === "passed_on" ? (input.passedOnTo as string) : undefined,
      }),
    );
  } catch {
    return { status: "error" };
  }
}

export async function addComplaintNote(raw: unknown, input: { complaintId: unknown; text: unknown }): Promise<ActionState> {
  try {
    const auth = await authorize(raw, "add_note", input.complaintId);
    if (!auth.ok) return auth.state;
    if (!isText(input.text, MAX_NOTE_LENGTH)) return { status: "invalid" };

    return toState(
      await addNote({
        ctx: toDataContext(auth.session),
        actorUserId: auth.session.userId,
        complaintId: input.complaintId as string,
        text: input.text,
      }),
    );
  } catch {
    return { status: "error" };
  }
}
