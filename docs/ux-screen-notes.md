# Well Watch: UX screen notes (S7)

**Status:** Draft for review. Written by the UX role for the Frontend tasks W1 to W5.
**Source:** `docs/spec.md` sections 2, 6 (MP, DB, AC), 7, 10, 14. Where the spec says **unknown**, this file says unknown too.
**Provisional:** Field names come from the spec, not from `docs/contracts.md`, which does not exist yet. Names in `{braces}` are placeholders for values the data layer will supply.

## 1. Rules that apply to every screen
| Rule | How every screen meets it |
|---|---|
| Color is never the only signal (red line 11) | Every status and pin shows a text label and a shape: open = circle "Open", passed on = diamond "Passed on", fixed = check mark "Fixed". Unverified = dashed outline plus the word "Unverified". |
| Projector legibility | Body text at least 18px, key labels at least 24px, high-contrast text (at least 7:1), pins at least 40px, map labels at least 20px with a solid background. Information is never hover-only, because projectors and touch screens have no hover. |
| No caller details | No names or phone numbers are shown (spec). Raw call IDs are also hidden (a UX choice, not a spec rule). Transcripts appear only on the detail page, only to signed-in users with access to the region. Transcript text is never copied into lists, the map, "Copy summary", or logs. Spoken location text is free text: whether it is scrubbed of names is unknown (PR-3), so Security must confirm. |
| Pin and status colors | Colors follow spec section 7 (red, yellow, green) and are always secondary to the label and shape. |
| No safety advice or repair promises | No screen says water is safe or unsafe, when something will be fixed, or who will fix it. "Passed on" is described as a recorded step only. |
| `unknown` is honest | Shown as "Unknown" in neutral grey text with no severity styling. Unknown people, school or clinic, and duration add no points. A problem of `unknown` scores +1 and its pin is yellow, per spec section 7, but its label reads "Unknown" (`problem.unknown`) and is never styled as severe. |
| One main action per screen | Named in each screen below. |
| Why is always shown | Priority always has its reason. Items always show report count and whether they are unverified or need review. |
| Risky actions are confirmable and reversible | Status changes ask for confirmation. Fixed can be reopened. |
| Denied is handled | If the server refuses an action, the screen shows the "denied" message and does not change. |
| Strings in one place | All wording below lives under keys in `lib/i18n/strings.ts` (to be created in W1). No literals in components. |

## 2. Shared strings
| Key | Wording |
|---|---|
| `common.loading` | Loading… |
| `common.error` | Something went wrong. Please try again. |
| `common.retry` | Try again |
| `common.confirm` | Confirm |
| `common.cancel` | Cancel |
| `common.denied` | You don't have permission to do that. |
| `common.unknown` | Unknown |
| `common.unverified` | Unverified |
| `common.needsReview` | Needs review |
| `common.sampleData` | Sample data (PROVISIONAL, from docs/design/) |
| `priority.high`, `priority.medium`, `priority.low` | High, Medium, Low (PROVISIONAL, from docs/design/) |
| `common.needsLocation` | Needs location |
| `status.open` | Open |
| `status.passed_on` | Passed on |
| `status.fixed` | Fixed |
| `problem.no_water` | No water |
| `problem.broken` | Broken |
| `problem.slow` | Slow |
| `problem.dirty` | Dirty |
| `problem.other` | Other |
| `problem.unknown` | Unknown |
| `type.well` / `hand_pump` / `tap` / `borehole` / `other` / `unknown` | Well / Hand pump / Tap / Borehole / Other / Unknown |
| `duration.today` / `few_days` / `week_or_more` / `unknown` | Today / A few days / A week or more / Unknown |
| `schoolClinic.true` / `false` / `unknown` | Serves a school or clinic / Does not serve a school or clinic / Unknown |

## 3. Screens

