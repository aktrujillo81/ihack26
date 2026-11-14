# Status

Last updated: 2026-11-14 by the Orchestrator. Read at the start of every session.

## Done (merged)
- S1-S3 setup: scaffold, Drizzle, health route, local Postgres without Docker.
- S7 UX screen notes. S4/S5 briefs and Vapi prompt v2 draft (not live).

## In review
- A1 accounts data and Better Auth server: branch `feat/auth-roles` (pushed, no PR). All agents passed v2, but it conflicts with D1 on the schema. Humans decided A1 adapts to D1 (see `docs/decisions.md`). Waiting for D1 to merge, then A1 v3.

## In progress (other developers)
- D1 full schema: `feat/database-migrations` (Dillon), no PR yet. Built ahead of S6.
- PR #22 public map page (JerrZane): marked NEEDS SPEC APPROVAL. The public map is cut in spec section 4.
- S4/S5 Vapi assistant and the first paid call: Vapi owner.
- W1 prep (`feat/auth-prep`) and the map component (`feat/map-component`): frontend.

## Blocked
- S6 `docs/contracts.md` data tables: waits for the S5 payload.
- D1 (water points, reports, complaints, history, partners), then D2-D7: wait for S6.

## Needs a human
- Dillon opens the D1 PR. A1 v3 starts after it merges.
- Retention decided: expired session rows are deleted at expiry (being built in A1).
- Manual check: sign-in rate limit through the Cloudflare Tunnel.

## Rules for working on this machine (production host)
Develop in dev mode: `.env.local`, `npm run dev`, `npm run db:local` (5434). The Docker database on 5433 is production. Never migrate, seed or test against it without a human's OK.

## Next
S6 as soon as the payload lands. Then D1.
