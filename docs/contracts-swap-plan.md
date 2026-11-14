# Swap plan: provisional UI files to `docs/contracts.md`

Written by Person 3 (web app) for Person 2, who owns `docs/contracts.md` (S6). Nothing here is a contract. It lists what the web app guessed from `docs/spec.md`, so each guess can be checked and replaced.

## What is provisional
| Group | File | What `contracts.md` must match | Swap steps |
|---|---|---|---|
| Types and enums | `lib/domain/types.ts` | Field names and values for water point, report, complaint, history event, note, partner. Enum values: problem, type, duration, status, verification state, location source, channel, role. Whether `people_affected` and `serves_school_or_clinic` use `"unknown"` or null. Needs-review reason values (unknown today). Whether the score reason is one string or parts. Date format. | 1. Compare each type to the contract. 2. Rename fields or replace the file with the contract types. 3. Run typecheck: every mismatch fails to compile. |
| Mock data | `lib/domain/mock.ts` | Same shapes as above. | Delete once the data layer reads the real API. Keep a cleaned copy for tests if useful. |
| Data layer | `lib/data/complaints.ts` | Route names and response shapes for the complaint API (D6): list, detail, needs review, needs location, water points, last report received. Error responses, especially that missing and cross-organization look identical. | Replace the function bodies with API calls. Keep the signatures and `DataResult` shapes. Remove the mock import and `MOCK_CONTEXT`. Screens do not change. |
| Data layer tests | `tests/unit/data-layer.test.ts` | Same as the data layer. | Point at the API with test fixtures. Keep the scope, identical-error and no-caller-details checks. |
| UI strings | `lib/i18n/strings.ts` | Nothing, unless a value or enum is renamed. Keys `status.*`, `problem.*`, `type.*`, `duration.*`, `schoolClinic.*` mirror enum values. | When an enum value changes, rename its key and fix the typecheck errors. |
| Config | `lib/config/ui.ts` | Where settings live (configuration table or file). The stale-report threshold is PROPOSED at 15 minutes, not approved. | Move the value to the real configuration source. |
| UX notes | `docs/ux-screen-notes.md` | Review-reason values, score-reason format, column list (DB-1). | Update wording and keys to match. |

## Known guesses (all unknown in the spec)
1. Needs-review reason values: `ambiguous_match`, `unusable_location`, `incomplete_report`, `off_topic`, `unknown`.
2. History event types: `created`, `report_added`, `status_changed`, `passed_on`, `reopened`, `note_added`, `edited`, `pin_moved`, `verified`, `merged`.
3. Partner type is free text. Partner contact is dropped by the data layer.
4. Timestamps are ISO strings.
5. A report with no match has a null water point and complaint. Several possible matches are `candidateWaterPointIds`.
6. Every record carries `organizationId` and `regionId` (spec section 5, rule 1).

## Order
1. S6 lands `docs/contracts.md`.
2. Update `types.ts` to the contract. Fix typecheck.
3. Update `complaints.ts` to call D6. Run `tests/unit/data-layer.test.ts` against it.
4. Update strings and the UX notes for any renamed value.
5. Delete the mock file. Remove every PROVISIONAL header.
