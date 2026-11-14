TASK: D3a Vapi webhook endpoint
PRIORITY: P0 (critical path: nothing connects a phone call to a complaint until D3a and D3b land)
SPEC REFERENCE: PI-*, PR-*; `docs/contracts.md` sections 1, 2, 3, 5.1, 5.2, 8
GOAL: `POST /api/vapi/webhook` receives Vapi's end-of-call report, authenticates it, finds the `water_point_report` output, redacts and validates it, and hands a closed, validated report to D3b's save function. Removes the temporary capture route. Adds the seed rows D3 needs.
AGENTS: Backend (lead), Security / Data Handling, Phone / AI Prompter (values, aliases, `docs/vapi-prompt.md`), UX and Frontend (read only)
DEPENDS ON: contracts PR #41. Schema PR #39 is not needed to build D3a (the stub stores nothing); it is needed before D3b. D3b (Andrew) builds the save function behind the type D3a freezes.

## What D3a builds (rules are in contracts section 2 and 5.1; do not restate them in code comments, point to them)
1. The route, in the order of contracts section 2: secret first, size limit while streaming, scope from the one `intake.phone` row, parse, find the structured output, normalize, hand over, respond. Response codes and fixed log codes exactly as section 2.
2. **Alias map before validation (humans, 2026-11-14):** `handpump` to `hand_pump`. Backend may add `bore_hole` to `borehole`, and `yes`/`no` for the school field, only if it writes each one into contracts 5.1 and `docs/vapi-prompt.md`. Anything not in the map stays `invalid_fields`, never silently null (red line 7).
3. **The validated-report type (frozen first, in its own commit, so D3b can code against it).** A closed type, no free-form object, no transcript, no raw call id, no caller name or number. Fields as in Backend's gate reply (`docs/reviews/D3b.md`, `docs/tasks/D3b.md`): `organizationId`, `regionId` (from the `intake.phone` row), `providerCallRef` (HMAC or null), `channel`, `locationText`, `waterPointType`, `problem`, `peopleAffected`, `servesSchoolOrClinic`, `duration`, `callerConfirmed`, `summary`, `languageSpoken`, `transcript` (null), `endedReason`, `needsReview`, `needsReviewReason`. The type name and file are Backend's to choose (unknown); proposal: `lib/ingest/types.ts`. Whether `receivedAt` is passed or the database default is used: Backend decides (Backend and UX suggest the database default). How a missing `endedReason` is stored: Backend decides and writes it in contracts.
4. **The hand-off:** the route calls one function, `saveReport(report)` (name: unknown, Backend), in a file D3b owns (proposal `lib/ingest/save-report.ts`). D3a ships it as a **stub** that returns an error result (the route answers 503 `{ "ok": false }` with the fixed log code `store_failed`), so nothing pretends to store. D3b replaces the stub. Never a silent success (red line 7).
5. **HMAC of `message.call.id`** (contracts 2, "Repeat deliveries"): a separate secret of at least 32 characters, read only through `lib/config/env.ts`. D3a picks the variable name (unknown today), adds the empty placeholder to `.env.example` and the name to contracts section 8 and the environment list. No real key anywhere. The raw call id never leaves D3a and is never logged or stored.
6. **Number scrub, text caps and "no structured data" paths** as in 5.1. Malformed bodies store nothing from the body.
7. **Seed rows** (contracts 4.1 item 4): `intake.phone` and the default configuration keys of section 8, added to the existing seed through one shared defaults module (no value repeated in code). A malformed payload must still get an organization and region from the `intake.phone` row.
8. **Remove `POST /api/vapi/capture`** and its config (`lib/config/vapi-capture.ts`), its tests and the proxy/permission mentions, in the same PR. Update `docs/contracts.md` (section 2 "Built", remove the temporary route text), `docs/vapi-prompt.md` (Server URL row, version table, stale "unknown" lines; Phone owns the wording) and `docs/status.md`.

## From the schema PR review (Security, `docs/reviews/D-schema.md`)
- Say in `docs/contracts.md` and in the comment on `reports.provider_call_ref` in `lib/db/schema.ts` that it is stored **only as a keyed HMAC**, never the raw call id (the database cannot enforce it).
- `ended_reason`: a value Vapi sends that is not one of the three known values is stored as `other` and never crashes the route (red line 6).

