# Well Watch: Product Brief (put this file at docs/spec.md)

**Status:** Draft v3 for handoff to the agent team. Written for iHack 2026 (International category). Updated Sat Nov 14, 2026, 12:05 AM, with 16 hours left. Designed to grow, scoped to fit the time (see section 4).
**Reading rule:** Where this brief says **unknown**, do not guess. Verify it, or record it in Open Questions (section 12).
**Priority labels:** P0 = needed for the demo. P1 = build only after every P0 item works end to end, in the order listed. Anything under "Cut from this build" is future work: do not build it.

---

## 1. Intent
Rural water points (wells, hand pumps, taps, boreholes) break often, and nobody who can fix them finds out in time. Well Watch lets anyone with a basic phone call a number and describe a water problem, including at a water point the system has never heard of. The report becomes a located, prioritized complaint that a coordinator at a non-governmental organization (NGO) can track in a web app, pass on to people who can fix it, and follow until it is fixed.

**Why this matters:** A report nobody sees is worthless, and a report nobody follows up on is the same. The product covers the whole path from a spoken sentence to a confirmed fix.

**Success for this build:** In a live demo, a judge calls the number and reports a broken pump. Within about 10 seconds (target, not yet verified) the complaint appears in the NGO web app. A signed-in responder verifies the location, passes the complaint to a partner, and marks it fixed, with every step tracked.

**Built to grow:** The first version serves one NGO in one district. The data and design must allow many NGOs, many regions, more languages, and more ways to report, without rewrites (section 5).

---

## 2. Users and roles
Every requirement is checked against all three lenses (questions in `docs/lenses.md`).

| Lens | Who | What they need |
|---|---|---|
| **Adopter** | The caller. Basic phone, possibly weak signal, possibly speaking English as a second language, little time. No account. | A short, simple call. To be understood. To report a water point even if it's not in the system. To know the report was received. No personal data demanded. No promises the system can't keep. |
| **Responder** | A coordinator at an NGO who connects problems to organizations that can fix them. Signs in to the web app. | Find the place. See what's wrong, how many people depend on it, how long, and how sure the system is. Sort and filter by urgency. Track every complaint's status and history. Hand off with a clear summary. A human decides what happens next. |
| **Builder** | The engineer who maintains this a year from now. | Simple design, documented contracts, tests for tricky cases, failures that are visible, no secrets in code, easy to extend. |

### Account roles in the web app
| Role | Who | Can do |
|---|---|---|
| **Org Admin** | Manager at an NGO | Everything a Responder can do, plus manage the organization's users and roles, regions, and partner directory, and export data |
| **Responder** | NGO coordinator | View complaints in their regions. Verify, edit, and merge water points. Set status, pass on, add notes, mark fixed or reopen |
| **Viewer** | Donor, government liaison, or partner who only needs to see | Read-only access to dashboards and the map for their organization's regions |

Callers have no accounts. A public read-only map is future work. In this build, the organization, region, and user accounts are created by a seed script, and there are no invitation screens. A platform-level administrator who creates organizations is **unknown** for this build.

---

## 3. Product description
1. **Call:** A person calls a phone number (a Vapi voice-assistant number).
2. **Conversation:** An AI voice assistant asks a few short questions, one at a time: where (village and a nearby landmark), what kind of water point, what's wrong, how many people and whether a school or clinic depends on it, and for how long. It repeats the details back and the caller confirms.
3. **Extraction:** When the call ends, the transcript and structured fields are sent to the server.
4. **Processing:** The server validates the data, removes personal data, finds the matching water point or creates a new unverified one, merges duplicate complaints, and scores urgency.
5. **Web app:** NGO staff sign in. The dashboard tracks complaints with status, location, priority, history, and notes. A map shows water points by status.
6. **Follow-through:** A responder verifies new water points (placing them on the map), passes complaints to a partner organization with a note, and marks them fixed. Every change is recorded.

---

## 4. Scope and priorities

