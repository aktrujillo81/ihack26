# Well Watch: UX screen notes (S7)

**Status:** Draft for review. Written by the UX role for the Frontend tasks W1 to W5.
**Source:** `docs/spec.md` sections 2, 6 (MP, DB, AC), 7, 10, 14. Where the spec says **unknown**, this file says unknown too.
**Provisional:** Field names come from the spec, not from `docs/contracts.md`, which does not exist yet. Names in `{braces}` are placeholders for values the data layer will supply.

## 1. Rules that apply to every screen
| Rule | How every screen meets it |
|---|---|
| Color is never the only signal (red line 11) | Every status and pin shows a text label and a shape: open = circle "Open", passed on = diamond "Passed on", fixed = check mark "Fixed". Unverified = dashed outline plus the word "Unverified". |
| Projector legibility | Body text at least 18px, key labels at least 24px, high-contrast text (at least 7:1), pins at least 40px, map labels at least 16px with a solid background. |
| No caller details | No names, phone numbers, or raw call IDs are shown. Transcripts appear only on the detail page, only to signed-in users with access to the region. |
| No safety advice or repair promises | No screen says water is safe or unsafe, when something will be fixed, or who will fix it. "Passed on" is described as a recorded step only. |
| `unknown` is honest | Shown as "Unknown" in neutral grey with no severity styling. It adds no points and never uses red or yellow. |
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
| `common.denied` | You don't have permission to do that. |
| `common.unknown` | Unknown |
| `common.unverified` | Unverified |
| `common.needsReview` | Needs review |
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
| Long lists | Paginated (P1-3 adds filters and search). Until then show the first 50 with "Showing {n} of {total}" (`list.showing`). |
| Priority | Number plus reason, for example "7: broken, serves school, 3 reports" (`list.priorityReason`). The reason comes from the data, not invented in the UI. |

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
| Denied (other region or organization) | "You can't view this complaint." (`detail.denied`). Gives no hint that it exists. |
| Not found | "This complaint was not found." (`detail.notFound`) |
| Needs review | Banner: "Needs review: the system couldn't match this to a water point with confidence." (`detail.needsReviewBanner`) |
| Unverified | Banner: "This water point has not been verified yet." (`detail.unverifiedBanner`) |
| Viewer | Status controls and note box are not rendered. The server still refuses any attempt. |
| Status change | Confirm dialog: "Change status to {status}?" (`detail.confirmStatus`), buttons "Confirm" and "Cancel". |
| Pass on (note field) | "Who is it passed to?" (`detail.passedOnTo`). This records a step only. Nothing is sent. Helper text: "This records the hand-off. It does not send a message." (`detail.passedOnHelp`) |
| Fixed | Button "Mark fixed" (`detail.markFixed`). After fixing, "Reopen" is available (`detail.reopen`). |
| Save failed | "Your change was not saved. Please try again." (`detail.saveFailed`). The screen keeps the user's text. |
| Copy summary | Button "Copy summary" (`detail.copySummary`), confirmation "Copied" (`detail.copied`). The summary contains water point, location, problem, people affected, duration, priority reason, status. No caller details. |

### SCREEN: Map
**WHO SEES IT:** Viewer, Responder, Org Admin. **MAIN ACTION:** Click a pin to open its complaint (P1, MP-7).
**SHOWS FIRST:** All water points with coordinates in the user's regions, plus a legend.
**PINS:** Shape and label together. Open = red circle "Open", passed on = red or yellow diamond "Passed on", fixed = green check "Fixed". Red or yellow follows the problem rule in the spec section 7. Unverified = dashed outline with "Unverified". The legend lists every shape and word.
| State | Wording (key) |
|---|---|
| Loading | `common.loading` over the empty map |
| Empty | "No water points with a location yet." (`map.empty`) with a link to the Needs location list |
| Error | `common.error`. If only the tiles fail: "The map background could not load. Water points are still listed below." (`map.tilesFailed`) |
| Denied | `common.denied` |
| Live update | The map updates without refresh. When a pin changes, its label briefly gets an "Updated" tag (`map.updated`). |
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

### SCREEN: Needs location list
**WHO SEES IT:** Viewer (read-only), Responder, Org Admin. **MAIN ACTION:** Place a pin (Responder and Org Admin, P1-1). Until P1-1, the main action is to open the complaint.
**SHOWS FIRST:** Water points that have a description but no coordinates, with the spoken location text.
| State | Wording (key) |
|---|---|
| Loading | `common.loading` |
| Empty | "Every water point has a location." (`location.empty`) |
| Error | `common.error` with `common.retry` |
| Denied | `common.denied` |
| Row | Water point, spoken location text, report count, "Unverified" badge if so. |
| Pin action (P1-1) | Button "Place pin" (`location.placePin`). Hidden for Viewers, and the server still refuses. |

### COMPONENT: "Last report received" indicator
**WHO SEES IT:** Everyone signed in, on the dashboard header and map. **PURPOSE:** Makes a gap visible if calls stop arriving (spec section 10).
| State | Wording (key) |
|---|---|
| Loading | "Checking for reports…" (`lastReport.loading`) |
| Normal | "Last report received {time ago}" (`lastReport.ago`), with the exact time on hover or focus. |
| Empty (none ever) | "No reports received yet." (`lastReport.none`) |
| Stale | After a configured number of hours (the threshold is configuration, value unknown): "Last report received {time ago}. If you expected more, check that the phone line is working." (`lastReport.stale`). A warning icon plus text, not color alone. |
| Error | "Couldn't check for new reports." (`lastReport.error`) |
| Live | Updates without refresh. |

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
3. **Stale threshold:** the number of hours before "last report received" warns is unknown. It must live in configuration.
4. **Needs review reasons:** the exact reason values are unknown until the contracts exist.
5. **Score reason format:** whether the backend returns a ready-made sentence or parts is unknown.
6. **Spoken wording:** the words said on the call belong to the Phone / AI Prompter and are not set here.
7. **Not yet checked:** this file has not been checked on a projector, on a phone, or as each role, because no screens exist yet. The UX checklist runs at build review.
