TASK: D3-schema one schema PR for D3, D4, D5
PRIORITY: P0 (first task; blocks D3a's use of the new columns and D3b)
SPEC REFERENCE: PR-*, WP-*; `docs/contracts.md` section 4.1 (the S6 version in PR #34)
GOAL: One migration (and the matching `lib/db/schema.ts` edit) that adds contracts 4.1 items 1, 2, 3, 5, 6, 7, 8 and 11, plus the seed rows of item 4 if Backend says they belong here. Merged before D3b starts. Approved by the humans (2026-11-14).
AGENTS: Backend (lead, writes it), Security (review), Frontend (checks the reads still work), Phone / AI Prompter and UX (read only)
DEPENDS ON: S6 contracts (PR #34, not merged yet: read `docs/contracts.md` from `origin/docs/s6-contracts`); no other schema task running (shared file).

CHANGES (names from contracts 4.1; anything not named there is unknown, ask)
1. `reports.provider_call_ref` text, null; partial unique index on (`organization_id`, `provider_call_ref`) where not null.
2. `reports.needs_review_reason` enum (the seven codes in 5.2), null; check: not null whenever `needs_review` is true. Existing rows (seed, D6 writes, demo seed) with `needs_review` true and no reason must be fixed in the same migration or the seed, never left to fail.
3. `reports.ended_reason` text, null; check: `customer-ended-call`, `assistant-said-end-call-phrase`, `other`.
5. `water_points.location_key` text, null, index on (`organization_id`, `region_id`, `location_key`). Backfill for existing points: unknown (Backend decides and states it in the PR).
6. `report_candidates` (`report_id`, `water_point_id`, `organization_id`, `region_id`, composite scoped foreign keys, unique pair).
7. `complaints.problem`, `people_affected`, `serves_school_or_clinic`, `duration`: most severe values over its reports (same rules as `lib/data/derive.ts`). Existing complaints: backfill rule is unknown (Backend states it).
8. Partial unique index: at most one complaint per `water_point_id` with `status` in (`open`, `passed_on`). Existing data that breaks it must be found first.
11. A `report_candidates` row is removed only when its report is attached; a merge repoints candidates (behaviour for D4; the table only needs to allow it).
Not in this PR: item 9 (no column), item 10 (D6), the HMAC key name (D3a).

RULES
- Local database only (`npm run db:local`, port 5434). Never `db:migrate` against, or write to, production (5433). Generating the migration needs no database. A human runs the migration on the host.
- Every new table and column carries organization and region where it is scoped. Nothing stores caller data. History stays append-only.
- Update `docs/contracts.md` section 4 and mark 4.1 items Built, in this PR only (shared file; after PR #34 merges, rebase onto it).
- Do not touch screens. Existing reads (`lib/data/complaints.ts`, `derive.ts`) must keep working: run `npm test`, `npm run typecheck`, `npm run lint`.

ACCEPTANCE CRITERIA
- Migration applies on a fresh local 5434 database and on the demo-seeded one; the demo seed and A1 seed still run.
- Tests: partial unique indexes refuse duplicates (same ref in one organization; two active complaints on one water point) and allow the same ref in two organizations; `needs_review` with no reason is refused; bad `ended_reason` refused; `report_candidates` cross-scope pair refused.
- All existing tests pass.
- Contracts updated; Security and Frontend sign-off PASS; a human merges.

OPEN QUESTIONS: backfill rules (items 5 and 7), seed rows of item 4 (`intake.phone`, default config keys): in this PR or D3a?
