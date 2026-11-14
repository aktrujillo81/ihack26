# AI mistakes

One line per mistake an AI assistant made: date, what went wrong, and the fix.

- 2026-11-14 (Backend, A1): ran `npm run db:migrate` expecting `.env.local` to win, but drizzle-kit loads `.env` itself (bundled dotenv) before `drizzle.config.ts`, so the migration went to the database in `.env` (127.0.0.1:5433) instead of the local one. The eight new tables were empty; they and the `drizzle` schema were dropped at once, restoring that database. Fix: pass `DATABASE_URL` in the shell when running drizzle-kit, until drizzle.config.ts is fixed.
- 2026-11-14 (Backend, A1): fixed. `drizzle.config.ts` now gives `.env.local` precedence over `.env` even though drizzle-kit preloads `.env`: a variable counts as set by the shell only if it is in the original process environment (`/proc/self/environ`), otherwise `.env.local` wins. Checked through the real drizzle-kit CLI: with both files it resolves to the `.env.local` database; a shell `DATABASE_URL` still wins.
