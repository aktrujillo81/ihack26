# Status

Read this first in every session. The Orchestrator keeps it current.

**Last updated:** Sat 2026-11-14, about 11:50 AM Mountain Time (webhook live check on the host).
**Deadline:** 4:00 PM Saturday. Feature freeze time: **unknown** (proposed: 1:30 PM Mountain; the humans set it).
**Vapi balance:** 4.73 credits of 5.00 (3 paid calls, $0.27). Floor until rehearsals: 2.25. Only Andrew places paid calls, each with a human's OK.

## Report
```
DONE: S1, S3, S4, S5 (with S5a), S6 (#34), S7, D1 (merged as PROVISIONAL), A1, contract-follow-code documentation (#41), shared UI pieces (#43), and app shell (#47). D3a webhook (#50) and D3b save (#53). Evidence: merged PRs in docs/changelog.md.
IN PROGRESS: PR #44 (open). D3a (#50) and D3b save (#53) are merged and deployed.
BLOCKED: real phone data until a human switches the Vapi server URL.
NEEDS A HUMAN: see "Needs a human" below.
NEXT: a human switches the Vapi server URL to `https://bg.verilen.com/api/vapi/webhook` (see "Needs a human" 1), then one paid test call with a human's OK.
WEBHOOK UPDATE (11:47 AM): D3a (#50) and D3b save (#53) are merged and deployed on the host. The authenticated check stored a row (details under "Release and demo readiness").
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
| D3a webhook | Done, deployed | PR #50 (was #42). Running on the host since 11:47 AM |
| D3b helpers | Merged, **not the save** | PR #45: input caps, alias map, provisional input type, fake-report builders, and 38 tests |
| D3b save | Done, deployed | PR #53. Authenticated sample POST stored a report, water point, complaint and 2 history events; a repeat was answered 200 and not stored |
| D4, D5, W5, D7 | Not started | The data path (D3a, D3b) is now live |

## Open PRs (limit: five)
| PR | Branch | Owner | Note |
|---|---|---|---|
| #44 | `fix/history-codes-only` | aktrujillo81 | unknown |

## Needs a human
1. **Vapi server URL.** Ready to switch: D3b is deployed and the authenticated check returned 200 with a stored row. In the Vapi dashboard, set the assistant's server URL to `https://bg.verilen.com/api/vapi/webhook`, attach the custom Bearer credential whose token equals `VAPI_WEBHOOK_SECRET` (in the dashboard, not through the API), and keep server messages to `end-of-call-report` only. Then one paid test call with a human's OK.
2. **Feature freeze time.** Not set.
3. **Public map (PR #22).** Merged, but the spec lists it as cut. Approve the spec change or turn the page off.
4. **Retention.** How long transcripts are kept (spec unknown 10), and whether Vapi's audio recording stays on (Vapi's own retention is unknown).
5. **Edge-case test calls.** Hang-up halfway, silence, and "I don't know the village" are untested. Each costs about $0.09 and needs a human's OK.
6. **End-call phrase.** Someone must listen to a call to check that v4 does not cut off the last words.

## Release and demo readiness (Orchestrator owns)
| Check | State |
|---|---|
| Public URL works from outside the venue network | unknown (not checked today) |
| Host has pulled `main`; app restarts after a reboot | Pulled and rebuilt at `f254216` (11:47 AM). `npm run start` runs detached (`setsid nohup`, log in `~/.cache/wellwatch-next.log`), **not** as a service: it does not come back after a reboot |
| Database the public site uses | **Development, 127.0.0.1:5434** (`.env.local` wins over `.env`), with the invented demo data. Decided by the humans for the demo (`docs/decisions.md`). Real call reports land next to demo rows |
| `intake.phone` row on the database the site uses | Yes, `npm run db:seed` on 5434 at 11:45 AM. It was missing before, so every report got 503 `no_scope` |
| Webhook check on the public URL | No secret: 401. Ignored type: 200. Sample payload: 200 and stored (one sample complaint now exists on 5434). Repeat: 200, not stored |
| `VAPI_WEBHOOK_SECRET`, `VAPI_CALL_REF_KEY`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, seed passwords set on the host | Yes in the host's `.env.local` (names checked, not values). The host's `.env` (production) has no `VAPI_CALL_REF_KEY` |
| **Vapi server URL points at the current public URL** | **No.** It points at a closed tunnel. The server side is ready. See "Needs a human" 1 |
| Capture route removed | Yes, deployed |
| Vapi call limits set (120 s, 20 s silence) | Yes (`docs/vapi-prompt.md`) |
| Vapi balance checked before rehearsals and before judging | 4.73 after call 3 |
| Demo accounts and starter data on the host | Yes, on 5434 (`db:seed` and `db:seed:demo`) |
| Database backup before the demo | Not yet |
| Backup video on two devices | Not yet (Q7) |
| Space cleaned before 5 PM Saturday | Not yet |
