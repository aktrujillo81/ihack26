# Better Auth setup: DRAFT (not applied)

**Status:** Draft by Person 3 (web app). **Nothing here is applied.** No package is installed, no file below exists, and `lib/db/schema.ts` and `drizzle.config.ts` are untouched. Apply only after D1 is merged to `main` and a human approves.

**Sources:** the Better Auth documentation (read 2026-11-14; pages listed at the end) and the D1 draft schema on `origin/feat/database-migrations` (commit `2893c47`, not on `main`). Anything the docs did not state is marked **UNVERIFIED**. Pin exact versions and re-check the pages when applying; the docs change.

## 1. Decisions and conflicts to settle first
1. **Library is decided, but `docs/contracts.md` on the D1 branch says "The exact authentication library remains undecided."** `docs/decisions.md` (2026-11-14) chose Better Auth. The D1 branch's wording should be updated to match.
2. **Table name collision.** Better Auth's default tables are singular: `user`, `session`, `account`, `verification`. D1 has a table named `users` (plural). Do **not** set `usePlural: true`: the docs say it applies plural names to all tables and would produce `users`. Keep the singular defaults, or better, put Better Auth in its own Postgres schema (section 4).
3. **Two places for the same person.** Better Auth owns the login identity (email, password hash, sessions). D1 `users` owns who the person is in our system (organization, region, role, active). Link them with `users.auth_subject`.
4. **Role, organization and region live only in D1 `users`.** Do not copy them into Better Auth `additionalFields`. One source of truth, read from the database on every request, so a role change or deactivation applies at once.
5. **Server-side calls skip rate limiting.** The docs say calls made through `auth.api.*` on the server are **not** rate limited. Our sign-in action must either go through the HTTP handler or do its own limiting (section 7).

## 2. How `auth_subject` links to Better Auth (proposal)
D1 only says `auth_subject` is "the external/auth-library subject identifier". Proposed meaning: **`users.auth_subject` = Better Auth `user.id`** (text).

- **Seed:** create the Better Auth user first (server-side `auth.api.signUpEmail`, see section 8), take the returned user id, then insert the D1 `users` row with that id as `auth_subject`, plus organization, region, role and `active = true`.
- **Request:** `auth.api.getSession({ headers: await headers() })` gives the Better Auth session and its `user.id`. Look up the D1 row `where auth_subject = user.id`. Build our session with `sessionFromUser(row, session.expiresAt)` (`lib/auth/user-session.ts`). No row, or `active` not true, means no session.
- A Better Auth user with no D1 row can sign in to Better Auth but gets **no** application session. That is the safe default.

## 3. Packages and versions
- `better-auth` (core). **Pin the version.**
- Drizzle adapter: **the docs conflict.** The Drizzle page says to install `@better-auth/drizzle-adapter` and import from it. The installation page imports `drizzleAdapter` from `"better-auth/adapters/drizzle"`. Check what the pinned version exports.
- CLI: `npx auth@<pinned version> ...` (the package is `auth`, not `@better-auth/cli`). The docs show `auth@latest`; do not use `latest`.
- Node minimum: **UNVERIFIED** (not stated). Next.js 16 is supported ("fully compatible"); this repo has Next 16.4.6, which replaces `middleware.ts` with `proxy.ts`.

## 4. Generate Better Auth's own tables into a separate file
Keep Better Auth's tables out of `lib/db/schema.ts` (D1's file). Isolate them in their own Postgres schema so they can never clash with `public.users`.

Config option: `drizzleAdapter(db, { provider: "pg", schemaName: "auth" })`. The docs say the CLI then generates `export const authSchema = pgSchema("auth");` and tables like `authSchema.table("user", ...)`.

Command (flags from the CLI page: `--adapter`, `--dialect`, `--output`, `--config`, `-y`):

```
npx auth@<pinned version> generate --adapter drizzle --dialect <value> --output lib/db/auth-schema.ts --config lib/auth/auth.ts -y
```

