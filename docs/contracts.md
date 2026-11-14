# Contracts

Data shapes, tables, endpoints, and rules. Written in task S6 from one real
captured Vapi payload (`docs/samples/vapi-end-of-call-report.sample.json`, test
call 3, assistant v4) plus the Orchestrator's check of the raw captures (key
paths and types only). Anything not listed here is **unknown**: do not guess.

Status words used below:
- **Built**: exists in `main`.
- **To build in <task>**: agreed here, not built yet. Build it exactly as written, and update this file in the same PR if it must change.
- **SPEC CHANGE**: not in `docs/spec.md`; needs human approval in the S6 PR.

Contents: 1 Vapi payload, 2 webhook, 3 common report format, 4 tables, 5 rules,
6 web API, 7 permissions, 8 configuration, 9 unknowns. Existing built parts
(health, auth, seed, environment names) are kept at the end of the relevant
sections.

---

## 1. The Vapi payload as received

Only the event type `end-of-call-report` is configured in Vapi. The body is JSON
with one top-level key, `message`. Real bodies are about 52 KB (mostly the
repeated `messages` lists). The caller's number appears in several places in
the raw body, so the server keeps an **allowlist** and never stores or logs the
raw body.

### Paths the server reads (the whole allowlist)
| Path | Type | Use | In the cleaned sample? |
|---|---|---|---|
| `message.type` | string | Must be `end-of-call-report`. Any other string: ignored (200). | Yes |
| `message.call.id` | string | Becomes `provider_call_ref` (HMAC, see 2). Never stored raw. | Raw capture only (sample has `REMOVED`) |
| `message.endedReason` | string | Stored as `ended_reason` (seen values or `other`). | Yes |
| `message.artifact.structuredOutputs.<id>.name` | string | Used to find the right entry. Never use `<id>`. | Yes |
| `message.artifact.structuredOutputs.<id>.result` | object | Holds the nine fields below. | Yes |

Not read in P0 (decision, see 5.1): `message.artifact.transcript`,
`message.transcript`. D3 stores no transcript, so it does not read one.

### The nine fields (`result`)
| Field | Wire type seen | Meaning | Observed value (one call) | Configured in Vapi |
|---|---|---|---|---|
| `location_text` | string | Village plus landmark | free text | any text |
| `water_point_type` | string | `well`, `hand_pump`, `tap`, `borehole`, `other`, `unknown` | `hand_pump` | in field description, not an enforced enum |
| `problem` | string | `no_water`, `broken`, `dirty`, `slow`, `other`, `unknown` | `no_water` | same |
| `people_affected` | string | Digits, or `unknown` | `"150"` | text |
| `serves_school_or_clinic` | string | `"true"`, `"false"`, `"unknown"` | `"true"` | string; the three allowed values are in the field description |
| `duration` | string | `today`, `few_days`, `week_or_more`, `unknown` | `week_or_more` | in field description |
| `caller_confirmed` | boolean | Caller said the read-back was right | `true` | boolean |
| `summary` | string | One plain sentence | text | text |
| `language_spoken` | string | Language of the call | `English` | text |

Only one value per field has been seen on the wire. Other allowed values are
configured, not observed (see section 9). No field is an enforced enum type on
the wire: allowed values sit in the field descriptions, and the live
configuration of `serves_school_or_clinic` is **unverified** (`docs/vapi-prompt.md`
says string with three values). The server therefore validates every field.

