# Chase Timeline — feature spec

**Status:** planned 2026-08-20, no code yet. Awaiting founder go on Phase 1.
**Owner:** Ellis. **Author:** planning session 2026-08-20.

## North star

A tab on each property file that is a **live map of everything the system is currently trying to get from other people**, showing what automation is handling itself and exactly where a human needs to step in. It is NOT an email history page. It merges the three existing chase tracks into one read-first view, organised by **thread** (what is being chased), not by email.

## The three tracks (verified)

| Track | Chases | State table | Sends recorded in | Cap → then |
|---|---|---|---|---|
| Client auto-chase | buyer/seller by email | `ClientChaseState` (per contact+milestone) | `OutboundEmailQueue` (`emailType:"CLIENT_CHASE"`) | 2 emails → hand to team |
| Solicitor auto-chase | the solicitor for confirmations | `SolicitorChaseState` (per side+milestone) | `OutboundMessage` (`solicitor-confirm/chase.ts`) | 2 → escalate to team |
| Manual chase | team/agent, after automation | `ChaseTask.manualChaseCount` | `OutboundMessage` (`isAutomated:false`) | N human chases → escalate to file owner |

The spine of every non-enquiry thread is one `ReminderLog` (exactly one per file+milestone) with its `ReminderRule` (timing knobs) and its `ChaseTask` (the actionable card + escalation state). See `docs/active/honest-chase-count/scope.md` for the auto-vs-manual counter split (`chaseCount` total, `manualChaseCount` human-only; escalation reads manual only).

## Verified findings (planning checks, 2026-08-20)

1. **Per-send records exist for all three tracks.** Client auto = `OutboundEmailQueue`; solicitor + manual = `OutboundMessage`. So the event assembler reads TWO tables and normalises. (Not one query.)
2. **Delivery signals differ by track.** `OutboundEmailQueue` (client auto) tracks `sentAt / deliveredAt / deferredAt / bouncedAt / blockedAt` — **no opens/clicks**. `OutboundMessage` (solicitor + manual) tracks `deliveredAt / openedAt / clickedAt`. So "opened" is only truthful for solicitor + manual sends; client auto-chases can honestly show delivered/bounced, not opened. (Mock correction: the "Opened 11 Aug" on an auto-chase to the buyer is not available data today.)
3. **One client auto-chase email covers MANY milestones.** `assembleDigestPayload` bundles `milestones[]` into one email. So a single send appears on several threads and its delivery signal is shared across them. Threads must render "included in an auto-chase on {date}", not imply a per-thread email.
4. **Data volumes are healthy to build/test against.** Prod: 461 `ClientChaseState`, 569 `CLIENT_CHASE` queue rows, 11,514 chase `OutboundMessage`, 14 `SolicitorChaseState`. Staging: 16 / 13 / 223 / 20.
5. **Enquiries are a separate source.** Not a normal `ReminderLog` — driven by `EnquiryTracker` + `EnquiryRaiseChase`. Assembled separately (Phase 2).

## Thread summary (collapsed card — cheap load)

| Field | Source |
|---|---|
| Title | `ReminderRule.name` / milestone label |
| Waiting on | derived: client name / solicitor firm / "your team" |
| State chip | derived (see states) |
| Chased N× | `Auto ×(chaseCount − manualChaseCount) · You ×manualChaseCount` |
| Last chased | `ChaseTask.lastChasedAt` / latest send |
| Next chase | `ReminderLog.nextDueDate` + flag: auto-send vs reminder-for-you |
| Escalates | computed from `manualChaseCount`, `escalateAfterChases`, `graceDays`, `lastChasedAt` |
| Side colour | milestone side (vendor/purchaser) |

## Thread events (expanded — lazy load on open)

Normalised event `{ at, kind, actor, detail, delivery? }`:

| Event | Source |
|---|---|
| Scheduled | `ReminderLog.createdAt` + `nextDueDate`, `ReminderRule.graceDays`/anchor |
| Auto-chase #n (client) | `OutboundEmailQueue` CLIENT_CHASE + delivered/bounced |
| Auto-chase #n (solicitor) | `OutboundMessage` + `SolicitorChaseState` + delivered/opened |
| Handed to team | `ChaseTask.fallbackKind` / `ClientChaseState.status` + `statusReason` |
| Manual chase | `OutboundMessage` (`isAutomated:false`) + `manualChaseCount`/`lastChasedAt` + delivered/opened |
| Escalated | `ChaseTask.escalatedAt/By/Reason` |
| Snoozed | `ReminderLog.snoozedUntil` / `ClientChaseState` / `SolicitorChaseState.snoozeUntil` + `statusReason` |
| Resolved | `ReminderLog.status = completed` |
| Cancelled | `ReminderLog.status = cancelled` + `statusReason` (relist, reversed) |

## States

`scheduled → auto-chasing → handed to team → manual-chasing → escalated → resolved`, plus off-ramps `snoozed` and `cancelled`. All derivable from existing fields. **Read-only over existing data — no schema change for v1.**

## Overview stat cards

Active / Due today / Escalating / Completed — reuse the existing `lib/reminders/classify.ts` buckets. Do NOT reinvent the counting (the work queue already uses them).

## Architecture

- `getChaseTimelineSummary(txId, scope)` → `{ stats, threads[] }`, no per-send data. Multi-tenant via `scopeOwnershipWhere` (Law 7).
- `getChaseThreadEvents(reminderLogId, scope)` → `events[]`, called on thread open (progressive disclosure = also a data-loading boundary).
- Tab on the internal file view + agent file view. `ChaseThreadList` (left rail, collapsed) + `ChaseThreadDetail` (right, lazy). "Chase now" **reuses the existing chase drawer** — do not reimplement chase actions here (avoids drift with the work queue).

## Phasing

- **v1 — read-only, client + manual tracks.** Threads, states, expand-to-history, delivery signals (delivered/bounced for client auto; delivered/opened for manual). No director rung, no New chase, actions deep-link to the existing drawer. Delivers the whole "live map" value, zero schema change.
- **v2 — solicitor track + enquiries thread.** `SolicitorChaseState` (confirmed live) + enquiry-tracker source.
- **v3 — inline actions** (snooze/chase reusing existing services); then decide whether ad-hoc "New chase" is worth building.

## Cut from the mock for v1 (with reasons)

- **"Escalate to director" rung** — no such tier in code (escalation = `priority:escalated` + push to file owner). Rendering it would be a dead rung (Law 13). Show only real rungs.
- **"New chase" button** — chases are rule-driven (one per milestone); ad-hoc chase is a new concept, not wiring. Separate decision.
- **Inline reimplemented chase actions** — reuse the existing drawer, don't duplicate the work queue.
- **"Opened" on client auto-chases** — not tracked on `OutboundEmailQueue`; show delivered/bounced instead (or add open tracking to the client-chase queue as a separate enhancement).

## Open decisions for founder

- Do we want the director escalation rung to actually exist (a second escalation tier)? If yes, scope it separately before it appears on the timeline.
- Is ad-hoc "New chase" wanted, or is rule-driven enough?
- Add open-tracking to client auto-chases (so the buyer track can show opens like the mock), or accept delivered-only there?