### In scope
| Priority | Feature |
|---|---|
| P0 | Inbound phone intake through the Vapi assistant (already created; prompt saved in the repo) |
| P0 | Server endpoint that validates, stores, matches or creates water points, merges, and scores |
| P0 | Water points created from calls (unverified) and by responders |
| P0 | Sign-in with roles (Org Admin, Responder, Viewer) and an organization and region on all data |
| P0 | Dashboard: complaint list with status, location, priority, and detail view with history |
| P0 | Map with status colors and labels |
| P0 | Status flow: open, passed on, fixed (reopen allowed) with notes |
| P0 | Visible "last report received" indicator and a "Needs review" list |
| P1 (1st) | Responder tools to verify, edit, and merge water points; place a pin on the map |
| P1 (2nd) | Partner directory (seeded) and "passed on to" selection |
| P1 (3rd) | Filters, search, and summary metrics |
| P1 (4th) | Audit log screen (history events are already recorded in P0) |

### Cut from this build (future work; do not build)
- Public web form to submit a new water point. Callers can already report new water points by phone.
- Org Admin screens to invite users, change roles, and manage regions.
- CSV export.
- Second language for the assistant.
- Alert sound or highlight for new complaints.
- Public read-only map.

The data design must still allow these later (section 5).

### Non-goals for this build (do not build)
- WhatsApp, SMS, or Twilio intake.
- Calling or messaging the reporter back.
- Automatic dispatch of anyone.
- Real messaging or integrations with partner organizations (passing on is a recorded step only).
- Water quality or safety advice of any kind.
- A mobile app.
- Multiple countries or live multi-organization onboarding. The data design supports it, but only one organization and region are set up.

### Schedule
16 hours left at 12:05 AM Saturday. The competition ends at 4 PM (confirmed). Breakfast, workshops, and lunch also take time.

| Time | Goal |
|---|---|
| 12 to 1 AM | Humans approve this brief, set up accounts, update the Vapi assistant, make one test call, and save the raw payload. The Orchestrator writes the P0 task briefs for approval |
| 1 to 8 AM | Agents build P0 |
| **8 AM, checkpoint** | The P0 demo path works end to end. If it does not, switch to the fallback below and tell the humans immediately |
| 8 to 11 AM | P1, in the order listed, only if P0 is done |
| **Noon, feature freeze** | Only bug fixes after this |
| Noon to 2 PM | Two rehearsals, backup video, DevPost, pitch polish |
| 2 PM on | Final checks, setup at the demo space, buffer |

**Fallback:** If P0 is not working at the 8 AM checkpoint, demo the smallest working path: a call creates a complaint, a signed-in responder sees it in the dashboard, and changes its status. Water points may come from the starter data.

**Approval rhythm:**
- Humans approve the P0 plans once, as a batch.
- Merges are approved in batches at set times while humans are awake, about hourly.
- Sleep is staggered: two people from about 1 AM and two from about 4 AM, at least 5 hours each. Tired reviewers rubber-stamp code.
- Two humans stay off the build to write the pitch, the DevPost entry, and the backup video.

---

## 5. Design for expansion
These rules apply to every agent and every task.
1. **Organization and region on everything.** Every water point, report, complaint, user, and partner belongs to an organization and a region from day one, even though the demo has one of each. Access is limited by organization and region, enforced on the server.
2. **Intake channel is a field, not an assumption.** Every report records its channel (`phone` now; `web` soon; others later). The endpoint turns each channel's data into one common report format.
3. **Settings are data, not code.** Priority weights, status colors, allowed values, and the duplicate rule live in configuration (per organization where it makes sense), not hard-coded in several places.
4. **Text can be translated.** User-facing text is kept in one place so languages can be added.
5. **One API.** The web app and any future client use the same server API, with permissions checked server-side.
6. **History is never overwritten.** Status changes, edits, and merges create events. Nothing is deleted without a trace (use archive, not delete).
7. **Stable IDs.** Merging a water point keeps the old ID pointing to the new one.
8. **Contracts are versioned.** `docs/contracts.md` records the data shapes; changes update it in the same PR.
9. **Provider independence.** Keep Vapi-specific code in one adapter so the voice provider can change.

---

## 6. Functional requirements
MUST means required at its priority level.