### Never read, stored, or logged
`message.call.customer.number`, `message.customer.number`, `message.call.id`
(never stored or logged raw; it is read only to make `provider_call_ref`), `message.call.phoneNumberId`, `message.call.status` (was `ringing` in all
three captures: stale, do not rely on it), recording and stereo recording links,
`message.summary` (empty), `message.analysis` (empty), `message.messages` and
`message.artifact.messages` (includes the assistant's system instructions),
`message.cost`, durations, timestamps from Vapi, `message.assistantVersion` and
`message.call.assistantVersion` (Vapi sends both; not needed), and everything
else. `received_at` is the server's own clock.

### What was seen
- Calls 1 and 2 (assistant v3): no `structuredOutputs` key at all.
- Call 3 (assistant v4): exactly one entry, named `water_point_report`.
- `endedReason` seen: `customer-ended-call`, `assistant-said-end-call-phrase`.
- The sample's structured output ID is a placeholder; the real ID differs per Vapi account.

---

## 2. `POST /api/vapi/webhook` (to build in D3)

Replaces `POST /api/vapi/capture`, which is **removed when D3 lands**. Humans
then delete the raw captures from every machine and set the new Vapi server URL.

### Request checks, in this order
1. **Secret first, before the body is read.** `Authorization: Bearer <secret>` or `X-Vapi-Secret: <secret>`, constant-time compare with `VAPI_WEBHOOK_SECRET`. Unset secret: refuse everything. Which header type Vapi really sends is **unknown** (only "Bearer credential" is recorded); D3 accepts both and logs the fixed code for which one matched, never the value.
2. **Size limit** (config `intake.maxBodyBytes`, default 1 MB; real bodies are about 52 KB), enforced **while streaming** the body (stop reading at the limit; do not buffer first). Over the limit: 413, nothing stored.
3. **Scope.** Organization and region come from one `configuration` row with key `intake.phone` (created by the seed). Exactly one such row must exist, otherwise 503, nothing stored, fixed log code. They are never read from the request. Mapping several phone lines is future work.
4. **Parse.** Valid JSON object with a string `message.type`.
   - `message.type` is a different string: ignored, 200 `{ "ok": true }`, nothing stored.
   - Not JSON, not an object, or `message.type` missing or not a string: stored as a report with reason `malformed_payload` (all fields `unknown`). **Nothing from the body is stored** in this case, not even a fragment.
5. **Find the structured output.** Search the values of `message.artifact.structuredOutputs` for entries whose `name`, trimmed and lowercased, equals `water_point_report`. Exactly one match with an object `result` is required. A missing key (calls 1 and 2), no match, several matches, or a `result` that is null or not an object: every field is `unknown`, reason `no_structured_data`.
6. **Normalize** (5.1), **store** the report, then **match and score** (5.3 to 5.6) in a second transaction.

### Responses
| Code | Body | When |
|---|---|---|
| 200 | `{ "ok": true }` | Stored, ignored on purpose (other event type), or a repeat delivery. A repeat and a first delivery answer identically (same body, no hint). |
| 401 | empty | Missing or wrong secret, or secret unset. |
| 413 | empty | Over the size limit. |
| 429 | empty | Too many failed-secret attempts from one client IP (config `intake.badSecretLimit`, per `cf-connecting-ip`, in memory). **Only failed attempts count**; a correct secret never uses the limit. With no valid `cf-connecting-ip` header: one shared bucket for all such requests (same as sign-in). Checked before anything else. |
| 500 or 503 | `{ "ok": false }` | Nothing could be stored (database down, no `intake.phone` row, more than one). |

What Vapi does after a non-200 is **unknown**: a 413, 500 or 503 may lose that
report, and "last report received" makes the gap visible (accepted risk,
section 9).

### Repeat deliveries
`provider_call_ref` = HMAC-SHA-256 of `message.call.id` with a server-only key
(environment variable `VAPI_CALL_REF_KEY`, in `.env.example`; a separate
secret, not `BETTER_AUTH_SECRET` or `VAPI_WEBHOOK_SECRET`, at least 32
characters; never in the browser or logs). Rotating the key breaks dedupe for
calls already stored (a repeat of an old call would be stored again). It is `null` when the id is missing or not a string. Unique
per organization where not null. A second delivery with the same ref is answered
200 and not stored again. With a null ref there is no dedupe. No API returns it.

### Logs
Fixed codes only (for example `[vapi-webhook] stored`, `ignored_type`, `repeat`,
`rejected`, `too_large`, `rate_limited`, `no_scope`, `store_failed`,
`match_failed`). Never the body, the secret, the call id, or a field value.

### Temporary route `POST /api/vapi/capture` (task S5a) (Built, REMOVE in D3)
- **Purpose:** Save the raw body of the first Vapi calls so this contract could be written (S5, S6).
- **Auth:** Same secret rules as above. **401** missing or wrong secret, empty body. **413** over `lib/config/vapi-capture.ts` (2 MB). **200** `{ "ok": true }` and the body saved untouched to `docs/samples/raw/` (gitignored, owner-only files, after 20 files still 200 but nothing saved). **500** `{ "ok": false }` when the file cannot be written.
- **Rules:** No parsing or database writes. The saved files contain the caller's phone number: never commit or share them. Logs use fixed codes only. Not cached.

---

## 3. The common report format

Each channel's adapter turns its data into this one shape before storing.
Vapi-specific code lives only in the Vapi adapter (spec section 5, rule 9). The
stored report is this, plus ids and timestamps.

```json
{
  "channel": "phone",
  "locationText": "Riverside Village near the market",
  "waterPointType": "hand_pump",
  "problem": "no_water",
  "peopleAffected": 150,
  "servesSchoolOrClinic": true,
  "duration": "week_or_more",
  "callerConfirmed": true,
  "summary": "The hand pump in Riverside Village near the market has no water.",
  "languageSpoken": "English",
  "transcript": null,
  "endedReason": "assistant-said-end-call-phrase",
  "needsReview": false,
  "needsReviewReason": null
}
```
This is what the sample normalizes to (example only, placeholders from the sample).

### The validated report type (task D3a, Built; frozen for D3b)
`ValidatedReport` in `lib/ingest/types.ts` (type only) is the closed hand-over
from the webhook to the save function. The JSON above plus the scope and the
call reference:
`organizationId`, `regionId` (from the `intake.phone` row, never the request),
`providerCallRef` (keyed HMAC or null), `channel`, `locationText`,
`waterPointType`, `problem`, `peopleAffected`, `servesSchoolOrClinic`,
`duration`, `callerConfirmed`, `summary`, `languageSpoken`, `transcript` (always
null), `endedReason`, `needsReview`, `needsReviewReason`. It has no free-form
field, no raw body, no raw call id, no caller name or number, and **no
`receivedAt`**: the database default of `reports.received_at` is used.
- `endedReason`: null when Vapi sent none; a value that is not `customer-ended-call` or `assistant-said-end-call-phrase` is `other` (never a crash).
- `needsReviewReason` is set by the webhook in the 5.2 priority order for what it can see: `malformed_payload`, `no_structured_data`, `unusable_location`, `invalid_fields`, `not_confirmed`. The type also allows `processing_error` and `ambiguous_match`, which later steps set. `needsReview` is true exactly when the reason is not null.
- The save function, `saveReport(report: ValidatedReport): Promise<{ ok: true; repeat: boolean } | { ok: false; reason: "store_failed" }>` in `lib/ingest/save-report.ts`, is owned by D3b. D3a ships a **stub** that always returns `{ ok: false, reason: "store_failed" }`, so the webhook answers 503 `{ "ok": false }` and nothing is stored (never a silent success). D3b replaces the body.

---

## 4. Tables

The schema is in `lib/db/schema.ts`; migrations are in `db/migrations/`. All
scoped records carry `organization_id` and `region_id`. The root
`organizations` table has no organization owner, and `regions` belongs to an
organization but has no region owner. Every scoped table has a composite foreign
key from (`organization_id`, `region_id`) to `regions`: a row cannot claim an
organization that does not own its region.

### Organizations and access (Built, D1 and A1)
- `organizations`: `id`, `name`, optional `archived_at`, timestamps.
- `regions`: `id`, `organization_id`, `name`, `slug`, optional `archived_at`, timestamps.
- `users`: `id`, `organization_id`, `region_id`, `auth_subject`, `email`, `display_name`, `role`, `active`, timestamps.
- Allowed roles: `org_admin`, `responder`, `viewer`.
- `auth_subject` is Better Auth's immutable `user.id`. The seed script creates this mapping and every authenticated request looks the user up by it.

### Staff sign-in: Better Auth tables (task A1, migration 0002)

Login identity only, for staff. Callers never have rows here. Hand-written to
Better Auth 1.7.23's schema (uuid ids), renamed to `auth_*` (Better Auth
`modelName`) and with timestamptz. They carry no organization, region, role or
active: those live only in `users`.
- `auth_user`: `id` uuid, `name`, `email` unique, `email_verified`, `image`, timestamps.
- `auth_account`: credentials. `provider_id = 'credential'`, `account_id` = `auth_user.id`, `password` = Better Auth scrypt hash (the only place a password hash is stored). OAuth columns unused.
- `auth_session`: `id`, `token` unique, `expires_at`, `ip_address`, `user_agent`, `user_id` → `auth_user` (cascade), timestamps. **Holds the signed-in staff member's IP address and browser user agent: staff data, not caller data.** Rows are deleted, not kept (a session is not history): on sign-out; when an expired row's own cookie is read (Better Auth); on every successful sign-in, which deletes all rows with `expires_at < now()` for every user; and by `npm run db:cleanup-sessions`. Expired rows are refused on read until deleted; with no sign-ins, an expired row stays until the next sign-in or cleanup run.
- `auth_verification`: required by Better Auth; unused.
- **Link:** `users.auth_subject` = `auth_user.id` (text, unique in D1, no FK). Lookups check the id is a non-empty string, ask for two rows and accept exactly one, and join `regions` (same organization, `archived_at` null) and `organizations` (`archived_at` null). `users.email` and `auth_user.email` are both set by the seed; nothing else changes either.

### Water points (Built in D1; changes in 4.1)
- `water_points`: `id`, `organization_id`, `region_id`, `location_text`, `water_point_type`, `verification_state`, `location_source`, optional `latitude`, `longitude` (numeric(9,6), range-checked), optional `merged_into_id`, `needs_review`, timestamps.
- Types: `well`, `hand_pump`, `tap`, `borehole`, `other`, `unknown`.
- Verification states: `unverified`, `verified`, `merged`, `archived`.
- Location sources: `landmark_only`, `map_pin`, `gps`, `geocoded`.
- A point without coordinates is not a map pin: it is listed in "Needs location".
- A merged point keeps its id and `merged_into_id` points to the survivor; reads follow the pointer.

### Reports and complaints (Built in D1; changes in 4.1)
- `reports`: one caller submission. Stores no caller name or phone number. `organization_id`, `region_id`, optional `complaint_id` and `water_point_id` (both null while unattached), `channel`, the extracted fields, `transcript` (always null in P0), `needs_review`, `received_at`.
- `complaints`: the current issue for a water point: `status`, `priority_score`, `priority_reason`, `report_count`, `needs_review`, optional `passed_on_partner_id` and `passed_on_note`, `fixed_at`.
- Channels: `phone`, `web`, `other`. Problems: `no_water`, `broken`, `dirty`, `slow`, `other`, `unknown`. Durations: `today`, `few_days`, `week_or_more`, `unknown`. Complaint statuses: `open`, `passed_on`, `fixed`.
- Stored values for missing data: the four NOT NULL columns (`location_text`, `water_point_type`, `problem`, `duration`) store the text or enum value `unknown`. No NOT NULL column becomes nullable. `people_affected`, `serves_school_or_clinic`, `caller_confirmed`, `summary`, `language_spoken` are null when unknown.

### Partners, notes, history, configuration (Built in D1)
- `partners`: organization and region scoped directory (`name`, `type`, `contact`, `active`). `contact` is never returned by the API.
- `notes`: appendable complaint notes with the author user and scope.
- `history_events`: append-only. A database trigger rejects updates and deletes. May reference a complaint, water point and actor, with optional `before_data` and `after_data` JSON and a `note`.
- `configuration`: scoped JSON by `key`, unique per (organization, region, key). Keys in section 8.

Caller identity, raw Vapi payloads, API keys and passwords are not stored in
these tables (staff password hashes live only in `auth_account`).

