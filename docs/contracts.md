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

### Authentication: `/api/auth/*` (task A1)
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

- **Cookie:** `better-auth.session_token` (signed, HttpOnly, SameSite=Lax, Path=/,
  Max-Age 43200). In production, or whenever `BETTER_AUTH_URL` is `https://`,
  it is `__Secure-better-auth.session_token` with `Secure`. No cookie cache
  (`session_data` cookie is never set).
- **Session length:** 12 hours from sign-in (`SESSION_LIFETIME_SECONDS` in
  `lib/config/auth.ts`, the one source for this value). Never extended by use.
  Every session row is capped at that lifetime when it is created.
- **Origins:** `BETTER_AUTH_URL` (the public hostname, `https://bg.verilen.com`
  on the host), plus `http://127.0.0.1:6543` only when `NODE_ENV=development`.
  The Origin check is forced on in every environment.
- **Rate limit:** on in every environment. Sign-in: 5 per 60 seconds per client
  IP, then 429. The client IP is taken only from `cf-connecting-ip` (a single
  valid IP). With no such header: `127.0.0.1` in development and tests; in
  production one shared bucket for all such requests. In-memory, per server
  process (resets on restart).
- **Accounts:** sign-up is disabled (also for direct server calls). Accounts
  come only from `npm run db:seed`. Password length 12 to 128.

### Server-only auth functions (task A1, `lib/auth/adapter.ts`)
Not HTTP endpoints. For W1's wiring points.
- `getSessionFromHeaders(h: Headers): Promise<unknown>`: reads the Better Auth
  session (signed cookie, row read from the database every time), then the
  `users` row with `auth_subject` = the Better Auth user id (see "Staff
  sign-in" below), and returns `sessionFromUser(row, session.expiresAt)`
  (`lib/auth/user-session.ts`): `{ userId, role, organizationId, regionIds,
  expiresAt }`, where `userId` is `users.id` and `regionIds` is the user's one
  region. `null` for: no or forged cookie, signed out, expired, no matching
  row, inactive user, archived region or organization, or any error.
- `readSessionFromHeaders()`: the same, using the current request's headers.
- `signInWithPassword(email, password, headers?)` returns
  `"ok" | "invalid" | "no_region" | "rate_limited" | "error"`. Unknown email and
  wrong password both give `"invalid"`. `"no_region"` only after the password
  was accepted (no active `users` row with a live region). Its own limit: 5 per
  60 s per `cf-connecting-ip` (Better Auth's limiter does not cover direct
  server calls). Failures are logged as `[auth] sign_in_failed reason=<result>`,
  never with the email.

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

## Tables

The initial schema is in `lib/db/schema.ts`; migrations are in `db/migrations/`.
All scoped records carry `organization_id` and `region_id`. The root
`organizations` table has no organization owner, and `regions` belongs to an
organization but has no region owner.

### Organizations and access

- `organizations`: `id`, `name`, optional `archived_at`, timestamps.
- `regions`: `id`, `organization_id`, `name`, `slug`, optional `archived_at`,
  timestamps.
- `users`: `id`, `organization_id`, `region_id`, `auth_subject`, `email`,
  `display_name`, `role`, `active`, timestamps.
- Allowed roles: `org_admin`, `responder`, `viewer`.
- `auth_subject` is Better Auth's immutable `user.id`. The seed script creates
  this mapping and every authenticated request looks the user up by it.
- Every scoped table has a composite foreign key from
  (`organization_id`, `region_id`) to `regions`. A row cannot claim an
  organization that does not own its region.

### Staff sign-in: Better Auth tables (task A1, migration 0002)

Login identity only, for staff. Callers never have rows here. Hand-written to
Better Auth 1.7.23's schema (uuid ids), renamed to `auth_*` (Better Auth
`modelName`) and with timestamptz. They carry no organization, region, role or
active: those live only in `users`.
- `auth_user`: `id` uuid, `name`, `email` unique, `email_verified`, `image`,
  timestamps.
- `auth_account`: credentials. `provider_id = 'credential'`, `account_id` =
  `auth_user.id`, `password` = Better Auth scrypt hash (the only place a
  password hash is stored). OAuth columns unused.
