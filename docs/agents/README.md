# Well Watch agents (put these files in docs/agents/)

Six agents: **Orchestrator, Backend, Frontend, Security / Data Handling, Phone / AI Prompter, UX.**
Each has its own file in this folder. An agent reads only its own file plus the parts of the spec that apply to its task. That keeps its context small and focused.

These are the same model with different instructions. The point is different questions, not independent minds. So each agent must disagree when its job says to, and must say `unknown` instead of guessing.

## How it works
- The humans talk only to the **Orchestrator**. The Orchestrator starts and coordinates the others.
- Every agent first reads: `AGENTS.md`, `docs/spec.md`, `docs/contracts.md` (once it exists), and its own file here.
- Humans approve three things: the **spec**, the **plan** for each task, and the **code** before merge. Everything else can run without them.

## The three rounds (every task)
1. **Plan.** The Orchestrator writes a task brief that answers: What is the goal? What could break? How will we test it? The agents involved reply with risks and their proposed approach. Disagreements are settled by the authority table below. Humans approve the plan for any P0 task or any change to a shared contract.
2. **Build.** The assigned agent(s) implement in one branch and one pull request. The same PR updates `docs/contracts.md` if a route, table, or rule changes.
3. **Review.** Every agent involved runs its checklist on the PR and posts a sign-off. All must say `PASS`. An `UNKNOWN` is allowed only if it is written in the spec's Open Questions with an owner. The Orchestrator checks the evidence. A human approves the merge.

## Sign-off format (all agents use this)
```
AGENT: <name>
TASK: <id>
VERDICT: PASS | CHANGES NEEDED | UNKNOWN
FINDINGS: numbered; each names the file or spec section and why it matters
EVIDENCE: tests run, calls made, screens checked, commands and results
UNKNOWNS: anything not verified, written as "unknown"
```

## Who wins when agents disagree
| Topic | Wins |
|---|---|
| Privacy, secrets, access control, data retention | Security / Data Handling |
| Data model, API, business logic, what is feasible | Backend |
| What the assistant says and asks callers | Phone / AI Prompter |
| How screens look, read, and flow | UX |
| How the interface is built | Frontend |
| Order of work, scope, and whether a task is done | Orchestrator |
| Anything the spec marks `unknown`, or a change to the spec | The humans |

If two agents still disagree, the Orchestrator writes both positions in `docs/decisions.md` and asks the humans to decide in one minute.

## Which agent leads which part of the spec
| Spec area | Lead | Also involved |
|---|---|---|
| Phone intake (PI-*) | Phone / AI Prompter | UX (conversation experience), Security (data collected, recording notice), Backend (field names) |
| Processing (PR-*) | Backend | Security, Phone / AI Prompter (field values) |
| Water points (WP-*) | Backend | Frontend (verify, pin, merge, public form), UX, Security (public form) |
| Accounts and access (AC-*) | Security | Backend (enforcement), Frontend (screens), UX |
| Map (MP-*) | Frontend | UX, Backend (data) |
| Dashboard (DB-*) | Frontend | UX, Backend (data), Security (who sees what) |
| Design for expansion (spec section 5) | Backend | All |
| Release and demo readiness | Orchestrator | Backend (deploy), Security (secrets), UX (demo flow), Phone / AI Prompter (call script, credits) |
| Pitch and DevPost | The humans | Orchestrator coordinates drafts |

## Lens reviews
At the start, and again before the feature freeze, the Orchestrator runs the Builder, Adopter, and Responder lens review from `docs/lenses.md` and asks the agents for their view:
- **Builder:** Backend and Security.
- **Adopter:** Phone / AI Prompter and UX.
- **Responder:** UX and Frontend.

## Shared habits
- When an AI output is wrong, add a line to `docs/ai-mistakes.md`.
- When a real decision is made, add a line to `docs/decisions.md`.
- Nothing is done until there is evidence. "It should work" is not evidence.