### 4.1 Schema changes still needed (listed here, not made in S6)
One migration per task, one task at a time (shared file).

| # | Change | Task |
|---|---|---|
| 1 | `reports.provider_call_ref` text, null; partial unique index on (`organization_id`, `provider_call_ref`) where not null | D3 |
| 2 | `reports.needs_review_reason` enum (list in 5.2), null; check: not null whenever `needs_review` is true | D3 |
| 3 | `reports.ended_reason` text, null; check: `customer-ended-call`, `assistant-said-end-call-phrase`, or `other` | D3 |
| 4 | Seed creates one `configuration` row `intake.phone` and the default config keys (section 8) | D3 (and D2 seed) |
| 5 | `water_points.location_key` text, null, with an index on (`organization_id`, `region_id`, `location_key`) | D4 |
| 6 | Candidates table `report_candidates` (`report_id`, `water_point_id`, `organization_id`, `region_id`, composite scoped foreign keys, unique pair) | D4 |
| 7 | `complaints.problem`, `people_affected`, `serves_school_or_clinic`, `duration`: the most severe values over its reports | D5 |
| 8 | Partial unique index: at most one complaint per `water_point_id` with `status` in (`open`, `passed_on`) | D5 |
| 9 | `complaints.needs_review_reason` is not stored: derived from its flagged reports (5.2) | D6 |
| 10 | `history_events.event_type` allowed list (5.9) enforced by a check constraint | D6 |
| 11 | A `report_candidates` row is removed (not history) only when its report is attached; a merge repoints candidates to the survivor | D4 |

Also needed outside the schema: `lib/domain/types.ts`, `lib/data/complaints.ts`,
`lib/domain/mock.ts`, strings and `docs/ux-screen-notes.md` follow the names in
section 6 (see `docs/contracts-swap-plan.md`); `docs/vapi-prompt.md` needs its
stale "unknown" lines, version table and Server URL row updated when D3 lands.

---

## 5. Rules

### 5.1 Normalizing (D3)
Every text value is trimmed. Enum values are trimmed, lowercased, and have
spaces and hyphens mapped to `_` before the check (`Hand pump` becomes
`hand_pump`). Strings or JSON numbers and booleans are accepted.

| Field | Rule |
|---|---|
| `water_point_type`, `problem`, `duration` | In the allowed list, else `unknown` and reason `invalid_fields`. A missing field is `unknown` and also `invalid_fields`. A caller's own `unknown` is valid and sets nothing. |
| `people_affected` | String or number matching `^\d{1,7}$` after trimming becomes an integer; `unknown` or anything else becomes null. A value that is present but not a number or `unknown` sets `invalid_fields`. |
| `serves_school_or_clinic` | `"true"`/`true` become true, `"false"`/`false` become false, `"unknown"` null. Anything else null plus `invalid_fields`. |
| `caller_confirmed` | Boolean true or false. Missing or not a boolean: null (never false). |
| `location_text` | Missing, empty, `unknown`, fewer than 3 characters after scrubbing, or nothing left after scrubbing: stored as the text `unknown`, reason `unusable_location`, no water point created. |
| `summary`, `language_spoken` | Text or null. Both are scrubbed (below). |

**Number scrub:** in `location_text`, `summary` and `language_spoken` (and in
any transcript, if one is ever stored), any run of 7 or more digits, with or without separators
(spaces, dots, hyphens, brackets, a leading plus), is replaced by the fixed
marker `[number removed]`. A short number such as an age or a count is kept.
Digits spoken as words ("five five five ...") are not caught: a **remaining
risk** (section 9). Names cannot be removed reliably: a volunteered name inside `location_text` or
`summary` is a **remaining risk** (section 9). Text caps (config
`intake.textMaxLength`, defaults 300 for location, 500 for summary, 50 for
language) shorten longer text; the report is still stored.

**Transcript (human decision, S6):** D3 stores **no transcript** in P0:
`reports.transcript` is null. The detail page shows the "no transcript was
captured" state. Red line 3 versus spec section 10 (a volunteered name in a
transcript) stays open for later; Vapi's own retention of the call is
**unknown** (section 9).

### 5.2 Review reasons
One stored reason per report, from this fixed list, in this priority order (the
first that applies wins). The API returns the code, never wording; UX words it.

| Code | Set when | Attached? |
|---|---|---|
| `malformed_payload` | Body not a JSON object, or `message.type` missing | No |
| `no_structured_data` | No usable `water_point_report` result (5. in section 2) | No |
| `processing_error` | Matching, creating or scoring failed after the report was stored | No (report kept as stored) |
| `unusable_location` | Location unusable (5.1) | No |
| `ambiguous_match` | Several water points fit (5.3) | No (candidates listed) |
| `invalid_fields` | A field was missing or outside the allowed values (not the caller saying "unknown") | **Yes** |
| `not_confirmed` | `caller_confirmed` is false or null | **Yes** |

- `invalid_fields` replaces the earlier draft name `incomplete_report`, so it is not confused with a caller's own `unknown` answers.
- A caller's own `unknown` alone never sets `needs_review` (spec section 7), except an unknown location (`unusable_location`).
- `off_topic` and `unknown` from `lib/domain/types.ts` are dropped: no field carries them. An off-topic call arrives as `no_structured_data` or `unusable_location`.
- **Invariant:** `needs_review` true means the reason is not null. Reports with `invalid_fields` or `not_confirmed` still match, create and score.
- A complaint is `needs_review` when any of its reports is flagged. Its reason is the highest-priority reason among those reports.
- Water point `needs_review`: true for a point created from a flagged report, cleared with the report.

Which reason can reach which screen:

| Reason | Complaint list and detail | Needs review list and report detail |
|---|---|---|
| `invalid_fields`, `not_confirmed` | Yes (the report is attached to a complaint) | Yes |
| `malformed_payload`, `no_structured_data`, `processing_error`, `unusable_location`, `ambiguous_match` | No (no complaint) | Yes, only here |

The API returns the reason code; a reason-specific banner is a UI concern.

### 5.3 Matching (D4)
A report that is not blocked by an unattached reason (5.2) looks for candidate
water points in the **same organization and region**:
- Only points with `verification_state` `unverified` or `verified`. A point that is `merged` is followed through `merged_into_id` to its survivor (then de-duplicated); `archived` points are skipped.
- `location_key` equal. The key is the report's `location_text` normalized: Unicode NFKC, lowercased, every run of non-letter and non-digit characters replaced by one space, trimmed.
- Type compatible: equal, or either side is `unknown`.

| Candidates | Action |
|---|---|
| 0 | Create a water point: `unverified`, `landmark_only`, no coordinates, the report's `location_text`, type and `location_key`, `needs_review` as the report. Attach the report. |
| 1 | Attach the report to it. |
| 2 or more | Do not pick. Reason `ambiguous_match`, report unattached, candidates saved in `report_candidates`. |

The rule is deterministic. It can create a duplicate unverified point (different
words for the same place, or a type mismatch). That is intended: a responder
merges (spec section 10). The rule values live in config (`matching.rule`).

### 5.4 Duplicates and complaints (D4, D5)
- Attached to a water point that has an `open` or `passed_on` complaint: the report joins it, `report_count` goes up by one, the score is recalculated.
- No complaint, or only a `fixed` one: a new `open` complaint is created.
- At most one active (`open` or `passed_on`) complaint per water point (partial unique index). If two calls race and the second insert hits the index, retry once as an attach.
- Complaints of different water points are never merged. Merging two water points moves their reports and history to the survivor and repoints the old id (P1).

### 5.5 Most severe values (D5)
The complaint holds the most severe value over all its reports. Unknown never
counts as severe.
- `problem`, most to least: `no_water`, `broken`, `dirty`, `slow`, `other`, `unknown`. (Scoring treats `no_water` and `broken` as severe; the rest of the order only breaks ties.)
- `duration`: `week_or_more`, `few_days`, `today`, `unknown`.
- `people_affected`: the largest known number; null if all are null.
- `serves_school_or_clinic`: true if any report says true; else false if any says false; else null.

