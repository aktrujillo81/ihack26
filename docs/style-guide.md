# Well Watch UI Style Guide

Every agent and person building or changing UI reads this first and runs the checklist in section 13 before opening a PR.

- **Visual source of truth:** the design canvas, https://claude.ai/artifact/5EAsyy3BkyoVcuBwnXXn5c (boards: Operations console, Complaint detail, Needs review, Foundations). If the canvas and this guide disagree, tell the Orchestrator; don't guess.
- **Tokens:** `app/tokens.css` (CSS variables, prefix `--ww-`). Use the variables. No raw hex, px font sizes or radii in components.
- **Spec wins.** If this guide conflicts with `docs/spec.md` or the red lines, follow the spec and flag the guide.

## 1. Principles
1. **Quiet and exact.** An operations console, not a marketing page. Flat surfaces, hairline borders, one accent, no gradients, no emoji, no decorative effects. The only shadow allowed is the card hairline (`--ww-shadow-card`); never use blur, glow or elevation on anything else.
2. **Readable at a glance, and on a projector.** Large enough type, strong contrast, labels always visible.
3. **Never color alone.** Every status, priority and map pin carries a word and a shape as well as a color.
4. **No caller details, ever.** No names, phone numbers or raw identifiers in any UI, mock, log or screenshot.
5. **No safety advice, no repair promises.** Text states what is known ("Reported 12 minutes ago"), never what will happen or what people should do about water.
6. **Every user-facing string lives in `lib/i18n/strings.ts`.** No literal text in components.
7. **Data comes through `lib/data/complaints.ts` and permissions through the matrix and `requireActionInScope`.** UI never decides authorization by hiding a button alone.

## 2. Color
All values are in `app/tokens.css`. Ratios below were calculated against the stated background.

| Role | Token | Value | Notes |
|---|---|---|---|
| Body text | `--ww-ink` | `#0E1A2B` | 17.5:1 on panel |
| Secondary text | `--ww-ink-2` | `#3B4858` | 9.3:1 |
| Tertiary text, meta | `--ww-ink-3` | `#5A6676` | 5.8:1 on panel, 5.4:1 on ground. Never lighter. |
| Accent, links, primary button | `--ww-accent` | `#0B5CAD` | 6.7:1; white on accent 6.7:1 |
| Page background | `--ww-ground` | `#F4F6F8` | |
| Card, table, input | `--ww-panel` | `#FFFFFF` | |
| Control border | `--ww-control-border` | `#8794A5` | 3.1:1, used on inputs and buttons |
| Divider | `--ww-divider` | `#D8DEE6` | decorative only |
| Navigation | `--ww-nav` | `#0B1626` | text 12.0:1, muted 6.8:1, white on active item 14.3:1 |
| Focus ring | `--ww-focus` | `#0B5CAD` | 3px outline, 2px offset, on every interactive element |

Rules:
- One accent. The primary button, links, focus ring and selected states use it. Nothing else is blue.
- Any new color pair needs a contrast check (4.5:1 for text, 3:1 for icons and large text, aim higher on the map). Record the numbers in the PR. Never claim a ratio you did not calculate.
- No dark mode in this build.

## 3. Status system
Each status has a fixed word, shape and color, used the same way in the list, detail, map and legend.

| Status | Word | Shape | Icon | Chip fill / border / text | Meaning |
|---|---|---|---|---|---|
| Open | Open | Filled circle | `--ww-open-icon` | `-bg` / `-border` / `-text` | Reported, not passed on |
| Passed on | Passed on | Filled triangle | `--ww-passed-icon` | same pattern | Handed to a partner |
| Fixed | Fixed | Filled square | `--ww-fixed-icon` | same pattern | Closed by staff |
| Unknown | Unknown / Unverified | Hollow dashed diamond | `--ww-unknown-icon` | same pattern, dashed border | Not verified |

Contrast (icon on chip / text on chip): Open 5.3 / 8.9, Passed on 4.0 / 7.8, Fixed 4.7 / 8.3, Unknown 5.1 / 8.2.

- A **status chip** is: 12px shape + word, 13px/600, padding `3px 10px 3px 8px`, 1px border, radius 6px. Text uses the dark `-text` token, never the icon color.
- An unknown or unrecognized status value always shows as Unknown, never blank.
- **Needs review** and **Needs location** are flags, not statuses: neutral outlined tag (1px `--ww-control-border`, 12px/600, radius 6px) with a small icon (flag, map pin) and the word.

