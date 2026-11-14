# D3b: agreement gate (plan round)

Date: Sat 2026-11-14. Proposal: split D3 into D3a (Backend: endpoint, parsing, redaction, validation, migration, remove capture route) and D3b (Andrew: save a validated report in one transaction). Brief: `docs/tasks/D3b.md`.

**Result: 5 of 5 AGREE WITH NOTE. No DISAGREE. No red line cited. Passed on the first ask.**

| Agent | Reply | Notes that changed the brief |
|---|---|---|
| Backend | AGREE WITH NOTE | "One transaction" conflicts with contracts 2 step 6 and `processing_error`. D3a migration (items 1 to 3) and the D4/D5 schema (items 5 to 8, 11) should merge before D3b. Gave the input shape and column names. Tests need their own organization. Race needs the unique index. |
| Security | AGREE WITH NOTE | Closed input type; D3a hashes the call ID; org/region from configuration; fixed-code logs; 5434 guard; list of privacy tests. |
| Frontend | AGREE WITH NOTE | Only nullable columns and a new table. No screen changes. Bump `updated_at`. Publish the function name and return shape. |
| Phone / AI Prompter | AGREE WITH NOTE | D3a freezes the type first. "handpump" alias gap. Fake-payload cases for unknowns 8 to 10. One paid call (about $0.09, human's OK) after the Server URL switch. |
| UX | AGREE WITH NOTE | One transaction would silently drop a report on failure. "Last report received" has one source: `reports.received_at`. Unattached reasons give staff little; W5 wording later. Duplicates logged, not silent. |

## Not settled by the gate
Open question 1 in the brief (one transaction or two) contradicts the contract. It is a human decision. Questions 2 to 6 are unknowns.

## Dissent
None.