### 5.6 Score and reason (D5)
Weights live in `scoring.weights` (section 8); these are the spec section 7 defaults.
- Problem `no_water` or `broken`: +3. Any other problem, including `unknown`: +1.
- Serves a school or clinic (true): +3.
- People affected 100 or more: +2. 20 to 99: +1.
- Duration `week_or_more`: +2. `few_days`: +1.
- Each extra report: +1, up to +3.

The score is a non-negative integer. `priority_reason` is one string built by the
server from a fixed vocabulary, with points and no caller text, items in the
order above, only items with points:

`problem no_water +3; school_or_clinic +3; people 100_or_more +2; duration week_or_more +2; extra_reports 1 +1; total 11`

**Grammar (this is the contract):** items separated by `"; "`, each item
`<token> +<n>`, last item `total <n>`. A token is a closed phrase: `problem
<problem code>`, `school_or_clinic`, `people 100_or_more`, `people 20_to_99`,
`duration <duration code>`, `extra_reports <count>`. Codes are the enum values.
A new token needs a change to this file. How the UI words a token, and what it
does with a token it does not know, is the UI's job.

### 5.7 Pin color (D5, returned by the API)
| Condition | `color` |
|---|---|
| Complaint `fixed`, or no active complaint | `green` |
| `open` or `passed_on`, problem `no_water` or `broken` | `red` |
| `open` or `passed_on`, any other problem | `yellow` |

The API also returns the label parts so color is never the only signal:
`status` and `unverified` (true when `verification_state` is `unverified`).
Hex values live in config `ui.colors`; the server returns names only.

### 5.8 Status changes (D6)
Only a signed-in human changes status (red line 5). Every change is one
transaction that updates the complaint and writes one history event.

| From | To | Event type | Notes |
|---|---|---|---|
| `open` | `passed_on` | `passed_on` | "Passed on to" text required (1 to 200 characters). A partner (`partnerId`) is **not built** (no picker; `passed_on_partner_id` is never set); when it is, a partner outside the caller's organization and region answers the same not-found as a missing one. |
| `open` | `fixed` | `status_changed` | Sets `fixed_at`. |
| `passed_on` | `fixed` | `status_changed` | Sets `fixed_at`. |
| `fixed` | `open` | `reopened` | Clears `fixed_at` and the pass-on fields. **Rule: refused if the water point already has an active complaint. NOT YET BUILT: the code has no such check and the unique index (4.1 item 8) does not exist, so a reopen can today leave two active complaints on one water point. Do not assume it is enforced.** |
| `passed_on` | `open` | `reopened` | **P1, not built, refused (`invalid`)** (human decision 2026-11-14; the spec does not list it, so it is still a spec change when built). It would be a new history row triggered by a human, with a required note; history is never overwritten. Until then a complaint passed on by mistake can only go to `fixed`; staff add a note, and the pass-on confirm dialog says it cannot be undone in this version (UX, `docs/ux-screen-notes.md`). |

**Built as server actions (human decision 2026-11-14: the contract follows the
code).** These writes are the server actions in "Complaint writes" (section 7),
not HTTP routes; there are no routes 6.4 and 6.5 in this build. The stale check is
the `version` (`updated_at` as UTC text to the microsecond), result `conflict`
(no `expectedStatus`, no 409). A note is 1 to 1000 characters
(`MAX_NOTE_LENGTH`) and "passed on to" is 1 to 200 (`MAX_PASSED_ON_TO_LENGTH`),
both in `lib/config/limits.ts` and both still marked PROPOSED there. Result
states: `saved`, `conflict`, `unauthenticated`, `denied`, `not_found`, `invalid`,
`error`. Any other pair of statuses is `invalid` and changes nothing.

