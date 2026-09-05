# Snooze reason + snooze-to-date

Status: built 2026-09-04, awaiting founder review on staging. No prior spec — scope
confirmed with founder in-session 2026-09-04.

## Problem

Snoozing a reminder recorded nothing: the agent forgets why they snoozed it, and
the rest of the team never sees it happened at all.

## What shipped

Snooze becomes "when should this come back, and why":

1. **Optional reason.** Every snooze can carry a short reason. It is stored on the
   reminder (rides on `ReminderLog.statusReason`, previously write-only audit) so it
   shows on the snoozed row, and it is posted as an internal note on the file's
   Activity tab so the whole team sees it.
2. **Snooze to a date.** Alongside the quick 24h/48h/72h/7-day gaps, an agent can
   pick a specific date; the reminder wakes at 06:00 UK that day. Same reason +
   activity note as the quick path. Mechanically identical to a normal snooze.
3. **Always logged.** Whether or not a reason is given, the snooze itself is posted
   to Activity (`Snoozed "X" until 5 Sep.` / `... N reminders until 5 Sep: ...`) so
   the snooze is no longer invisible.

## Decisions (founder, 2026-09-04)

- Reason is **optional** (no friction on a quick snooze).
- "Snooze all" applies **one shared reason** and writes **one combined** note.
- Reason shows on the snoozed row **and** the Activity tab.
- Rolled out to **all three** snooze surfaces (Reminders page rows, Snooze all,
  file-tab Reminders).

## Implementation

- No migration. Reuses `statusReason` (cleared on wake in `wakeUpReminderLog` +
  `chaseNowFromLogAction` so it can't go stale) and the existing internal-note
  helper `createCommunicationRecord({ type: "internal_note" })`.
- `lib/services/reminders.ts` — `snoozeReminderLog(taskId, wake, reason, scope)`
  now takes a wake-spec (`{ hours }` or `{ untilISO }`) + reason, returns the
  milestone name + wake date for the note.
- `app/actions/tasks.ts` — `snoozeTaskAction(taskId, opts, path)` (single) and new
  `snoozeManyAction(taskIds, opts, path)` (bulk, one combined note). `logSnoozeNote`
  helper is best-effort (a note failure never blocks the snooze).
- `components/reminders/SnoozeMenu.tsx` — one shared popover (quick gaps + date +
  optional reason), replaces the three bespoke menus in `AgentRemindersList` and
  `RemindersSection`. Flip-above/below positioning; tracks its own content ref so
  typing in the reason box doesn't dismiss it.
- Reason rendered on snoozed rows: `RemindersSection` (file tab) inline, and
  `ReminderCard` (Reminders page snoozed view) under the Wakes banner.

## Not in scope

- `ReminderCard`'s own active-mode quick dropdown (only rendered on demo/test pages)
  and the legacy `WorkQueue.tsx` / `/api/reminders/tasks` path keep quick-gap snooze;
  they pass the reason through when present but have no reason UI.