### SCREEN: Sign-in
**WHO SEES IT:** Anyone not signed in. **MAIN ACTION:** Sign in.
**SHOWS FIRST:** The app name and the email and password fields.
| State | Wording (key) |
|---|---|
| Default | Title "Well Watch" (`signIn.title`). Fields "Email" (`signIn.email`), "Password" (`signIn.password`). Button "Sign in" (`signIn.submit`). |
| Loading | Button shows "Signing in…" and is disabled (`signIn.submitting`). |
| Empty | Not applicable. |
| Error (wrong details) | "That email or password is not right." (`signIn.invalid`). The screen does not say which one is wrong. |
| Error (server) | `common.error` |
| Denied (no access to any region) | "Your account is not set up for any region yet. Ask your organization's admin." (`signIn.noRegion`) |
| Session expired | "Your session ended. Please sign in again." (`signIn.expired`). Unsaved work is not discarded silently. |
| Too many attempts (PROPOSED) | "Too many sign-in attempts. Please wait a minute and try again." (`signIn.rateLimited`). Shown after 5 attempts in a minute from one address (the limit is configuration). It does not say whether the email exists. |
| Already signed in | Opening the sign-in page while signed in goes straight to the complaint list. |
| After signing in | The user goes to the complaint list (`/complaints`). The destination is fixed; it is never taken from the address or the form. |
| Signed out, or session ended | Any protected page sends the user to the sign-in page. If a session cookie was present but is no longer valid, the page shows "Your session ended. Please sign in again." (`signIn.expired`); with no cookie, it shows no message. |
| Sign out | A "Sign out" button (`nav.signOut`) in the page header ends the session on the server and goes to the sign-in page. If it fails, the user stays where they are and sees "Sign-out did not work. Please try again." (`nav.signOutFailed`, PROPOSED), because the session may still be valid. |
| Page not allowed for this role | A signed-in user whose role may not open a page sees the same "not found" page as for a page that does not exist. Every role can open the pages that exist today. |
| Navigation (PROPOSED) | Links shown by role: "Complaints" (`nav.complaints`), "Map" (`nav.map`), "Needs review" (`common.needsReview`), "Needs location" (`common.needsLocation`), and "Sign out" (`nav.signOut`). Hiding a link is a convenience only; the server checks every route. Route paths are proposals. The "Map" link opens the signed-in map at `/dashboard/map`. `/map` is the separate public, status-only map and is not in the navigation. |
| Needs review | Not applicable. |

### SCREEN: Complaint list (the dashboard home)
**WHO SEES IT:** Viewer, Responder, Org Admin (their regions only). **MAIN ACTION:** Open the most urgent complaint.
**SHOWS FIRST:** Complaints sorted by priority, highest first. Above the list: the "last report received" indicator and the counts for Needs review and Needs location.
**COLUMNS (provisional, from DB-1):** water point, location, problem, people affected, school or clinic, duration, report count, priority and its reason, status, last update.
| State | Wording (key) |
|---|---|
| Loading | `common.loading` with placeholder rows |
| Empty | "No complaints yet. When someone reports a problem, it will appear here." (`list.empty`) |
| Error | `common.error` with `common.retry` |
| Denied | `common.denied` |
| Unknown values | Shown as `common.unknown`. People affected unknown shows "Unknown", never 0. |
| Needs review | A "Needs review" badge with an icon on the row (`common.needsReview`). Row sorts into the Needs review list as well. |
| Unverified water point | "Unverified" badge with a dashed row border. |
| Long lists | Paginated (P1-3 adds filters and search). Until then show the first page with "Showing {n} of {total}" (`list.showing`). Page size is configuration, not a constant (proposal; value unknown). |
| Priority | The score number plus the reason text from the data (`list.priorityReason`), for example "8: {reason}". The UI never builds or edits the reason itself. |