**OPEN, owner: the humans with Security, deadline: before real use (not only
before the demo).** The built code copies the "passed on to" text into
`history_events.after_data.passedOnNote`. This **breaks the rule that history
never holds note text** (`before_data`/`after_data` hold codes only). The text is
typed by staff and `history_events` is append-only, so anything personal typed
there can never be removed (the copy in `complaints.passed_on_note` can be
cleared, and is on reopen). The timeline (`components/complaints/format.ts`)
reads it. Options: B, keep the text only in `complaints.passed_on_note` and store
codes in history (Security's recommendation); C, accept it with the form warning;
A, codes and partner id only (needs the partner directory). Not decided.

### 5.9 History event types
`created`, `report_added`, `status_changed`, `passed_on`, `reopened`,
`note_added`, `edited`, `pin_moved`, `verified`, `merged`, `review_cleared`,
`role_changed`, `user_deactivated`. The first ten are in `lib/domain/types.ts`;
add `review_cleared`, `role_changed`, `user_deactivated` there (the last two are
already written by A1). The server writes `created` and `report_added` with the
actor empty (shown as "system").

### 5.10 Clearing "needs review" (NOT BUILT: waits for W5; P0 as one simple button)
Verdict: **P0**, because it is one POST, one history row and one flag, with no
choices to make. `POST /api/reports/{id}/review/clear` (6.8): Responder and Org
Admin only; the report must already be attached (`waterPointId` not null; so
only `invalid_fields` or `not_confirmed` reports qualify). It sets the report's
`needs_review` false and clears the reason, recomputes the complaint and water
point flags, and writes one `review_cleared` history event. `before_data` and `after_data` hold codes only (`{ "needsReview": true,
"reason": "not_confirmed" }` and `{ "needsReview": false }`). Clearing a report
that is not flagged is **idempotent**: 200, no new history row (a double click
does not fail). An unattached report
(`malformed_payload`, `no_structured_data`, `processing_error`,
`unusable_location`, `ambiguous_match`) answers 409 `not_attached`: a responder
must first match it to a water point, which is **P1** (tool not designed here).
Until then those reports stay on the Needs review list. Humans confirm this
verdict (section 9).

---

## 6. Web API (D6, D7, W5)

**None of the routes in this section exist yet** (checked 2026-11-14: `app/api` has only auth, health and the temporary capture route). It is the target design for D7 and W5. What is built instead: the signed-in screens read through `lib/data/complaints.ts` (section 7) and complaint status and note writes are server actions (5.8, 7); **6.4, 6.5 and 6.8 will not be built as routes in this build**, and 5.10 (clearing needs review) is not built (W5).
Same server API for every client (spec section 5, rule 5). Scope comes only from
the session (`organizationId`, `regionIds`), never from the request.

### 6.1 Conventions
- JSON, camelCase names (names of `lib/domain/types.ts` kept; table in 6.9). Ids are uuid strings.
- Timestamps: ISO 8601 UTC ending in `Z`. Sorting relies on it.
- `latitude` and `longitude` are JSON numbers or null.
- Unknown people and school values are the string `"unknown"` in the API (null in the database).
- **Error body** (all errors): `{ "error": "<code>" }`, nothing else, never messages, ids or hostnames. Codes: `unauthenticated` (401, no valid session), `forbidden` (403, in-scope user without the permission, for example a Viewer writing), `not_found` (404), `invalid_request` (400), `conflict` (409, with an extra `"reason"`: `stale_status`, `invalid_transition`, `active_complaint_exists`, `not_attached`), `internal` (500).
- A missing record, a record in another organization or region, and an unreadable id all give the **same 404** `not_found`, for reads, writes and notes.
- Lists: `{ "items": [...], "total": n }`. `total` counts all in scope. `GET /api/complaints` takes `limit` (default 100, max 200, config `api.listLimit`). **The map, needs-location and needs-review lists** use the larger `api.mapLimit` (default 500, max 1000) and always return `total`; **the UI must show "N of total" whenever `items.length < total`**, so nothing is truncated silently. Filters, search and pagination are P1 (DB-8), not built.
- Lists never carry transcripts. Responses are not cached (`Cache-Control: no-store`).
- **Order of checks:** session (401), then scope (404 for a missing, out-of-scope or malformed id, and for a `partnerId` outside scope), then role (403). A Viewer writing to an out-of-scope id gets 404, not 403.
- **Tests (red line 5):** tests must prove a cross-organization 404 and a cross-region 404 for every route in this section, a Viewer 403 on every write, and that writes outside scope store nothing.
- **Not public:** no route in this section, including `/api/water-points` and the map data, is readable without a session in P0.
- The view types sent to the browser drop `organizationId` and `regionId` on list items, notes, history events and partners (the session already scopes them). History `detail` may be null. The history `actor` value `system` is a literal the UI localizes.
- No response contains a caller phone number, name, call id or `provider_call_ref`.

### 6.2 `GET /api/complaints` (D6; W2)
Any role. Sort: `priorityScore` desc, `updatedAt` desc, `id` asc. Item:
```json
{
  "id": "...", "waterPointId": "...", "status": "open",
  "problem": "no_water", "peopleAffected": 150, "servesSchoolOrClinic": true,
  "duration": "week_or_more", "reportCount": 1,
  "priorityScore": 11, "scoreReason": "problem no_water +3; ...; total 11",
  "needsReview": false, "needsReviewReason": null,
  "color": "red", "updatedAt": "...",
  "waterPoint": { "id": "...", "locationText": "...", "type": "hand_pump",
                  "verificationState": "unverified", "latitude": null, "longitude": null }
}
```
Covers every DB-1 column. `summary` is on the detail only.

### 6.3 `GET /api/complaints/{id}` (D6; W3)
Any role. Returns the complaint (fields above plus
`passedOnPartnerId`, `passedOnNote`, `createdAt`, `fixedAt`), then:
`waterPoint` (full), `reports` (newest first, the **report shape** below), `notes` (oldest
first), `history` (oldest first), `passedOnTo` (`{ id, name, type }` or null; no
contact).

**Report shape** (detail and `GET /api/reports/{id}`; never `providerCallRef`):
```json
{
  "id": "...", "waterPointId": "... or null", "complaintId": "... or null",
  "channel": "phone", "locationText": "...", "waterPointType": "hand_pump",
  "problem": "no_water", "peopleAffected": 150 ,
  "servesSchoolOrClinic": true, "duration": "week_or_more",
  "callerConfirmed": true,
  "summary": "... or null", "languageSpoken": "... or null",
  "endedReason": "assistant-said-end-call-phrase or other or null",
  "needsReview": false, "needsReviewReason": null,
  "receivedAt": "...", "transcript": null
}
```
`peopleAffected` and `servesSchoolOrClinic` may be `"unknown"`; `callerConfirmed` is
`true`, `false` or `"unknown"`. `transcript` is always null in P0. `summary`
and `languageSpoken` appear on detail reads only, never in lists. The reason for needs review is `needsReviewReason`, never null when
`needsReview` is true.

### 6.4 `POST /api/complaints/{id}/status` (NOT BUILT as a route: a server action, see 5.8)
Responder, Org Admin. Body: `{ "toStatus", "expectedStatus", "note"?, "partnerId"? }`.
Rules in 5.8. `note` is required for `passed_on` and for reopening from `passed_on` to `open`. 200 returns the updated
complaint (6.3 shape). Errors: 400, 403, 404, 409.

### 6.5 `POST /api/complaints/{id}/notes` (NOT BUILT as a route: a server action, see 5.8)
Responder, Org Admin. Body `{ "text" }` (1 to 2000 characters). 201 returns the
note `{ id, complaintId, author, text, createdAt }`; writes a `note_added` event.
`author` is the staff display name. A note on a record outside scope is 404.

### 6.6 `GET /api/reports/{id}` (D6; W3, W5)
Any role. An in-scope report, attached or not, in the report shape (6.3) plus
`candidates: [{ "id", "type", "locationText" }]` (in-scope water points only;
empty for an attached report). Needed because an unmatched needs-review report
has no complaint.

### 6.7 Lists for W5 and the map (D6, D7)
| Route | Returns | Sort |
|---|---|---|
| `GET /api/needs-review` | Items `{ "report": <report list view>, "candidates": [{ id, type, locationText }] }`. The report list view is the report shape without `summary`, `languageSpoken` and `transcript`, and **always carries `needsReviewReason`** (never null here). Candidates are in-scope only: one outside scope is dropped silently, so the list may show fewer than were found; the UI shows the in-scope count. | `receivedAt` asc |
| `GET /api/water-points/needs-location` | Active water points with no coordinates (water point shape, full) | `createdAt` asc |
| `GET /api/water-points` | Map items (below). Merged and archived hidden unless `?includeInactive=true`. | `id` asc |
| `GET /api/partners` | `{ id, name, type }` (no contact) | `name` asc |
| `GET /api/live` | See below | |

**Map item** (`GET /api/water-points`): `id`, `latitude`, `longitude` (JSON
numbers; points without coordinates are not in this list), `complaintId` (the
active complaint, else null), `type`, `status`, `color`, `unverified`,
`needsReview`, `reportCount`, `locationText`, `problem` (the current complaint's
problem, `"unknown"` when none). `status` is `open`, `passed_on`, `fixed` or
**`none`** (no complaint at all); `none` stays distinct from `fixed` in the API
even though `color` is `green` for both. A point with a `fixed` complaint and no
active one reports `fixed`.

**`candidates`** is the one name for possible matches everywhere (6.6, 6.7), with
the shape `[{ "id", "type", "locationText" }]`, in-scope only.

`GET /api/live` (D7, polling): `{ "serverTime", "lastReportReceivedAt" (or null if
none ever), "staleAfterMinutes", "pollIntervalSeconds", "version" }`. `version`
is the latest `updatedAt` among the user's scope records (complaints, water
points, reports), as an ISO string. Clients poll every `pollIntervalSeconds`
(config `polling.intervalSeconds`, default 5) and **re-read the complaint list,
the map and the review lists whenever `version` changes**. The UI judges "stale"
with `serverTime`, not the browser clock. "Last report" counts only reports in
the caller's scope.

### 6.8 `POST /api/reports/{id}/review/clear` (D6)
Responder, Org Admin. Empty body. Rules in 5.10. 200 returns the report (also
when it was not flagged: idempotent, no new history row). Errors: 401, 403, 404,
409 with `reason` `not_attached` (the only 409 reason this route has).
Status route 409 reasons: `stale_status`, `invalid_transition`,
`active_complaint_exists`.

Not in P0 (P1): create, verify, edit, pin, merge water points; pass-on partner
choice; match an unattached report; filters; audit log screen.

### 6.9 Column to API names
| Table and column | API name |
|---|---|
| `water_points.water_point_type` | `type` (water point), `waterPointType` (report) |
| `water_points.location_text` | `locationText` |
| `water_points.verification_state` | `verificationState` |
| `water_points.merged_into_id` | `mergedIntoId` |
| `reports.people_affected` (null) | `peopleAffected` (`"unknown"`) |
| `reports.serves_school_or_clinic` (null) | `servesSchoolOrClinic` (`"unknown"`) |
| `reports.caller_confirmed` (null) | `callerConfirmed` (`true`, `false` or `"unknown"`) |
| `reports.needs_review_reason` | `needsReviewReason` |
| `reports.ended_reason` | `endedReason` |
| `report_candidates` rows | `candidates: [{ id, type, locationText }]` (in-scope only; replaces the `candidateWaterPointIds` of `lib/domain/types.ts`) |
| `complaints.priority_score`, `priority_reason` | `priorityScore`, `scoreReason` |
| `complaints.passed_on_partner_id`, `passed_on_note` | `passedOnPartnerId`, `passedOnNote` |
| `history_events.event_type` | `type` |
| `history_events.actor_user_id` | `actor` (staff display name, or `system`) |
| `history_events.note` | `detail` |
| `history_events.created_at` | `at` |
| `notes.body`, `author_user_id` | `text`, `author` (display name) |

