# Honest chase count — scope

**Status:** in progress
**Opened:** 2026-05-28
**Owner:** Ellis

## The problem in one sentence

Today the chase counter ticks up every few days on its own, regardless of whether anyone actually chased anyone — so "Chased 2×, Escalated" can appear on a file where nothing has happened.

## What we're changing

`ChaseTask.chaseCount` will only increment when a chase has genuinely happened — either someone clicked the Chased button, or the system actually sent a chase email. Dormant files sit in "Overdue" with a growing days-overdue counter and never escalate on their own.

Escalation only kicks in when both:
1. The file has been chased the required number of times for real
2. Another full chase interval has passed since the last real chase, with no resolution

## Decisions locked in

- **Automated client-chase digest counts as a chase from the agent's POV.** When the digest cron sends a real email, it bumps the agent-side `ChaseTask.chaseCount` too.
- **Backfill on rollout.** We accept a brief window of inconsistency between deploy and backfill completing.
- **No new persisted `overdueIntervals` field.** Derivable on the fly from `daysOverdue / repeatEveryDays`.

## Schema delta

Add `lastChasedAt DateTime?` to `ChaseTask`.

## Behaviour changes

- Remove calendar-tick increment block from `runReminderEngine` (lib/services/reminders.ts ~L480-498)
- Add escalation evaluation pass: `where chaseCount >= rule.escalateAfterChases AND lastChasedAt + repeatEveryDays < now AND priority != 'escalated'` → flip to escalated + fire push
- Update every chase increment path to set `lastChasedAt = now`:
  - `advanceChaseTask` (Chased button on reminders list)
  - `recordManualChaseAction` (manual chase from drawer)
  - Any drawer "send email" path that increments chaseCount
  - Client-chase digest cron (NEW link to ChaseTask)
- Backfill `chaseCount` and `lastChasedAt` from `OutboundMessage` records on rollout

## Out of scope

- Engagement-resets-the-loop semantics on the agent side (that's a client-chase concept)
- Any change to `ClientChaseState` schema or behaviour
- UI redesign of the reminders list

## Risks

- Brief inconsistency window between deploy and backfill — minutes only
- Tying client-chase digest to ChaseTask creates a new coupling point
- Escalation rate drops — intended outcome but might feel quiet at first

## Verification

- `npx tsc --noEmit` clean
- `scripts/verify-b6.ts` and `scripts/verify-b7.ts` rewritten + passing against new contract
- Manual walk on a real staging file: dormant file does NOT escalate; chased-twice-then-cycle file DOES
