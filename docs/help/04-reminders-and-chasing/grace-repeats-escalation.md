# Grace Periods, Repeats, and Escalation

Each reminder rule has three timing parameters. Understanding them helps you interpret what you see in the Work Queue and when to expect reminders to appear.

## Grace period

The **grace period** is the number of days after a milestone becomes Available before the first chase is shown. During this window, the reminder is silent.

Grace periods vary by milestone and reflect realistic timelines:

| Milestone type | Typical grace period |
|---|---|
| Solicitor instruction / MOS received | 1–2 days |
| Administrative steps (ID, forms, searches) | 3–5 days |
| Enquiry responses | 2–5 days |
| Mortgage offer (from valuation) | 14 days |
| Search results (from order) | 21 days |
| Management pack (from request) | 21 days |
| Exchange-readiness milestones (VM18, PM25) | 2 days |

The short grace periods for exchange-readiness milestones reflect how important it is to keep momentum at the end of a transaction.

## Repeat interval

Once the grace period has expired and the first chase is due, the reminder repeats every **repeat interval** days if the milestone remains incomplete.

For most milestones this is 3–5 days. For management packs and search results (where delays are out of your control), the repeat interval is longer — 7–10 days.

## Escalation threshold

Each reminder has an **escalation threshold** — the number of chases that must be sent before the reminder is flagged as Escalated.

Most milestones escalate after 3 chases. Exchange-readiness milestones escalate after 2. The earliest milestones (solicitor instruction, MOS) escalate after 2.

Once escalated, the reminder turns red in the Work Queue. It remains escalated until the milestone is marked complete.

## The full timing example

VM9 (management pack received — leasehold) has:
- Grace period: 21 days after VM8 (management pack requested)
- Repeat interval: 7 days
- Escalation after: 2 chases

Timeline:
1. Day 0: VM8 marked complete. VM9 becomes Available. 21-day clock starts.
2. Day 21: First chase due. Appears in Work Queue.
3. Day 28: If still incomplete, second chase due. Appears again.
4. Day 35: Third chase due — but escalation threshold is 2, so after the second chase (day 28) the reminder escalates to red.

## Snoozed reminders

You can snooze a reminder to defer the next chase to a specific date. Snoozing is useful when you know the party is waiting on something with a known ETA (e.g. "searches will be back in 2 weeks"). Once the snooze date arrives, the reminder reactivates.

## Related articles

- [How the reminder system works](how-reminders-work.md)
- [Generating chase emails](chase-emails.md)
- [Reminders tab](../02-property-file/reminders-tab.md)