### SCREEN: Complaint detail
**WHO SEES IT:** Viewer (read-only), Responder, Org Admin. **MAIN ACTION:** Change the status (Responder and Org Admin). Viewers have no main action.
**SHOWS FIRST:** Water point name and location, status, priority with its reason, report count, then the copyable summary.
**SECTIONS:** reports and transcripts, score reason, notes, timeline (who, what, when), status controls, "Copy summary".
| State | Wording (key) |
|---|---|
| Loading | `common.loading` |
| Empty (no notes) | "No notes yet." (`detail.notesEmpty`) |
| Empty (no transcript) | "No transcript was captured for this report." (`detail.transcriptEmpty`) |
| Error | `common.error` with `common.retry` |
| Denied or not found (other region or organization, or missing) | One identical message for both: "This complaint was not found or you can't view it." (`detail.notFoundOrDenied`). Two different messages would reveal that a record exists in another organization. The server should return indistinguishable responses (Security to confirm). |
| Unknown values | Problem, people affected, school or clinic, and duration use the shared `unknown` wording from section 2 and never look severe. |
| Needs review | Banner: "Needs review: the system couldn't match this to a water point with confidence." (`detail.needsReviewBanner`) |
| Unverified | Banner: "This water point has not been verified yet." (`detail.unverifiedBanner`) |
| Viewer | Status controls and note box are not rendered. The server still refuses any attempt. |
| Status change | Confirm dialog: "Change status to {status}?" (`detail.confirmStatus`), buttons "Confirm" (`common.confirm`) and "Cancel" (`common.cancel`). |
| Pass on (note field) | "Who is it passed to?" (`detail.passedOnTo`). This records a step only. Nothing is sent. Helper text: "This records the hand-off. It does not send a message." (`detail.passedOnHelp`) |
| Fixed | Button "Mark fixed" (`detail.markFixed`). After fixing, "Reopen" is available (`detail.reopen`). |
| Save failed | "Your change was not saved. Please try again." (`detail.saveFailed`). The screen keeps the user's text. |
| Copy summary | Button "Copy summary" (`detail.copySummary`), confirmation "Copied" (`detail.copied`). The summary contains water point, location, problem, people affected, duration, priority reason, status. It never includes transcript text or caller details. |
| Notes | Helper text under the note box: "Don't enter caller names or phone numbers." (`detail.noteHelp`) |

### SCREEN: Map
**WHO SEES IT:** Viewer, Responder, Org Admin. **MAIN ACTION:** Click a pin to open its complaint (P1, MP-7).
**SHOWS FIRST:** All water points with coordinates in the user's regions, plus a legend.
**PINS:** Shape and label together. Open = circle "Open", passed on = diamond "Passed on", fixed = check "Fixed". Color follows spec section 7: red for open or passed on with `no_water` or `broken`, yellow for the other problems including `unknown`, green for fixed. Unverified = dashed outline with "Unverified". Water points flagged needs review that have coordinates also get a "Needs review" label and icon, so low-confidence items look different (MP-3). The legend lists every shape and word.
| State | Wording (key) |
|---|---|
| Loading | `common.loading` over the empty map |
| Empty | "No water points with a location yet." (`map.empty`) with a link to the Needs location list |
| Error | `common.error`. If only the tiles fail: "The map background could not load. Water points are still listed below." (`map.tilesFailed`) |
| Denied | `common.denied` |
| Unknown values | An unknown problem or type shows "Unknown" in the label. The pin is yellow per spec section 7 but is never styled as severe. |
| Needs review | Items with no matched water point cannot be pins. They are listed in the Needs review list, and the map links to it. |
| Live update | The map updates without refresh. As a proposal (not in the spec), a changed pin briefly gets an "Updated" tag (`map.updated`). |
| Pin text (PROPOSED) | Always visible beside each pin: status (`status.*`, or "No open complaint" `map.noOpenComplaint` when the water point has none), then "Unverified" and "Needs review" when they apply, then "Reports: {n}" (`map.reports`). Open and passed-on pins also show what is wrong (`problem.*`), so red and yellow never differ by color alone. Zoom buttons are labelled "Zoom in" and "Zoom out" (`map.zoomIn`, `map.zoomOut`). A legend titled "Map key" (`map.legend`) and a text list titled "Water points on the map" (`map.listTitle`) repeat every pin and work without a pointer. |
| Needs location | Water points without coordinates are not pins. A counter links to that list: "{n} water points need a location" (`map.needsLocationCount`). |
| Tile terms | **Open:** the map library and OpenStreetMap tile usage terms are unconfirmed. See section 5. |
| Privacy | The map shows water point, status and report count only. No transcripts and no caller details. |

