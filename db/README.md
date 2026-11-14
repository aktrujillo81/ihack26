# Database

Self-hosted PostgreSQL. Schema, migrations, seed data, and database
configuration belong here. Every table must include organization and region
ownership as required by the spec.

Postgres listens only on the host server and is never exposed to the
internet. Only the Next.js server connects to it, using `DATABASE_URL`.

## Running it

1. Copy `.env.example` to `.env` and fill in the values (use a long random
   password). `.env` is gitignored.
2. Start Postgres: `docker compose up -d db`
3. Check it: `docker compose ps` (should show `healthy`)

Postgres is published on `127.0.0.1:$POSTGRES_PORT` (default 5433) only.
Data lives in the `pgdata` Docker volume. `docker compose down` keeps the
data; `docker compose down -v` deletes it.

Backup (the `backups/` folder is gitignored). Backups contain transcripts, so
keep them owner-only and never commit or share them:

```sh
mkdir -p backups && chmod 700 backups
umask 077
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "backups/wellwatch-$(date +%F).sql"
```

How long backups are kept is unknown (open question in `docs/spec.md`).
