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
