```
TASK: A1 Better Auth server on D1's users table (backend half of W1)
VERSION: v3. v2 (branch feat/auth-roles, all agents PASS) defined its own
  organizations, regions, memberships and membership_regions. D1 (PR #27) has
  since merged with organizations, regions and users, and the humans decided A1
  adapts to D1 (docs/decisions.md). v3 keeps v2's reviewed Better Auth work and
  drops its own account tables. Built on a fresh branch, feat/auth-server, from
  main; code is reused from feat/auth-roles.
PRIORITY: P0
SPEC REFERENCE: AC-1, AC-2, AC-3, AC-4, AC-5, AC-7; spec 2; spec 5 rules 1, 3, 6; AGENTS.md red lines 2, 7, 8, 9, 10, 16
GOAL: Staff sign in with email and password. Better Auth owns the login
  identity; D1's `users` row (found by users.auth_subject = Better Auth
  user.id) owns organization, region, role and active. Two server-only
  functions for W1's wiring points: readSessionFromHeaders() for
  getCurrentSession() and signInWithPassword() for attemptSignIn().

DIVISION OF WORK (no shared files with W1):
  W1 / JerrZane owns (A1 does not edit): lib/auth/session.ts, guards.ts,
    sign-in.ts, sign-in-state.ts, user-session.ts, lib/permissions/*,
    app/(auth)/*, and their tests. Open PR #28 edits session.ts.
  D1 owns the existing tables. A1 does not change them; it adds tables only.

REUSED FROM v2 (already reviewed by Security, re-checked against D1):
  - Better Auth 1.7.23 (exact) with drizzleAdapter. Its tables are renamed
    with modelName to `auth_user`, `auth_session`, `auth_account`,
    `auth_verification` (public schema, timestamptz): `user` is a reserved word
    in Postgres and too close to D1's `users`. Drizzle exports named authUser
    etc., passed explicitly to drizzleAdapter. No role/org/region fields on
    Better Auth's user
  - /api/auth allowlist: POST /sign-in/email and POST /sign-out only; every
    other path 404 (incl. get-session, sign-up, update-user); token stripped
    from the sign-in body
  - emailAndPassword with disableSignUp; min password 12; cookieCache off;
    disableSessionRefresh; secure cookies in production or on https; origin
    check forced on; trustedOrigins = public host (+127.0.0.1:6543 in dev)
  - Fixed 12-hour session from one config value (lib/config/auth.ts), capped
    in the session-create hook
  - Rate limits: Better Auth's on /api/auth and the adapter's own on
    signInWithPassword, both 5/min per cf-connecting-ip
  - Expired session rows deleted on every sign-in and by npm run db:cleanup-sessions
  - Integration test harness: separate wellwatch_test DB on db:local,
    migrated in globalSetup, files in sequence, loud failure if unreachable
  - Secrets boundary unit test

CHANGED FOR D1:
  1. Migration: one new migration on top of D1's 0000/0001 that adds only the
     four Better Auth tables. D1's tables are not altered
  2. Adapter getSessionFromHeaders(h): Better Auth session -> look up `users`
     where auth_subject = session.user.id (id checked non-empty first; ask for
     two rows, accept exactly one), JOINED to `regions` and `organizations`
     requiring regions.archived_at is null, organizations.archived_at is null,
     and regions.organization_id = users.organization_id (sessionFromUser
     checks none of these; auth_subject has no FK) -> map the columns to
     sessionFromUser's camelCase { id, organizationId, regionId, role, active }
     -> main's sessionFromUser(row, session.expiresAt) -> parseSession shape
     or null. Inactive user, archived region or org, or no row -> null
  3. Session-create hook: refuse a session (after the password check) unless
     exactly one active users row matches with a live region -> "no_region"
     on the adapter path, same as v2
  4. AC-5 in lib/auth/users.ts: changeRole(orgId, userId, role) and
     deactivateUser(orgId, userId) in one transaction that locks the org's
     active org_admin rows (FOR UPDATE, id order). Refuse to leave zero active
     org_admins. "Remove" = active false (red line 9; D1 has no archived_at on
     users). Callers pass the session's organizationId, never the request's.
     Each change writes a history_events row in the same transaction
     (event_type role_changed / user_deactivated; actor = the session user;
     org and region = the target user's; before_data/after_data = the role or
     active value). Spec 9 and red line 9; tested
  5. Seed (npm run db:seed): one organization and region (D1 tables), then per
     role a Better Auth user + credential account (hashPassword) and a D1
     users row with auth_subject = that user id. Passwords from
     SEED_ADMIN_PASSWORD / SEED_RESPONDER_PASSWORD / SEED_VIEWER_PASSWORD,
     12-128 chars or exit; never printed; idempotent; never calls sign-up
  6. contracts.md: auth endpoints, Better Auth tables, the auth_subject link,
     permission rules, session table holds staff IP and user agent, deleted at expiry
  7. lib/config/auth.ts exports the 12-hour value so W1 can import it in
     session.ts later (W1's change, not A1's)

WHAT COULD BREAK:
  - Naming confusion: Better Auth `user` vs D1 `users` (different tables)
  - auth_subject lookup matching the wrong row (undefined id, duplicates)
  - users.email vs Better Auth user.email drifting apart (the seed sets both; nothing else changes either)
  - Migration numbering: next is 0002. If another schema PR merges first,
    regenerate from fresh main; never rename migration files
  - PR #30 (drizzle.config.ts fix) must merge first, or db:migrate on this host hits production

HOW WE WILL TEST IT (Vitest, wellwatch_test on db:local 5434, never 5433):
  - All v2 auth tests that still apply (allowlist 404s, token stripped, rate
    limits on both paths, identical invalid results, cleanup, cookie flags)
  - sign in -> cookie -> getSessionFromHeaders -> main's parseSession accepts it, for all three roles
  - no users row, inactive user, region archived, forged/expired/signed-out cookie -> null
  - role change and deactivation apply on the next request
  - AC-5: last admin demote/deactivate refused; two admins -> one demotable;
    concurrent demote/demote and deactivate/demote leave exactly one admin;
    a target in another org -> not_found
  - archived organization -> null; region from another org cannot occur (D1 FK) and is refused by the join
  - each role change and deactivation writes exactly one history_events row with actor, before, after
  - the 12-hour value in lib/config/auth.ts equals MAX_SESSION_LIFETIME_MS in lib/auth/session.ts (until W1 imports it)
  - seed twice -> same counts; short password -> exit 1, password not printed
  - npm run db:generate after the change -> one new migration, then "No schema changes"
  - manual: curl sign-in, session row, sign-out, row gone (against npm run dev)

AGENTS: Security (lead), Backend (builds), Frontend (fits W1's user-session.ts and parseSession), UX (failure results unchanged)
DEPENDS ON: D1 (merged), PR #30 (drizzle.config.ts fix) merged first
FILES: package.json/lock (better-auth, tsx), lib/db/schema.ts (SHARED: adds 4
  tables), db/migrations (SHARED: one new migration), lib/auth/server.ts,
  adapter.ts, users.ts, session-cleanup.ts, lib/config/auth.ts, env.ts,
  app/api/auth/[...all]/route.ts, db/seed/*, db/cleanup-sessions.ts,
  vitest config, tests/integration/*, tests/unit/secrets-boundary.test.ts,
  .env.example, docs/contracts.md (SHARED), docs/decisions.md, docs/reviews/A1.md
NOT IN SCOPE: W1's files; changing D1's tables; several regions per user
  (D1 has one); invitation or role screens (AC-6)
HANDOFF TO W1 (after merge): session.ts getCurrentSession() -> readSessionFromHeaders();
  sign-in.ts attemptSignIn() async -> signInWithPassword(), "ok" redirects;
  import the 12-hour value. UX asks: "rate_limited" gets its own state and
  string ("Too many tries. Please wait a few minutes and try again."), not
  "error"; an expired session shows signIn.expired
OPEN QUESTIONS: none (session length, retention, Org Admin scope, and the D1 model are decided)
```
