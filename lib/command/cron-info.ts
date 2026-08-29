// Plain-English descriptions + grouping for the scheduled jobs on the System
// status page. Keyed by the job name (the last segment of the cron path in
// vercel.json). Keep each description to one jargon-free sentence a founder
// would understand. If a job is added to vercel.json without an entry here, the
// page falls back to the raw name with no description.

export type CronGroup =
  | "Analytics & insights"
  | "Chasing & reminders"
  | "Emails & digests"
  | "Billing & payments"
  | "Housekeeping & safety nets"
  | "Integrations";

export const CRON_GROUP_ORDER: CronGroup[] = [
  "Chasing & reminders",
  "Emails & digests",
  "Billing & payments",
  "Analytics & insights",
  "Housekeeping & safety nets",
  "Integrations",
];

export type CronInfo = { label: string; desc: string; group: CronGroup };

export const CRON_INFO: Record<string, CronInfo> = {
  // Chasing & reminders
  run:                   { label: "Reminder engine",        group: "Chasing & reminders", desc: "Sends staff their due task and follow-up reminders each morning." },
  "enquiries-chase":     { label: "Enquiries reply chase",  group: "Chasing & reminders", desc: "Weekdays: chases whoever owes a reply on open enquiries, escalating after three weeks of silence." },
  "enquiries-raise-chase": { label: "Enquiries raise chase", group: "Chasing & reminders", desc: "Weekdays: nudges the buyer's side to actually raise their enquiries, escalating to staff if slow." },
  "client-chase":        { label: "Client chase",           group: "Chasing & reminders", desc: "Daily: queues chase emails to clients who owe information, escalating after repeated silence." },
  "solicitor-chase":     { label: "Solicitor chase",        group: "Chasing & reminders", desc: "Weekdays: reminds solicitors to confirm overdue steps, escalating to the assigned agent if ignored." },
  "chain-invite-nudge":  { label: "Chain-invite nudge",     group: "Chasing & reminders", desc: "Weekday mornings: a one-time reminder to chain members who got an invite but never opened it." },

  // Emails & digests
  "morning-digest":      { label: "Agent morning digest",   group: "Emails & digests", desc: "Weekday mornings: emails staff their daily summary and alerts owners about upcoming exchanges and expiring mortgage offers." },
  "agent-weekly-brief":  { label: "Agent weekly brief",     group: "Emails & digests", desc: "Mondays: emails each branch a summary of the past week's progress." },
  "client-weekly-update": { label: "Client weekly update",  group: "Emails & digests", desc: "Saturdays: emails clients a weekly update on how their sale or purchase is going." },
  "retention-sweep":     { label: "Retention emails",       group: "Emails & digests", desc: "Daily: sends follow-up emails to eligible dormant or past contacts." },
  "send-milestone-digests": { label: "Milestone digests",  group: "Emails & digests", desc: "Every few minutes: sends milestone-update emails, bundling several updates to one person into one email." },
  "exchange-day-emails": { label: "Exchange-day emails",    group: "Emails & digests", desc: "Every 15 minutes on workdays: sends the timed exchange-day emails to solicitors and clients." },
  "drain-outbound-email": { label: "Outbound email sender", group: "Emails & digests", desc: "Hourly: actually sends the queued emails that were scheduled and are now due." },
  "drain-chain-neighbour-updates": { label: "Chain update emails", group: "Emails & digests", desc: "Every 10 minutes: sends batched update emails to neighbours in a chain about recent confirmations." },
  "drain-withdrawal-notifications": { label: "Withdrawal notices", group: "Emails & digests", desc: "Hourly backstop: sends any chain-collapse notifications that failed, and nudges agents waiting too long." },

  // Billing & payments
  "accrue-invoices":     { label: "Invoice accrual",        group: "Billing & payments", desc: "Daily: adds this month's exchange charges to each agency's running invoice." },
  "issue-invoices":      { label: "Monthly invoicing",      group: "Billing & payments", desc: "First of the month: finalises the previous month's invoices and charges agencies via Stripe." },
  "check-failed-payments": { label: "Failed-payment check", group: "Billing & payments", desc: "Daily: blocks new file creation for agencies whose payment failed and stayed unpaid past a seven-day grace." },

  // Analytics & insights
  "rollup-metrics":      { label: "Metrics rollup",         group: "Analytics & insights", desc: "Nightly: crunches yesterday's numbers and recent weekly figures into the reporting dashboards." },
  signals:               { label: "Signal detectors",      group: "Analytics & insights", desc: "Nightly: runs detectors that spot notable trends and events for the briefings." },
  "daily-brief":         { label: "Daily brief",            group: "Analytics & insights", desc: "Each morning: generates the daily insights brief from the freshly detected signals." },
  "weekly-review":       { label: "Weekly review",          group: "Analytics & insights", desc: "Mondays: generates the weekly performance review summary." },
  "detect-problems":     { label: "Problem detection",      group: "Analytics & insights", desc: "Nightly: scans all live files for warning signs and flags at-risk sales for staff." },
  "medians-ready-check": { label: "Timing-data check",      group: "Analytics & insights", desc: "Daily: checks if enough real completion data has built up, then suggests updated timing estimates." },
  "backfill-mode-profile": { label: "Mode-profile backfill", group: "Analytics & insights", desc: "Fills in missing agency profile data so newer features have what they need." },

  // Housekeeping & safety nets
  "completion-safety-net": { label: "Completion safety net", group: "Housekeeping & safety nets", desc: "Nightly safety check: marks any finished sale still wrongly showing as active as completed." },
  "check-domains":       { label: "Email domain check",     group: "Housekeeping & safety nets", desc: "Nightly: verifies each agency's email-sending domain still works and warns them if it broke." },
  "quote-requests-maintenance": { label: "Quote-request upkeep", group: "Housekeeping & safety nets", desc: "Nightly: expires old unanswered quote requests and wipes personal details from ones over a year old." },
  "data-retention":      { label: "Data retention",         group: "Housekeeping & safety nets", desc: "Weekly: anonymises personal details of long-inactive users to comply with data-protection rules." },
  "file-time-close":     { label: "File-timer cleanup",     group: "Housekeeping & safety nets", desc: "Closes staff file-viewing timers left open when a browser dropped, saving the real time spent." },
  "portal-time-close":   { label: "Portal-timer cleanup",   group: "Housekeeping & safety nets", desc: "Closes client portal-viewing timers abandoned without a clean exit, saving the real time spent." },
  "demo-cleanup":        { label: "Demo cleanup",           group: "Housekeeping & safety nets", desc: "Deletes expired demo sample sales about a week after they were created." },

  // Integrations
  "outlook-sync":        { label: "Outlook sync",           group: "Integrations", desc: "Hourly on workdays: pulls in connected Outlook mailboxes so email replies attach to the right file." },
};

export function cronInfo(name: string): CronInfo {
  return CRON_INFO[name] ?? { label: name, desc: "", group: "Housekeeping & safety nets" };
}
