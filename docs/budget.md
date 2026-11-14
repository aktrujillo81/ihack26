# Budget and spend log (put this file at docs/budget.md)

**Total Vapi budget:** $5.00.
**Estimated rate:** about $0.09 per minute (Vapi's estimate; confirm after the first call). That is about 55 minutes of calls in total.

## Plan
| Bucket | Amount | About |
|---|---|---|
| Development test calls | $1.80 | 20 minutes |
| Rehearsals | $0.45 | 5 minutes |
| Demo day (judges) | $1.80 | 20 minutes |
| Buffer | $0.95 | 10 minutes |
| **Total** | **$5.00** | **about 55 minutes** |

## Rules
1. Before any paid call, set the maximum call length and the silence timeout. Set on 2026-11-14: **120 seconds** and **20 seconds** (see `docs/vapi-prompt.md`). A call capped at 120 seconds costs about $0.18 at most. A call of about 90 seconds costs about $0.14.
2. Only one task places paid test calls: the Phone / AI Prompter's. Every other developer works from the saved sample payload in `docs/samples/` and never calls the number. There are five developers, so this matters.
3. A human must say OK before each paid call. The Orchestrator never approves one.
4. Capture one real payload, remove personal data, and reuse it for all endpoint and web app development.
5. Before a call, write the purpose and the expected length. After it, add a line to the spend log below.
6. Never let the balance fall below $2.25 (demo day plus rehearsals) until rehearsals begin. Development calls beyond the $1.80 bucket come from the buffer, and only with a human's OK.
7. Check the balance in the Vapi dashboard after the first call, after every five calls, before rehearsals, and before judging.
8. No automated, looped, or scripted calls.
9. If the real cost per call is higher than estimated, or Vapi rounds each call up to a full minute, recompute this plan and tell the humans right away. Both are **unknown** until the first call.
10. On demo day, keep live judge calls short and limited. Use the backup video for repeat viewings.
11. Never commit raw call payloads. They can contain caller phone numbers. Raw files live in `docs/samples/raw/`, which is gitignored. Only cleaned samples go in `docs/samples/`.

## Spend log
| # | Date and time | Who | Purpose | Length | Cost | Balance after |
|---|---|---|---|---|---|---|
| 1 | 2026-11-14 04:36 (Mountain Time) | Andrew | First real test call (S5), via local tunnel capture | 1 m 33 s | $0.10 ($0.0988) | 4.90 |
| 2 | 2026-11-14 05:03 (Mountain Time) | Andrew | Second test call (S5): checking structured extraction; none ran | 1 m 15 s | $0.08 ($0.0801) | 4.82 |
| 3 | 2026-11-14 05:23 (Mountain Time) | Andrew | Third test call (S5), assistant v4: structured output ran, call ended itself | 1 m 17 s | $0.09 | 4.73 |
| 4 | 2026-11-14 (late morning, Mountain Time) | Andrew | Fourth test call (S5), first call on the new webhook setup; the call picked up other voices and was confused | 1 m 22 s | $0.10 | unknown |
| 5 | 2026-11-14 (late morning, Mountain Time) | Andrew | Fifth test call (S5), via /api/vapi/webhook: succeeded | 1 m 16 s | $0.09 | 4.45 (dashboard) |

Note: after call 3 the balance was 4.73. Calls 4 and 5 add up to $0.19, but the dashboard showed 4.45 afterwards, a drop of $0.28. About $0.09 is unaccounted for and is probably one more call. Unknown until checked in the Vapi dashboard call log.
