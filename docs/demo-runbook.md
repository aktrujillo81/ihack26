# Demo runbook

How to start Well Watch on a laptop, what to click, and what is real. **State as of
main at `e7e5f37` (2026-11-14).** Update this file when D3, D4 or W5 land: it will
be wrong the day they do.

> Safety: everything here uses the **development** database on **port 5434**
> (`npm run db:local`). Port **5433 is production**: never run `db:migrate`,
> `db:seed`, `db:seed:demo` or tests against it. The demo seed refuses it.
> No credentials are written in this file; they live in `.env.local` (gitignored).

## 1. Real, seeded, or simulated

Say this out loud if asked. Do not let the demo imply more than it does.

| Part | Status | Notes |
|---|---|---|
| Sign-in, 12-hour sessions, sign-out, roles (Org Admin, Responder, Viewer) | **Real** | Better Auth, users and sessions in our Postgres. |
| Complaint list and detail screens | **Real reads** | From the database, scoped by the signed-in user's organization and region. |
| Status change, pass on, reopen, notes | **Real writes** | Server-checked, a Viewer is refused, history event written in the same transaction, version check on edits. |
| History timeline | **Real** | Append-only. |
| Signed-in map (`/dashboard/map`) | **Real** | Pins from stored water points with coordinates. Tiles need internet (or set `NEXT_PUBLIC_MAP_TILES=none` for a plain background). |
| The complaints, water points, reports, notes, partners you see | **Seeded** | Invented by `npm run db:seed:demo`. No real caller, no caller details. They are not marked as demo in the screens. |
| Staff accounts | **Seeded** | By `npm run db:seed`. |
| "Pass on" to a partner | **A recorded step only** | Nothing is sent to anyone. The partner is typed as text; there is no partner picker yet. |
| Vapi phone line and assistant | **Real, but not connected to the dashboard** | The temporary capture route saves raw call bodies to a gitignored folder on the host. |
| A phone call creating a complaint on the dashboard | **Not built** | Needs D3 (Vapi endpoint) and D4 (water point matching). Seeded complaints stand in. |
| Needs review and Needs location lists, last-report indicator | **Not built** | W5, blocked on D3 and D4. The seeded data for them exists; there is no screen yet. |
| Placing a pin on an unverified point, verify, merge | **Not built** | P1-1, blocked on D4 and W4. |
| Scoring from a call | **Not built** | D5. The seeded complaints carry a score and reason that were written by hand. |
| Public status map (`/map`) | **Off** | Proposed, not approved (spec lists it as cut). Shows nothing unless two env variables are set. |

**The 90-second script in `docs/S8-demo-script.txt` assumes D3, D4, W5 and P1-1.**
Until those merge, the "judge calls, the complaint appears, Needs location, place the
pin" part of that script can not be shown live. Use section 4 instead, or tell the
humans who own the script.

## 2. Start it locally (first time)

Needs Node 20.12 or newer and `npm install` done.

1. Copy `.env.example` to `.env.local` and fill in the names. In particular:
   - `POSTGRES_PORT=5434` and a `DATABASE_URL` that points at `127.0.0.1:5434`.
     Check the port in the URL before every database command. `db:local` falls
     back to 5433 if `POSTGRES_PORT` is unset: set it.
   - `BETTER_AUTH_URL=http://127.0.0.1:6543`, and a `BETTER_AUTH_SECRET` of 32 or
     more random characters.
   - `SEED_ADMIN_PASSWORD`, `SEED_RESPONDER_PASSWORD`, `SEED_VIEWER_PASSWORD`,
     each 12 to 128 characters. Choose them yourself; they are only ever in this
     file on your machine.
2. Terminal 1, leave running: `npm run db:local` (first run creates `.pgdata/`).
3. Terminal 2, once, after confirming the port is 5434:
   ```
   npm run db:migrate
   npm run db:seed
   npm run db:seed:demo
   ```
   `db:seed:demo` is safe to run twice (a marker stops the second run). To start
   over, stop `db:local` and delete `.pgdata/`. History is never deleted by the seed.
4. Terminal 2: `npm run dev`, then open `http://127.0.0.1:6543`.

Every later start is just steps 2 and 4.

## 3. Log in as each role (no credentials in this file)

The sign-in page is `/sign-in`. The seeded accounts are staff only:

| Role | Email | Password |
|---|---|---|
| Org Admin | `admin@example.org` | the value of `SEED_ADMIN_PASSWORD` in your `.env.local` |
| Responder | `responder@example.org` | the value of `SEED_RESPONDER_PASSWORD` |
| Viewer | `viewer@example.org` | the value of `SEED_VIEWER_PASSWORD` |

- Sign in as the Responder on the main window; open the Viewer in a **private
  window** (separate session).
- Sessions last 12 hours. An expired one sends you to `/sign-in`.
- There is no sign-up. A wrong password shows one message and no hint about which
  part was wrong. Repeated failures are rate limited, so do not hammer it.

## 4. The click-path that works today (about 3 minutes)

As **Responder**:
1. `/complaints`: the list. Point out priority order, the score reason in words,
   status as text (not only color), and that no caller name or number appears
   anywhere.
2. Open the Riverside complaint (open, no water, school, many people). Show the
   three reports behind it and the transcript on the detail page only.
3. **Add a note.** It appears at once with the signed-in user as author, and a
   "note added" line appears in the history.
4. **Pass on:** choose "Pass on", type a partner name (for example the seeded
   "Demo Pump Repair Co-op"), confirm. Say: *"This records the hand-off. It does
   not contact anyone."* The status and history update.
5. **Mark fixed**, confirm. Then **Reopen** to show nothing is lost: the history
   keeps every step.
6. `/dashboard/map`: pins with a label and shape for status, not only color.

As **Viewer** (private window): the same list and detail, **no buttons or note
form**. Say: *"The server refuses a Viewer's change even if someone tries to send
it by hand."*

Optional, two windows as Responder: open the same complaint twice, change status in
one, then try in the other. The second shows "This complaint was changed by someone else. Reload the page and try again."
message and overwrites nothing. This is the version check.

## 5. If something breaks

Say what is true. Do not claim a feature that is not there.

| What you see | Do / say |
|---|---|
| Sign-in fails | Check `db:local` is running (terminal 1) and `DATABASE_URL` is port 5434. Re-run `npm run db:seed` (idempotent). Do not retry more than a few times (rate limit). |
| Lists are empty | The demo seed was not run: `npm run db:seed:demo`. Signed in as the wrong account is not the cause: all three roles share one region. |
| An error message instead of data | The database is down or unreachable. The screen shows an error, not fake data. Restart `db:local`, reload. |
| Map is grey with no tiles | No internet. Say: *"tiles come from OpenStreetMap; the pins are ours."* Or restart with `NEXT_PUBLIC_MAP_TILES=none`. |
| A save says it was changed by someone else | Working as designed (two edits can not silently overwrite). Reload the page and repeat. |
| Someone asks "does the phone call create this?" | *"The phone line and assistant are live and the call data is captured. The step that turns a call into a complaint (matching the water point, scoring) is the next piece and is not connected yet. The complaints you see are invented demo data."* |
| Someone asks about water safety or repair dates | The product gives none, on purpose (red line 4). |
| Page is stuck after a long idle | Session ended: sign in again. |

## 6. Pre-demo checklist

Day before:
- [ ] `git checkout main` and pull; `npm install`; `npm run lint`, `npm run typecheck`, `npm test` pass (on Windows, three known failures are listed in the pull request notes; they are test-environment problems, not the app).
- [ ] `.env.local` has all names filled; **`DATABASE_URL` port is 5434**.
- [ ] Demo data seeded on the demo database; sign in as all three roles once.
- [ ] Decide how the demo is shown: on the laptop (this runbook), or on the host server. **The demo seed refuses the host's port 5433 and there is no override**, so showing seeded data on the host needs a human decision first. Unknown until decided.
- [ ] Phone number and Vapi assistant working (only with a human's OK to place a paid call; budget in `docs/budget.md`).

Right before:
- [ ] `npm run db:local` running; `npm run dev` running; page loads at `http://127.0.0.1:6543`.
- [ ] Responder signed in on the projector window; Viewer signed in in a private window.
- [ ] Riverside complaint is still **open** (reopen it if a rehearsal fixed it).
- [ ] Browser zoom, notifications off, internet checked (map tiles).
- [ ] Know the "if something breaks" lines above, especially the phone-call one.

After a rehearsal, the data is changed (history is never deleted). To reset:
stop `db:local`, delete `.pgdata/`, and repeat section 2 step 3.