## 4. Priority
Three bars of rising height plus the word High / Medium / Low. Filled bars `--ww-bar-on`, empty `--ww-bar-off`. High = 3 filled, Medium = 2, Low = 1. The word is always present. Priority never uses status colors.

## 5. Typography
- **IBM Plex Sans** for UI, **IBM Plex Mono** for identifiers, coordinates and the copyable summary. Load through the app's font mechanism with the system stack as fallback; no runtime dependency that can fail offline during the demo.
- Weights: 400, 500, 600. 600 for titles, section titles, table titles and chip words; 500 for labels and buttons.
- Scale (`--ww-text-*`): page title 26/1.2/600; section 16/600; body 15/1.5; label 14/500; meta 13; micro 12 (chips in rows, attribution only); stat number 30/600 with `font-variant-numeric: tabular-nums`.
- Numbers in tables and tiles use tabular numerals. Identifiers (WP-0142) are mono 13px.
- Nothing under 12px. No all-caps. Sentence case everywhere.

## 6. Layout and spacing
- Spacing scale 4, 8, 12, 16, 20, 24, 32. No other values.
- Shell: fixed 248px navigation on the left, content to the right with padding `28px 32px 40px`. The shell wraps on narrow screens (navigation stacks above content). Page content uses `flex-wrap`, `min-width: 0`, and tables sit in an `overflow-x: auto` box with a minimum width.
- Cards: white, 1px divider border, radius 12, padding 20. Stat tiles: radius 10, padding 16 by 20. Controls: height 40, radius 8. Chips: radius 6.
- Page header: title and one-line description on the left; sample-data tag, live indicator and last-report card on the right.
- Targets: icon-only controls at least 40px, aim for 44px; at least 8px between controls.

## 7. Components

**Navigation.** Dark rail. Items are links with a 20px icon, label and optional count badge (mono 13px on `--ww-nav-badge`). The current page uses `aria-current="page"` and `--ww-nav-active`. Items shown depend on the permission matrix, and the route is also checked server-side. Role shown at the bottom, with an icon-only Sign out (`aria-label`).

**Stat tile.** Label with shape, number (30px), one-line caption. Captions describe a state ("Awaiting action"), never a promise.

**Table.** Header row on `--ww-ground`, 13px/600, sort buttons with an arrow icon on the active column. Rows are real links with a visible focus ring, 14px 20px padding, soft divider, hover `--ww-row-hover`, selected `--ww-row-selected`. Columns on the main list: Water point (type + mono ID + flags), Status, Priority, Reports, Last report. List rows never show transcripts or spoken location text.

**Buttons.** Primary (accent fill, white text, one per view), secondary (white, control border), ghost (accent text). 40px high, 14px/500. Disabled buttons are avoided; leave enabled and respond with an explanation.

**Inputs.** Visible label above every field (13px/500), or `aria-label` on a compact toolbar search. 40px high, control border, radius 8, 3px accent focus ring.

**Segmented control.** Joined buttons with `aria-pressed`; the active segment is ink fill with white text.

**Map.** See section 8.

**States** (one component each: icon or skeleton, short title, one plain sentence, an action when there is one). Wording comes from `docs/ux-screen-notes.md`:
- Loading: skeleton bars, no spinner-only state.
- Empty: invitation, not an apology ("No complaints yet. New reports appear here.").
- Error: what happened, then a Try again button. A failed refresh keeps the data on screen and shows the error beside it.
- Denied and not-found use the identical message and layout.

**Live indicator and last report.** "Live · updated N seconds ago" with a refresh icon, and the last-report card with a clock icon, the relative time, and a word chip: Recent, Stale or No reports yet. The stale threshold is the `LAST_REPORT_STALE_AFTER_MINUTES` constant. Updates never steal focus or scroll position.

## 8. Map
- Pins: 30px, concentric outline (ink ring, white ring, colored fill) in the status shape. A selected pin gets a 2px accent ring.
- Every pin has an always-visible label chip next to it: white, 1px control border, radius 6, 15px/600, "Type · Status". Nothing is hover-only. For the projector view raise labels to 20px and pins to 36px.
- A legend (shape + word) is always visible below or beside the map. The map always has a text list alternative (the table).
- Zoom controls 40px in a bordered group, a scale bar, and attribution as the tile provider requires.
- Basemap: muted land, pale water, white roads; never saturated. Tile source must pass the OpenStreetMap usage policy check or use a licensed or keyed provider; otherwise fall back to the plain background with all pins and the text list.
- The public view (if it ever ships) is status only and colors by status only.

