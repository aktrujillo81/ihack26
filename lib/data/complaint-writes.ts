import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { MAX_NOTE_LENGTH, MAX_PASSED_ON_TO_LENGTH } from "@/lib/config/limits";
import { getDb } from "@/lib/db";
import { complaints, historyEvents, notes, users } from "@/lib/db/schema";
import type { ComplaintStatus } from "@/lib/domain/types";

import { ALLOWED_TRANSITIONS } from "../actions/transitions";
import { isUsableContext, scopeFilter, versionOf, type DataContext, type DataResult } from "./complaints";
import { isUuid } from "./derive";

/**
 * The complaint writes (task D6): a status change (including passing on and
 * reopening) and adding a note. These are the ONLY writes the signed-in screens
 * make, and they are called only from lib/actions/complaints.ts, after the
 * guards (`requireActionInScope`) have run. This file is the last line of
 * defence, so it checks scope itself too.
 *
 * Every write is ONE transaction that:
 *   1. locks the complaint row (`FOR UPDATE`), found by id AND the session's
 *      organization and regions, so another organization's or region's record
 *      is "not found", the same as a missing one;
 *   2. checks the caller's version token against the row's current version, so
 *      two people can never silently overwrite each other (a stale form gets
 *      `conflict` and nothing is written);
 *   3. makes the change; and
 *   4. appends the history event in the SAME transaction. If any step fails,
 *      nothing is written. `history_events` is append-only: this file only ever
 *      INSERTs into it, and the database refuses UPDATE and DELETE (red line 9).
 *
 * Organization, region and author come from the locked row and the session,
 * never from the request. The version is the row's `updated_at` as UTC text to
 * the microsecond (see `versionOf`); every status change moves it. Adding a
 * note does not (notes only append, so nothing is overwritten).
 *
 * PROVISIONAL: the history event types and the fields stored in `before_data` /
 * `after_data` (docs/contracts.md, "Complaint writes") wait for S6 and D4/D5.
 */

export type WriteResult =
  | { status: "saved"; version: string }
  /** The complaint changed since the caller loaded it. Nothing was written. */
  | { status: "conflict" }
  /** Missing, or in another organization or region. Deliberately indistinguishable. */
  | { status: "not_found" }
  | { status: "invalid" }
  /** The author is not an active staff member of this organization. Nothing was written. */
  | { status: "denied" }
  | { status: "error" };

/** What an action needs to authorize a change, without loading transcripts or anything else. */
export interface ComplaintHead {
  id: string;
  organizationId: string;
  regionId: string;
  status: ComplaintStatus;
}

/** The scope and status of one complaint, in the session's scope only. An unknown id and another organization's id answer identically. */
export async function getComplaintHead(ctx: DataContext, id: string): Promise<DataResult<ComplaintHead>> {
  const notFound = { status: "error", error: "not_found_or_denied" } as const;
  if (!isUsableContext(ctx) || !isUuid(id)) return notFound;
  try {
    const [row] = await getDb()
      .select({ id: complaints.id, organizationId: complaints.organizationId, regionId: complaints.regionId, status: complaints.status })
      .from(complaints)
      .where(and(eq(complaints.id, id), scopeFilter(complaints, ctx)))
      .limit(1);
    return row ? { status: "ok", data: row } : notFound;
  } catch {
    console.error("[data] read_failed");
    return { status: "error", error: "failed" };
  }
}

/** The shape of a version token: UTC time to the microsecond. Anything else is refused before the database is touched. */
const VERSION = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/** The complaint row, locked for this transaction, in the session's scope only. */
async function lockComplaint(tx: Tx, ctx: DataContext, id: string, mode: "update" | "share") {
  const [row] = await tx
    .select({
      id: complaints.id,
      organizationId: complaints.organizationId,
      regionId: complaints.regionId,
      status: complaints.status,
      version: versionOf(complaints.updatedAt),
    })
    .from(complaints)
    .where(and(eq(complaints.id, id), scopeFilter(complaints, ctx)))
    .for(mode)
    .limit(1);
  return row;
}

/** The author must be an active staff member of the same organization (the session already says so; checked again where the row is written). */
async function actorIsActiveStaff(tx: Tx, ctx: DataContext, actorUserId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, actorUserId), eq(users.organizationId, ctx.organizationId), inArray(users.regionId, ctx.regionIds), eq(users.active, true)))
    .limit(1);
  return !!row;
}

const clockNow = sql`clock_timestamp()`;

