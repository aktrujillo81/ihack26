# ihack26

Well Watch: a phone-in water point reporting system with a web app for NGO coordinators. Built for iHack 2026 (International category).

Start with `AGENTS.md` and `docs/spec.md`.

## Running locally

Requires Node 20.9+ and Docker.

```sh
cp .env.example .env      # fill in values; never commit .env
npm install
npm run db:up             # Postgres on 127.0.0.1:5433
npm run dev               # http://localhost:6543
```

Check it: `curl localhost:6543/api/health` should return `{"status":"ok","db":"ok"}`.

| Command | What it does |
|---|---|
| `npm run build` / `npm start` | Production build and server on port 6543 |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript checks |
| `npm run db:generate` / `npm run db:migrate` | Create and apply Drizzle migrations in `db/migrations/` |

On the host server, port 6543 is published at https://bg.verilen.com through a Cloudflare Tunnel.
