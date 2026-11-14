TASK: D3b save a validated phone report
PRIORITY: P0
SPEC REFERENCE: PR-* (processing), WP-* (water points), PI-* (intake); rules in `docs/contracts.md` sections 2, 3, 4.1, 5.1 to 5.6 (the S6 version, PR #34)
GOAL: One server function takes the validated report that D3a hands over and saves it: duplicate check, water point match / new / needs-review (D4), report, complaint and score (D5), history. Together with D3a this is the first thing that connects a phone call to a complaint.
OWNER: Andrew (D3b). D3a (endpoint, parsing, redaction, validation, migration, removal of `/api/vapi/capture`) is Backend's and is a separate task.

## Local database only
Port 5434 only (`npm run db:local`). Never `db:migrate` and never write to production (port 5433). Tests and dev runs reuse the demo seed's allowlist guard (`lib/...` seed guard; plain host, port 5434, no query string, no `PG*` variables) and refuse to run otherwise. Never print a connection string.

## Input (what D3a hands over; names from Backend's reply, final type name and file: unknown, D3a freezes it first)
A closed type, no free-form object, no transcript, no raw call ID, no caller name or number.
- `organizationId`, `regionId`: uuid, read by D3a from the `intake.phone` configuration row. **Never from the payload.**
- `providerCallRef`: string or null. HMAC of `message.call.id`, computed by D3a. D3b never sees the raw ID and needs no key.
- `channel`: `"phone"`.
- `locationText` (scrubbed, capped; `"unknown"` if unusable), `waterPointType`, `problem`, `peopleAffected` (integer or null), `servesSchoolOrClinic` (boolean or null), `duration`, `callerConfirmed` (boolean or null), `summary`, `languageSpoken` (scrubbed, capped, or null), `transcript` (always null), `endedReason` (`customer-ended-call`, `assistant-said-end-call-phrase`, `other` or null).
- `needsReview`, `needsReviewReason`: set by D3a for `malformed_payload`, `no_structured_data`, `unusable_location`, `invalid_fields`, `not_confirmed`. D3b/D4 set `ambiguous_match` and `processing_error`. One reason stored, by the priority in 5.2.
- Allowed values per field: `docs/contracts.md` section 3. Anything else is unknown.

## Writes (tables and columns: contracts section 4 and 4.1)
`reports`, `water_points` (new point only), `complaints`, `report_candidates` (ambiguous only), `history_events` (`created`, `report_added`, actor empty). `configuration` is read only. **"Last report received" has no column of its own**: it is `max(reports.received_at)` in scope (6.7). `received_at` is server time at the moment the report is stored; flagged and unattached reports count; non-report Vapi messages and rejected requests never write one.
Every row carries organization and region. Every query filters by both and checks that the water point it attaches to is in scope (the schema only ties the pair). Every write bumps `updated_at` (the `version` check of D6 depends on it).

## Rules
1. Duplicate call ID is a no-op: same result as a first save, no second row, logged with the fixed code `repeat`. `providerCallRef` null means no duplicate check (contracts 2). Do not invent one. A second caller about the same pump is a NEW report and raises `report_count`.
2. Missing or unknown fields go to needs-review with a reason. Nothing throws on them. Unknown values score 0 or +1 as in 5.6 and show as "Unknown".
3. Several water points fit: `ambiguous_match`, candidates stored, never a silent pick (red line 7).
4. History is append-only: INSERT only into `history_events`. Changes to an existing water point or complaint are new history rows.
5. No caller name, number, transcript or raw call ID stored or logged. Logs are fixed codes only (`repeat`, `store_failed`, `processing_error`), never values, refs or error text.
6. Changes no screens. The `needsReviewReason` and `candidates` stubs in `lib/data/complaints.ts` stay until W5. Stored complaint columns follow the same severity rules as `lib/data/derive.ts`.
7. Tests build fake data at runtime and create their own organization (the demo seed refuses an organization it did not write). No raw payload is committed. Only Andrew places paid Vapi calls, each with a human's OK.

## WHAT COULD BREAK
- Two calls for the same pump at once: needs the one-active-complaint unique index (4.1 item 8) and "retry once as attach" (5.4).
- A failure after matching: the report must not vanish (see Open question 1).
- Cross-scope links (organization A's id on organization B's row).
- Digits or a name surviving into a stored column.
- The check "needs-review reason not null when needs review" (4.1 item 2) rejecting seed and D6 rows.
- Old water points have no `location_key` and would never match; the matcher must handle null keys. How: unknown (Backend).

## HOW WE WILL TEST IT (Postgres on 5434, fake data)
- Privacy (Security): fake phone numbers in several formats and a fake name in the text fields; after the save no stored column in any table matches 7+ digits or holds the name; no transcript, number, name or raw-call-ID column exists; stored ref differs from and does not contain the raw ID; console output during a save holds only fixed codes.
- Duplicate: second save leaves row counts unchanged and returns the same shape. Null ref: no dedupe.
- Isolation: a report saved under organization A is invisible to B; organization and region on every row come from configuration, not input.
- Rollback: a forced failure writes nothing partial.
- Matching: new point, one match attaches, two candidates give `ambiguous_match` with no pick, two wordings of one place give a second point (expected).
- Values (contracts section 9, unknowns 8 to 10): every unseen value of type, problem and duration; `people_affected` of "unknown", "abc", 8 digits, a number; school field "false", "unknown", boolean, garbage; `callerConfirmed` false, missing, non-boolean (missing or non-boolean is null and `not_confirmed`, never false); missing, `unknown` and 2-character location (`unusable_location`, no water point created); non-English language; no structured output; null result; reason priority when several apply.
- Race: two simultaneous saves for one water point end with one active complaint.
- Guard: the run refuses a `DATABASE_URL` that is not the 5434 allowlist.

AGENTS: Backend (lead for data and names), Security / Data Handling, Phone / AI Prompter (values), UX (reason wording later), Frontend (nothing changes)
DEPENDS ON: S6 contracts merged (PR #34); the schema migrations for contracts 4.1 items 1 to 3 (D3a) and items 5 to 8 and 11 (D4/D5 schema). Backend proposes one small schema PR for items 1 to 3 and 5 to 8, 11, merged before D3b starts, so D3b makes no schema edits. Who owns items 5 to 8 and 11 is not set: unknown (the humans). The input type frozen by D3a.
FILES LIKELY TOUCHED: new `lib/ingest/` module (name: unknown, Backend), its tests under `tests/integration/`, `docs/contracts.md` (shared: one task at a time; the save function's name and return shape must be published there for W5 and D7), `docs/status.md`, `docs/changelog.md`. No schema file (shared) unless the humans assign it here.

ACCEPTANCE CRITERIA
- Every test above passes on port 5434, and the guard test passes.
- `npm run lint`, `typecheck`, `test` pass.
- No change under `app/` or `components/`.
- `docs/contracts.md` states the function name, input type and return shape (match, new or needs-review outcome).
- Four reviews at PASS (Backend, Security, Phone / AI Prompter, UX) and a human merges.

DECIDED BY THE HUMANS (2026-11-14, `docs/decisions.md`)
1. **Two steps.** Step 1 (one transaction): duplicate check, insert the report (with `received_at`). Which history rows go in which step: unknown (open question 2). Step 2 (second transaction): match (D4), complaint and score (D5), attach, history. If step 2 fails, the report from step 1 stays, flagged `processing_error`, and counts as received. Acceptance test: force a failure in step 2 and see the report kept with `processing_error` and no partial complaint or history. The function may be one exported function with two phases or two functions: Backend names them.
2. **Schema first.** Items 1 to 3, 5 to 8 and 11 come from the schema PR (`docs/tasks/D3-schema.md`), merged before D3b starts. D3b makes no schema edits.
3. **Alias** `handpump` to `hand_pump` is D3a's (before the report reaches D3b).

OPEN QUESTIONS (unknown; Backend answers, a human if it is a choice)
1. HMAC key env var name; whether `receivedAt` is passed in or set by the database default (Backend and UX suggest the database default); how a missing `endedReason` is stored.
2. Which `history_events` get which event (`created` for the complaint, `report_added` for the report) and the `before_data`/`after_data` shape: unknown (contracts 5.9 gives names only).
3. The `intake.phone` row and the default config keys must exist (seed, contracts 4.1 item 4) so a malformed payload still gets an organization and region: who adds them is unknown (D3a or the schema PR).
