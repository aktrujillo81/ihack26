# Decisions

One line per real team decision: date, decision, and why.

- 2026-11-14: Self-host the stack. A Next.js app and a PostgreSQL database run on one team server instead of Vercel and Supabase. Only the Next.js server is public, on one port, through a Cloudflare Tunnel. Postgres is never exposed. Sign-in moves from Supabase Auth to an auth library that stores data in our Postgres (default: Better Auth). Live updates move from Supabase Realtime to our own API (default: polling). Why: full control over hosting and data, one public port, and no third-party data provider. Trade-offs: the team owns uptime, backups, and server-side permission checks.
- 2026-11-14: On the host server, the Next.js app listens on port 6543 (localhost). The existing Cloudflare Tunnel maps the public hostname bg.verilen.com to it, so no extra tunnel setup is needed. Postgres stays on 127.0.0.1:5433. Why: reuse an existing tunnel route and avoid ports already in use on the host.
