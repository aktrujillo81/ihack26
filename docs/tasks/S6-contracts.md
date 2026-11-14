# Task S6: Write `docs/contracts.md` from the real payload

```
TASK: S6 Write docs/contracts.md from the real payload
PRIORITY: P0
SPEC REFERENCE: section 4 (S6); PR-1 to PR-9; WP-1 to WP-3, WP-6; AC-2, AC-3; MP-1 to MP-6; DB-1 to DB-7; sections 5, 7, 8, 10; unknowns 1 to 4, 10, 13
GOAL: Replace the provisional parts of docs/contracts.md with a full contract written from the real sample, so D3 to D7 and W2 to W5 can build in parallel without guessing.
WHAT COULD BREAK: a guessed field or path (red line 1); caller data stored through a field nobody listed (red lines 3, 16); a rule that drops a report or picks a water point (red lines 6, 7); a contract that does not match lib/db/schema.ts with no list of the changes needed; UI types and the contract drifting apart.
HOW WE WILL TEST IT: every payload path in the contract exists in the sample; npm test (pattern guard) passes; each agent checks its area in the Review round; the D1 checklist in docs/reviews/D1.md is ticked or carried forward.
AGENTS: Backend (lead author), Security, Phone / AI Prompter, Frontend, UX
DEPENDS ON: S5 (done)
FILES LIKELY TOUCHED: docs/contracts.md (SHARED), docs/tasks/S6-contracts.md, docs/reviews/S6.md, docs/reviews/D1.md, docs/status.md, docs/changelog.md, docs/decisions.md, docs/spec.md section 12 (unknowns only, asked for by a human)
ACCEPTANCE CRITERIA:
- Positions P1 to P13 in docs/reviews/S6.md, as amended by the gate notes there, are in the contract.
- Existing sections that are already true (health, auth, A1 tables, permission rules, seed, environment names) are kept.
- Every payload path named exists in docs/samples/vapi-end-of-call-report.sample.json, or is marked as seen only in the raw capture.
- The schema changes still needed are listed with the task that makes each one. No code, schema or migration change in this PR.
- An unknowns table with an owner and how to answer each one.
- No phone-shaped text and no real IDs.
OPEN QUESTIONS: transcript storage (red line 3 versus spec section 10); passed_on back to open; whether clearing needs-review is P0. All three go to the humans.
```
