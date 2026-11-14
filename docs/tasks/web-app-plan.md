# Web app plan: W1 to W4 (Person 3)

Status: W1 is blocked, W2 and W3 wait for W1's session seam, and the map (W4) component is built (PR for `feat/map-component`). This file is the plan for the rest and what is left to wire.

## Shape every screen follows
- **Route (server component or handler):** reads the verified session, builds a `DataContext` from it (`organizationId`, `regionIds`) and the user's role. This is the only place a context is created. Unauthenticated requests are redirected before any data is read.
- **Screen components take `ctx` (and `role` where controls differ) as props.** They are server components. They call only `lib/data/complaints.ts` and never read a session, cookie, or header themselves.
- **Client components receive data, never `ctx`.** A client component is only for interaction (copy button, confirm dialog, the map). Anything a client sends to the server is re-checked against the session on the server. Role and scope are never taken from props, form fields, or cookies the client can edit (red line 8).
- **Actions** (status change, note, pass on) are server actions or route handlers. Each one reads the session, checks the role (Viewer refused), checks the record is in scope, and writes a history event. Not wired until D6 exists; until then they are not built (no fake writes).
- **Wording** comes only from `lib/i18n/strings.ts` through `t()`. Data only from the data layer.

## What is left to wire
| Item | Needs | Notes |
|---|---|---|
| Session seam: `getSession()` returning user id, role, organization, regions | W1 (Better Auth) and D1 tables | Needed by every item below |
| `DataContext` from the session | Session seam | One helper used by every route |
| Protected layout and role-aware navigation | W1 | Server-side redirect, not hidden links |
| `/complaints` list screen: `ComplaintList({ ctx })` | Session seam | Columns provisional (DB-1). States per UX notes. Priority has a number and a text reason. No transcripts. |
| `/complaints/[id]` detail: `ComplaintDetail({ ctx, id, role })` | Session seam | Not-found and denied use one identical message (`detail.notFoundOrDenied`). Copy summary never includes transcripts. |
| Status, note and pass-on actions | D6, session seam | Server-enforced role check, confirm dialog, history event |
| `/map` page: `<Suspense fallback={<MapLoading />}><MapView ctx={ctx} /></Suspense>` | Session seam | Component exists. Page and nav link only. |
| Map pin click opens the complaint | Route for detail | `complaintId` is already on authenticated pins (MP-7, P1) |
| Needs-location count link | Route for the Needs location list (W5) | Currently plain text; target route unknown |
| Live updates | D7 (unknown mechanism; default is polling) | Not built |
| Map tile source decision | Humans | See the map PR. Default OSM tiles with a plain-background fallback. |
| Replace mock data | D6 and `docs/contracts.md` | See `docs/contracts-swap-plan.md` |

## Out of scope until D3 and D4 merge
W5 (Needs review and Needs location lists, last-report indicator) and P1-1 (water point tools).