### SCREEN: Needs review list
**WHO SEES IT:** Viewer (read-only), Responder, Org Admin. **MAIN ACTION:** Open the oldest item and check it.
**SHOWS FIRST:** Items the system could not match or complete, with the reason.
| State | Wording (key) |
|---|---|
| Loading | `common.loading` |
| Empty | "Nothing needs review right now." (`review.empty`) |
| Error | `common.error` with `common.retry` |
| Denied | `common.denied` |
| Reasons | "Several water points could match" (`review.reasonAmbiguous`), "Location could not be understood" (`review.reasonUnusable`), "Report was incomplete" (`review.reasonIncomplete`), "Not about water" (`review.reasonOffTopic`). If the reason is not available: "Reason unknown" (`review.reasonUnknown`). |
| Several matches | Never shows one chosen water point. Lists the candidates: "Possible matches: {names}" (`review.candidates`). |
| Needs review flag | Each row has the badge and icon, not color alone. |
| Unknown values | Shown as `common.unknown`, never as 0 and never styled as severe. |

### SCREEN: Needs location list
**WHO SEES IT:** Viewer (read-only), Responder, Org Admin. **MAIN ACTION:** Place a pin (Responder and Org Admin, P1-1). Until P1-1, the main action is to open the complaint.
**SHOWS FIRST:** Water points that have a description but no coordinates, with the spoken location text.
| State | Wording (key) |
|---|---|
| Loading | `common.loading` |
| Empty | "Every water point has a location." (`location.empty`) |
| Error | `common.error` with `common.retry` |
| Denied | `common.denied` |
| Row | Water point, spoken location text, report count, "Unverified" badge if so. Unknown type shows `common.unknown`. |
| Pin action (P1-1) | Button "Place pin" (`location.placePin`). Hidden for Viewers, and the server still refuses. |

### COMPONENT: "Last report received" indicator
**WHO SEES IT:** Everyone signed in, on the dashboard header and map. **PURPOSE:** Makes a gap visible if calls stop arriving (spec section 10).
| State | Wording (key) |
|---|---|
| Loading | "Checking for reports…" (`lastReport.loading`) |
| Normal | "Last report received {time ago}, at {exact time}" (`lastReport.ago`). The exact time is always in the text, not only on hover. |
| Empty (none ever) | "No reports received yet." (`lastReport.none`) |
| Stale | After a configured time without a report (the threshold is configuration; a default of 15 minutes is PROPOSED, not approved): "Last report received {time ago}. If you expected more, check that the phone line is working." (`lastReport.stale`). A warning icon plus text, not color alone. |
| Error | "Couldn't check for new reports." (`lastReport.error`) |
| Live | Updates without refresh. |

