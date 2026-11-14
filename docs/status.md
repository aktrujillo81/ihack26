# Status

Read this first in every session. The Orchestrator keeps it current.

**Last updated:** Sat 2026-11-14, after D3a review, by the Backend agent.
**Deadline:** 4:00 PM Saturday. Feature freeze time: **unknown** (proposed: 1:30 PM Mountain; the humans set it).
**Vapi balance:** 4.73 credits of 5.00 (3 paid calls, $0.27). Floor until rehearsals: 2.25. Only Andrew places paid calls, each with a human's OK.

## Report
```
DONE: S1, S3, S4, S5 (with S5a), S7, D1 (merged as PROVISIONAL), A1. Evidence: merged PRs in docs/changelog.md.
IN PROGRESS: D3a webhook branch is ready for human review; D3b must replace the failing storage stub before Vapi is switched.
BLOCKED: D3, D4, D5, D6, D7, W2 to W5 real data, Q1 to Q8: all wait for S6.
NEEDS A HUMAN: see "Needs a human" below.
NEXT: D3b replaces `saveReport` and then the human deploys and switches Vapi to `/api/vapi/webhook`. D4/D5 and W5/D7 follow their gates.
```

## Tasks
| Task | State | Evidence or note |
|---|---|---|
| S1 gitignore, `.env.example` | Done | PR #2, #3 |
| S2 host, database, Vapi key | Done by the humans | Health route and the former capture route answered on the host. Not re-checked today by the Orchestrator |
| S3 app scaffold | Done | PR #10, `docs/reviews/setup.md` |
| S4 Vapi assistant | Done | PR #16, #23, #32. Assistant v4 is live. `docs/vapi-prompt.md` |
| S5a capture route (temporary) | Removed | Replaced by D3a `POST /api/vapi/webhook` |
| S5 paid test call and sample | Done | PR #32. `docs/samples/`, spend log in `docs/budget.md` |
| S6 contracts | **PR open, waiting for a human merge** | `docs/tasks/S6-contracts.md`, `docs/reviews/S6.md` |
| S7 UX screen notes | Done | PR #4 |
| S8 pitch, DevPost, demo script | Drafts merged (the humans own it) | PR #25 |
| D1 schema | Merged, **PROVISIONAL** | PR #27. `reports` and the complaint link must be updated after S6: `docs/reviews/D1.md` |
| A1 sign-in and roles | Done | PR #31, `docs/reviews/A1.md` |
| W1 prep, W2/W3 screens on mock data, W4 map component | Merged as prep | PR #14, #18, #20, #21. PR #28 open |
| Public map page | Merged, **needs spec approval** | PR #22. The public map is cut from the spec (section 4) |
| W1 wiring, real reads, demo seed, D6 complaint writes | Merged | PR #33, #35, #36, #37. D6 differs from the contract: `docs/contracts.md` 5.8 and unknown 18 |
| D3a | Built on this branch | Authenticated, bounded, normalized webhook; `saveReport` is intentionally a failing D3b stub |
| D3b, D4, D5, W5, D7 | Not started | D3b must land before any Vapi URL switch |

## Open PRs (limit: five)
| PR | Branch | Owner | Note |
|---|---|---|---|
| #28 | `chore/w1-prep` | JerrZane | 12-hour session cap, public `/map` vs `/dashboard/map` |

## Needs a human
1. **Vapi server URL.** Do not switch it until D3b is deployed and the authenticated webhook check returns 200 with a stored row. The target is `https://bg.verilen.com/api/vapi/webhook`.
2. **Feature freeze time.** Not set.
3. **Public map (PR #22).** Merged, but the spec lists it as cut. Approve the spec change or turn the page off.
4. **Retention.** How long transcripts are kept (spec unknown 10), and whether Vapi's audio recording stays on (Vapi's own retention is unknown).
5. **Edge-case test calls.** Hang-up halfway, silence, and "I don't know the village" are untested. Each costs about $0.09 and needs a human's OK.
6. **End-call phrase.** Someone must listen to a call to check that v4 does not cut off the last words.

## Release and demo readiness (Orchestrator owns)
| Check | State |
|---|---|
| Public URL works from outside the venue network | unknown (not checked today) |
| Host has pulled `main`; app restarts after a reboot | unknown |
| `VAPI_WEBHOOK_SECRET`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, seed passwords set on the host | unknown |
| **Vapi server URL points at the current public URL** | **No.** It points at a closed tunnel. See "Needs a human" 1 |
| Capture route removed | Yes in D3a branch; human deploy still required |
| Vapi call limits set (120 s, 20 s silence) | Yes (`docs/vapi-prompt.md`) |
| Vapi balance checked before rehearsals and before judging | 4.73 after call 3 |
| Demo accounts and starter data on the host | unknown (seed exists: `npm run db:seed`) |
| Database backup before the demo | Not yet |
| Backup video on two devices | Not yet (Q7) |
| Space cleaned before 5 PM Saturday | Not yet |
