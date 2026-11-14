# Status

Read this first in every session. The Orchestrator keeps it current.

**Last updated:** Sat 2026-11-14, about 9:30 AM Mountain Time, by the Orchestrator.
**Deadline:** 4:00 PM Saturday. Feature freeze time: **unknown** (proposed: 1:30 PM Mountain; the humans set it).
**Vapi balance:** 4.73 credits of 5.00 (3 paid calls, $0.27). Floor until rehearsals: 2.25. Only Andrew places paid calls, each with a human's OK.

## Report
```
DONE: S1, S3, S4, S5 (with S5a), S6 (#34), S7, D1 (merged as PROVISIONAL), A1, contract-follow-code documentation (#41), shared UI pieces (#43), and app shell (#47). PR #45 merged D3b's schema-independent helpers only; D3b save is not done. Evidence: merged PRs in docs/changelog.md.
IN PROGRESS: D3a (PR #42), W1 prep (PR #28, open), and the D3/D4/D5 schema work (PR #39, open).
BLOCKED: D3b save implementation until #39 and #42 are merged. D4, D5, D6, D7, W2 to W5 real data, and Q1 to Q8 remain downstream of the data path.
NEEDS A HUMAN: see "Needs a human" below.
NEXT: merge #39 and #42, then Andrew builds the real D3b save on `feat/d3b-save-impl` from `C:\Users\aktru\projects\hackathon-d3b`. That save must use D3a's frozen type, not the provisional helper type from #45.
D3a UPDATE (this branch): webhook built and reviewed; `saveReport` is intentionally a failing D3b stub until D3b replaces it.
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
| S6 contracts | Done | PR #34; `docs/tasks/S6-contracts.md`, `docs/reviews/S6.md` |
| S7 UX screen notes | Done | PR #4 |
| S8 pitch, DevPost, demo script | Drafts merged (the humans own it) | PR #25 |
| D1 schema | Merged, **PROVISIONAL** | PR #27. `reports` and the complaint link must be updated after S6: `docs/reviews/D1.md` |
| A1 sign-in and roles | Done | PR #31, `docs/reviews/A1.md` |
| W1 prep, W2/W3 screens on mock data, W4 map component | Merged as prep | PR #14, #18, #20, #21. PR #28 open |
| Public map page | Merged, **needs spec approval** | PR #22. The public map is cut from the spec (section 4) |
| W1 wiring, real reads, demo seed, D6 complaint writes | Merged | PR #33, #35, #36, #37. D6 differs from the contract: `docs/contracts.md` 5.8 and unknown 18 |
| Shared UI pieces | Done | PR #43 |
| App shell | Done | PR #47 |
| D3a webhook | In progress | PR #42; freezes the final `ValidatedReport` in `lib/ingest/types.ts` |
| D3b helpers | Merged, **not the save** | PR #45: input caps, alias map, provisional input type, fake-report builders, and 38 tests |
| D3b save | **Blocked, not started** | Future branch `feat/d3b-save-impl`, Andrew's folder `C:\Users\aktru\projects\hackathon-d3b`; waits for #39 and #42. Delete the provisional `lib/ingest/report-input.ts` type when #42 lands and use D3a's type. |
| D4, D5, W5, D7 | Not started | Still downstream of the D3a/D3b data path |
| D3a | Built on this branch | Authenticated, bounded, normalized webhook; `saveReport` is intentionally a failing D3b stub |
| D3b, D4, D5, W5, D7 | Not started | D3b must land before any Vapi URL switch |

## Open PRs (limit: five)
| PR | Branch | Owner | Note |
|---|---|---|---|
| #28 | `chore/w1-prep` | JerrZane | 12-hour session cap, public `/map` vs `/dashboard/map` |
| #39 | `feat/schema-d3-d4-d5` | unknown | Schema prerequisite for D3b save; not merged |
| #42 | `feat/d3a-vapi-webhook-impl` | unknown | D3a prerequisite; not merged |

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
