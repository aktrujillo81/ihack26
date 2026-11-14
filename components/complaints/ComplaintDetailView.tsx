import Link from "next/link";

import { Panel } from "@/components/ui/Panel";
import { PriorityBars } from "@/components/ui/PriorityBars";
import { StatusChip } from "@/components/ui/StatusChip";
import type { ComplaintDetail, Loadable } from "@/lib/data/complaints";
import { priorityLevel } from "@/lib/domain/priority";
import { t } from "@/lib/i18n/strings";
import { can } from "@/lib/permissions/matrix";

import "./complaints.css";
import { CopySummaryButton } from "./CopySummaryButton";
import "./detail.css";
import { actorText, durationText, historyText, peopleText, problemText, schoolClinicText, timeText, typeText } from "./format";
import { NoteForm } from "./NoteForm";
import { StateMessage } from "./StateMessage";
import { StatusControls } from "./StatusControls";
import { buildSummary } from "./summary";

/** Decorative icons (the words carry the meaning). */
function Icon({ path, size = 16 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={path} />
    </svg>
  );
}
const PHONE = "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2";
const LOCK = "M5 11h14v9H5zM8 11V8a4 4 0 0 1 8 0v3";

/**
 * Presentational complaint detail (W3). Everything it shows comes in as
 * `result`, so every state is renderable and testable. It reads no session.
 *
 * `role` only decides which controls to render, as a convenience: it comes from
 * the validated server session in the route, never from the client, and the
 * server actions refuse anyone the matrix does not allow. An unknown or missing
 * role renders no controls (default deny).
 *
 * Transcripts appear here and only here, never in the list or the summary. The
 * copyable summary is built by `buildSummary` and is unchanged: it never holds
 * transcripts, report summaries, notes or caller details. Timeline text is built
 * from the event type and data (format.ts).
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
  const typeName = waterPoint ? typeText(waterPoint.type) : t("common.unknown");
  const passedOn = passedOnTo?.name ?? complaint.passedOnNote;
  const summary = buildSummary(result.data);
  const hasCoordinates = waterPoint !== null && waterPoint.latitude !== null && waterPoint.longitude !== null;

  return (
    <article className="ww-detail">
      <nav aria-label={t("detail.breadcrumb")} className="ww-breadcrumb">
        <Link href="/complaints">{t("nav.complaints")}</Link>
        <span aria-current="page">{typeName}</span>
      </nav>

      <header className="ww-detail-header">
        <div className="ww-detail-title">
          <h1>{typeName}</h1>
          <StatusChip status={complaint.status} />
          <PriorityBars level={priorityLevel(complaint.priorityScore)} />
        </div>
        <div className="ww-detail-actions">
          <CopySummaryButton text={summary} />
          {(canChange || canPassOn) && (
            <StatusControls complaintId={complaint.id} status={complaint.status} version={complaint.version} canPassOn={canPassOn} canChange={canChange} />
          )}
        </div>
      </header>

      {complaint.needsReview && (
        <p className="ww-banner">
          {complaint.needsReviewReason ? `${t("common.needsReviewWithReason", { reason: complaint.needsReviewReason })}. ` : ""}
          {t("detail.needsReviewBanner")}
        </p>
      )}
      {unverified && <p className="ww-banner ww-banner-unverified">{t("detail.unverifiedBanner")}</p>}

      <div className="ww-detail-grid">
        <div className="ww-detail-main">
          <Panel as="section" aria-label={t("detail.summaryTitle")}>
            <h2 className="ww-card-title">{t("detail.summaryTitle")}</h2>
            <dl className="ww-facts">
              <div className="ww-fact">
                <dt>{t("detail.waterPointType")}</dt>
                <dd>{typeName}</dd>
              </div>
              <div className="ww-fact">
                <dt>{t("list.col.status")}</dt>
                <dd>
                  <StatusChip status={complaint.status} />
                  {passedOn && <span className="ww-passed-on">{passedOn}</span>}
                </dd>
              </div>
              <div className="ww-fact">
                <dt>{t("list.col.priority")}</dt>
                <dd>
                  <PriorityBars level={priorityLevel(complaint.priorityScore)} />
                </dd>
              </div>
              <div className="ww-fact">
                <dt>{t("list.col.reports")}</dt>
                <dd>{complaint.reportCount}</dd>
              </div>
              <div className="ww-fact">
                <dt>{t("list.col.problem")}</dt>
                <dd>{problemText(complaint.problem)}</dd>
              </div>
              <div className="ww-fact">
                <dt>{t("list.col.people")}</dt>
                <dd>{peopleText(complaint.peopleAffected)}</dd>
              </div>
              <div className="ww-fact">
                <dt>{t("list.col.schoolClinic")}</dt>
                <dd>{schoolClinicText(complaint.servesSchoolOrClinic)}</dd>
              </div>
              <div className="ww-fact">
                <dt>{t("list.col.duration")}</dt>
                <dd>{durationText(complaint.duration)}</dd>
              </div>
              <div className="ww-fact ww-fact--wide">
                <dt>{t("detail.priorityReason")}</dt>
                <dd>{t("list.priorityReason", { score: complaint.priorityScore, reason: complaint.scoreReason })}</dd>
              </div>
            </dl>
          </Panel>

          <Panel as="section" aria-label={t("detail.reportsTitle")}>
            <div className="ww-card-head">
              <h2 className="ww-card-title">{t("detail.reportsTitle")}</h2>
              <span className="ww-card-note">
                <Icon path={LOCK} size={14} />
                {t("detail.transcriptsStaffOnly")}
              </span>
            </div>
            <ul className="ww-reports">
              {reports.map((report) => (
                <li key={report.id} className="ww-report">
                  <div className="ww-report-meta">
                    <Icon path={PHONE} />
                    <span>{t("detail.pair", { first: timeText(report.receivedAt), second: t(`channel.${report.channel}`) })}</span>
                  </div>
                  <p className="ww-report-summary">{report.summary}</p>
                  <div className="ww-report-location">
                    <span>{t("detail.spokenLocation")}</span> {report.locationText}
                  </div>
                  {report.transcript ? <pre className="ww-transcript">{report.transcript}</pre> : <p className="ww-report-empty">{t("detail.transcriptEmpty")}</p>}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel as="section" aria-label={t("detail.timelineTitle")}>
            <h2 className="ww-card-title">{t("detail.timelineTitle")}</h2>
            <ul className="ww-timeline">
              {history.map((event) => (
                <li key={event.id}>
                  <div className="ww-timeline-text">{historyText(event)}</div>
                  <div className="ww-timeline-meta">
                    {t("detail.pair", { first: actorText(event.actor), second: timeText(event.at) })}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <aside className="ww-detail-side">
          <Panel as="section" aria-label={t("detail.locationTitle")}>
            <div className="ww-card-head">
              <h2 className="ww-card-title">{t("detail.locationTitle")}</h2>
              {waterPoint?.verificationState === "verified" && <span className="ww-tag">{t("detail.verified")}</span>}
              {unverified && <span className="ww-tag ww-tag--dashed">{t("common.unverified")}</span>}
            </div>
            <p className="ww-location-text">{waterPoint?.locationText ?? t("common.unknown")}</p>
            {hasCoordinates ? (
              <p className="ww-coordinates">
                {t("detail.coordinates", { lat: waterPoint.latitude?.toFixed(5) ?? "", lon: waterPoint.longitude?.toFixed(5) ?? "" })}
              </p>
            ) : (
              <p className="ww-card-note-text">{t("common.needsLocation")}</p>
            )}
          </Panel>

          <Panel as="section" aria-label={t("detail.copyableTitle")}>
            <h2 className="ww-card-title">{t("detail.copyableTitle")}</h2>
            <pre className="ww-summary-pre">{summary}</pre>
            <p className="ww-card-note-text">{t("detail.copyableNote")}</p>
          </Panel>

          <Panel as="section" aria-label={t("detail.notesTitle")}>
            <h2 className="ww-card-title">{t("detail.notesTitle")}</h2>
            {canNote && (
              <div className="ww-notes-form">
                <NoteForm complaintId={complaint.id} />
              </div>
            )}
            {notes.length === 0 ? (
              <p className="ww-empty-note">{t("detail.notesEmpty")}</p>
            ) : (
              <ul className="ww-notes">
                {notes.map((note) => (
                  <li key={note.id} className="ww-note">
                    <div className="ww-note-text">{note.text}</div>
                    <div className="ww-note-meta">
                      {t("detail.pair", { first: note.author ?? t("common.unknown"), second: timeText(note.createdAt) })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </article>
  );
}
