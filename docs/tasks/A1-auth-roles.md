```
TASK: A1 Accounts data and Better Auth server (backend half of W1, tenancy part of D1)
VERSION: v2 (gate retry 1). v1 rebuilt the session seam that origin/feat/auth-prep
  (W1 prep, teammate) already has. v2 builds only what auth-prep leaves open and
  touches none of its files.
PRIORITY: P0
SPEC REFERENCE: AC-1, AC-2, AC-3, AC-4, AC-5, AC-7; spec 2 (roles); spec 5 rules 1, 3, 6; spec 12 decision 2; AGENTS.md red lines 2, 7, 8, 9, 10, 16
GOAL: Real accounts in our Postgres and a configured Better Auth server, exposed
  as two small server-only functions that auth-prep's wiring points call:
  readSessionFromHeaders() for getCurrentSession() and signInWithPassword() for
  attemptSignIn(). Pulled ahead of S6 by the humans (2026-11-14): nothing here
  depends on the Vapi payload.

DIVISION OF WORK (no shared files with feat/auth-prep):
  auth-prep owns (A1 does not edit): lib/auth/session.ts, guards.ts, sign-in.ts,
    sign-in-state.ts, lib/permissions/*, app/(auth)/sign-in/*, their tests.
  A1 adds: tables, Better Auth config, /api/auth route, the two adapter
    functions, membership role changes (AC-5), seed.
  W1 (teammate) afterwards: wiring edits in session.ts (one line) and
    sign-in.ts (attemptSignIn becomes async, "ok" redirects, AUTH_CONFIGURED
    true, its tests updated; snippets in docs/reviews/A1.md), and
    protected layout, sign-out button, optional proxy.ts cookie check.

WHAT COULD BREAK:
  - Role or scope stored where the user can edit it (Better Auth user fields via /update-user)
  - Cookie cache keeps a signed-out or demoted user signed in (AC-7)
  - A membership given a region from another org
  - AC-5 race: two concurrent demotions leave no admin
  - Rate limiter sees every request as 127.0.0.1 behind the tunnel
  - Unused Better Auth endpoints (sign-up, reset, change-email, delete-user) reachable
  - `server-only` breaks Better Auth's schema CLI; next/headers throws in Vitest
  - Secrets reach browser code (red line 16)

ACCEPTANCE CRITERIA:
  1. Tables in lib/db/schema.ts, one first migration in db/migrations:
     - Better Auth core user, session, account, verification (hand-written to
       its documented schema; CLI only to check the diff). No role/org/region
       fields on user
     - organizations(id uuid, name, created_at, archived_at)
     - regions(id uuid, organization_id FK, name, created_at, archived_at,
       unique(organization_id, name), unique(id, organization_id))
     - memberships(id uuid, user_id FK, organization_id FK, role CHECK in
       org_admin|responder|viewer, created_at, archived_at); partial unique:
       one active membership per user
     - membership_regions(membership_id, region_id, organization_id) with
       composite FKs to (regions.id, organization_id) and
       (memberships.id, organization_id): cross-org region is impossible in the DB
  2. lib/auth/server.ts: Better Auth with drizzleAdapter; emailAndPassword
     enabled, disableSignUp true, min password 12; no reset/change-email/
     delete-user flows; cookieCache off; secure cookies forced in production;
     BETTER_AUTH_URL and trustedOrigins = the public hostname (+ 127.0.0.1:6543
     in development only); ipAddressHeaders ["cf-connecting-ip"]; rate limit
     on in every environment, sign-in about 5 per minute per IP; nextCookies()
  3. Session length from one config value in lib/config (12 hours, decided by the humans;
     auth-prep proposes 7 days max, Security proposes 12 hours). Sign-out deletes the session row
  4. app/api/auth/[...all]/route.ts; POST /api/auth/sign-up/email is refused (tested)
  5. lib/auth/adapter.ts (server-only):
     - getSessionFromHeaders(h: Headers): Promise<unknown> -- pure, testable.
       Reads the session row and the single active membership + regions from
       the DB on every request; returns { userId, role, organizationId,
       regionIds, expiresAt (ISO) } for auth-prep's parseSession, or null.
       Zero or several active memberships, or no regions -> null (never picks one)
     - readSessionFromHeaders(): wraps it with next/headers
     - signInWithPassword(email, password) -> "ok" | "invalid" | "no_region" |
       "rate_limited" | "error". Unknown email and wrong password give the same
       result; no_region only after the password is checked
  6. lib/auth/memberships.ts: changeRole and archiveMembership in one
     transaction that locks the org's active admin rows (FOR UPDATE); refuses to
     leave zero active org_admins (AC-5). "Remove" = archived_at (red line 9)
  7. Seed (npm run db:seed): one org, one region, one account per role, Org Admin
     with an explicit region row. Passwords from SEED_ADMIN_PASSWORD,
     SEED_RESPONDER_PASSWORD, SEED_VIEWER_PASSWORD (each >= 12 chars or the seed
     exits); hashed with better-auth's hashPassword; never printed; idempotent;
     never calls sign-up
  8. Env names only in .env.example: BETTER_AUTH_SECRET, BETTER_AUTH_URL, SEED_*.
     Read only via server-only getters. Nothing logged from /api/auth bodies,
     cookies, or tokens; failed sign-ins logged without the email
  9. contracts.md: auth endpoints, the 8 tables, permission rules, and that the
     session table holds staff IP and user agent (not caller data)
  10. typecheck, lint, tests pass

HOW WE WILL TEST IT (Vitest, real Postgres via npm run db:local, separate
  wellwatch_test database, migrated in globalSetup, files run in sequence; DB
  unreachable = loud failure, never a skip):
  - sign in via auth.api -> cookie -> getSessionFromHeaders returns the shape and
    auth-prep's parseSession accepts it (once auth-prep is merged; until then
    the shape is asserted directly)
  - no cookie, signed-out cookie, expired session -> null
  - no membership, two active memberships, no regions -> null
  - DB refuses a membership_regions row whose region is in another org
  - AC-5: last admin demote/archive refused; with two admins one can be demoted;
    concurrent demotions leave one admin
  - sign-up refused; 6th rapid sign-in -> 429 on POST /api/auth AND
    "rate_limited" from signInWithPassword (the server-action path). If Better
    Auth's limiter does not cover direct auth.api calls (unknown), the adapter
    enforces its own limit keyed by cf-connecting-ip
  - unknown email and wrong password give the same result
  - seed twice -> same row counts; seed exits on a short password
  - grep: no BETTER_AUTH_SECRET or DATABASE_URL in client components
  - manual: curl sign-in, read session, sign-out, session row gone; through the
    tunnel, rate limit by cf-connecting-ip (unknown until checked)

AGENTS: Security (lead), Backend (builds), Frontend (adapter fits auth-prep), UX (failure results)
DEPENDS ON: S3 (done). Coordinates with feat/auth-prep (not merged); no file overlap.
FILES: package.json/lock (better-auth), lib/db/schema.ts + db/migrations (SHARED),
  lib/auth/server.ts, lib/auth/adapter.ts, lib/auth/memberships.ts,
  app/api/auth/[...all]/route.ts, lib/config/auth.ts, lib/config/env.ts,
  .env.example, db/seed/*, vitest config + tests/integration/*,
  docs/contracts.md (SHARED), docs/decisions.md, docs/reviews/A1.md
NOT IN SCOPE: anything in auth-prep's files; sign-in screen, layout, nav;
  complaint/report/water point/partner/history tables (D1 after S6); invitations (AC-6)
HANDOFF TO W1 (auth-prep owner):
  - signInWithPassword can return "rate_limited"; SignInState has no such
    state. W1 either adds it with a UX string ("Too many tries. Please wait a
    few minutes and try again." proposed by UX) or maps it to "error"
  - Expired and missing sessions both come back null; showing signIn.expired
    is W1's choice
  - Once both merge, add the end-to-end test: adapter output -> parseSession
DECIDED (humans, 2026-11-14): session length 12 hours; Org Admin regions explicit rows.
OPEN QUESTIONS (humans): none
```
