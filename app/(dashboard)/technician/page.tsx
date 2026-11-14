import { and, asc, eq, inArray } from "drizzle-orm";
import { requirePageSession } from "@/lib/auth/page-guard";
import { getDb } from "@/lib/db";
import { technicianTickets, waterPoints } from "@/lib/db/schema";
import { createTechnicianTicket } from "./actions";
import { PinPicker } from "./PinPicker";
import "./technician.css";

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
          <h1 className="ww-page-title">Field tickets</h1>
          <p className="ww-page-subtitle">
            Record a site visit for a water point in your assigned region.
          </p>
        </div>
      </header>
      <section className="ww-panel ww-panel--padded">
        <form action={createTechnicianTicket} className="ww-tech-form">
          <div className="ww-tech-heading">
            <h2>New maintenance ticket</h2>
            <p>Fields marked required must be completed before saving.</p>
          </div>
          <label>
            Water point{" "}
            <select name="waterPointId" required>
              <option value="">Choose a water point</option>
              {points.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.type}: {p.location}
                </option>
              ))}
            </select>
          </label>
          <label>
            Location{" "}
            <input
              name="locationText"
              required
              placeholder="Village, landmark, or site"
            />
          </label>
          <PinPicker />
          <label>
            What did you find?{" "}
            <textarea
              name="issueSummary"
              required
              maxLength={1000}
              placeholder="Describe the condition and work needed"
            />
          </label>
          <label>
            Notes{" "}
            <textarea
              name="notes"
              maxLength={4000}
              placeholder="Parts used, access notes, or other useful context"
            />
          </label>
          <button type="submit" className="ww-btn ww-btn--primary">
            Create ticket
          </button>
        </form>
      </section>
      <section className="ww-tech-tickets">
        <h2>My tickets</h2>
        {tickets.length === 0 ? (
          <p className="ww-panel ww-panel--padded">No field tickets yet.</p>
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
