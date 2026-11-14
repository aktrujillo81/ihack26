"use client";

import { useState } from "react";

import { t } from "@/lib/i18n/strings";

import "./complaints.css";

/** Copies the prepared summary text. The text is built on the server and never holds transcripts or caller details. */
export function CopySummaryButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="ww-copy"
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => setCopied(true))
          .catch(() => setCopied(false));
      }}
    >
      {copied ? t("detail.copied") : t("detail.copySummary")}
    </button>
  );
}