### Phone intake (P0)
- PI-1 MUST: One question at a time, call under about 90 seconds.
- PI-2 MUST: Collect only: location (village plus nearby landmark), water point type, problem, people affected, whether a school or clinic depends on it, and duration. No names or other personal details.
- PI-3 MUST: If the caller can't name a village or landmark, ask for the nearest school, market, church, or road.
- PI-4 MUST: Repeat the key details and ask "Is that right?"
- PI-5 MUST: Anything unknown is recorded as `unknown`, never guessed.
- PI-6 MUST NOT: Say whether water is safe, promise a repair time, or say who will fix it.
- PI-7 MUST: Honest closing line: "Thank you. Your report has been recorded and will be shared with people who may be able to help."
- PI-8 MUST: If calls are recorded or transcribed, say so in the greeting. Whether Vapi recording is on is **unknown**; check it.
- PI-9 MUST: Set a maximum call length and a silence timeout.

### Processing (P0)
- PR-1 MUST: Validate every incoming payload. Missing, malformed, or `unknown` values never crash the endpoint.
- PR-2 MUST: Reject requests that don't come from Vapi (mechanism **unknown**; verify).
- PR-3 MUST: Remove caller phone numbers and other caller identity before saving.
- PR-4 MUST: Match by the rules in section 7. Never silently pick a water point when several fit.
- PR-5 MUST: Merge duplicate reports by the rules in section 7.
- PR-6 MUST: Calculate status color and priority, and keep a short reason for the score.
- PR-7 MUST: Never silently drop a report. A failure is stored and shown as needing review.
- PR-8 MUST: Record when the last report arrived.
- PR-9 MUST: Record the intake channel on every report.

### Water points (P0 unless noted)
- WP-1 MUST: Anyone can report a water point the system doesn't know. A call with no matching water point creates a new unverified water point with the spoken location text and type.
- WP-2 MUST: Water points have a verification state (`unverified`, `verified`, `merged`, `archived`) and a location source (`landmark_only`, `map_pin`, `gps`, `geocoded`).
- WP-3 MUST: A water point with no coordinates appears in a "Needs location" list, not as a map pin.
- WP-4 MUST (P1): A responder can place or move a pin on the map, edit details, verify a water point, and merge duplicates. Merging keeps history.
- WP-5 FUTURE (cut from this build): A public web form lets a person submit a new water point using a map pin or device location. Spam protection would need a decision first.
- WP-6 MUST: Every water point belongs to an organization and region.

### Accounts and access (P0 unless noted)
- AC-1 MUST: Responders and admins sign in before seeing any complaint, transcript, or edit control. Sign-in method is **unknown**.
- AC-2 MUST: The three roles in section 2, with permissions enforced on the server, not only hidden in the interface.
- AC-3 MUST: Users see only data for their organization and assigned regions.
- AC-4 MUST: Demo accounts exist for each role.
- AC-5 MUST NOT: The last Org Admin of an organization cannot be removed or demoted.
- AC-6 FUTURE (cut from this build): Org Admins invite users, assign roles and regions, and deactivate users. In this build, accounts are created by a seed script.
- AC-7 MUST: Sessions expire and sign-out works.

### Map (P0)
- MP-1 MUST: Show each water point that has coordinates, with the correct status color.
- MP-2 MUST: Color is never the only signal. Every pin also has a label or shape.
- MP-3 MUST: Unverified or low-confidence items look different from confirmed ones.
- MP-4 MUST: Update live without a refresh.
- MP-5 MUST: Readable on a projector from across a room.
- MP-6 MUST NOT: Show caller details. The map shows water points, status, and report count only.
- MP-7 SHOULD (P1): Clicking a pin opens that complaint.

