# Enquiries rework — deep downstream audit (second pass)

**Date:** 2026-08-14
**Trigger:** founder wants 100% confidence before prod go-live — "I don't want to be discovering things down the line or having clients come to me saying something doesn't make sense or is broken."
**Method:** six parallel specialist audit agents (milestone graph/state machine, client copy/emails, forecast/stats, reminders/chase, tracker integrity, UI surfaces). Every finding below was independently re-verified against source before landing here.

## Root cause (one sentence)
Almost every real defect below traces to a single thing: **VM21 (the new seller-side "all enquiries satisfied") is a derived reflection of PM20, but that coupling was only wired into the two happy-path confirm maps — not made an invariant.** So the paths that reverse, reset, backfill, or alternatively-confirm PM20 don't keep VM21 in step, and VM21 both blocks the seller exchange gate and carries weight 12.

---

## CRITICAL

### C1 — Solicitor "enquiries satisfied" completes PM20 but never VM21
`app/s/[token]/actions.ts` `solicitorEnquiriesSatisfiedAction` calls `completeMilestone(PM20)` directly. `completeMilestone` has **no** bilateral logic (only `maybeUnlockExchangeGate` + `syncEnquiryTracker`); the PM20→VM21 auto-complete lives only in `confirmMilestoneAction` (agent) and `portalCompleteMilestone` (portal). So on the **primary designed flow of the whole rework**, PM20 completes, the tracker closes, the seller gets the PM20 email — but VM21 stays incomplete. VM21 `blocksExchange=true`, so the seller exchange gate never clears; the seller's portal Enquiries group reads "1 of 2 done" forever with a stuck Confirm button. The code comment claims it "bilaterally completes VM21" — it does not. (Introduced this session.) Confirmed by all six agents + my own trace.

---

## HIGH

