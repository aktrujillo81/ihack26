"use client";

import { useActionState, useState } from "react";

import { changeStatusAction } from "@/lib/actions/form-actions";
import { INITIAL_ACTION_STATE, actionMessageKey } from "@/lib/actions/state";
import { nextStatuses } from "@/lib/actions/transitions";
import type { ComplaintStatus } from "@/lib/domain/types";
import { t } from "@/lib/i18n/strings";

import "./complaints.css";

const BUTTON_TEXT = {
  passed_on: "detail.passOn",
  fixed: "detail.markFixed",
  open: "detail.reopen",
} as const;

/**
 * Status buttons with a confirm step (risky actions are confirmable and
 * reversible). This component is only rendered for roles the matrix allows,
 * but that is a convenience: the server action refuses everyone else.
 * `canPassOn` and `canChange` come from the matrix on the server.
 */
export function StatusControls({
  complaintId,
  status,
  canPassOn,
  canChange,
}: {
  complaintId: string;
  status: ComplaintStatus;
  canPassOn: boolean;
  canChange: boolean;
}) {
  const [target, setTarget] = useState<ComplaintStatus | null>(null);
  const [state, formAction, pending] = useActionState(changeStatusAction, INITIAL_ACTION_STATE);
  const options = nextStatuses(status).filter((s) => (s === "passed_on" ? canPassOn : canChange));
  const messageKey = actionMessageKey(state);

  if (options.length === 0) return null;
  return (
    <div>
      <div className="ww-controls">
        {options.map((option) => (
          <button key={option} type="button" onClick={() => setTarget(option)} disabled={pending}>
            {t(BUTTON_TEXT[option])}
          </button>
        ))}
      </div>
      {target !== null && (
        <form action={formAction} className="ww-confirm" aria-busy={pending}>
          <input type="hidden" name="complaintId" value={complaintId} />
          <input type="hidden" name="status" value={target} />
          <p>{t("detail.confirmStatus", { status: t(`status.${target}`) })}</p>
          {target === "passed_on" && (
            <>
              <label htmlFor="passedOnTo">{t("detail.passedOnTo")}</label>
              <input id="passedOnTo" name="passedOnTo" type="text" maxLength={200} required disabled={pending} />
              <p>{t("detail.passedOnHelp")}</p>
            </>
          )}
          <div className="ww-controls">
            <button type="submit" disabled={pending}>
              {t("common.confirm")}
            </button>
            <button type="button" onClick={() => setTarget(null)} disabled={pending}>
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}
      {messageKey !== null && (
        <p role="alert" className="ww-state-error">
          {t(messageKey)}
        </p>
      )}
    </div>
  );
}