- The exact `--dialect` value for Postgres with Drizzle is **UNVERIFIED** (the docs only show `postgresql` in a Prisma example). Try `pg`, then `postgresql`, and check the output.
- The docs say the command generates "the schema required by Better Auth" from the config and plugins. They do **not** say it touches only Better Auth's tables, and they do not mention app tables. Read the generated file before committing.
- Drizzle and Prisma generation needs no database connection, but the CLI loads the auth config, so `lib/auth/auth.ts` must import cleanly without secrets at generate time. **UNVERIFIED** whether it requires env vars to be set.
- For Drizzle the docs say to then run `npx drizzle-kit generate` and `npx drizzle-kit migrate`. `npx auth@... migrate` is for the built-in Kysely adapter only. **Do not use it.**
- **`drizzle.config.ts` must list both schema files**, because it currently reads only `./lib/db/schema.ts`: `schema: ["./lib/db/schema.ts", "./lib/db/auth-schema.ts"]`. That file is shared; change it in the same PR as the generated file and get the schema owner's OK. With a non-default Postgres schema, drizzle-kit may also need `schemaFilter` including `"auth"`. **UNVERIFIED.**
- `lib/db/index.ts` builds Drizzle with `import * as schema from "./schema"`. The adapter needs the auth tables too: pass `{ ...schema, ...authSchema }` to `drizzleAdapter`.

## 5. Config sketch (DRAFT; do not paste without checking the docs for the pinned version)

`lib/auth/auth.ts`:

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle"; // or "@better-auth/drizzle-adapter": see section 3
import { nextCookies } from "better-auth/next-js";

import { getDb } from "@/lib/db";
import * as appSchema from "@/lib/db/schema";
import * as authSchema from "@/lib/db/auth-schema";

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schemaName: "auth",
    schema: { ...appSchema, ...authSchema },
  }),
  emailAndPassword: { enabled: true, disableSignUp: true }, // accounts come from the seed script
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days; must not exceed MAX_SESSION_LIFETIME_MS (lib/auth/session.ts)
    cookieCache: { enabled: false }, // default; keeps revocation immediate
  },
  rateLimit: {
    enabled: true, // default is production only
    storage: "memory", // default; per process (see section 7)
    customRules: { "/sign-in/email": { window: 10, max: 3 } }, // docs' default for this path
  },
  advanced: { ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] } }, // UNVERIFIED: see section 7
  plugins: [nextCookies()], // docs: must be the last plugin
});
```

`app/api/auth/[...all]/route.ts`:

```ts
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/auth";

