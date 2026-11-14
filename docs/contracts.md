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

### Authentication: `/api/auth/*` (task A1)
Better Auth 1.7.23, email and password, served by `app/api/auth/[...all]/route.ts`.
**Deny by default:** only these two reach Better Auth. Every other path or
method under `/api/auth` answers `404 {"error":"not_found"}` (sign-up, password
reset, change email, change password, delete user, update user, social sign-in,
list sessions, get-session, and the rest). Bodies, cookies and tokens are never logged.

| Method | Path | Request | Responses |
|---|---|---|---|
| POST | `/api/auth/sign-in/email` | JSON `{ "email", "password" }` | **200** sets the session cookie; body is `{ redirect, user }` (the route strips Better Auth's `token` field: the token lives only in the HttpOnly cookie). **401** `{ "message": "Invalid email or password", "code": "INVALID_EMAIL_OR_PASSWORD" }` for an unknown email or a wrong password (same body). **401** `code: "FAILED_TO_CREATE_SESSION"` when the password is right but the account has no single active membership with a region (no session is created). **400** malformed email. **403** untrusted `Origin` when the request carries a cookie (Better Auth checks Origin only then; JSON-only bodies plus no CORS/OPTIONS handler keep cross-site browsers out otherwise). **429** `{ "message": "Too many requests. Please try again later." }` plus `X-Retry-After`. |
| POST | `/api/auth/sign-out` | JSON body (e.g. `{}`) with `Content-Type: application/json` and the session cookie | **200** `{ "success": true }`; deletes the `session` row and expires the cookie. Without a JSON content type: **415**. |
| GET | `/api/auth/get-session` | | **404**. Not exposed: sessions are read on the server only, through `lib/auth/adapter.ts`. |

- **Cookie:** `better-auth.session_token` (signed, HttpOnly, SameSite=Lax, Path=/,
  Max-Age 43200). In production, or whenever `BETTER_AUTH_URL` is `https://`,
  it is `__Secure-better-auth.session_token` with `Secure`. No cookie cache (`session_data` cookie is never set).
- **Session length:** 12 hours from sign-in (`SESSION_LIFETIME_SECONDS` in
  `lib/config/auth.ts`). Never extended by use. Any session row is capped at
  that lifetime when it is created.
- **Origins:** `BETTER_AUTH_URL` (the public hostname, `https://bg.verilen.com`
  on the host), plus `http://127.0.0.1:6543` only when `NODE_ENV=development`.
- **Rate limit:** on in every environment. Sign-in: 5 per 60 seconds per client
  IP, then 429. The client IP is taken only from `cf-connecting-ip` (a single
  valid IP). With no such header: `127.0.0.1` in development and tests; in
  production one shared bucket for all such requests. In-memory, per server
  process (resets on restart).
- **Accounts:** sign-up is disabled (also for direct server calls). Accounts
  come only from `npm run db:seed`. Minimum password length 12, maximum 128.

### Server-only auth functions (task A1, `lib/auth/adapter.ts`)
Not HTTP endpoints. For feat/auth-prep's wiring points (W1).
- `getSessionFromHeaders(h: Headers): Promise<unknown>` returns
  `{ userId, role, organizationId, regionIds, expiresAt }` (`role` one of
  `org_admin | responder | viewer`; `expiresAt` ISO 8601 UTC) or `null`. Reads
  the session row and the membership on every call. `null` for: no or forged
  cookie, signed out, expired, zero or several active memberships, archived
  organization, no active region, or any error.
- `readSessionFromHeaders()`: the same, using the current request's headers.
- `signInWithPassword(email, password, headers?)` returns
  `"ok" | "invalid" | "no_region" | "rate_limited" | "error"`. Unknown email and
  wrong password both give `"invalid"`. `"no_region"` only after the password
  was accepted. Its own limit: 5 per 60 s per `cf-connecting-ip` (Better Auth's
  limiter does not cover direct server calls). Failures are logged as
  `[auth] sign_in_failed reason=<result>`, never with the email.

## Tables
Complaint, report, water point, partner and history tables: unknown until S6,
added in task D1. Migration `db/migrations/0000_auth_accounts.sql` (task A1)
creates the eight tables below. All timestamps are `timestamptz`.

### Better Auth core (staff accounts only, never callers)
Hand-written to Better Auth 1.7.23's Drizzle schema with `generateId: "uuid"`.
They carry no organization or region: access lives in `memberships`.
- `user`: `id uuid PK`, `name text` (staff display name), `email text unique`,
  `email_verified bool`, `image text null`, `created_at`, `updated_at`.
  No role, organization or region fields (a user can edit their own row
  through Better Auth, so access must never live here).
- `session`: `id uuid PK`, `token text unique`, `expires_at`, `created_at`,
  `updated_at`, `ip_address text null`, `user_agent text null`,
  `user_id → user.id` (cascade). **Holds the signed-in staff member's IP
  address and browser user agent. This is staff data, not caller data.** Rows
  are deleted on sign-out (a session is not history).
- `account`: credentials. `provider_id = 'credential'`, `account_id = user.id`,
  `password` = Better Auth scrypt hash. Other columns (OAuth tokens) unused.
- `verification`: required by Better Auth; unused in this build.

### Tenancy and access
- `organizations`: `id uuid PK`, `name`, `created_at`, `archived_at null`.
- `regions`: `id uuid PK`, `organization_id → organizations`, `name`,
  `created_at`, `archived_at null`. Unique `(organization_id, name)` and
  `(id, organization_id)`.
- `memberships`: `id uuid PK`, `user_id → user`, `organization_id →
  organizations`, `role` CHECK in `org_admin | responder | viewer`,
  `created_at`, `archived_at null`. Partial unique index: one active
  (`archived_at is null`) membership per user. Unique `(id, organization_id)`.
- `membership_regions`: `membership_id`, `region_id`, `organization_id`;
  PK `(membership_id, region_id)`. Composite FKs `(membership_id,
  organization_id) → memberships(id, organization_id)` and `(region_id,
  organization_id) → regions(id, organization_id)`, so a region from another
  organization cannot be assigned (enforced by Postgres).

## Permission rules (task A1)
- Access = exactly one active membership in a non-archived organization, with a
  known role and at least one non-archived region. Anything else: no session
  (refused at sign-in) and `null` from the adapter. The system never picks one
  of several memberships.
- Org Admins get explicit region rows like every other role.
- Role and regions are read from the database on every request, so a demotion,
  archive or sign-out takes effect on the next request.
- "Remove" a member = set `memberships.archived_at` (red line 9).
- AC-5: `changeRole` and `archiveMembership` (`lib/auth/memberships.ts`) lock
  the organization's active Org Admin rows (`FOR UPDATE`, id order) in one
  transaction and refuse (`"last_admin"`) any change that would leave zero
  active Org Admins. Results: `ok | not_found | last_admin | invalid_role`. A
  membership outside the given organization is `not_found`. Callers must pass
  the `organizationId` from the signed-in session, never one taken from the
  request (body, query, path or header). Who may call them
  (Org Admin of that organization) is checked by the caller's guard; there is
  no UI or endpoint for them in this build (AC-6 is cut).
- **Gap, flagged for whoever builds region management:** AC-5 protects roles and
  memberships only. Archiving a region that is a member's only region (for
  example the only region of an organization, or of its last Org Admin) leaves
  those members with no access, and nothing in A1 prevents it. Region
  management must check this before archiving.
- What each role may do: unknown here; see feat/auth-prep's
  `lib/permissions/matrix.ts` and spec section 7.

## Seed (`npm run db:seed`, task A1)
Creates "Demo Organization", "Demo Region", and `admin@example.org`
(org_admin), `responder@example.org`, `viewer@example.org`, each with one
region row. Passwords from `SEED_ADMIN_PASSWORD`, `SEED_RESPONDER_PASSWORD`,
`SEED_VIEWER_PASSWORD` (12 to 128 characters, or the seed exits with code 1).
Hashed with Better Auth's `hashPassword`; never printed. Idempotent: reuses
existing rows, never changes an existing active membership, and updates the
password hashes to the current values.

## Environment variables (names only)
`DATABASE_URL`, `BETTER_AUTH_SECRET` (32+ characters), `BETTER_AUTH_URL`,
`SEED_ADMIN_PASSWORD`, `SEED_RESPONDER_PASSWORD`, `SEED_VIEWER_PASSWORD`. Read
only through `lib/config/env.ts` (server-only).
