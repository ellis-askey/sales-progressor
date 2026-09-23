// Single source of truth for the enquiries chase cadence. Shared by the cron that
// actually sends the nudges (lib/enquiries/chase.ts), the file panel + hero, and
// the triage page's "we'll chase again on …" display, so the date the agent sees
// always matches when the nudge really fires.
//
// Cadence (working days of silence since the last reply/movement; working days are
// Mon–Fri excluding England & Wales bank holidays — see lib/emails/working-hours):
//   - first chase after 6 working days,
//   - then again every 5 working days,
//   - escalate to the hub (+ flag the owner) after 13 working days, and STOP the
//     auto-chases at that point — it's a human's job in the hub drawer from then on.
export const ENQUIRY_FIRST_CHASE_WORKING_DAYS = 6;
export const ENQUIRY_REPEAT_CHASE_WORKING_DAYS = 5;
export const ENQUIRY_ESCALATE_WORKING_DAYS = 13;
