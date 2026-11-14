import type { ComplaintDetail, Loadable } from "@/lib/data/complaints";
import { t } from "@/lib/i18n/strings";
import { can } from "@/lib/permissions/matrix";

import "./complaints.css";
import { CopySummaryButton } from "./CopySummaryButton";
import { durationText, peopleText, problemText, schoolClinicText, timeText, typeText } from "./format";
import { NoteForm } from "./NoteForm";
import { StateMessage } from "./StateMessage";
import { StatusControls } from "./StatusControls";
import { buildSummary } from "./summary";

/**
 * Presentational complaint detail (W3). Everything it shows comes in as
 * `result`, so every state is renderable and testable. It reads no session.
 *
 * `role` only decides which controls to render, as a convenience: it comes from
 * the validated server session in the route, never from the client, and the
 * server actions refuse anyone the matrix does not allow. An unknown or missing
 * role renders no controls (default deny).
 *
 * Transcripts appear here and only here, never in the list or the summary.
 * Timeline `detail` text is data from the system: PROVISIONAL until events are
 * structured (type plus values) so they can be translated.
 */
export function ComplaintDetailView({
  result,
  role,
  retryHref,
}: {
  result: Loadable<ComplaintDetail>;
  role: unknown;
  retryHref?: string;
}) {
  if (result.status !== "ok") {
    return <StateMessage state={result} emptyKey="detail.notFoundOrDenied" retryHref={retryHref} />;
  }
  const { complaint, waterPoint, reports, notes, history, passedOnTo } = result.data;
  const unverified = waterPoint?.verificationState === "unverified";
  const canChange = can(role, "change_status");
  const canPassOn = can(role, "pass_on");
  const canNote = can(role, "add_note");

  return (
    <article>
      <h1>{waterPoint ? `${typeText(waterPoint.type)}: ${waterPoint.locationText}` : t("common.unknown")}</h1>

      {complaint.needsReview && <p className="ww-banner">{t("detail.needsReviewBanner")}</p>}
      {unverified && <p className="ww-banner ww-banner-unverified">{t("detail.unverifiedBanner")}</p>}

      <section className="ww-section">
        <dl>
          <dt>{t("list.col.status")}</dt>
          <dd>
            <span className="ww-badge">{t(`status.${complaint.status}`)}</span>
            {passedOnTo && ` ${passedOnTo.name}`}
          </dd>
          <dt>{t("list.col.priority")}</dt>
          <dd>{t("list.priorityReason", { score: complaint.priorityScore, reason: complaint.scoreReason })}</dd>
          <dt>{t("list.col.reports")}</dt>
          <dd>{complaint.reportCount}</dd>
          <dt>{t("list.col.problem")}</dt>
          <dd>{problemText(complaint.problem)}</dd>
          <dt>{t("list.col.people")}</dt>
          <dd>{peopleText(complaint.peopleAffected)}</dd>
          <dt>{t("list.col.schoolClinic")}</dt>
          <dd>{schoolClinicText(complaint.servesSchoolOrClinic)}</dd>
          <dt>{t("list.col.duration")}</dt>
          <dd>{durationText(complaint.duration)}</dd>
        </dl>
        <CopySummaryButton text={buildSummary(result.data)} />
      </section>

      {(canChange || canPassOn) && (
        <section className="ww-section">
          <StatusControls complaintId={complaint.id} status={complaint.status} canPassOn={canPassOn} canChange={canChange} />
        </section>
      )}

      <section className="ww-section">
        <h2>{t("detail.reportsTitle")}</h2>
        <ul className="ww-list-plain">
          {reports.map((report) => (
            <li key={report.id}>
              <div>{timeText(report.receivedAt)}</div>
              <div>{report.summary}</div>
              {report.transcript ? <pre className="ww-transcript">{report.transcript}</pre> : <p>{t("detail.transcriptEmpty")}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section className="ww-section">
        <h2>{t("detail.notesTitle")}</h2>
        {notes.length === 0 ? (
          <p>{t("detail.notesEmpty")}</p>
        ) : (
          <ul className="ww-list-plain">
            {notes.map((note) => (
              <li key={note.id}>
                <strong>{note.author}</strong> {timeText(note.createdAt)}
                <div>{note.text}</div>
              </li>
            ))}
          </ul>
        )}
        {canNote && <NoteForm complaintId={complaint.id} />}
      </section>

      <section className="ww-section">
        <h2>{t("detail.timelineTitle")}</h2>
        <ul className="ww-list-plain">
          {history.map((event) => (
            <li key={event.id}>
              {timeText(event.at)} <strong>{event.actor}</strong>
              {": "}
              {event.detail}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