export const { GET, POST } = toNextJsHandler(auth);
```

## 6. Environment variables (names only; values never in the repo)
- `BETTER_AUTH_SECRET`: at least 32 characters. Generate with `openssl rand -base64 32` or `npx auth@<version> secret`. Fallback name `AUTH_SECRET`. The docs say production throws if it is unset. Rotation uses `BETTER_AUTH_SECRETS`.
- `BETTER_AUTH_URL`: the public base URL. Set it explicitly (the docs advise against inferring it). Base path defaults to `/api/auth`.
- Add both names (empty) to `.env.example`. Server only; never `NEXT_PUBLIC_`. They live in `.env.local` and the `.env` on the host server.

## 7. Sessions and rate limiting
- **Sessions** are stored in the database by default. `expiresIn` defaults to 604800 seconds (7 days), which equals the proposed cap in `lib/auth/session.ts`. `updateAge` (1 day) extends a session as it is used; because `parseSession` refuses a session that expires more than `MAX_SESSION_LIFETIME_MS` from now, keep `expiresIn` at or below the cap.
- **Cookie cache** is off by default. The docs warn that with it on, a revoked session can stay valid on other devices until the cache `maxAge` ends. Leave it off.
- **Revocation:** sign-out ends the current session (`auth.api.signOut({ headers: await headers() })` on the server, with `nextCookies()` for cookies). Revoking others: `revokeSession`, `revokeOtherSessions`, `revokeSessions`.
- **Rate limit defaults:** enabled in production only, window 10 s, max 100; `/sign-in/email` is 3 per 10 s. Default storage is **memory**: per process, lost on restart, and the docs say it may not suit serverless. One self-hosted Next.js server makes this acceptable; `storage: "database"` needs another table and `drizzle-kit generate`.
- **Server-side calls are not rate limited.** If our sign-in server action calls `auth.api.signInEmail` directly, the limit does not apply. Either route sign-in through the HTTP handler, or add our own limiter (by client address and by email) in `attemptSignIn` before calling Better Auth, plus a lockout. We still need to build this.
- **Client address:** by default Better Auth reads `X-Forwarded-For`; the docs say to set `advanced.ipAddress.ipAddressHeaders` or `trustedProxies` for your proxy, or clients can spoof it. Our app is public through a Cloudflare Tunnel. Which header the tunnel sets and whether it can be spoofed is **UNVERIFIED**. Check before relying on `cf-connecting-ip`.

## 8. Seed script, sign-up, hashing
- `disableSignUp: true` stops public sign-up. **UNVERIFIED:** whether it also blocks `auth.api.signUpEmail` from a server script. Test it. If it does, the seed script can run with sign-up temporarily enabled in its own config, or use the Admin plugin's `create-admin` (heavier; avoid).
- Seed order: for each demo account, create the Better Auth user (name, email, password), then insert the D1 `users` row with `auth_subject` = the new Better Auth user id. Accounts needed: one per role, plus a user with **no region** to exercise the denied state (D1 requires `region_id`, so that test user needs a different approach: see open items).
- Demo passwords must **never** be committed. Read them from the environment or generate them at seed time and print them once.
- Password hashing: scrypt by default; min 8, max 128 characters.

## 9. Reading the session in routes
- Pages and actions: `const session = await auth.api.getSession({ headers: await headers() })`, then load the D1 user by `auth_subject` and call `sessionFromUser`. Pass the result into `requireSession` and friends. No session means `redirect("/sign-in")`.
- `proxy.ts` (Next 16): the docs say middleware should only check the cookie (`getSessionCookie`), which "does **not** validate it". Use it for a fast redirect only. Every page, route handler and action still calls the guards.

## 10. Apply checklist (after D1 is on `main`)
1. Confirm D1's role enum, `users` columns and `auth_subject` meaning with its owner; update `contracts.md` ("auth library undecided").
2. Branch from `main`. Install the pinned `better-auth`.
3. Write `lib/auth/auth.ts`; add env names to `.env.example`.
4. Run the generate command; review the output; add the file to `drizzle.config.ts`.
5. `npx drizzle-kit generate`, review the migration, then `npx drizzle-kit migrate` on a local database.
6. Write the seed script and the session adapter (`getCurrentSession`); mount the route handler.
7. Add the rate limiting and lockout for sign-in; test that a failed sign-in creates no session.
8. Tests, security review (red line 8), lint, typecheck, build.

## 11. Open items and unverified
- The Drizzle adapter import path, the `--dialect` value for Postgres, and whether the generate command touches only Better Auth's tables.
- Whether `disableSignUp` blocks `auth.api.signUpEmail`.
- Cloudflare Tunnel client-address header and trust.
- Whether the auth config needs env vars at generate time.
- Node minimum version.
- A "user with no region" cannot exist under D1's `region_id NOT NULL`. The denied state needs a different trigger (a user whose region is archived or missing in `regions`, or a test double). Decide with the schema owner.
- D1's `users.active` is the deactivation switch: the adapter refuses inactive users, but nothing sets it yet (user management is cut from this build).

## Sources (Better Auth docs, read 2026-11-14)
installation, adapters/drizzle, concepts/database, concepts/cli, integrations/next, authentication/email-password, concepts/session-management, concepts/users-accounts, concepts/rate-limit, reference/options (all under https://www.better-auth.com/docs/).