### SCREEN: Public map (PROPOSED; cut from the spec, built on request)
**WHO SEES IT:** Anyone, without signing in. **MAIN ACTION:** None (look at the map). **STATUS:** `docs/spec.md` section 4 lists the public read-only map as cut from this build. This screen exists only because a human asked for it, and needs the spec change approved.
**SHOWS:** Each water point that has a location, as a pin with a shape and always-visible text: its type (`type.*`, because the data has no water point name), and its status (Open, Passed on, Fixed, or No open complaint). Unverified water points are not shown by default (PROPOSED: they come straight from a caller's words and have an exact location); if a human turns them on, they carry the word "Unverified" and a dashed outline. A legend and a text list repeat every pin.
**NEVER SHOWS:** report details, transcripts, spoken location text, counts of reports or reporters, problem, people affected, dates, notes, ids, or anything about callers.
**Color:** by status only (open red circle, passed on yellow diamond, fixed green check, no open complaint green square). This differs from the spec's problem-based colors because the problem must not be public. The word and shape carry the meaning.
| State | Wording (key) |
|---|---|
| Title | "Water points" (`map.publicTitle`) |
| Loading | "Loading…" (`common.loading`) |
| Empty, or not published | "No water points with a location yet." (`map.empty`). The map is empty, not an error, when no organization is configured for publishing. |
| Error | "Something went wrong. Please try again." (`common.error`) |
| Tiles fail | "The map background could not load. Water points are still listed below." (`map.tilesFailed`) |

### PROPOSED wording for the complaint screens (not in the first draft)
| Key | Wording |
|---|---|
| `list.col.waterPoint` / `problem` / `people` / `schoolClinic` / `duration` / `reports` / `priority` / `status` / `updated` | Water point / Problem / People affected / School or clinic / How long / Reports / Priority / Status / Last update |
| `common.timeUtc` | {time} UTC |
| `detail.reportsTitle` / `notesTitle` / `timelineTitle` | Reports / Notes / Timeline |
| `detail.passOn` | Pass on |
| `detail.addNote` / `detail.noteLabel` | Add note / Note |
| `detail.conflict` | This complaint was changed by someone else. Reload the page and try again. (Shown when the screen is out of date; nothing is saved.) |
| `detail.invalidInput` | Please check what you entered. |
| `history.system` / `created` / `reportAdded` / `reopened` / `noteAdded` / `other` | System / Complaint created / Report added / Reopened / Note added / Change recorded |
| `history.statusChanged` | Status changed from {from} to {to} |
| `history.passedOn` | Passed on to {who} |

Status changes allowed (spec DB-3 and section 10): Open to Passed on or Fixed, Passed on to Fixed, Fixed back to Open. Passed on back to Open is not listed in the spec and is refused (unknown). Passing on needs a note of who it is passed to (free text until the partner directory exists, P1-2).

## 4. Role differences
| Screen | Viewer | Responder | Org Admin |
|---|---|---|---|
| Lists, map, detail | Read only | Read, plus status, notes, pass on | Same as Responder |
| Status and note controls | Not rendered (server refuses anyway) | Shown | Shown |
| Water point tools (P1-1) | Not rendered | Shown | Shown |
| User, role, region screens | None | None | Cut from this build |

## 5. Open items and unknowns
1. **Map provider and tile terms:** the default is Leaflet with OpenStreetMap, unconfirmed with the team. Tile usage terms have not been checked. (Spec Open Question 3.)
2. **`docs/contracts.md`:** missing. All field names and the reason codes in Needs review are provisional.
3. **Stale threshold:** how long without a report before "last report received" warns is unknown. A default of 15 minutes is PROPOSED in `lib/config/ui.ts` and needs a human decision. It must live in configuration.
4. **Needs review reasons:** the exact reason values are unknown until the contracts exist.
5. **Score reason format:** whether the backend returns a ready-made sentence or parts is unknown.
6. **Spoken wording:** the words said on the call belong to the Phone / AI Prompter and are not set here.
7. **Scrubbing of spoken location text:** whether names are removed from free-text locations is unknown. Security to confirm.
8. **Denied vs not found:** this file assumes the server returns indistinguishable responses for other-organization records. Unverified.
9. **Task IDs and change tracking:** task IDs (W1 to W5, P1-1) are taken from the spec task list. `docs/status.md` and `docs/changelog.md` do not exist yet, so this PR cannot update them.
10. **Not yet checked:** this file has not been checked on a projector, on a phone, or as each role, because no screens exist yet. The UX checklist runs at build review.