`reports.provider_call_ref` has no API name: it is never returned.

---

## 7. Permissions (Built in A1; routes in 6)

The role and action table is `lib/permissions/matrix.ts` and spec section 7. API
mapping:

| Route | Viewer | Responder | Org Admin |
|---|---|---|---|
| Every `GET` in section 6 | yes | yes | yes |
| Complaint status and notes (server actions; routes `POST .../status`, `.../notes`, `.../review/clear` are not built), review clear (not built, W5) | 403 / `denied` | yes | yes |

- Not signed in: 401. In-scope Viewer writing: 403. Out of scope or missing: 404 (the same body as missing).
- Role, organization, region and active are read from the database on every request. The session never carries trust from the browser.
- A Viewer sees transcripts in scope (none stored in P0).

### Permission rules (task A1, Built)
- Access = exactly one `users` row for the Better Auth user, `active = true`, with a non-archived region that belongs to the user's non-archived organization, and a known role. Anything else: no session at sign-in and `null` from the adapter. The system never picks one of several rows.
- Role, organization, region and active are read from the database on every request, so a role change, deactivation, archive or sign-out takes effect on the next request.
- "Remove" a staff member = `users.active = false` (red line 9; `users` has no `archived_at`).
- AC-5: `changeRole({ organizationId, actorUserId, userId, role })` and `deactivateUser({ organizationId, actorUserId, userId })` in `lib/auth/users.ts` lock the organization's active `org_admin` rows (`FOR UPDATE`, id order) in one transaction and refuse (`"last_admin"`) any change that would leave zero active Org Admins. Results: `ok | not_found | last_admin | invalid_role | forbidden`. Defence in depth: in the same transaction they lock the actor's `users` row and return `"forbidden"` (writing nothing) unless the actor is `role = org_admin`, `active = true` and in the same `organizationId`. A target outside the given organization, or already inactive, is `not_found`. **Callers must pass the `organizationId` and `actorUserId` from the signed-in session, never values taken from the request.** There is no UI or endpoint for them in this build (AC-6 is cut).
- Every change writes exactly one `history_events` row in the same transaction: `event_type` `role_changed` or `user_deactivated`; `actor_user_id` = the session user; `organization_id` and `region_id` = the target user's; `before_data`/`after_data` = `{ userId, role }` or `{ userId, active }`. No change (same role), no row.
- **Gap, flagged for whoever builds region management:** AC-5 protects roles and active only. Archiving a region that is the only region of users leaves them with no access, and nothing in A1 prevents it.

### Authentication: `/api/auth/*` (task A1, Built)
Better Auth 1.7.23, email and password, served by `app/api/auth/[...all]/route.ts`.
**Deny by default:** only these two reach Better Auth. Every other path or
method under `/api/auth` answers `404 {"error":"not_found"}` (sign-up, password
reset, change email, change password, delete user, update user, social sign-in,
list sessions, get-session, and the rest). Bodies, cookies and tokens are never logged.

