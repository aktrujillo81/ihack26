/**
 * UI configuration. Settings live here, not scattered through components
 * (spec section 5, rule 3; red line 10).
 */

/**
 * PROPOSED, NOT APPROVED. How long without a new report before the
 * "last report received" indicator shows its stale warning.
 *
 * 15 minutes suits a busy demo. A real pilot with few calls would need hours.
 * A human must decide the value (see docs/ux-screen-notes.md, section 5).
 */
export const LAST_REPORT_STALE_AFTER_MINUTES = 15;

/**
 * PROPOSED, NOT APPROVED. How many complaints the list shows before filters and
 * pagination exist (P1-3). A real page size is configuration and is unknown.
 */
export const COMPLAINT_LIST_PAGE_SIZE = 50;

/**
 * PROPOSED, NOT APPROVED. The most rows any list read returns, until real
 * pagination exists (P1-3). It keeps one huge list from hitting Postgres's
 * bind-parameter limit or loading everything into memory. A list longer than
 * this is cut off, silently, so the real value and a "showing the first N" notice
 * need a decision before the data can grow that large.
 */
export const DATA_LIST_HARD_LIMIT = 1000;

/**
 * PROVISIONAL, NOT APPROVED. Where a complaint's numeric priority score becomes
 * High, Medium or Low. The score is NOT 1 to 5: spec section 7 adds weights
 * (problem +3 or +1, school or clinic +3, people +1 or +2, duration +1 or +2,
 * extra reports up to +3), so it runs from about 1 to 13. The spec gives no
 * cutoffs for the words, so these are a proposal for the team to confirm:
 * High at 7 or more (for example no water + a school), Medium at 4 to 6, Low
 * below 4. Used only by `priorityLevel` in lib/domain/priority.ts.
 */
export const PRIORITY_HIGH_FROM_SCORE = 7;
export const PRIORITY_MEDIUM_FROM_SCORE = 4;

/**
 * PROPOSED, NOT APPROVED. How often the complaint list re-reads itself (D7,
 * smallest version: `router.refresh()` in the browser, no endpoint). The
 * contract's `GET /api/live` (6.7) is a larger design with a 5 second default
 * and is not built. Paused while the tab is hidden.
 */
export const LIST_REFRESH_SECONDS = 15;
