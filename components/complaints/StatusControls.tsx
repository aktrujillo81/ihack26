"use client";

import { useActionState, useState } from "react";

import { changeStatusAction } from "@/lib/actions/form-actions";
import { INITIAL_ACTION_STATE, actionMessageKey, type ActionState } from "@/lib/actions/state";
import { nextStatuses } from "@/lib/actions/transitions";
import { MAX_PASSED_ON_TO_LENGTH } from "@/lib/config/limits";
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
 * reversible: fixed can be reopened). This component is only rendered for roles
 * the matrix allows, but that is a convenience: the server action refuses
 * everyone else, whatever is sent.
 *
 * It sends the `version` of the complaint it was shown. If the complaint changed
 * since (someone else acted), the server refuses and the message says so; nothing
 * is overwritten. After any result the confirm form closes and the result is
 * shown. What was typed in "who is it passed to" is kept, so a refused save never
 * loses it. After a save the page refreshes with the new status and version.
 * Passing on is a recorded step only: nothing is sent to anyone.
 */
export function StatusControls({
  complaintId,
  status,
  version,
  canPassOn,
  canChange,
}: {
  complaintId: string;
  status: ComplaintStatus;
  /** The complaint's version when this page was loaded. */
  version: string;
  canPassOn: boolean;
  canChange: boolean;
}) {
  const [target, setTarget] = useState<ComplaintStatus | null>(null);
  const [passedOnTo, setPassedOnTo] = useState("");
  // The action runs, then the confirm form closes whatever the result (a message takes its place).
  const [state, formAction, pending] = useActionState(
    async (previous: ActionState, formData: FormData): Promise<ActionState> => {
      const next = await changeStatusAction(previous, formData);
      setTarget(null);
      if (next.status === "saved") setPassedOnTo("");
      return next;
    },
    INITIAL_ACTION_STATE,
  );
  const options = nextStatuses(status).filter((s) => (s === "passed_on" ? canPassOn : canChange));
  const messageKey = target === null ? actionMessageKey(state) : null;
  const saved = state.status === "saved";

  if (options.length === 0 && messageKey === null) return null;
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
          <input type="hidden" name="version" value={version} />
          <p>{t("detail.confirmStatus", { status: t(`status.${target}`) })}</p>
          {target === "passed_on" && (
            <>
              <label htmlFor="passedOnTo">{t("detail.passedOnTo")}</label>
              <input
                id="passedOnTo"
                name="passedOnTo"
                type="text"
                maxLength={MAX_PASSED_ON_TO_LENGTH}
                required
                disabled={pending}
                value={passedOnTo}
                onChange={(event) => setPassedOnTo(event.target.value)}
              />
              <p>{t("detail.passedOnHelp")}</p>
              <p>{t("detail.noteHelp")}</p>
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
        <p role={saved ? "status" : "alert"} className={saved ? "ww-saved" : "ww-state-error"}>
          {t(messageKey)}
        </p>
      )}
    </div>
  );
}
