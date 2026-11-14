# Setup review: Plan round (2026-11-14)

Orchestrator ran the agreement gate and the start-of-project lens review on
branches `docs/self-host-stack` and `feat/app-scaffold` (S1-S3).

## Agreement gate
PROPOSED STEP: Treat S1-S3 as done once the branches merge; finish setup that
needs no paid call or unknown data; list blocking human decisions.

| Agent | Vote |
|---|---|
| Backend | AGREE WITH NOTE: reconcile open remote branches (`feat/domain-types`, `feat/data-layer`, `feat/i18n-strings`, `docs/ux-screen-notes`, `docs/contracts-swap-plan`) before writing briefs |
| Security | AGREE WITH NOTE: S3 done only after the bind and headers are fixed; no input or data route goes live before auth |
| Frontend | AGREE WITH NOTE: dashboard routes deny by default until W1; mock fixtures labeled provisional, spec values only |
| Phone / AI Prompter | AGREE WITH NOTE: `docs/vapi-prompt.md` v1 is the live prompt copied by a human; the section 8 rewrite is v2 |
| UX | AGREE WITH NOTE: S3 done after its PR merges with run evidence; S7 names no fields beyond spec sections 7 and 8 |

Result: passed (5 of 5 agree with notes).

## S3 scaffold findings and fixes (commit `dcdc397`)
1. App listened on all interfaces, reachable from the LAN around the tunnel (Backend, Security). Fixed: `-H 127.0.0.1`. Verified with `ss` and a LAN request that is now refused.
2. No security headers (Security). Fixed: baseline headers in `next.config.ts`. Verified live with `curl -sI`.
3. `drizzle.config.ts` ignored `.env.local` (Backend). Fixed.
4. Health check had no DB timeout and no log (Backend, Security). Fixed: 5s connect timeout and a fixed log code.
5. Backup command hard-coded the user and had loose permissions (Backend, Security). Fixed in `db/README.md`.

Open from UX (wait for S7 to be merged): body text uses muted gray, no focus style, no status tokens, dark mode follows the OS.
Open from Frontend: component tests need jsdom and Testing Library.

## Lens review highlights
- Builder: nothing supervises the app process or restarts it after a reboot; no migration, seed, or permission conventions yet; deny-by-default tests should start with D1.
- Adopter: callers never hear that a water point was fixed (known gap, out of scope); the live Vapi closing line may not meet PI-3 and PI-7 until S4.
- Responder: priority and reason on the list row; "Unknown" in neutral style; the copyable summary excludes caller identity and transcripts and makes no promises.

## Proposed setup items (not built yet)
- Backend: DB conventions (uuid ids, timestamps, `archived_at`, org and region NOT NULL, append-only history); migration workflow; separate dev and demo databases; reset script with a name allowlist.
- Security: `docs/security.md` (data inventory, retention, log rules); one `requireSession` guard; deny-by-default test skeleton; backup procedure.
- Frontend: dashboard shell that denies all until W1; state components (Loading, Empty, Error, Denied, UnknownValue, StatusBadge); component testing; Leaflet map shell; polling hook.
- Phone / AI Prompter: prompt v2 draft, S5 test-call script, budget log entry template, proposed webhook `POST /api/vapi/webhook`.
- UX: S7 screen notes and wording (already in progress on `docs/ux-screen-notes`).

## Waiting on humans
See the decision list reported to the humans in this session; it will be copied into `docs/decisions.md` as answers come in.