- `auth_session`: `id`, `token` unique, `expires_at`, `ip_address`,
  `user_agent`, `user_id` → `auth_user` (cascade), timestamps. **Holds the
  signed-in staff member's IP address and browser user agent: staff data, not
  caller data.** Rows are deleted, not kept (a session is not history): on
  sign-out; when an expired row's own cookie is read (Better Auth); on every
  successful sign-in, which deletes all rows with `expires_at < now()` for every
  user; and by `npm run db:cleanup-sessions`. Expired rows are refused on read
  until deleted; with no sign-ins, an expired row stays until the next sign-in
  or cleanup run.
- `auth_verification`: required by Better Auth; unused.
- **Link:** `users.auth_subject` = `auth_user.id` (text, unique in D1, no FK).
  Lookups check the id is a non-empty string, ask for two rows and accept
  exactly one, and join `regions` (same organization, `archived_at` null) and
  `organizations` (`archived_at` null). `users.email` and `auth_user.email` are
  both set by the seed; nothing else changes either.

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
- `history_events`: append-only audit/history records. A database trigger
  rejects updates and deletes. Events may reference a complaint, water point,
  and actor, with optional before/after JSON data.
- `configuration`: organization/region-scoped JSON configuration for scoring,
  colors, allowed values, and duplicate rules.

Caller identity, raw Vapi payloads, API keys, and passwords are not stored in
these tables (staff password hashes live only in `auth_account`). Transcript redaction and retention policy remain open questions.

## Permission rules (task A1)
- Access = exactly one `users` row for the Better Auth user, `active = true`,
  with a non-archived region that belongs to the user's non-archived
  organization, and a known role. Anything else: no session at sign-in and
  `null` from the adapter. The system never picks one of several rows.
- Role, organization, region and active are read from the database on every
  request, so a role change, deactivation, archive or sign-out takes effect on
  the next request.
- "Remove" a staff member = `users.active = false` (red line 9; `users` has no
  `archived_at`).
- AC-5: `changeRole({ organizationId, actorUserId, userId, role })` and
  `deactivateUser({ organizationId, actorUserId, userId })` in
  `lib/auth/users.ts` lock the organization's active `org_admin` rows
  (`FOR UPDATE`, id order) in one transaction and refuse (`"last_admin"`) any
  change that would leave zero active Org Admins. Results:
  `ok | not_found | last_admin | invalid_role | forbidden`. Defence in depth:
  in the same transaction they lock the actor's `users` row and return
  `"forbidden"` (writing nothing) unless the actor is `role = org_admin`,
  `active = true` and in the same `organizationId`. A target outside the given
  organization, or already inactive, is `not_found`. **Callers must pass the
  `organizationId` and `actorUserId` from the signed-in session, never values
  taken from the request.** Who may call them (an Org Admin of that
  organization) is checked by the caller's guard; there is no UI or endpoint for
  them in this build (AC-6 is cut).
- Every change writes exactly one `history_events` row in the same transaction:
  `event_type` `role_changed` or `user_deactivated`; `actor_user_id` = the
  session user; `organization_id` and `region_id` = the target user's;
  `before_data`/`after_data` = `{ userId, role }` or `{ userId, active }`. No
  change (same role), no row.
- **Gap, flagged for whoever builds region management:** AC-5 protects roles and
  active only. Archiving a region that is the only region of users (for example
  an organization's only region, or its last Org Admin's) leaves them with no
  access, and nothing in A1 prevents it.
- What each role may do: `lib/permissions/matrix.ts` and spec section 7.

## Seed (`npm run db:seed`, task A1)
Creates "Demo Organization" and "Demo Region" (`slug` `demo-region`), then per
role a Better Auth user and credential account and a `users` row
(`auth_subject` = that user id, same email): `admin@example.org` (org_admin),
`responder@example.org`, `viewer@example.org`, all in the demo region.
Passwords from `SEED_ADMIN_PASSWORD`, `SEED_RESPONDER_PASSWORD`,
`SEED_VIEWER_PASSWORD` (12 to 128 characters, or the seed exits with code 1),
hashed with Better Auth's `hashPassword`, never printed. Idempotent: reuses
existing rows, never changes an existing `users` row, and updates the password
hashes to the current values. Never calls sign-up.

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

## Environment variables (names only)
`DATABASE_URL`, `BETTER_AUTH_SECRET` (32+ characters), `BETTER_AUTH_URL`,
`SEED_ADMIN_PASSWORD`, `SEED_RESPONDER_PASSWORD`, `SEED_VIEWER_PASSWORD`
(plus the Vapi and public-map names in `.env.example`). Secrets are read only
through `lib/config/env.ts` (server-only).
