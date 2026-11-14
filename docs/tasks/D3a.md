TASK: D3a Vapi webhook endpoint
PRIORITY: P0 (critical path: nothing connects a phone call to a complaint until D3a and D3b land)
SPEC REFERENCE: PI-*, PR-*; `docs/contracts.md` sections 1, 2, 3, 5.1, 5.2, 8
GOAL: `POST /api/vapi/webhook` receives Vapi's end-of-call report, authenticates it, finds the `water_point_report` output, redacts and validates it, and hands a closed, validated report to D3b's save function. Removes the temporary capture route. Adds the seed rows D3 needs.
AGENTS: Backend (lead), Security / Data Handling, Phone / AI Prompter (values, aliases, `docs/vapi-prompt.md`), UX and Frontend (read only)
DEPENDS ON: schema PR #39 (migration 0003) merged; contracts PR #41. D3b (Andrew) builds the save function behind the type D3a freezes.

## What D3a builds (rules are in contracts section 2 and 5.1; do not restate them in code comments, point to them)
1. The route, in the order of contracts section 2: secret first, size limit while streaming, scope from the one `intake.phone` row, parse, find the structured output, normalize, hand over, respond. Response codes and fixed log codes exactly as section 2.
2. **Alias map before validation (humans, 2026-11-14):** `handpump` to `hand_pump`. Backend may add `bore_hole` to `borehole`, and `yes`/`no` for the school field, only if it writes each one into contracts 5.1 and `docs/vapi-prompt.md`. Anything not in the map stays `invalid_fields`, never silently null (red line 7).
3. **The validated-report type (frozen first, in its own commit, so D3b can code against it).** A closed type, no free-form object, no transcript, no raw call id, no caller name or number. Fields as in Backend's gate reply (`docs/reviews/D3b.md`, `docs/tasks/D3b.md`): `organizationId`, `regionId` (from the `intake.phone` row), `providerCallRef` (HMAC or null), `channel`, `locationText`, `waterPointType`, `problem`, `peopleAffected`, `servesSchoolOrClinic`, `duration`, `callerConfirmed`, `summary`, `languageSpoken`, `transcript` (null), `endedReason`, `needsReview`, `needsReviewReason`. The type name and file are Backend's to choose (unknown); proposal: `lib/ingest/types.ts`. Whether `receivedAt` is passed or the database default is used: Backend decides (Backend and UX suggest the database default). How a missing `endedReason` is stored: Backend decides and writes it in contracts.
4. **The hand-off:** the route calls one function, `saveReport(report)` (name: unknown, Backend), in a file D3b owns (proposal `lib/ingest/save-report.ts`). D3a ships it as a **stub** that returns an error result (the route answers 503 `{ "ok": false }` with the fixed log code `store_failed`), so nothing pretends to store. D3b replaces the stub. Never a silent success (red line 7).
5. **HMAC of `message.call.id`** (contracts 2, "Repeat deliveries"): a separate secret of at least 32 characters, read only through `lib/config/env.ts`. D3a picks the variable name (unknown today), adds the empty placeholder to `.env.example` and the name to contracts section 8 and the environment list. No real key anywhere. The raw call id never leaves D3a and is never logged or stored.
6. **Number scrub, text caps and "no structured data" paths** as in 5.1. Malformed bodies store nothing from the body.
7. **Seed rows** (contracts 4.1 item 4): `intake.phone` and the default configuration keys of section 8, added to the existing seed through one shared defaults module (no value repeated in code). A malformed payload must still get an organization and region from the `intake.phone` row.
8. **Remove `POST /api/vapi/capture`** and its config (`lib/config/vapi-capture.ts`), its tests and the proxy/permission mentions, in the same PR. Update `docs/contracts.md` (section 2 "Built", remove the temporary route text), `docs/vapi-prompt.md` (Server URL row, version table, stale "unknown" lines; Phone owns the wording) and `docs/status.md`.

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
