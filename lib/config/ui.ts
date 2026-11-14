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