export interface ChangeStatusInput {
  /** From the validated session. */
  ctx: DataContext;
  /** The signed-in staff member's `users.id`, from the validated session. */
  actorUserId: string;
  complaintId: string;
  /** The `version` the caller loaded. A stale one is refused. */
  expectedVersion: string;
  to: ComplaintStatus;
  /** Required when passing on: who it was passed to (free text until the partner directory is used). */
  passedOnNote?: string;
}

/**
 * Open to passed on or fixed, passed on to fixed, fixed back to open
 * (lib/actions/transitions.ts). Passing on is a RECORDED STEP only: nothing is
 * sent to anyone (spec section 11).
 */
export async function applyStatusChange(input: ChangeStatusInput): Promise<WriteResult> {
  const { ctx, actorUserId, complaintId, expectedVersion, to } = input;
  if (!isUsableContext(ctx) || !isUuid(complaintId) || !isUuid(actorUserId)) return { status: "not_found" };
  if (typeof expectedVersion !== "string" || !VERSION.test(expectedVersion)) return { status: "invalid" };
  const note = typeof input.passedOnNote === "string" ? input.passedOnNote.trim() : "";
  if (to === "passed_on" && (note.length === 0 || note.length > MAX_PASSED_ON_TO_LENGTH)) return { status: "invalid" };

  try {
    return await getDb().transaction(async (tx): Promise<WriteResult> => {
      const row = await lockComplaint(tx, ctx, complaintId, "update");
      if (!row) return { status: "not_found" };
      if (!(await actorIsActiveStaff(tx, ctx, actorUserId))) return { status: "denied" };
      if (row.version !== expectedVersion) return { status: "conflict" };
      if (!ALLOWED_TRANSITIONS[row.status].includes(to)) return { status: "invalid" };

      const reopening = row.status === "fixed" && to === "open";
      const changes =
        to === "passed_on"
          ? { status: to, passedOnNote: note, passedOnPartnerId: null, fixedAt: null }
          : to === "fixed"
            ? { status: to, fixedAt: clockNow }
            : { status: to, fixedAt: null, passedOnNote: null, passedOnPartnerId: null };

      const [updated] = await tx
        .update(complaints)
        .set({ ...changes, updatedAt: clockNow })
        // The version is checked again in the WHERE: belt and braces behind the row lock.
        .where(and(eq(complaints.id, row.id), scopeFilter(complaints, ctx), sql`${versionOf(complaints.updatedAt)} = ${expectedVersion}`))
        .returning({ version: versionOf(complaints.updatedAt) });
      if (!updated) return { status: "conflict" };

      await tx.insert(historyEvents).values({
        organizationId: row.organizationId,
        regionId: row.regionId,
        complaintId: row.id,
        actorUserId,
        eventType: reopening ? "reopened" : to === "passed_on" ? "passed_on" : "status_changed",
        // Only fields that are safe to show on the timeline: statuses, and who it was passed to.
        beforeData: { status: row.status },
        afterData: to === "passed_on" ? { status: to, passedOnNote: note } : { status: to },
        createdAt: clockNow,
      });
      return { status: "saved", version: updated.version };
    });
  } catch {
    // A fixed code only: never the query, the values or the connection string.
    console.error("[data] write_failed");
    return { status: "error" };
  }
}

export interface AddNoteInput {
  ctx: DataContext;
  actorUserId: string;
  complaintId: string;
  text: string;
}

/** Adds a note by the signed-in staff member. Notes only append, so no version is needed and the complaint's version does not move. */
export async function addNote(input: AddNoteInput): Promise<WriteResult> {
  const { ctx, actorUserId, complaintId } = input;
  if (!isUsableContext(ctx) || !isUuid(complaintId) || !isUuid(actorUserId)) return { status: "not_found" };
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (text.length === 0 || text.length > MAX_NOTE_LENGTH) return { status: "invalid" };

  try {
    return await getDb().transaction(async (tx): Promise<WriteResult> => {
      const row = await lockComplaint(tx, ctx, complaintId, "share");
      if (!row) return { status: "not_found" };
      if (!(await actorIsActiveStaff(tx, ctx, actorUserId))) return { status: "denied" };

      const [note] = await tx
        .insert(notes)
        .values({ organizationId: row.organizationId, regionId: row.regionId, complaintId: row.id, authorUserId: actorUserId, body: text })
        .returning({ id: notes.id });
      await tx.insert(historyEvents).values({
        organizationId: row.organizationId,
        regionId: row.regionId,
        complaintId: row.id,
        actorUserId,
        eventType: "note_added",
        // The note's text is not copied into history, only a pointer to it.
        afterData: { noteId: note.id },
        createdAt: clockNow,
      });
      return { status: "saved", version: row.version };
    });
  } catch {
    console.error("[data] write_failed");
    return { status: "error" };
  }
}
