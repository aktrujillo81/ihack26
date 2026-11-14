# Well Watch: rules for humans and AI assistants

## What this is
iHack 2026 project (International category). People call a Vapi phone number to report a broken water point, including ones the system doesn't know yet. Vapi sends structured data to our server. We create or match the water point, score the complaint, and show it in a web app where NGO staff sign in, track complaints, pass them to partners, and mark them fixed.

## Stack (confirm and edit)
- Next.js (App Router) and PostgreSQL, both self-hosted by the team. No Supabase, no Vercel.
- Only the Next.js server is public, on one port, through a Cloudflare Tunnel. Postgres listens only on the host and is never exposed.
- Sign-in uses a proven auth library that stores users and sessions in our Postgres (default: Better Auth, email and password).
- Vapi for the phone line and call data
- Live updates use our own API (default: polling), not a third-party realtime service. The stack decisions are recorded in `docs/decisions.md`.

## Source of truth
- `docs/spec.md`: the product brief (what and why). Humans approve changes.
- `docs/contracts.md`: data shapes, tables, endpoints, rules. Written from a real captured Vapi payload.
- `docs/lenses.md`: the Builder, Adopter, and Responder lenses.
- `docs/agents/`: the six agents and how they work together.

Read the spec and contracts before changing anything. Any change to a route, table, or rule updates `docs/contracts.md` in the same PR.

## Agents
Orchestrator, Backend, Frontend, Security / Data Handling, Phone / AI Prompter, and UX. The humans talk only to the Orchestrator. Start every AI task with:

> You are the [NAME] agent. Read AGENTS.md, docs/spec.md, docs/contracts.md, and docs/agents/[name].md. If you don't know, say unknown.

Work runs in three rounds: Plan, Build, Review. Before any doc is written or any change is made, the Orchestrator seeks agreement from all agents and retries up to three times. One dissenter is allowed. Two or more block the step. Any disagreement is reported to the humans, and a dissent that cites a red line blocks the step. All involved agents must pass before a human approves the merge. See `docs/agents/README.md`.

## Rules (red lines)
1. If you don't know, say "unknown". Do not guess routes, fields, tables, or behavior. Check `docs/contracts.md` or ask.
2. Never commit secrets. Keys live in environment variables. `.env` is gitignored.
3. Store and show no personal data from callers: no names, no caller phone numbers.
4. No water-safety advice or repair promises anywhere in the product.
5. A human confirms every action. Nothing auto-dispatches.
6. Validate incoming Vapi payloads. Missing or "unknown" fields must not crash the endpoint.
7. Never silently pick a water point when several fit. Never silently drop a report.
8. Permissions are enforced on the server. Organizations never see each other's data.
9. History is never overwritten. Archive instead of delete.
10. Every record has an organization and region. Settings live in configuration, not scattered in code.
11. Color is never the only signal.
12. Build P0 end to end before P1, and P1 before P2.
13. Never commit to `main` or force-push. All changes go through a pull request that a human merges.
14. Track every change and decision inside `docs/`.
15. Never place a paid Vapi call without a human's OK. The Vapi budget is $5 in total, about $0.09 per minute. See `docs/budget.md`.
16. The repo is public. Keys live only in `.env.local` (development) and the `.env` file on the host server. The database URL and auth secret are used only on the server, never in browser code. The browser never talks to Postgres directly. Never commit raw call payloads.

## Workflow
- The Orchestrator manages git. A new feature gets a new branch from an up-to-date `main`. When asked to merge, it opens a pull request. A human merges.
- One task = one branch = one small PR. Branch names: `type/short-name`. No more than five PRs open at once (one per developer).
- Changes and decisions are tracked in `docs/`: `status.md`, `changelog.md`, `decisions.md`, `ai-mistakes.md`, `budget.md`, `reviews/`, and `tasks/`.
- The reviewer runs the code and checks it against `docs/contracts.md` before merging.
- After the feature freeze, only bug-fix PRs.
- Shared files (`docs/contracts.md`, the schema, shared types) are edited by one task at a time.
- When an AI assistant gets something wrong, add a line to `docs/ai-mistakes.md`.
- When the team makes a real decision, add a line to `docs/decisions.md`.

<!-- BEGIN:nextjs-agent-rules -->

## UI work
- Read `docs/style-guide.md` and match `docs/design/` before any UI change.
- Use `--ww-*` tokens only (`app/tokens.css`). No raw hex colors in components. `npm run check:hex` enforces it.
- Status is always shape + word + color. Never color alone (red line 11).
- Run the PR checklist in section 13 of the guide before opening a UI PR.

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
