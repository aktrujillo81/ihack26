import { and, asc, eq, inArray } from "drizzle-orm";
import { requirePageSession } from "@/lib/auth/page-guard";
import { getDb } from "@/lib/db";
import { technicianTickets, waterPoints } from "@/lib/db/schema";
import { createTechnicianTicket } from "./actions";
import { PinPicker } from "./PinPicker";
import "./technician.css";
import { t } from "@/lib/i18n/strings";

export const dynamic = "force-dynamic";
export default async function TechnicianPage() {
  const session = await requirePageSession("technician_ticket");
  const db = getDb();
  const points = await db
    .select({
      id: waterPoints.id,
      location: waterPoints.locationText,
      type: waterPoints.waterPointType,
      lat: waterPoints.latitude,
      lng: waterPoints.longitude,
    })
    .from(waterPoints)
    .where(
      and(
        eq(waterPoints.organizationId, session.organizationId),
        inArray(waterPoints.regionId, session.regionIds),
      ),
    )
    .orderBy(asc(waterPoints.locationText));
  const tickets = await db
    .select({
      id: technicianTickets.id,
      status: technicianTickets.status,
      summary: technicianTickets.issueSummary,
      location: technicianTickets.locationText,
      createdAt: technicianTickets.createdAt,
    })
    .from(technicianTickets)
    .where(
      and(
        eq(technicianTickets.technicianUserId, session.userId),
        eq(technicianTickets.organizationId, session.organizationId),
        inArray(technicianTickets.regionId, session.regionIds),
      ),
    )
    .orderBy(asc(technicianTickets.createdAt));
  return (
    <main className="ww-tech">
      <header className="ww-page-header">
        <div>
          <h1 className="ww-page-title">{t("technician.title")}</h1>
          <p className="ww-page-subtitle">
            {t("technician.subtitle")}
          </p>
        </div>
      </header>
      <section className="ww-panel ww-panel--padded">
        <form action={createTechnicianTicket} className="ww-tech-form">
          <div className="ww-tech-heading">
            <h2>{t("technician.newTicket")}</h2>
            <p>{t("technician.requiredHelp")}</p>
          </div>
          <label>
            {t("technician.waterPoint")} {" "}
            <select name="waterPointId" required>
              <option value="">{t("technician.chooseWaterPoint")}</option>
              {points.map((p) => (
                <option key={p.id} value={p.id}>
                  {t("technician.pointOption", { type: p.type, location: p.location })}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("technician.location")} {" "}
            <input
              name="locationText"
              required
              placeholder={t("technician.locationPlaceholder")}
            />
          </label>
          <PinPicker />
          <label>
            {t("technician.issue")} {" "}
            <textarea
              name="issueSummary"
              required
              maxLength={1000}
              placeholder={t("technician.issuePlaceholder")}
            />
          </label>
          <label>
            {t("technician.notes")} {" "}
            <textarea
              name="notes"
              maxLength={4000}
              placeholder={t("technician.notesPlaceholder")}
            />
          </label>
          <button type="submit" className="ww-btn ww-btn--primary">
            {t("technician.create")}
          </button>
        </form>
      </section>
      <section className="ww-tech-tickets">
        <h2>{t("technician.myTickets")}</h2>
        {tickets.length === 0 ? (
          <p className="ww-panel ww-panel--padded">{t("technician.empty")}</p>
        ) : (
          <ul>
            {tickets.map((t) => (
              <li key={t.id} className="ww-panel">
                <span className="ww-tag">{t.status.replace("_", " ")}</span>
                <strong>{t.summary}</strong>
                <span>{t.location}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