### H1 — Confirming PM20 rolls back entirely when VM10 isn't complete
The bilateral fires `completeMilestone(VM21)` inside the same transaction; VM21's prereq is VM10 (seller "received"). If VM10 isn't complete, the inner call throws `PREREQUISITES_NOT_COMPLETE`, rolling back **the whole transaction — PM20 never saves** — and returns a confusing error naming a seller-side step. New to the rework (VM21's prereq sits on the opposite side from the buyer-driven PM20). Affects the agent path too.

### H2 — VM21 survives a relist as "complete"
`RELIST_RESET_VM_CODES` = `VM2, VM7, VM10–VM20` — VM21 (numerically outside that range) is treated as preserved. On a relisted file the previous buyer's VM21 stays complete; because it's `blocksExchange`, the new buyer's seller exchange gate can open before their enquiries are ever raised.

### H3 — Undoing PM20 doesn't undo VM21 or reopen the tracker
`BILATERAL_UNDO_PAIRS` has only the exchange/completion pairs. Undo PM20 → VM21 left complete (12 weight still counted, gate still wrongly satisfied); `syncEnquiryTracker` never runs on undo so `closedAt` stays set. The undo-impact preview doesn't even list VM21.

### H4 — Backfill migration only touched `status='active'` files
`20260815240000` steps are gated on active status. An on_hold/withdrawn file already past enquiries (PM20 complete) got no VM21 row; nothing heals it (init only runs at file creation, PM20 won't re-fire). On reactivation VM21 is `locked` → gate blocked, no way to tick it. **Needs a DB check** on staging + prod for non-active files lacking a VM21 row.

### H5 — Enquiry chase cron ignores transaction status
`runEnquiryChaseCron` selects trackers `closedAt: null` with no join on `transaction.status`, and nothing closes the tracker when a file is withdrawn/paused. When the master switch is on, dead/paused files get chased and get the 15-day "stalled" escalation. (Latent while the switch is OFF.)

---

## MEDIUM

### M1 — Client portal timeline shows retired steps (CLIENT-FACING)
`getPortalTimeline` (`lib/services/portal.ts`) reads raw `state:'complete'` completions with no retired filter and no side filter. On a migrated in-flight file the buyer/seller sees phantom events ("Additional enquiries received", "Replies to further enquiries reviewed"). This is the one that reaches an external user.

### M2 — Clients can confirm PM20/VM21 ("all enquiries satisfied") from the portal
Neither code is in `PORTAL_AGENT_ONLY_CODES`, and (post-rework) both go "available" as soon as enquiries are *raised/received* — a wide early window. The portal offers a client a Confirm button (and possibly the headline next-action CTA) on their solicitor's legal sign-off; tapping it prematurely closes the loop and pushes the exchange gate. Both a "why am I asked this?" moment and an operational footgun.

### M3 — Agent activity feed + next-action show retired steps on migrated files
`getAgentMilestoneActivity` and `getFileSnapshots`/`nextAction` (`lib/services/agent.ts`) read raw completions/available rows without the retired filter — agent sees "Completed: Seller provided enquiry replies", or a retired code surfaced as the file's next step.

### M4 — Audit log shows retired steps
`getAuditLog` (`lib/services/audit.ts`) renders retired completions. **May be intentional** (audit = immutable history) — flagging the tension, not asserting a bug. Decision needed: hide, or document the exception.

### M5 — Command Settings + Admin config step tables list all 48 (incl. retired)
`app/command/(protected)/settings/page.tsx` and `app/admin/page.tsx` fetch all definitions unfiltered; header count reads 48 not 38, retired rows shown. Superadmin/admin only.

### M6 — Escalation + solicitor-update notifications aren't in the agent bell allowlist
`enquiries_stalled` and `solicitor_update` aren't in `BELL_NOTIFICATION_TYPES`, so on self-managed (agent-owned) files the stalled escalation and the new solicitor enquiries replies never surface in the bell (they do bump the SP bell for outsourced files). The `solicitor_update` gap pre-dates the rework; the new E2 action inherits it.

### M7 — API route `BILATERAL_PAIRS` missing PM20:VM21
`app/api/milestones/route.ts` — latent (no client currently hits this route), but the route is publicly mounted for "non-React callers" and the four-way map divergence is a trap.

---

## LOW
- **L1** `completedCount / 38` counts retired completes on legacy files (numerator includes retired, denominator excludes) → over-credits progress %. Pre-launch, few files.
- **L2** Enquiry escalation creates a `Notification`, not a `ChaseTask` — the header comment says "task for the file's owner". No work-queue item.
- **L3** A past/blank expected date snoozes nothing but the follow-on movement still resets the 9-day clock.
- **L4** Reconcile picker `CROSS_SIDE_PAIRS` still lists dead retired pairs and lacks VM21↔PM20 (inert; claim-time only).
- **L5** Dead copy/labels/email-skeletons for retired codes remain (harmless, filtered everywhere reachable).
- **L6** Reconciliation `BILATERAL_PAIRS` (milestones action :601) omits PM20:VM21 — non-issue (PM20 doesn't flow through the exchange/completion reconciliation sweep).

---

## Verified clean (explicitly checked, no action)
- No active milestone has a retired prerequisite (the "locked forever" check passes); PM20→PM14 and VM21→VM10 chains are all-active.
- Exchange gate reads `blocksExchange:true` from the DB; retired rows are `blocksExchange:false`+weight 0 so they neither block nor satisfy it; VM21 correctly a vendor blocker (set after its backfill, right ordering).
- Section/stage maps: every active code assigned to exactly one section on every surface; VM21 present in Steps tab + portal maps + ordered between VM10 and VM16; no retired code in any map.
- Email fan-out: each side hears once; PM20 doesn't double-email the seller; VM21 is correctly silent (progressor-only copy, not in `AUTO_COUNTERPART_OF`); no raw-code leak (every active code has copy).
- Forecast = 84 days = 12.0 weeks on freehold/mortgage and cash; both weight sides sum to 100; active count = 38; no enquiries duration double-count.
- No double-chase: enquiries codes are out of `solicitorCodesForSide` and their reminder rules are inactive; the tracker is the single chaser; `runEnquiryChaseCron` IS scheduled (`vercel.json`, weekdays 09:00) and gated by the master switch.
- Tracker open/close idempotency + double-close safe; FK cascade clean; closed tracker can't be mutated; agent + portal confirm paths keep PM20/VM21 in sync.
- Definition-driven UI surfaces all filter retired correctly (MilestonePanel is structurally section-gated).

---

## Resolution (all shipped to staging 2026-08-14, committed not pushed)
| # | Item | Fix | Commit |
|---|---|---|---|
| C1 | VM21 stranded on solicitor path | VM21 made a true invariant of PM20 inside `completeMilestone` (fires on every path); redundant per-caller maps removed; solicitor action wrapped in a transaction | `81480d7` |
| H1 | PM20 rollback when VM10 unticked | reflection bypasses VM21's prereq guard (`bypassPrereqs`) | `81480d7` |
| H2 | VM21 survives relist | added to `RELIST_RESET_VM_CODES` + mirror | `903f4d4` |
| H3 | Undo PM20 orphans VM21 | added to `BILATERAL_UNDO_PAIRS`; tracker reopens on undo of a close-code | `903f4d4` |
| H4 | Backfill skipped non-active files | migration `20260815270000` backfills VM21 = PM20 on all statuses, dated to PM20's `completedAt`; staging verified 2→0 | `1be1d44` |
| H5 | Chase ignores file status | enquiry cron filtered to active files; tracker closed on withdraw/complete, chase-clock reset on return-from-hold | `1be1d44` |
| M1 | Portal timeline shows retired | retired filter on `getPortalTimeline` | `68b34d1` |
| M2 | Clients can confirm "satisfied" | PM20+VM21 added to `PORTAL_AGENT_ONLY_CODES`; excluded from the portal next-action CTA. **Raised/received stay client-confirmable (founder decision).** | `81187ce` |
| M3 | Agent feed/next-action show retired | retired filter on `getAgentMilestoneActivity` + `getFileSnapshots` | `68b34d1` |
| M4 | Audit log shows retired | **Left as-is** — audit log is immutable history (founder default). | — |
| M5 | Admin step tables show 48 | retired filtered in Command Settings + Admin config tables | `68b34d1` |
| M6/M7 | Bell + API map | `enquiries_stalled` + `solicitor_update` added to the bell allowlist; M7 obviated by the C1 centralisation | `81187ce` / `81480d7` |

**LOW (L1–L6) not yet actioned** — flagged for POLISH_TBD: L1 (legacy progress-% over-credit), L2 (escalation Notification vs ChaseTask), L3 (past-date snooze resets clock), L4 (dead reconcile pairs), L5 (dead retired copy), L6 (non-issue).

**New scope that came out of this review:** a dedicated "get enquiries raised" chase (buyer → solicitor → escalate) — designed + founder-approved, spec at `docs/active/enquiries-raise-chase-SPEC.md`, not yet built.

## Recommended fix plan
1. **Make VM21 a real invariant of PM20** — move the PM20→VM21 completion into the shared `completeMilestone`/`syncEnquiryTracker` chokepoint, tolerant of VM10 being unmet, so every path (solicitor, API, task, reconciliation) stays in sync. Closes C1, H1, M7 and prevents recurrence. (Core-function change — surface before landing.)
2. **VM21 lifecycle parity:** add to `RELIST_RESET_VM_CODES` (+ mirror) [H2], `BILATERAL_UNDO_PAIRS` + reopen tracker on undo of a close-code [H3].
3. **Retired filter on the three raw-completion feeds:** portal timeline [M1, client-facing — do first], agent activity + next-action [M3], and decide on audit log [M4] + the two admin tables [M5].
4. **Client-safety:** add PM20 + VM21 to `PORTAL_AGENT_ONLY_CODES` [M2].
5. **Chase robustness (before switch-on):** filter the enquiry cron to active files + close/snooze the tracker when a file leaves active [H5]; add `enquiries_stalled` + `solicitor_update` to the bell allowlist [M6].
6. **DB checks (staging + prod):** any non-active file missing a VM21 row [H4]; any open tracker on a non-active/exchanged file. Follow-up backfill migration if the check finds any.
7. **Nits:** L1–L6 as capacity allows.