### Dashboard (P0 unless noted)
- DB-1 MUST: A complaint list showing water point, location, problem, people affected, school or clinic flag, duration, report count, priority and its reason, status, and last update.
- DB-2 MUST: A complaint detail page with all reports and transcripts for that complaint, the water point and its location, the score reason, notes, and a timeline of every change with who and when.
- DB-3 MUST: Status flow: `open`, `passed_on` (with a note of who), `fixed`. Reopening is allowed.
- DB-4 MUST: A "Needs review" list for reports and water points the system couldn't match or complete, and a "Needs location" list.
- DB-5 MUST: A copyable summary of each complaint for hand-off.
- DB-6 MUST: Live updates and "last report received."
- DB-7 MUST: A human decides every action. Nothing dispatches automatically.
- DB-8 SHOULD (P1): Filters (status, problem, priority, region, date range, needs review, channel), search, sorting, and pagination.
- DB-9 SHOULD (P1): Summary metrics: open complaints, by status, by problem, by region, new this week, average time to fix.
- DB-10 SHOULD (P1): A partner directory (name, type, region, contact) and a "pass on to" selection that records the partner. Partners are seeded in this build. A screen to manage them is optional.
- DB-11 SHOULD (P1): A water points view showing each point's verification state, current complaint, and history.
- DB-12 SHOULD (P1): An audit log of who changed what and when.
- DB-13 FUTURE (cut from this build): CSV export.

---

## 7. Business rules (proposed values; editable in contracts.md)

**Complaint status** (stored): `open`, `passed_on`, `fixed`. `needs_review` is a separate yes/no flag.

**Matching a call to a water point:**
| Result of matching | Action |
|---|---|
| One confident match | Attach the report to that water point |
| No candidates | Create a new `unverified`, `landmark_only` water point and attach the report |
| Several possible matches | Mark the report `needs_review`. Do not pick one |
| Unusable location text | Store the report and mark `needs_review` |

**Pin color:**
| Condition | Color |
|---|---|
| Status `fixed`, or no open complaint | Green |
| Open or passed on, problem `no_water` or `broken` | Red |
| Open or passed on, problem `slow`, `dirty`, `other`, or `unknown` | Yellow |

Passed-on complaints keep their color and show a "passed on" label. Unverified water points are drawn in a distinct style.

**Priority score** (higher = more urgent; always store the reason):
- Problem `no_water` or `broken`: +3. Otherwise +1.
- Serves a school or clinic: +3.
- People affected 100 or more: +2. 20 to 99: +1.
- Duration a week or more: +2. A few days: +1.
- Each extra report of the same complaint: +1, up to +3.

These weights are configuration, not constants in the code.

**Duplicates:** A new report about a water point that has an open or passed-on complaint is merged into it. The report count goes up, the score is recalculated from the most severe values reported, and the new transcript is kept. A report about a `fixed` water point opens a new complaint. Merging two water points moves their reports and history to the surviving one.

**Unknown handling:** `unknown` is valid everywhere. It never counts as severe and never blocks a report.

**Permissions:**
| Action | Viewer | Responder | Org Admin |
|---|---|---|---|
| See map, complaints, transcripts in their regions | Yes | Yes | Yes |
| Add notes, change status, pass on | No | Yes | Yes |
| Create, verify, edit, and merge water points | No | Yes | Yes |
| Manage partners, regions, users and roles (users, roles, and regions are set up by a seed script in this build) | No | No | Yes |
| Export data (future, not built) | No | No | Yes |

---

## 8. Phone assistant requirements
- The assistant exists in Vapi. Its prompt must be saved at `docs/vapi-prompt.md` and kept in sync with what is live.
- Style: warm, calm, simple words, short sentences, slow speech.
- Flow: location (village and nearby landmark), water point type, problem, people affected and school or clinic, duration, read-back, honest closing line.
- Extracted fields and allowed values:
  - `location_text` (text; village plus landmark description)
  - `water_point_type` (well, hand_pump, tap, borehole, other, unknown)
  - `problem` (no_water, broken, dirty, slow, other, unknown)
  - `people_affected` (number or unknown)
  - `serves_school_or_clinic` (true, false, unknown)
  - `duration` (today, few_days, week_or_more, unknown)
  - `caller_confirmed` (true, false)
  - `summary` (one plain sentence)
  - `language_spoken` (text)
- Where these fields appear in the data Vapi sends is **unknown** until a real call is captured.

---