## 9. Screens (see the canvas boards)
- **Operations console (Complaints):** header, four summary tiles, table with segmented status filter, region button, density toggle and search, and the map panel with legend.
- **Complaint detail:** breadcrumb; title with status and priority; actions (Copy summary, Pass on, Mark as fixed, role-aware); Summary card, Reports card (transcripts and spoken location, staff only), Timeline; right column Location (mini map, Verified tag), Copyable summary (leaves out transcripts, notes and caller details), Notes.
- **Needs review:** segmented Needs review / Needs location, table with Report, Reason (icon + word), Possible water points (mono chips), Reports, Last report.

## 10. Voice and wording
- Short, plain, literal. Say what is known, not what will happen.
- Never advise on water safety. Never promise a repair or a time.
- Verb-first buttons, 1 to 3 words. No "please", no "successfully", no exclamation marks, no jargon or raw enum values on screen.
- Errors say what happened and what to do next, without blaming the user.
- Times are relative ("12 minutes ago") with one shared formatting helper.

## 11. Accessibility baseline
- Usable by keyboard alone; visible focus on every interactive element.
- Semantic HTML first: headings in order, buttons are buttons, links are links, tables are tables. ARIA only where HTML cannot do it.
- Icon-only controls have `aria-label`; decorative icons are `aria-hidden`.
- Respect `prefers-reduced-motion`. No auto-playing animation.
- Page language attribute set so other languages can be added later.

## 12. Data and privacy in UI
- Lists never show transcripts. Detail shows them only to roles the matrix allows.
- Spoken location text is staff-only, on the authenticated detail page.
- Copyable summaries never include transcript text, notes or caller details.
- Mock and seed data contain no phone numbers, emails or names.

## 13. Before you open a UI PR
- [ ] Only tokens used; no raw hex, font sizes or radii outside `app/tokens.css`
- [ ] Every status, priority and pin has word + shape + color
- [ ] Map labels visible without hover; projector size works
- [ ] Contrast checked and recorded for any new color pair
- [ ] All text through `lib/i18n/strings.ts`; no safety advice or repair promises
- [ ] Loading, empty, error, needs-review and denied states done
- [ ] Keyboard-only walkthrough done; focus visible
- [ ] Data only through `lib/data/complaints.ts`; actions go through `requireActionInScope`
- [ ] No caller details anywhere (UI, mock, screenshot)
- [ ] Matches the canvas board for this screen; differences are listed in the PR

## 14. Known gaps (not yet in the design)
Real tile basemap and clustering, the public map view, bulk actions, keyboard shortcuts, a compact density mode, and the partner picker on pass-on. Add them to the canvas first, then to this guide.

## 15. Polish pass additions (match the canvas)
- **Card shadow:** `box-shadow: var(--ww-shadow-card)` (0 1px 2px rgba(14,26,43,.05)) on cards and panels, with the 1px divider border.
- **Titles:** page titles use `letter-spacing: -0.015em`, weight 600.
- **Brand tile:** 32px accent rounded square with a white droplet, beside "Well Watch" and the muted subtitle "Operations console".
- **User block:** circular initial avatar, role below the name, "Sign out" as a quiet text button.
- **Summary strip:** one bordered panel split into four equal cells (Open, Passed on, Fixed, Needs review), 32px numbers, label above in ink-3. Not four separate cards.
- **Complaints table:** grid `minmax(0,3.1fr) minmax(0,1.3fr) minmax(0,1.1fr) minmax(0,1.2fr) 20px`, min-width 660px, no text wrapping in cells (truncate with ellipsis), sortable headers, 3-bar priority plus word, pager footer ("Showing 8 of 24").
- **Filters:** segmented control (All / Open / Passed on / Fixed) with `aria-pressed`; search placeholder "Search water points".
- **Basemap:** muted land #ECEFED, parks #DCE8DF, river #CFE0EA with bank #BBD2E0, building footprints #DFE4E1, roads white with casings, street names along the path. Label chips sit beside pins on the side with free space. Real build: use a licensed tile provider; seeded or cached OSM tiles are not allowed. Keep the "Basemap placeholder" tag until then.
- **Sample data tag:** dashed-border "Sample data" tag in the header whenever data is not live.
