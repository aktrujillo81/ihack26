"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { technicianTickets, waterPoints } from "@/lib/db/schema";
import { requirePageSession } from "@/lib/auth/page-guard";

export async function createTechnicianTicket(formData: FormData) {
  const session = await requirePageSession("technician_ticket");
  const waterPointId = String(formData.get("waterPointId") ?? "");
  const locationText = String(formData.get("locationText") ?? "").trim();
  const issueSummary = String(formData.get("issueSummary") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));
  if (!waterPointId || !locationText || !issueSummary || issueSummary.length > 1000 || notes.length > 4000 || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;
  const [point] = await getDb().select({ id: waterPoints.id, organizationId: waterPoints.organizationId, regionId: waterPoints.regionId }).from(waterPoints).where(and(eq(waterPoints.id, waterPointId), eq(waterPoints.organizationId, session.organizationId), inArray(waterPoints.regionId, session.regionIds))).limit(1);
  if (!point) return;
  await getDb().transaction(async (tx) => {
    await tx.update(waterPoints).set({ locationText, latitude: String(latitude), longitude: String(longitude), locationSource: "map_pin" }).where(and(eq(waterPoints.id, point.id), eq(waterPoints.organizationId, session.organizationId), inArray(waterPoints.regionId, session.regionIds)));
    await tx.insert(technicianTickets).values({ organizationId: point.organizationId, regionId: point.regionId, waterPointId: point.id, technicianUserId: session.userId, locationText, latitude: String(latitude), longitude: String(longitude), issueSummary, notes: notes || null });
  });
  revalidatePath("/technician");
}
