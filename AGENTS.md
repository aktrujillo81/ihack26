# Well Watch: rules for humans and AI assistants

## What this is
iHack 2026 project (International category). People call a Vapi phone number to report a broken water point, including ones the system doesn't know yet. Vapi sends structured data to our server. We create or match the water point, score the complaint, and show it in a web app where NGO staff sign in, track complaints, pass them to partners, and mark them fixed.

## Stack (confirm and edit)
- Next.js + Supabase (including its sign-in), deployed on Vercel
- Vapi for the phone line and call data
- TODO: confirm with the team

## Source of truth
- `docs/spec.md`: the product brief (what and why). Humans approve changes.
- `docs/contracts.md`: data shapes, tables, endpoints, rules. Written from a real captured Vapi payload.
- `docs/lenses.md`: the Builder, Adopter, and Responder lenses.
- `docs/agents/`: the six agents and how they work together.

Read the spec and contracts before changing anything. Any change to a route, table, or rule updates `docs/contracts.md` in the same PR.

## Agents
Orchestrator, Backend, Frontend, Security / Data Handling, Phone / AI Prompter, and UX. The humans talk only to the Orchestrator. Start every AI task with:

> You are the [NAME] agent. Read AGENTS.md, docs/spec.md, docs/contracts.md, and docs/agents/[name].md. If you don't know, say unknown.

Work runs in three rounds: Plan, Build, Review. All involved agents must pass before a human approves the merge. See `docs/agents/README.md`.

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

## Workflow
- One task = one branch = one small PR. Branch names: `type/short-name`.
- Pull `main` before you start.
- The reviewer runs the code and checks it against `docs/contracts.md` before merging.
- After the feature freeze, only bug-fix PRs.
- Shared files (`docs/contracts.md`, the schema, shared types) are edited by one task at a time.
- When an AI assistant gets something wrong, add a line to `docs/ai-mistakes.md`.
- When the team makes a real decision, add a line to `docs/decisions.md`.