## Switching Vapi to the webhook (hard rules, from the UX and Phone gate replies)
1. **Do not switch the Vapi Server URL until D3b is merged and deployed.** With the stub in place every call gets 503 and nothing is stored: staff see an empty list and a stale indicator that reads as a quiet or broken line, and the report is lost unless Vapi retries (unknown).
2. Deploy order: merge D3a, deploy (the capture route is gone from that moment and Vapi still points at it, so calls reach nothing until the switch: keep this window short), `curl` with a fake body and **no secret** (expect 401), then `curl` with the secret: **with the stub, 503 `store_failed` means the auth passed and the URL must NOT be switched yet; after D3b, expect 200 and a stored row.** Only then a human switches the URL in the Vapi dashboard and re-attaches the Bearer credential.
3. The single paid end-to-end call comes after D3b replaces the stub (Andrew, with a human's OK, a written script; about $0.14 for 90 s, about $0.18 at the 120 s cap; log it as spend entry 4 in `docs/budget.md`). Pass: a complaint with `hand_pump`, and a replayed delivery does not duplicate it. If it fails, replay the cleaned sample by curl, not another call.
4. Contracts must say: "last report received" moves only on a **stored** report (never on 401, 413, 500 or 503, and no separate "webhook received" timestamp); the indicator is the staff's only signal of a failed delivery and the fixed log codes are the operator's.
5. Demo day: seed and sample data must not be taken for live calls; the indicator reads real rows only.

## Names and build order (Backend's gate reply; final unless Backend finds a clash)
- `ValidatedReport` in `lib/ingest/types.ts` (type only). `saveReport(report: ValidatedReport): Promise<{ ok: true; repeat: boolean } | { ok: false; reason: "store_failed" }>` in `lib/ingest/save-report.ts` (D3b owns it; D3a ships the stub returning `{ ok: false, reason: "store_failed" }`). Normalizer and alias map in `lib/ingest/normalize.ts`; handler factory in `lib/ingest/webhook.ts` (the route file stays thin); defaults module `lib/config/intake.ts`, shared with the seed; env var `VAPI_CALL_REF_KEY`.
- `receivedAt` is not in the type: the database default is used. A missing `endedReason` is null; an unknown value is `other`. Aliases: `handpump` to `hand_pump` and `bore_hole` to `borehole` only (exact-match map, each written into contracts 5.1). No yes/no alias (5.1 already accepts `"true"`/`true`).
- `needsReviewReason` is set by the route from 5.1 in the 5.2 priority order; the type allows the later D3b reasons.
- **Commits, in this order:** (1) types, stub, env var name, contracts text for the type: pushed first, `typecheck` green, so D3b can start; (2) defaults module and seed rows; (3) route and normalizer; (4) tests; (5) capture removal; (6) docs.
- Capture removal. Delete: `app/api/vapi/capture/route.ts`, `lib/vapi/capture.ts`, `lib/config/vapi-capture.ts`, `tests/unit/vapi-capture.test.ts`. Edit: `lib/permissions/routes.ts` (comment only; keep the `/api/vapi/` prefix), `tests/unit/page-guards.test.ts`, `permissions.test.ts`, `proxy.test.ts` (capture paths become the webhook path; keep the prefix-list assertion), `docs/contracts.md`, `docs/vapi-prompt.md`, `docs/status.md`, `docs/changelog.md`, `docs/demo-runbook.md`, `docs/samples/README.md`. History files (decisions, reviews, S-task briefs, budget, spec) stay as they are. "No reference remains" means no code or test reference, docs history excepted. Humans delete `docs/samples/raw/capture-*.json` (gitignored); that is a PR checklist item, not an assistant's job.

## Extra requirements (Security, UX, Phone gate replies)
- One shared secret helper: hash both sides with SHA-256, then `timingSafeEqual`; a test proves it is used. Rate limit checked first, only failed attempts count; a valid secret from another IP is unaffected.
- Size: count bytes while streaming and abort at the limit; also check `content-length` early but never rely on it alone. Test a chunked body without `content-length`.
- HMAC key unset or shorter than 32 characters: answer 503 `store_failed`, never store with a null ref. The raw call id never reaches logs, errors, or the type; a test scans logs and the handed-over object for it.
- `JSON.parse` and the handler sit in try/catch with no `console.error(err)`. Cap text AFTER scrubbing; the scrub also catches digits split by newlines and non-breaking spaces. Allowlist only: no other body field is copied.
- Tests added: raw id absent from logs, no key gives 503, chunked oversize.
- The seed (or a note for D4/W5) gives demo complaints with `needsReview` set, so the Needs review and Needs location lists have real rows. Check whether the demo seed already does after #39.
- Publish in contracts for W5 and D7: the type, the reason values, the `endedReason` rule, the allowed values and aliases, and that "last report received" is `max(reports.received_at)` in scope.

## Rules
- Local database only (port 5434). Never `db:migrate`, never write to production (5433). No paid Vapi call (only Andrew, with a human's OK).
- Tests build fake payloads at runtime. Never commit a raw payload. `docs/samples/` stays as the one cleaned sample.
- No caller name, number or transcript stored or logged. Logs are fixed codes only.
- Tests: secret checks (both header types, none, wrong, unset, constant-time helper used), size limit while streaming, rate limit counts only failed attempts, 503 with no or two `intake.phone` rows, other event type ignored, malformed body stores nothing from it, every case in contracts section 9 unknowns 8 to 10 that D3a decides (values, aliases, scrub, caps), repeat delivery answers like a first one, and that the stub never answers 200 "stored".
- Contracts section 2 and 8 are updated in the same PR (shared file: one task at a time).

## WHAT COULD BREAK
- Vapi's header type is unknown: accept both, log which matched (a fixed code, no value).
- A 413, 500 or 503 may lose a report (Vapi's retry behaviour is unknown); "last report received" shows the gap.
- Switching the Vapi Server URL before the new route is deployed, or deploying with the capture route gone and the URL unchanged: calls reach nothing. The switch is one human step right after the deploy, after a curl with a fake body (401 without the secret, 200 with it).
- Names or digit words that the scrub cannot catch (remaining risk, contracts 9).

ACCEPTANCE CRITERIA
- All tests above pass; `npm run lint`, `typecheck` and `test` pass.
- The capture route and its config are gone; no reference remains.
- The validated-report type and the stub are merged or on the branch before D3b starts coding, and the type is documented in contracts.
- Backend, Security, Phone / AI Prompter sign off PASS; UX and Frontend have no changes needed; a human merges.

OPEN QUESTIONS (Backend answers or marks unknown): type and file names; env var name; `receivedAt`; missing `endedReason`; extra aliases.
