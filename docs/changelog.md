# Changelog

Every merged change: date, PR, task, summary, agents involved.

This file was created on 2026-11-14 during S6. Rows up to PR #32 were filled in from the GitHub merge list, so "agents involved" is given only where a review file records it. All dates are Sat 2026-11-14. Times are Mountain Time.

| Time | PR | Task | Summary | Agents involved |
|---|---|---|---|---|
| 12:19 AM | #1 | Setup | Product brief, agent definitions, lenses | not recorded |
| 12:46 AM | #2 | S1 | Task list replaces the schedule; budget, `.gitignore`, agreement gate | not recorded |
| 1:19 AM | #3 | S1 | Project folder structure | not recorded |
| 2:17 AM | #4 | S7 | UX screen notes | UX |
| 2:17 AM | #5 | W prep | Provisional domain types and mock data | not recorded |
| 2:17 AM | #6 | W prep | Typed i18n strings | not recorded |
| 2:18 AM | #7 | W prep | Thin data layer over the mock | not recorded |
| 2:18 AM | #8 | W prep | Swap plan from provisional files to contracts | not recorded |
| 2:22 AM | #9 | Setup | Self-hosted stack recorded (Next.js and Postgres on the team server) | all five (`docs/reviews/setup.md`) |
| 2:23 AM | #10 | S3 | App scaffold and health route | all five (`docs/reviews/setup.md`) |
| 2:45 AM | #15 | Setup | `npm run db:local`: Postgres without Docker | not recorded |
| 2:53 AM | #16 | S4, S5 | Vapi prompt v2 draft and the S4/S5 brief | Phone / AI Prompter |
| 2:59 AM | #17 | S5a | Brief for the temporary capture route | not recorded |
| 3:42 AM | #11 | Quality | Guards: hardcoded strings, phone and email patterns | not recorded |
| 3:43 AM | #12 | Quality | CI: lint, typecheck, tests | not recorded |
| 3:43 AM | #13 | W prep | Web app plan for W1 to W4 | not recorded |
| 3:45 AM | #14 | W4 prep | Map component behind a swappable renderer | not recorded |
| 3:47 AM | #19 | Setup | AGENTS.md stack wording matches decisions | not recorded |
| 3:47 AM | #18 | W1 prep | Permissions, guards, sign-in screen (no schema needed) | not recorded |
| 3:48 AM | #20 | W2, W3 prep | Complaint list and detail screens on mock data | not recorded |
| 3:49 AM | #21 | W1 prep | Session adapter fitted to D1's `users`; Better Auth draft | not recorded |
| 3:58 AM | #23 | S4 | Vapi v2 live: 120 s cap, 20 s silence, recording on, structured output | Phone / AI Prompter |
| 4:04 AM | #25 | S8 | Pitch outline, DevPost entry, demo script | the humans |
| 4:08 AM | #26 | S5a | Temporary `POST /api/vapi/capture` route | not recorded |
| 4:13 AM | #27 | D1 | Database schema and migrations. `reports` is PROVISIONAL until S6 | see `docs/reviews/D1.md` (no agent review recorded) |
| 4:13 AM | #22 | Extra | Public status-only map page. Needs spec approval | not recorded |
| 4:29 AM | #29 | D1 | Record that D1's Vapi-dependent tables need updating after S6 | Orchestrator |
| 4:34 AM | #30 | A1 | `drizzle.config.ts`: `.env.local` wins over `.env` | Backend |
| 5:30 AM | #31 | A1 | Better Auth sign-in on D1's `users` table | Backend, Security, Frontend, UX, Phone / AI Prompter (`docs/reviews/A1.md`) |
| 5:36 AM | #32 | S4, S5 | Cleaned sample payload from test call 3, three test calls logged, Vapi v3 and v4 recorded | Phone / AI Prompter |
| (merged after the table was last updated) | #33 | W1 | Sign-in, sign-out, proxy and page guards wired to the real session | not recorded here |
| (same) | #35 | D1, W2, W3 | Signed-in screens read real data (scoped by session) | not recorded here |
| (same) | #36 | Demo | Demo seed on the local database only (port 5434) | not recorded here |
| (same) | #37 | D6 | Complaint writes: status change, pass on, reopen, notes, version check, same-transaction history. Differs from contract 5.8/6.4/6.5: see contracts.md section 5.8 and unknown 18 | not recorded here |
| 9:04 AM | #41 | S6 | Contract corrections: contracts follow the built complaint writes; records the remaining pass-on text and reopen-check open items | not recorded here |
| 9:14 AM | #43 | W prep | Shared UI pieces: status, priority, sample-data, layout, button and control components | not recorded here |
| 9:19 AM | #45 | D3b prep | Schema-independent helpers only: provisional validated-report input type, text caps, alias map, runtime fake-report builders and 38 tests. The real save is not included and D3b remains open. | not recorded here |
| 9:27 AM | #47 | W1, W2, W3, W4 prep | Dashboard app shell, navigation, page header, sign-out wiring and related UI/test updates | not recorded here |
| (this branch) | D3a | Backend | Replaced the temporary capture endpoint with the authenticated Vapi webhook, closed normalizer hand-off, HMAC call reference, intake defaults, and failing D3b storage stub | Backend, Security, Phone / AI Prompter, UX, Frontend |
| (this branch) | P1 follow-up | Technician complaint tickets | Technicians can add a scoped field ticket from complaint detail; the ticket links to the complaint, updates the water-point pin/location, and records a history event | Backend, Frontend, Security / Data Handling, Phone / AI Prompter, UX |
| (this branch) | UI responsive pass | Responsive layouts | Made the shell, navigation, headers, complaint list/detail, technician workspace, maps, and sign-in layout adapt across phone, tablet, and desktop widths | Frontend, UX |

## S5 results (from PR #32)
- Three paid calls, $0.27 in total, balance 4.73. Calls 1 and 2 (assistant v3) arrived with no extracted data. Call 3 (v4) carried all nine fields.
- Extracted fields are at `message.artifact.structuredOutputs.<id>.result`, found by the name `water_point_report`. `message.analysis` is `{}` and `message.summary` is `""`.
- Vapi sent the Bearer credential. The capture route, which fails closed, saved all three bodies.
- Cost so far is billed by the second ($0.0988 for 93 s, $0.0801 for 75 s, about $0.09 for 78 s). This does not prove Vapi never rounds up.
- v4's End Call Phrase ended call 3 right after the closing line (`endedReason: assistant-said-end-call-phrase`).
