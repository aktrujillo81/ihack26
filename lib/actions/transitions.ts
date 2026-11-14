/**
 * Which status changes a complaint may make. Client-safe: used to decide which
 * buttons to show, and by the server to refuse anything else. Hiding a button
 * is a convenience; the server checks every change.
 *
 * PROVISIONAL: docs/contracts.md defines no status rules yet.
 *
 * Source: docs/spec.md DB-3 and section 10 (open, passed on, fixed; reopening
 * is allowed after a mistake). Passed on back to open is NOT listed: the spec
 * is silent, so it is unknown and refused.
 */
import type { ComplaintStatus } from "../domain/types";

export const ALLOWED_TRANSITIONS: Readonly<Record<ComplaintStatus, readonly ComplaintStatus[]>> = {
  open: ["accepted", "denied", "passed_on", "fixed", "completed"],
  accepted: ["in_progress", "denied", "passed_on", "completed"],
  denied: ["open"],
  in_progress: ["passed_on", "completed", "fixed"],
  passed_on: ["in_progress", "completed", "fixed"],
  fixed: ["open", "completed"],
  completed: ["open"],
};

export function nextStatuses(status: ComplaintStatus): readonly ComplaintStatus[] {
  return ALLOWED_TRANSITIONS[status];
}
