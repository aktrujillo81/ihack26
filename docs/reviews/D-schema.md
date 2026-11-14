# Schema PR #39 (migration 0003): review round

Task brief: `docs/tasks/D3-schema.md`. Built by Backend. Reviews are read-only (`gh pr diff 39`); the reviewers ran no tests.

| Agent | Verdict | Notes |
|---|---|---|
| Frontend | PASS | Screens keep deriving facts from reports (stored complaint columns default to unknown; switch only when D5 writes them, with a parity test). Stubs `needsReviewReason: null` and `candidates: []` untouched. A reopen blocked by the one-active-complaint index returns a generic `error` (rolled back, nothing written): **P1** per the humans, after the freeze. |
| Security | PASS | No caller-data columns. `report_candidates` is scoped by composite foreign keys. Migration guard (item 8) runs before any change; backfill gives every flagged report a reason. Demo seed keeps the 5434 guard. Should-fix: say in contracts and the schema comment that `provider_call_ref` is stored only as a keyed HMAC, never the raw call id (put in D3a). D4 must not treat a null `location_key` as a silent "no match, create new" (route to review). Unknown `ended_reason` values from Vapi must map to `other`, not crash (D3a). |

Humans approved the backfill rules and the NOT NULL defaults on 2026-11-14 (`docs/decisions.md`).
Unverified by anyone: the 3 Windows-only test failures on Linux/CI; the migration on already demo-seeded data; the host data (see `docs/host-migration-0003.md`).
