# D3a: agreement gate (plan round)

Date: Sat 2026-11-14. Brief: `docs/tasks/D3a.md`. Humans said GO (decisions of 2026-11-14).

**Result: 5 of 5 AGREE WITH NOTE. No DISAGREE. No red line cited. Passed on the first ask.**

| Agent | Reply | Notes folded into the brief |
|---|---|---|
| Backend | AGREE WITH NOTE | Names, stub signature, six-commit order, capture-removal file list, `receivedAt` from the database, missing `endedReason` null / unknown `other`, aliases `handpump` and `bore_hole` only, "no reference remains" means code and tests only. |
| Security | AGREE WITH NOTE | Shared constant-time helper, streaming size check without trusting content-length, HMAC key unset gives 503, no raw call id anywhere, try/catch without logging errors, scrub then cap, keep the `/api/vapi/` proxy prefix, extra tests. |
| Phone / AI Prompter | AGREE WITH NOTE | Alias wording lives in contracts and `docs/vapi-prompt.md`; the curl check must expect 503 from the stub; Server URL switch sequence; the one paid call after D3b (about $0.14 to $0.18, a human's OK, Andrew). |
| Frontend | AGREE WITH NOTE | Removal touches no screen. Publish the type, reasons, aliases and the last-report source for W5 and D7. Seed `needsReview` demo rows. |
| UX | AGREE WITH NOTE | Do not switch the Vapi URL before D3b is merged and deployed; the indicator moves only on a stored report and is staff's only signal of a failed delivery. The 15-minute stale threshold (`ui.staleReportMinutes`) still needs a human's approval. |

Dissent: none.
Open for the humans: approve or change `ui.staleReportMinutes` (15).
