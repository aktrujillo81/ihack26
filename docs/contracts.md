# Contracts

Data shapes, tables, endpoints, and rules. The full contract is written in
task S6 from a real captured Vapi payload. Anything not listed here is
**unknown**: do not guess.

## Endpoints

### `GET /api/health`
- **Purpose:** Uptime check for the app and its database (task S3).
- **Auth:** None. Public.
- **200:** `{ "status": "ok", "db": "ok" }`
- **503:** `{ "status": "error", "db": "down" }`
- **Rules:** Never returns error messages, hostnames, versions, or any data.
  Response is not cached (`Cache-Control: no-store`).

### `POST /api/vapi/capture` (TEMPORARY, task S5a)
- **Purpose:** Save the raw body of the first Vapi calls so this contract can be written from real data (S5, S6). **Remove when D3 lands.**
- **Auth:** Shared secret from the Vapi credential, in `Authorization: Bearer <secret>` or `X-Vapi-Secret: <secret>`, compared in constant time. If `VAPI_WEBHOOK_SECRET` is unset, every request is refused.
- **401:** Missing or wrong secret. Empty body. Nothing saved.
- **413:** Body over the limit in `lib/config/vapi-capture.ts` (2 MB). Nothing saved.
- **200:** `{ "ok": true }`. The body is saved untouched to `docs/samples/raw/` (gitignored), one owner-only file per request. After 20 saved files, still 200, nothing saved.
- **500:** `{ "ok": false }` when the file cannot be written.
- **Rules:** No parsing, validation, cleaning, or database writes. The saved files contain the caller's phone number: never commit or share them. Logs use fixed codes only (`[vapi-capture] saved`, `rejected`, `too_large`, `limit_reached`, `save_failed`), never the body or the secret. Not cached.

## Tables

The initial schema is in `lib/db/schema.ts`; migrations are in `db/migrations/`.
All scoped records carry `organization_id` and `region_id`. The root
`organizations` table has no organization owner, and `regions` belongs to an
organization but has no region owner.

### Organizations and access

- `organizations`: `id`, `name`, timestamps.
- `regions`: `id`, `organization_id`, `name`, `slug`, timestamps.
- `users`: `id`, `organization_id`, `region_id`, `auth_subject`, `email`,
  `display_name`, `role`, `active`, timestamps.
- Allowed roles: `org_admin`, `responder`, `viewer`.
- `auth_subject` is the external/auth-library subject identifier. The exact
  authentication library remains undecided.

### Water points

- `water_points`: `id`, `organization_id`, `region_id`, `location_text`,
  `water_point_type`, `verification_state`, `location_source`, optional
  `latitude`, `longitude`, optional `merged_into_id`, `needs_review`, timestamps.
- Allowed water point types: `well`, `hand_pump`, `tap`, `borehole`, `other`,
  `unknown`.
- Verification states: `unverified`, `verified`, `merged`, `archived`.
- Location sources: `landmark_only`, `map_pin`, `gps`, `geocoded`.
- A point without coordinates is not shown as a map pin.

### Reports and complaints

- `reports`: one caller submission. It stores no caller name or phone number.
  It contains organization/region, optional complaint and water point links,
  channel, extracted fields, transcript, `needs_review`, and `received_at`.
- `complaints`: the current issue for a water point. It contains status,
  priority score and reason, report count, review flag, optional pass-on data,
  and fixed timestamp.
- A report may be stored before matching; missing or ambiguous matching marks
  it `needs_review` rather than dropping it.
- Allowed channels: `phone`, `web`, `other`.
- Allowed problems: `no_water`, `broken`, `dirty`, `slow`, `other`, `unknown`.
- Allowed durations: `today`, `few_days`, `week_or_more`, `unknown`.
- Complaint statuses: `open`, `passed_on`, `fixed`.

### Partners, notes, history, and configuration

- `partners`: organization/region-scoped partner directory records.
- `notes`: appendable complaint notes with the author user and scope.
- `history_events`: append-only audit/history records. They may reference a
  complaint, water point, and actor, with optional before/after JSON data.
- `configuration`: organization/region-scoped JSON configuration for scoring,
  colors, allowed values, and duplicate rules.

Caller identity, raw Vapi payloads, API keys, and passwords are not stored in
these tables. Transcript redaction and retention policy remain open questions.
