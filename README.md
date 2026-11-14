# ihack26

Well Watch: a phone-in water point reporting system with a web app for NGO coordinators. Built for iHack 2026 (International category).

Start with `AGENTS.md` and `docs/spec.md`.

## Running locally

Requires Node 20.12+. Docker is optional.

```sh
cp .env.example .env.local  # fill in values; never commit it
npm install
npm run db:local            # Postgres 17 on 127.0.0.1:5433, no Docker. Leave it running.
npm run dev                 # in a second terminal: http://localhost:6543
```

`DATABASE_URL` must match the other values, for example
`postgres://<POSTGRES_USER>:<POSTGRES_PASSWORD>@127.0.0.1:5433/<POSTGRES_DB>`.

### Choosing a database

- **Your own machine: `npm run db:local`.** Uses the `embedded-postgres` dev
  package, which installs a real Postgres 17 for your OS through npm. Data lives
  in `.pgdata/` (gitignored) and survives restarts. Ctrl+C stops it. Delete
  `.pgdata/` to start from an empty database.
- **Your own machine, with Docker: `npm run db:up`.** Same settings, same port.
  Use one or the other, not both: they share port 5433.
- **The host server: always `npm run db:up` (Docker).** Never run `db:local` there.

If `db:local` says the port is in use, the Docker database or a leftover
Postgres from a crashed run is still running. Stop it, or set another
`POSTGRES_PORT` (and the matching port in `DATABASE_URL`).

Check it: `curl localhost:6543/api/health` should return `{"status":"ok","db":"ok"}`.

| Command | What it does |
|---|---|
| `npm run build` / `npm start` | Production build and server on port 6543 |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript checks |
| `npm run db:local` | Local Postgres without Docker (development only) |
| `npm run db:up` | Postgres in Docker (host server, or developers who prefer Docker) |
| `npm run db:generate` / `npm run db:migrate` | Create and apply Drizzle migrations in `db/migrations/` |

On the host server, port 6543 is published at https://bg.verilen.com through a Cloudflare Tunnel.
