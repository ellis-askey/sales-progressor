# Reminders Tab

The Reminders tab shows every active reminder for this file — all the chases that are due, overdue, or escalated, along with those that are still within their grace period. It also shows the history of chases already sent.

## What is a reminder?

Each milestone has an associated reminder rule. When a milestone becomes Available (unlocked and not yet complete), its reminder clock starts. After the grace period passes, the reminder becomes active — meaning it appears in the Work Queue and in this tab, signalling that you should chase.

See [How the reminder system works](../04-reminders-and-chasing/how-reminders-work.md) for the full explanation.

## Reminder states

| State | Meaning |
|---|---|
| **Within grace period** | The milestone just became available. No chase needed yet. |
| **Due today** | Today is the chase date. |
| **Overdue** | The chase date has passed and the milestone is still incomplete. |
| **Escalated** | The chase has repeated multiple times and crossed the escalation threshold. |
| **Snoozed** | You've deferred this chase to a later date. |
| **Resolved** | The milestone was marked complete and the reminder is now inactive. |

## Actions on a reminder

For each active reminder you can:

**Generate a chase email** — Click "Chase" to generate a draft email addressed to the relevant party (solicitor or client). The system uses AI to draft a message based on the milestone context. Review it, edit if needed, and send.

**Mark the milestone complete** — If you've just received confirmation on the phone, click through to the milestone and mark it complete directly from this tab.

**Snooze** — If you know this milestone is genuinely waiting on something scheduled for a future date, snooze the reminder. This suppresses the chase until the snooze date.

**Add a note** — Record what happened (e.g. "Called Smith & Sons. They said they're waiting on the management pack. Chasing next Tuesday."). Notes appear in the [Activity tab](activity-tab.md).

## Chase history

Below the active reminders, the Reminders tab shows all chases previously sent for this file: the date, the recipient, the milestone it related to, and whether it was sent by email or logged manually.

## Related articles

- [How the reminder system works](../04-reminders-and-chasing/how-reminders-work.md)
- [Grace periods, repeats and escalation](../04-reminders-and-chasing/grace-repeats-escalation.md)
- [Generating chase emails](../04-reminders-and-chasing/chase-emails.md)
- [Work Queue](../01-running-your-pipeline/work-queue.md)
