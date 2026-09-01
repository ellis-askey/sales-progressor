// Single source of truth for the enquiries chase cadence. Shared by the cron
// that actually sends the nudges (lib/enquiries/chase.ts) and the file panel's
// "we'll chase again on …" display (lib/enquiries/tracker.ts), so the date the
// agent sees always matches when the nudge really fires. These used to be two
// separate literals (7 in the cron, 9 in the panel), which showed the wrong day.
export const ENQUIRY_CHASE_WORKING_DAYS = 7; // nudge cadence
export const ENQUIRY_ESCALATE_WORKING_DAYS = 13; // ~2.5 weeks of silence -> hand to a human
