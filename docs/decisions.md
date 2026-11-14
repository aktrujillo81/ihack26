# Decisions

One line per real team decision: date, decision, and why.

- 2026-11-14: Self-host the stack. A Next.js app and a PostgreSQL database run on one team server instead of Vercel and Supabase. Only the Next.js server is public, on one port, through a Cloudflare Tunnel. Postgres is never exposed. Sign-in moves from Supabase Auth to an auth library that stores data in our Postgres (default: Better Auth). Live updates move from Supabase Realtime to our own API (default: polling). Why: full control over hosting and data, one public port, and no third-party data provider. Trade-offs: the team owns uptime, backups, and server-side permission checks.