| Method | Path | Request | Responses |
|---|---|---|---|
| POST | `/api/auth/sign-in/email` | JSON `{ "email", "password" }` | **200** sets the session cookie; body is `{ redirect, user }` (the route strips Better Auth's `token` field: the token lives only in the HttpOnly cookie). **401** `{ "message": "Invalid email or password", "code": "INVALID_EMAIL_OR_PASSWORD" }` for an unknown email or a wrong password (same body). **401** `code: "FAILED_TO_CREATE_SESSION"` when the password is right but there is no single active `users` row with a live region (no session is created). **400** malformed email. **403** untrusted `Origin` when the request carries a cookie (Better Auth checks Origin only then; JSON-only bodies plus no CORS/OPTIONS handler keep cross-site browsers out otherwise). **429** `{ "message": "Too many requests. Please try again later." }` plus `X-Retry-After`. |
| POST | `/api/auth/sign-out` | JSON body (e.g. `{}`) with `Content-Type: application/json` and the session cookie | **200** `{ "success": true }`; deletes the `auth_session` row and expires the cookie. Without a JSON content type: **415**. |
| GET | `/api/auth/get-session` | | **404**. Not exposed: sessions are read on the server only, through `lib/auth/adapter.ts`. |

- **Cookie:** `better-auth.session_token` (signed, HttpOnly, SameSite=Lax, Path=/, Max-Age 43200). In production, or whenever `BETTER_AUTH_URL` is `https://`, it is `__Secure-better-auth.session_token` with `Secure`. No cookie cache (`session_data` cookie is never set).
- **Session length:** 12 hours from sign-in (`SESSION_LIFETIME_SECONDS` in `lib/config/auth.ts`, the one source for this value). Never extended by use. Every session row is capped at that lifetime when it is created.
- **Origins:** `BETTER_AUTH_URL` (the public hostname, `https://bg.verilen.com` on the host), plus `http://127.0.0.1:6543` only when `NODE_ENV=development`. The Origin check is forced on in every environment.
- **Rate limit:** on in every environment. Sign-in: 5 per 60 seconds per client IP, then 429. The client IP is taken only from `cf-connecting-ip` (a single valid IP). With no such header: `127.0.0.1` in development and tests; in production one shared bucket for all such requests. In-memory, per server process (resets on restart).
- **Accounts:** sign-up is disabled (also for direct server calls). Accounts come only from `npm run db:seed`. Password length 12 to 128.

### Server-only auth functions (task A1, `lib/auth/adapter.ts`, Built)
Not HTTP endpoints. For W1's wiring points.
- `getSessionFromHeaders(h: Headers): Promise<unknown>`: reads the Better Auth session (signed cookie, row read from the database every time), then the `users` row with `auth_subject` = the Better Auth user id, and returns `sessionFromUser(row, session.expiresAt)` (`lib/auth/user-session.ts`): `{ userId, role, organizationId, regionIds, expiresAt }`, where `userId` is `users.id` and `regionIds` is the user's one region. `null` for: no or forged cookie, signed out, expired, no matching row, inactive user, archived region or organization, or any error.
- `readSessionFromHeaders()`: the same, using the current request's headers.
- `signInWithPassword(email, password, headers?)` returns `"ok" | "invalid" | "no_region" | "rate_limited" | "error"`. Unknown email and wrong password both give `"invalid"`. `"no_region"` only after the password was accepted. Its own limit: 5 per 60 s per `cf-connecting-ip`. Failures are logged as `[auth] sign_in_failed reason=<result>`, never with the email.

### Web pages and who may open them (task W1)
Pages, not API endpoints. `proxy.ts` (Next.js 16) only checks that a session
cookie **exists** and redirects signed-out visitors; it validates nothing, so
**every protected page, layout and action validates the session itself**
(`requirePageSession()` in `lib/auth/page-guard.ts`, the guards in
`lib/auth/guards.ts`). The rules are in `lib/permissions/routes.ts` and
`lib/permissions/proxy-rules.ts`.

| Path | Who | Notes |
|---|---|---|
| `/sign-in` | anyone | A signed-in user is sent to `/complaints`. `?reason=expired` shows "Your session ended". |
| `/` | anyone | Shows nothing: signed in goes to `/complaints`, else `/sign-in`. |
| `/map` | anyone | PUBLIC, status only (type and status of each water point, no detail). **PROPOSED, NOT APPROVED:** the spec lists the public map as cut. Shows nothing unless `PUBLISHED_MAP_ORGANIZATION_ID` and `PUBLISHED_MAP_REGION_IDS` are set. |
| `/api/health` | anyone | See above. |
| `/api/auth/*` | self-authenticating | Only POST sign-in and sign-out reach Better Auth (above). The proxy lets this prefix through without a cookie because it must. |
| `/api/vapi/*` | self-authenticating | Shared secret in constant time; refuses everything while unset. TEMPORARY (S5a). The proxy lets this prefix through without a cookie because Vapi has none. |
| `/complaints` | Viewer, Responder, Org Admin | Complaint list. Role needs `view`. |
| `/complaints/[id]` | Viewer, Responder, Org Admin | Complaint detail. A missing id and another organization's id show the identical message. |
| `/dashboard/map` | Viewer, Responder, Org Admin | The signed-in map (the public one is `/map`). |

Without a session cookie: any other page redirects (307) to `/sign-in`, any
other `/api/*` path answers `401 {"error":"unauthorized"}`. With a cookie the
request reaches the page, which refuses it if the session is not valid (the
page redirects to `/sign-in?reason=expired`). Redirect targets are fixed paths;
nothing from the request is copied into them. `/needs-review` and
`/needs-location` are denied by default and have no pages yet (W5).

Sign-out is a server action (`lib/auth/sign-out.ts`): it ends the session on the
server and goes to `/sign-in`. Sign-in is a server action that calls
`signInWithPassword()`; on success it redirects to `/complaints`; on any failure
it returns a message and sets no cookie.

### What the signed-in screens read (`lib/data/complaints.ts`)
Every screen reads through this one file, with the `DataContext` built from the
validated session (organization and region). **Every query filters by that
organization and those regions on every table it touches**, including joined
ones. A context that is missing, empty or has a non-uuid id returns nothing,
never everything. Another organization's record and a missing record answer
identically (`not_found_or_denied`). Lists select named columns and never
`transcript`. The real queries are tested against Postgres in
`tests/integration/data-reads.test.ts` (two organizations, three regions).

All of it is **real** (complaints, water points, reports, notes, history events,
partners, last report). What D1 does not store, and what the screens do about
it (**PROVISIONAL, waits for S6 and D4/D5**, see `docs/reviews/D1.md`):

| The screens need | D1 has | What is done |
|---|---|---|
| A complaint's problem, people affected, school or clinic, duration | Only on `reports`, not on `complaints` | Derived at read time: the most severe known values across the complaint's reports (spec section 7). No reports: all unknown. |
| A review reason, and the candidate water points for an ambiguous match | No column | Reason is null, candidates empty. W5 needs a column or a table. |
| A description of each history event | `event_type`, `before_data`, `after_data`, `note` | The screen builds the sentence from those (translatable). Unknown event types show "Change recorded". |
| The name of a water point | `location_text` (spoken) and the type only | No name. The public map labels a point by its type. |
| A version for the overwrite check (D6) | `updated_at` | `updated_at` as UTC text to the microsecond (`version`). |
| Who it was passed to | `passed_on_partner_id` and free text `passed_on_note` | Shows the partner name, else the note. |
| A report's channel | enum `phone`, `web`, `other` | The app's list now includes `other`. |
| A report's people affected, school or clinic | nullable | Null reads as `unknown`. |

Things to know (found by the red-line-8 review of these reads):

- **Lists never carry caller-derived text.** `transcript` and `summary` are
  returned by the detail read only. A list, including the needs-review list,
  has neither.
- **The schema allows cross-scope links.** Only the (organization, region) pair
  is tied to `regions` by a composite key. A report, note, history event or
  complaint can point at another organization's complaint, water point, partner
  or author. So the data layer filters EVERY table it reads, and tests insert such
  rows on purpose (`tests/integration/data-fixtures.ts`). D1 should add
  composite foreign keys (organization with each id column) so the database
  refuses them; until then the filters are the only defence.
- A note's or history event's author name is shown only if that user belongs to the
  same organization. Names of staff in OTHER regions of the same organization are
  shown (staff names, not caller data).
- `before_data` and `after_data` are passed to the screen as stored; the screen
  reads only `status` and `passedOnNote`. Whatever D6 writes there must be safe to
  show (no contact values, no note text).
- A complaint's shown problem, duration and so on are derived from ALL its
  reports, so after a reopen they can differ from the stored score and reason next
  to them. The order "slow before dirty" is a choice; the spec is silent.
- Lists are cut off at `DATA_LIST_HARD_LIMIT` (1000, PROPOSED) until pagination
  exists. The public map's read selects only the columns a pin needs.

### Complaint writes (task D6, `lib/data/complaint-writes.ts`)
Two server actions in `lib/actions/complaints.ts`, called by the forms through
`lib/actions/form-actions.ts`. Nothing here contacts anyone: "pass on" is a
recorded step (red line 5).

| Action | Input | Permission | Result states |
|---|---|---|---|
| `changeComplaintStatus` | `complaintId`, `status` (`open`, `passed_on`, `fixed`), `passedOnTo` (required, max 200, for `passed_on`), `version` | `pass_on` for `passed_on`, else `change_status` | `saved`, `conflict`, `unauthenticated`, `denied`, `not_found`, `invalid`, `error` |
| `addComplaintNote` | `complaintId`, `text` (1 to 1000 after trim) | `add_note` | same |

Order of checks: session, then the complaint is looked up inside the session's
organization and regions (another organization, another region, a missing id and
a malformed id all answer `not_found`), then `requireActionInScope` (a Viewer is
`denied` whatever the payload), then the input, then the write. Organization,
region and author come from the stored complaint and the session, never from the
request.

- **Allowed steps:** open to passed on or fixed; passed on to fixed; fixed to open
  (reopen). Anything else, including the same status, is `invalid`.
- **Version check:** the form sends the `version` it was shown (`updated_at` as
  UTC text to the microsecond). The write locks the complaint row, compares, and
  refuses with `conflict` if it moved. Two requests with the same version: exactly
  one is saved. Notes do not change the version.
- **Same transaction:** the change and its `history_events` row are written
  together; if either fails both are rolled back (`error`).
- **History event:** `status_changed`, `passed_on` or `reopened`, with
  `before_data {status}` and `after_data {status[, passedOnNote]}`; `note_added`
  with `after_data {noteId}` (no note text). Actor is the signed-in user.
  Reopen clears `fixed_at` and the pass-on fields.
- **Append-only (red line 9):** the write code only inserts into `history_events`
  and the database trigger refuses update and delete. Both are tested.
- `passedOnNote` is free text typed by staff and is copied into the history
  event, so the form tells staff not to type caller names or numbers (red line 3).
  Nothing can check this automatically.
- The author must be an active user of the same organization and in one of the
  session's regions; the role is taken from the validated session.
- Errors log the fixed code `[data] write_failed` only. The page is refreshed
  after `saved`.
- Not done: setting `passed_on_partner_id` (no partner picker yet), and `review`
  actions (W5).

Tested in `tests/integration/complaint-writes.test.ts` (Postgres) and
`tests/unit/complaint-actions.test.ts` (what the actions pass to the write).

### Seed (`npm run db:seed`, task A1, Built)
Creates "Demo Organization" and "Demo Region" (`slug` `demo-region`), then per
role a Better Auth user and credential account and a `users` row
(`auth_subject` = that user id, same email): `admin@example.org` (org_admin),
`responder@example.org`, `viewer@example.org`, all in the demo region.
Passwords from `SEED_ADMIN_PASSWORD`, `SEED_RESPONDER_PASSWORD`,
`SEED_VIEWER_PASSWORD` (12 to 128 characters, or the seed exits with code 1),
hashed with Better Auth's `hashPassword`, never printed. Idempotent: reuses
existing rows, never changes an existing `users` row, and updates the password
hashes to the current values. Never calls sign-up. **To build in D2/D3:** also
creates the `intake.phone` row and the default config keys of section 8.

### Demo data (`npm run db:seed:demo`, a separate command)
Run **after** `npm run db:seed`. Adds invented demo data to the demo organization
and region: 13 water points (verified, unverified, merged, archived; with and
without coordinates; one with no complaint), 7 complaints (every status and every
problem type; one needs review), 13 reports with transcripts (3 unmatched and
flagged, never dropped), 3 notes, 2 partners (no contact details) and the history
events. Times are "hours before the run", so the demo looks recent. Scores follow
the spec's formula (a unit test recomputes them). No caller details: no names, phone
numbers or emails (tests scan the data and the stored rows). No credentials.
- **Refuses anything but the development database (an allowlist):** it accepts a
  `DATABASE_URL` only if it is a plain URL with host `127.0.0.1`, `localhost` or
  `[::1]`, the port written and exactly **5434**, and **no query string and no
  fragment**. It also refuses if `PGHOST`, `PGHOSTADDR`, `PGPORT`, `PGSERVICE` or
  `PGSERVICEFILE` is set, and any run with `NODE_ENV=production`. This matters
  because the database driver also honors `?port=` and `?host=` in the URL and
  the `PG*` variables, and reads `#` differently from the URL parser, so a check
  of the URL's port alone can be fooled into connecting to 5433. Both the command
  line (before the database module is loaded) and `runDemoSeed` itself check the
  same `DATABASE_URL`, so neither can be skipped. Exit code 1, and a message that
  never prints the connection string. There is no override, and 5433 can never be
  allowed. Use `npm run db:local` (port 5434).
- **Will not guess the organization:** it finds "Demo Organization" by name (names
  are not unique in D1). It stops if two active organizations have that name, or
  if the organization already holds water points, complaints, reports, notes or
  partners that this seed did not write.
- **Idempotent:** a marker row (`demo_seed`) in `configuration` stops a second run,
  including two at the same moment. It never deletes anything (history is
  append-only, red line 9). To start over, delete the local `.pgdata/` folder.
- It needs the demo organization, region and accounts from `npm run db:seed`, and
  stops with that instruction if they are missing.
- **Invented, including the history:** every row is made up, and the history
  events carry made-up past times and the demo responder as the actor. Nothing
  marks a row as demo except the organization's name and the "Demo" partner
  names, so do not point real Vapi calls at this organization. The coordinates are
  invented values in a real region (the real district is unknown).
- Note for A1's owner: `npm run db:seed` itself has no port guard, and it writes
  password hashes, so it is the more dangerous command.

### `GET /api/health` (task S3, Built)
- **Auth:** None. Public. **200:** `{ "status": "ok", "db": "ok" }`. **503:** `{ "status": "error", "db": "down" }`.
- **Rules:** Never returns error messages, hostnames, versions, or any data. Not cached (`Cache-Control: no-store`).

---

## 8. Configuration

Settings live in `configuration` rows (per organization and region), read by
one server module. If a row is missing, the module falls back to the defaults
below (one defaults module, shared with the seed). Nothing is repeated in code.

| Key | Default |
|---|---|
| `intake.phone` | `{ "enabled": true }`. Exactly one row must exist (section 2). |
| `intake.maxBodyBytes` | 1 MB |
| `intake.badSecretLimit` | 5 failed attempts per 60 seconds per client IP, then 429 |
| `intake.textMaxLength` | `{ "location": 300, "summary": 500, "language": 50 }` |
| `scoring.weights` | `{ "problemSevere": 3, "problemOther": 1, "school": 3, "people100": 2, "people20": 1, "weekOrMore": 2, "fewDays": 1, "extraReport": 1, "extraReportCap": 3 }` |
| `matching.rule` | `{ "key": "normalized_location_text", "typeCompatible": "equal_or_unknown" }` |
| `ui.colors` | green, red, yellow hex values (UX picks; never the only signal) |
| `ui.staleReportMinutes` | 15 (PROPOSED in `lib/config/ui.ts`, not approved) |
| `polling.intervalSeconds` | 5 (returned by `/api/live` as `pollIntervalSeconds`) |
| `api.listLimit` | `{ "default": 100, "max": 200 }` |
| `api.mapLimit` | `{ "default": 500, "max": 1000 }` (map, needs-location, needs-review) |

Allowed values (types, problems, durations, statuses) are fixed by the database
enums in this build; changing one needs a migration and a change to this file.

### Environment variables (names only)
`DATABASE_URL`, `BETTER_AUTH_SECRET` (32+ characters), `BETTER_AUTH_URL`,
`SEED_ADMIN_PASSWORD`, `SEED_RESPONDER_PASSWORD`, `SEED_VIEWER_PASSWORD`,
`VAPI_WEBHOOK_SECRET` (plus the Vapi and public-map names in `.env.example`).
`VAPI_CALL_REF_KEY` (task D3a): the server-only key for the call reference HMAC,
a separate secret of at least 32 characters; empty placeholder in `.env.example`.
Unset or shorter than 32: the webhook answers 503 and stores nothing. Secrets are
read only through `lib/config/env.ts` (server-only).

---

## 9. Unknowns and open questions

| # | What is unknown | Owner | How to answer |
|---|---|---|---|
| 1 | How long Vapi keeps the call, its recording (audio recording is ON) and its transcript | Humans (Security) | Read the Vapi account settings and terms; set retention or delete. Spec unknown 2 |
| 2 | Whether a stored transcript may hold a volunteered name (red line 3 versus spec section 10). P0 stores none (human decision) | Humans, Security | Rule before any transcript is stored; then set a retention period (spec unknown 10) |
| 3 | `passed_on` back to `open`: decided P1 (2026-11-14), not built. When built it is a spec change (spec DB-3 and section 10 do not list it) | Humans | Approve with the P1 task, and update the spec then |
| 4 | Whether clearing needs review is P0. Verdict in 5.10: P0 for attached reports only; matching an unattached one is P1 | Humans (Backend, Frontend propose) | Confirm in the S6 PR |
| 5 | Which header type Vapi sends (only "Bearer credential" recorded) | Backend, Phone | D3 logs which matched (no value) on the first real call |
| 6 | Vapi retries when the endpoint is down, slow or answers non-200 | Phone | Test with a failing endpoint (one paid call, a human's OK). Spec unknown 4 |
| 7 | Other event types Vapi could send (only `end-of-call-report` is configured) | Phone | D3 ignores them with 200; log counts of fixed codes |
| 8 | Whether `structuredOutputs` can arrive late or empty even on a normal call (v3 calls had none) | Phone | Watch `no_structured_data` counts across the Q4 test calls |
| 9 | Values never seen on the wire: `water_point_type` `well`, `tap`, `borehole`, `other`, `unknown`; `problem` `broken`, `dirty`, `slow`, `other`, `unknown`; `duration` `today`, `few_days`, `unknown`; `people_affected` `unknown`; `serves_school_or_clinic` `"false"`, `"unknown"`; `caller_confirmed` false or missing (null); other languages | Phone | One short test call each, or accept `invalid_fields` handling |
| 10 | Untested call cases: hang-up halfway, silence, no village named, caller says "I don't know", off-topic call, non-English call, caller volunteers a name or number, two callers for the same pump, same pump named differently, whether the end-call phrase cuts off words | Phone, Backend | Each costs about $0.09 and needs a human's OK (budget file). Expected handling is in 5.2 and spec section 10 |
| 11 | Volunteered names inside `location_text` or `summary`, and digits spoken as words, which the number scrub does not catch (remaining risks) | Security | Accepted; revisit with unknown 2 |
| 12 | Whether $0.09 per minute is all-in and whether Vapi rounds up (spec unknown 13); `message.cost` is not read | Humans | Compare the Vapi invoice to the call log |
| 13 | Whether about 10 seconds from call end to the complaint is met (spec target) | Backend | Time it in Q4 |
| 14 | A platform-level administrator who creates organizations | Humans | Spec unknown 7; not needed in this build |
| 15 | Whether the stale-report threshold (15 minutes) is right | UX, humans | Approve or change `ui.staleReportMinutes` |
| 16 | Several phone lines mapped to several organizations or regions | Backend | Future work; one `intake.phone` row now |
| 17 | The map provider and tile terms | Frontend, humans | Spec unknown 9 |
| 18 | The pass-on text copied into `history_events.after_data.passedOnNote` against the "history holds codes only" rule in 5.8 (the other differences were settled on 2026-11-14: the contract follows the code). The reopen active-complaint check is NOT YET BUILT (needs the unique index, 4.1 item 8) | Humans, Security | Choose B, C or A (text in 5.8) before real use; build the reopen check with the schema PR's index |
