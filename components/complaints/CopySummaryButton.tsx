"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n/strings";

import "./complaints.css";

/** Copies the prepared summary text. The text is built on the server and never holds transcripts or caller details. */
export function CopySummaryButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => setCopied(true))
          .catch(() => setCopied(false));
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
      </svg>
      {copied ? t("detail.copied") : t("detail.copySummary")}
    </Button>
  );
}
