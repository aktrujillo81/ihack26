# Swap plan: provisional UI files to `docs/contracts.md`

For whoever owns `docs/contracts.md` (S6). Nothing here is a contract. It lists what the web app guessed from `docs/spec.md`, so each guess can be checked and replaced.

| Group | File | `contracts.md` must match | Swap steps |
|---|---|---|---|
| Types, enums | `lib/domain/types.ts` | Field names and values for water point, report, complaint, history event, note, partner; all enums; `"unknown"` vs null; date format | Compare, rename or replace with the contract types, run typecheck (every mismatch fails) |
| Mock data | `lib/domain/mock.ts` | Same shapes | Delete once the data layer calls the API |
| Data layer | `lib/data/complaints.ts` | D6 routes and response shapes; error responses | Replace function bodies with API calls, keep signatures and `DataResult`; remove mock import and `MOCK_CONTEXT` |
| Data layer tests | `tests/unit/data-layer.test.ts` | Same | Point at the API with fixtures; keep the scope, identical-error, no-transcript-in-lists and no-caller-details checks |
| Strings | `lib/i18n/strings.ts` | Only enum renames (`status.*`, `problem.*`, `type.*`, `duration.*`, `schoolClinic.*` mirror enum values) | Rename keys, fix typecheck |
| Config | `lib/config/ui.ts` | Where settings live. Stale threshold is PROPOSED (15 min), not approved | Move to the real config source |
| UX notes | `docs/ux-screen-notes.md` | Review-reason values, score-reason format, list columns (DB-1) | Update wording and keys |

## Guesses (all unknown in the spec)
1. Needs-review reasons: `ambiguous_match`, `unusable_location`, `incomplete_report`, `off_topic`, `unknown`.
2. History event types: `created`, `report_added`, `status_changed`, `passed_on`, `reopened`, `note_added`, `edited`, `pin_moved`, `verified`, `merged`.
3. Partner type is free text. The data layer drops partner `contact`.
4. Timestamps are ISO strings in UTC ("Z"); sorting relies on it. The API must guarantee it.
5. An unmatched report has null water point and complaint. Several possible matches are `candidateWaterPointIds`.
6. Every record carries `organizationId` and `regionId` (spec section 5, rule 1; `AGENTS.md` red line 10).
7. Score reason is one string. Parts are not supported yet.

## What the server must guarantee (the mock only imitates it)
- Scope every read by organization and region, including related records (water point, reports, notes, history, partner).
- Missing and other-organization records return the same response.
- List endpoints omit `transcript`. Only complaint detail returns it.
- Spoken location text is free text and may hold a name. Whether it is scrubbed is unknown (PR-3).
- Out-of-scope candidate water points are dropped silently from needs-review. The UI could show "Several water points could match" with no candidates. The contract should say what is returned.

## Order
1. S6 lands `docs/contracts.md`.
2. Update `types.ts`, fix typecheck.
3. Update `complaints.ts` to call D6, run the data layer tests against it.
4. Update strings and the UX notes for any renamed value.
5. Delete the mock file and every PROVISIONAL header.