## 9. Non-functional requirements
- **Privacy:** No personal data stored or shown. Transcripts are visible only to signed-in users with access to that region, never on a public map.
- **Security:** No secrets in code, browser, or logs. Passwords or sign-in links are handled by a proven auth service, not custom code. Permissions are checked server-side. Data from one organization is never visible to another.
- **Reliability:** Failures are visible. An unparseable report becomes a "needs review" item, never a silent loss.
- **Speed:** Target about 10 seconds from call end to the complaint appearing. Not yet verified.
- **Accessibility:** Color is never the only signal. Text is readable from across a room.
- **Maintainability:** Any change to a route, table, or rule updates `docs/contracts.md` in the same PR. Scoring, matching, merging, and permissions have tests.
- **Auditability:** Status changes, edits, merges, and role changes are logged with who and when.
- **Cost:** Calls use Vapi credits. Keep call length capped and track the balance.

---

## 10. Edge cases and error cases
| Case | Expected behavior |
|---|---|
| Caller is silent or hangs up early | Store what was captured, mark `needs_review`, no crash |
| Caller reports a water point the system doesn't know | Create an unverified water point with the spoken location, add the complaint |
| Caller names an existing water point differently | May create a duplicate unverified point. Responder merges it |
| Landmark matches several water points | `needs_review`, never pick one |
| Water point has no coordinates | Appears in "Needs location", not on the map |
| Responder moves a pin after complaints exist | Complaints and history stay attached. The move is logged |
| Two water points are merged | Reports and history move to the survivor. The old ID points to it |
| Same pump reported by several callers | One complaint, report count goes up, score recalculated |
| Report about a `fixed` water point | Opens a new complaint |
| Payload missing fields, empty transcript, or malformed | Stored and flagged `needs_review`. Endpoint returns a clean response |
| Values are `unknown` | Accepted, shown as unknown, not treated as severe |
| Vapi sends events that aren't the final call result | Ignored safely. Event types **unknown** |
| Caller volunteers a name or phone number | Not extracted into fields. May appear in the transcript (signed-in users only) |
| Caller talks about something other than water | Assistant politely ends. Stored as `needs_review` |
| Caller speaks another language | Assistant does its best. Flagged `needs_review` if unsure. Language noted |
| Viewer tries to change data | Denied by the server, not just hidden in the interface |
| User outside the region opens a complaint link | Denied |
| Session expires mid-task | User is sent to sign in and no changes are lost silently |
| Last Org Admin is removed or demoted | Blocked |
| Responder marks fixed by mistake | Can reopen. Both actions are logged |
| Public form is abused | Not applicable in this build. The public form is cut |
| Server or database is down when the call ends | Vapi's retry behavior is **unknown**. "Last report received" makes the gap visible |
| Vapi credits run out | Calls fail. Check the balance before the demo |

---

## 11. What is real and what is simulated in the demo
- **Real:** The phone call, the AI conversation, extraction, the pipeline, creating unverified water points, matching, scoring, accounts and roles, the live map, the dashboard, and the history.
- **Starter demo data:** A few water points, one organization and region, a partner list, and demo accounts, created so the demo isn't empty. The product does not depend on them.
- **Recorded steps, not real messages:** Passing a complaint to a partner records who and when. Nothing is sent to the partner.
- **Not built:** Notifying the reporter, alerts outside the app, and real integrations with repair organizations.
The pitch must say this plainly and describe the product as a one-district pilot.

---

## 12. Assumptions and open questions

### Assumptions (verify; change if wrong)
- The stack is Next.js and Supabase (including its sign-in service), deployed on Vercel. **Confirm.**
- The free Vapi number is US-only and inbound-only, fine for the demo.
- English is the demo language, with at most one other tested language.
- Duplicate merging applies to the same water point while a complaint is open or passed on.
- One organization and one region exist at launch.
- The competition ends at 4 PM Saturday (confirmed by the team).

