# Host runbook: apply migration 0003 (schema PR #39)

For the person who runs the production database (port 5433 on the host). **Nobody runs this from a development machine, and the AI assistants never do.** Order: merge #39, deploy, back up, check the data, migrate, verify. What is not known to the Orchestrator is marked "unknown".

1. **Before you start.** #39 is merged to `main` and the host has pulled it (`git pull` on the host checkout). The app may keep running during the backup and the check. Stop or pause the Vapi Server URL only if the humans say so (unknown). Do not point Vapi at the new webhook yet: D3a is a separate step.
2. **Back up the database.** Use `pg_dump` in custom format, to a file that is not in the repo and not on a synced folder, for example `pg_dump --format=custom --file <backup-file> "<production connection string>"`. Then check the file is not empty and that `pg_restore --list <backup-file>` prints the table list. Keep a copy on a second device. The exact production connection string and where backups are kept are unknown here; never paste the string into chat, a commit or a log.
3. **Data check (read-only).** In `psql` on the host, run:
   ```sql
   -- must return ZERO rows, or the migration will stop with an error and change nothing
   SELECT water_point_id, count(*) FROM complaints
   WHERE status IN ('open','passed_on') GROUP BY water_point_id HAVING count(*) > 1;
   ```
   If it returns rows: do not migrate. Tell the Orchestrator which water points (ids only). A human decides which complaint stays active; that fix is a normal status change by a signed-in staff member, not an edit in the database.
4. **Informational (read-only).** `SELECT count(*) FROM reports WHERE needs_review;` and `SELECT count(*) FROM reports WHERE needs_review AND water_point_id IS NULL;` The second number is how many existing flagged, unattached reports will get the reason `processing_error` (or `unusable_location` when their location is `unknown`). If both are 0 nothing is backfilled.
5. **Migrate.** On the host checkout, with the host's own `.env` (production `DATABASE_URL`): `npm run db:migrate`. It applies `0003_*` only. Read the output. If it prints an error, stop and do not retry in a loop.
6. **Verify.** Run the app health check (`GET /api/health` returns `{"status":"ok","db":"ok"}`), sign in as a demo or staff user, open the complaint list and one complaint. Then in `psql`: `\d reports` shows `provider_call_ref`, `needs_review_reason`, `ended_reason`; `\d report_candidates` exists; `SELECT count(*) FROM reports WHERE needs_review AND needs_review_reason IS NULL;` returns 0.
7. **If something is wrong:** do not edit tables by hand. Restore from the backup (`pg_restore --clean --if-exists`, into the same database, with the app stopped) and tell the Orchestrator. Restoring loses anything written after the backup; say so before doing it (unknown how much traffic there is).
8. **Report back:** the migration output (no connection strings), the two counts, and the verify results.

Do not run `npm run db:seed:demo` on the host: it refuses anything but port 5434 on purpose, and its data is invented.
