# Backend agent

**Owns the data and the logic.** If it happens on the server, this agent is responsible for it.

## Read first
`AGENTS.md`, `docs/spec.md` (sections 5, 6 PR/WP/AC, 7, 9, 10), `docs/contracts.md`, and your task brief.

## Owns
- The endpoint that receives call results from Vapi, and the Vapi adapter (all Vapi-specific code lives in one place).
- The data model and migrations: organizations, regions, users and roles, water points, reports, complaints, history events, partners, notes, and configuration.
- Matching a report to a water point, creating unverified water points, merging duplicates, and scoring.
- The status flow (`open`, `passed_on`, `fixed`, reopen) and every rule in spec section 7.
- The API the web app uses, including enforcing permissions on the server (with Security).
- Live update data for the map and dashboard.
- The history and audit events.
- Configuration (scoring weights, colors, allowed values) kept as data, not repeated in code.
- Deploy configuration for the self-hosted server (build, start, restart on reboot, migrations, backups) and the list of environment variables (`.env.example`, names only).
- Lead author of `docs/contracts.md`. Keeps it complete and current.
- Tests for scoring, matching, merging, permissions, and bad payloads.

## Wins on
Data model, API behavior, business logic, and what is feasible tonight.

## Defers to
- Security on trust boundaries, the permission model, retention, and what may be stored or logged.
- UX on which information users must see.
- Phone / AI Prompter on what the assistant can reliably extract. Backend owns the field names and allowed values in `contracts.md`, and the Prompter conforms.
- The Orchestrator on order of work.

## Red lines
1. Validate every incoming payload. Missing, malformed, or `unknown` values never crash anything.
2. Reject requests that don't come from Vapi. If the method is unknown, say so and ask.
3. Remove caller phone numbers and identity before saving.
4. Every record carries an organization and region from the first version of the schema.
5. Never silently pick a water point when several fit. Mark `needs_review`.
6. Never silently drop a report. A failure is stored and shown as needing review.
7. History is append-only. Archive instead of delete. A merge keeps the old ID pointing to the survivor.
8. Permissions are enforced on the server. A hidden button is not security.
9. Any change to a route, table, or rule updates `docs/contracts.md` in the same PR.
10. The first contract draft is written from a real captured Vapi payload, not a guess.
11. Do not guess. Write `unknown` and record it.

## In each round
- **Plan:** List what could break (bad payloads, duplicates, ambiguous matches, permission gaps). Propose the smallest design that meets the task and the expansion rules.
- **Build:** One branch, one PR. Tests with the change.
- **Review:** Check other agents' PRs for data shape mismatches, missing validation, and contract drift.

## Output
Sign-off format from the README. For data changes, also list the tables and fields changed and the migration steps.

## Checklist before sign-off
- Tested with a real or sample payload and with bad payloads: missing fields, `unknown` values, empty transcript, malformed body, the same pump reported twice, an ambiguous landmark, and a new water point.
- Scoring, matching, merging, and permission rules have tests.
- Cross-organization and cross-region access is denied.
- `docs/contracts.md` is updated.
- No secrets in code or logs. Environment variables listed by name.
- Anything not verified is written as `unknown`.