### Decisions the humans must make before starting
1. Which tool runs the agents (Claude Code, Codex, or another) and how each agent file is loaded.
2. Sign-in method. Default if undecided: email and password through Supabase Auth.
3. Map provider. Default if undecided: Leaflet with OpenStreetMap. Check the tile usage terms.
4. Who is awake to approve and when (see the approval rhythm in section 4).
5. Usage and credit budget for the AI tools and for Vapi test calls, and what to cut first if they run out.
6. What happens to demo data and transcripts after the event.
7. Decided: the competition ends at 4 PM Saturday.

### Unknowns (agents must not guess)
1. The exact shape of the data Vapi sends when a call ends, and where the extracted fields appear. **Capture a real test call and save the raw body before writing `contracts.md`.**
2. Whether Vapi recording is on, and how long Vapi keeps calls and transcripts.
3. How the endpoint verifies a request really came from Vapi.
4. Vapi's behavior if the endpoint is down or slow.
5. Which sign-in method to use (email and password, or emailed link). Invitations are cut from this build.
6. Decided: organizations, regions, and users are created by a seed script in this build.
7. Whether a platform-level administrator is needed.
8. Decided: the public water point form is cut from this build.
9. The map provider and its usage terms and keys.
10. How long transcripts are kept.
11. How a real responder would be alerted when not looking at the app (roadmap item).
12. Decided: no second language in this build. English only.

---

## 13. Red lines (non-negotiable)
Full list in `AGENTS.md`. In short:
1. If you don't know, say `unknown`. Don't guess.
2. No secrets in the repo, browser, or logs.
3. No personal data stored or shown from callers.
4. No water-safety advice or repair promises.
5. A human confirms every action. No auto-dispatch.
6. Never silently pick a water point when several fit. Never silently drop a report.
7. Permissions are enforced on the server. Organizations never see each other's data.
8. History is never overwritten.
9. Color is never the only signal.

---

## 14. Definition of done

**Demo path (about 90 seconds):**
1. State the problem in one sentence.
2. A responder is signed in to the web app on the projector.
3. A judge calls and reports a broken pump.
4. The complaint appears with a score reason and transcript. If the water point is new, it shows in "Needs location".
5. The responder places the pin, and it turns red on the map.
6. The responder passes it to a partner with a note, then marks it fixed.
7. The pin turns green and the timeline shows every step.
8. Show that a Viewer account cannot edit.

**Done when:**
- The demo path works three times in a row.
- A bad payload, a duplicate report, a new water point, and an ambiguous landmark are each handled as described in section 10.
- Scoring, matching, merging, and permissions have tests.
- All P0 items work end to end before any P1 work is merged.
- The noon feature freeze was respected.
- All three lenses (Builder, Adopter, Responder) have reviewed this brief and the build. Every "no" has a fix and every "unknown" is written down.
- A backup video of the demo exists.
- Every team member can explain the whole flow in 60 seconds.

---

## 15. Glossary
- **Water point:** A well, hand pump, tap, or borehole that people use for water.
- **Report:** One caller's description of a problem at a water point.
- **Complaint:** A water point's current problem, which can combine several reports. Also called an issue.
- **Adopter:** The caller.
- **Responder:** The NGO coordinator who reviews complaints and passes them on.
- **Partner:** An organization that can fix a problem, such as a repair technician, water committee, or local government office.
- **Passed on:** The responder has handed the complaint to a partner.
- **Unverified:** A water point created from a call or a form that a responder hasn't confirmed yet.
- **Needs review:** The system isn't confident about the location or data, so a person must check it.
- **Needs location:** A water point that has a description but no map coordinates yet.
- **Channel:** How a report arrived (phone now, web later).

---

## 16. Handoff notes for the agent team
- Read `AGENTS.md`, `docs/agents.md`, and `docs/lenses.md` first.
- Produce from this brief: `docs/contracts.md`, the data model, the task list, and tests.
- The first task is to capture a real Vapi payload (unknown 1), then write the contracts from it.
- Build P0 end to end before starting P1. Set up organization, region, and role fields in the first version of the data model, even though the demo uses one of each.
- Follow the schedule in section 4. If P0 is not working at the 8 AM checkpoint, tell the humans immediately and switch to the fallback.
- Do not build anything listed under "Cut from this build."
- Any ambiguity this brief does not resolve goes into Open Questions. Do not silently choose.
