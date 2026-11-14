/**
 * Input limits for complaint actions and their forms. Settings live here, not
 * scattered through code (red line 10). Client-safe.
 *
 * PROPOSED, NOT APPROVED: the real limits are unknown.
 */
export const MAX_COMPLAINT_ID_LENGTH = 100;
export const MAX_NOTE_LENGTH = 1000;
/** "Who is it passed to?" (free text until the partner directory exists, P1-2). */
export const MAX_PASSED_ON_TO_LENGTH = 200;
export const MAX_TICKET_LOCATION_LENGTH = 500;
export const MAX_TICKET_ISSUE_LENGTH = 1000;
export const MAX_TICKET_NOTES_LENGTH = 4000;
