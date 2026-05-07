# How the Reminder System Works

Every milestone in Sales Progressor has an associated reminder rule. When a milestone becomes Available (unlocked and not yet complete), that rule starts running in the background — tracking whether the milestone is completed within the expected timeframe and escalating if it isn't.

## The lifecycle of a reminder

### 1. Milestone becomes Available

The moment a milestone becomes Available — either at file creation (for milestones with no predecessor) or when a predecessor is marked complete — its reminder clock starts.

### 2. Grace period

Every reminder rule has a **grace period** (measured in days). During this period, the reminder is silent — no chase is shown in the Work Queue, and nothing appears in the Reminders tab. The grace period reflects the realistic time it should take for a given step to happen after the preceding one.

For example, VM3 (seller's welcome pack received) has a 3-day grace period after VM1. If you mark VM1 complete on Monday, the reminder for VM3 doesn't become active until Thursday.

### 3. First chase

When the grace period expires, the reminder becomes active and appears in:
- The **Work Queue** (prioritised by urgency)
- The **Reminders tab** of the file
- The **Hub** "Needs your attention" section (top 3)

This is the signal to chase. Generate a chase email or make a phone call.

### 4. Repeat chases

If the milestone is still not complete after the first chase, the reminder repeats. Each rule has a **repeat interval** (measured in days) — how many days pass before the next chase is shown.

For example, VM5 has a repeat interval of 3 days. If you chase on Monday and the milestone still isn't complete, the next chase appears Thursday.

### 5. Escalation

If a milestone has been chased a certain number of times without being completed, it is **escalated**. Escalation is shown with a red badge in the Work Queue and on the Hub. The escalation threshold is set per milestone.

An escalated reminder signals that a routine email chase has not worked — it's time for a phone call, or to escalate the chase to a more senior person in the relevant firm.

### 6. Resolution

When the milestone is marked Complete, the reminder is automatically resolved and disappears from the Work Queue and Reminders tab. The chase history (how many chases were sent, when) is preserved in the [Activity tab](../02-property-file/activity-tab.md).

## Anchor-based timing

Most reminders start their grace period clock from the moment the predecessor milestone is completed ("relative" timing). A few use **event dates** — for example, PM10 (survey report received) uses the actual date the survey was booked (entered when you mark PM9 complete) rather than counting from file creation. This makes the timing more accurate for events with a known date.

## Related articles

- [Grace periods, repeats and escalation](grace-repeats-escalation.md)
- [Reminders tab](../02-property-file/reminders-tab.md)
- [Work Queue](../01-running-your-pipeline/work-queue.md)
- [Generating chase emails](chase-emails.md)
