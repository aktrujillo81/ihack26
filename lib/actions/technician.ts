"use server";

import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { requireActionInScope, requireSession, toDataContext } from "../auth/guards";
import { getCurrentSession } from "../auth/session";
import { isUuid } from "../data/derive";
import { getComplaintHead } from "../data/complaint-writes";
import { getDb } from "../db";
import { complaints, historyEvents, technicianTickets, waterPoints } from "../db/schema";
import { scrubNumbers } from "../ingest/scrub";
import {
  MAX_COMPLAINT_ID_LENGTH,
  MAX_TICKET_ISSUE_LENGTH,
  MAX_TICKET_LOCATION_LENGTH,
  MAX_TICKET_NOTES_LENGTH,
} from "../config/limits";
import type { ActionState } from "./state";

const isText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;

export async function createComplaintTechnicianTicket(
  raw: unknown,
  input: {
    complaintId: unknown;
    locationText: unknown;
    latitude: unknown;
    longitude: unknown;
    issueSummary: unknown;
    notes: unknown;
  },
): Promise<ActionState> {
  try {
    const session = requireSession(raw);
    if (typeof input.complaintId !== "string" || input.complaintId.length === 0 || input.complaintId.length > MAX_COMPLAINT_ID_LENGTH || !isUuid(input.complaintId)) {
      return { status: "not_found" };
    }
    const head = await getComplaintHead(toDataContext(session), input.complaintId);
    if (head.status !== "ok") return { status: head.status === "error" && head.error === "failed" ? "error" : "not_found" };
    requireActionInScope(raw, "technician_ticket", head.data);

    const locationText = typeof input.locationText === "string" ? scrubNumbers(input.locationText.trim()) : "";
    const issueSummary = typeof input.issueSummary === "string" ? scrubNumbers(input.issueSummary.trim()) : "";
    const notes = typeof input.notes === "string" ? scrubNumbers(input.notes.trim()) : "";
    const latitude = typeof input.latitude === "number" ? input.latitude : Number(input.latitude);
    const longitude = typeof input.longitude === "number" ? input.longitude : Number(input.longitude);
    if (!isText(locationText, MAX_TICKET_LOCATION_LENGTH) || !isText(issueSummary, MAX_TICKET_ISSUE_LENGTH) || notes.length > MAX_TICKET_NOTES_LENGTH) return { status: "invalid" };
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return { status: "invalid" };

    await getDb().transaction(async (tx) => {
      const [complaint] = await tx
        .select({ id: complaints.id, organizationId: complaints.organizationId, regionId: complaints.regionId, waterPointId: complaints.waterPointId })
        .from(complaints)
        .where(and(eq(complaints.id, input.complaintId as string), eq(complaints.organizationId, session.organizationId), inArray(complaints.regionId, session.regionIds)))
        .for("update")
        .limit(1);
      if (!complaint) throw new Error("not_found");
      const [point] = await tx
        .select({ id: waterPoints.id })
        .from(waterPoints)
        .where(and(eq(waterPoints.id, complaint.waterPointId), eq(waterPoints.organizationId, complaint.organizationId), inArray(waterPoints.regionId, session.regionIds)))
        .limit(1);
      if (!point) throw new Error("not_found");
      const [ticket] = await tx
        .insert(technicianTickets)
        .values({
          organizationId: complaint.organizationId,
          regionId: complaint.regionId,
          waterPointId: point.id,
          complaintId: complaint.id,
          technicianUserId: session.userId,
          locationText,
          latitude: latitude.toFixed(6),
          longitude: longitude.toFixed(6),
          issueSummary,
          notes: notes || null,
        })
        .returning({ id: technicianTickets.id });
      await tx
        .update(waterPoints)
        .set({ locationText, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6), locationSource: "map_pin" })
        .where(and(eq(waterPoints.id, point.id), eq(waterPoints.organizationId, complaint.organizationId), inArray(waterPoints.regionId, session.regionIds)));
      await tx.insert(historyEvents).values({
        organizationId: complaint.organizationId,
        regionId: complaint.regionId,
        complaintId: complaint.id,
        waterPointId: point.id,
        actorUserId: session.userId,
        eventType: "technician_ticket_added",
        afterData: { ticketId: ticket.id },
      });
    });
    return { status: "saved" };
  } catch (error) {
    if (error instanceof Error && error.message === "not_found") return { status: "not_found" };
    return { status: "error" };
  }
}

export async function createComplaintTechnicianTicketAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const complaintId = formData.get("complaintId");
  const state = await createComplaintTechnicianTicket(await getCurrentSession(), {
    complaintId,
    locationText: formData.get("locationText"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    issueSummary: formData.get("issueSummary"),
    notes: formData.get("notes"),
  });
  if (state.status === "saved" && typeof complaintId === "string" && isUuid(complaintId)) {
    const { revalidatePath } = await import("next/cache");
    revalidatePath(`/complaints/${complaintId}`);
    revalidatePath("/complaints");
  }
  return state;
}
