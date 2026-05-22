# Client-Chase Arc — Discovery

**Status:** discovery only. Read-only investigation, ground-truth mapping. No design, no recommendations. Every claim cites `file:line`.

**Date:** 2026-05-22.

**Scope of investigation:**
- **Part A** — the agent milestone-confirmation code path and everything downstream that reacts to a confirmation. A new client-chase arc will introduce a NEW source feeding all of it (clients clicking confirm via the portal triggers the same writes), so the full ripple needs to be visible before design.
- **Part B** — every source that creates `ReminderLog` / `ChaseTask` rows, and the precise mechanics of the reminder→chase ladder as built today.
- **Part C** — client-facing infrastructure: which milestones are client-confirmable, email-to-Contact pipeline, portal token model, activity trail.

The remainder of this file is structured as: cross-cutting findings (things that span Parts), then Part A → B → C, then a glossary of the load-bearing schema columns referenced throughout.

---

## Cross-cutting findings

These five observations surfaced from more than one of the three sub-investigations and deserve front-page visibility.

### 1. A portal-confirm path **already exists** and **diverges from the agent path** on ~9 side effects

`portalCompleteMilestone` at [lib/services/portal.ts:204–278](lib/services/portal.ts) is wired today: it's the existing path for client-driven milestone confirmation via the portal. It writes `confirmedByPortal: true` (the dedicated portal-confirm signal at [prisma/schema.prisma:440](prisma/schema.prisma)) but **skips** the following side effects that the agent-confirm path runs through `completeMilestone` at [lib/services/milestones.ts:453–567](lib/services/milestones.ts):

| Side effect | Agent path runs it? | Portal path runs it? |
|---|---|---|
| `unlockDirectDependents` | Yes ([lib/services/milestones.ts:531](lib/services/milestones.ts)) | Yes ([lib/services/portal.ts:259](lib/services/portal.ts)) |
| `autoCompleteRemindersForMilestone` | Yes ([lib/services/milestones.ts:512](lib/services/milestones.ts)) | Yes ([lib/services/portal.ts:260](lib/services/portal.ts)) |
| `maybeUnlockExchangeGate` | Yes ([lib/services/milestones.ts:540](lib/services/milestones.ts)) | Yes ([lib/services/portal.ts:262](lib/services/portal.ts)) |
| `generateSummaryText` (writes `summaryText`) | Yes ([lib/services/milestones.ts:481–483](lib/services/milestones.ts)) | **No** — `summaryText: null` |
| Bilateral counterpart write (VM19↔PM26, VM20↔PM27) | Yes ([app/actions/milestones.ts:91–104](app/actions/milestones.ts)) | **No** — only same-side row written |
| `touchLastActivity` | Yes ([lib/services/milestones.ts:556](lib/services/milestones.ts)) | **No** |
| `outOfOrderCompletion` self-resolve loop | Yes ([lib/services/milestones.ts:517–554](lib/services/milestones.ts)) | **No** |
| `enqueueChainMilestoneNotifications` (chain mates) | Yes ([lib/services/milestones.ts:559–560](lib/services/milestones.ts)) | **No** |
| `maybeEnqueueCelebration` | Yes ([lib/services/milestones.ts:561–564](lib/services/milestones.ts)) | **No** |
| PostHog `MILESTONE_CONFIRMED` event | Yes ([app/actions/milestones.ts:120–125](app/actions/milestones.ts)) | **No** |
| `maybeFireFirstExchangeEmail` (retention) | Yes ([app/actions/milestones.ts:185–187](app/actions/milestones.ts)) | **No** |
| `notifyOutsourcedMilestoneConfirmed` | Yes ([app/actions/milestones.ts:202–208](app/actions/milestones.ts)) | **No** |
| `sendAdminMilestoneNotificationToPortal` / `sendExchangeCompletionPack` | Yes for non-exchange, completion via separate trigger | Yes for VM19/PM26 only ([lib/services/portal.ts:273–275](lib/services/portal.ts)) |

The portal path uses individual `prisma.x` writes, NOT a `$transaction` ([lib/services/portal.ts:239–256](lib/services/portal.ts)). Partial failure mid-confirm leaves partial state by design.

### 2. There are **two parallel email rails**

- **Rail A — `OutboundEmailQueue` (business-hours, consent-aware, dedup'd):** `enqueueEmail` at [lib/email/outboundQueue.ts:86–115](lib/email/outboundQueue.ts) writes to a queue table, drained daily 09:00 UTC by `/api/cron/drain-outbound-email`. Suppression via `User.emailUnsubscribedAt` at [lib/email.ts:74–80](lib/email.ts). Unique `@@unique([emailType, sourceId, recipientUserId])` at [prisma/schema.prisma:868](prisma/schema.prisma). **Requires `recipientUserId: String`** — non-nullable. Used by chain-arc emails (withdrawal, decline, exchange, completion, celebration) and the new medians-ready email.
- **Rail B — synchronous portal sends via `sendEmail()` direct:** `lib/services/portal.ts:35–59` (`logAutomatedEmail`) and 7+ call sites including `logPortalMilestoneConfirm` ([:309–316](lib/services/portal.ts)), `sendRichMilestoneEmails` ([:838, 861, 873](lib/services/portal.ts)), `sendExchangeCompletionPack` ([:933, 953](lib/services/portal.ts)). **No suppression check, no business-hours, no verified-domain sender** — sends from the platform default `Sales Progressor <updates@thesalesprogressor.co.uk>`.

Rail B already targets `Contact.email` addresses. Rail A cannot today — `recipientUserId` is required.

### 3. Read paths that write to the database

Two `lib/services/reminders.ts` "read" helpers actually create `ChaseTask` rows as a side effect of being called:

- `getReminderLogsForTransaction` at [lib/services/reminders.ts:113–119](lib/services/reminders.ts) — called from agent file detail page load ([app/agent/transactions/[id]/page.tsx:67](app/agent/transactions/[id]/page.tsx))
- `getAgentReminderLogs` at [lib/services/reminders.ts:181–185](lib/services/reminders.ts) — called from work-queue page load ([app/agent/work-queue/page.tsx:47](app/agent/work-queue/page.tsx))

Both check whether each active reminder log has a pending chase task, and if not, `chaseTask.create` is invoked. Then the helper recurses. The work-queue `useEffect` at [components/reminders/AgentRemindersList.tsx:592–597](components/reminders/AgentRemindersList.tsx) ALSO unconditionally runs `runReminderEngineAction("/agent/work-queue")` on every mount. So the reminder engine and ChaseTask creation are NOT exclusive to cron — page navigation triggers them.

### 4. The opps-doc is partly wrong about `isAutomated`

The opps-doc (`docs/active/opportunities-discovery.md`) claims `OutboundMessage.isAutomated` exists but is "never set to true anywhere in the codebase." **The field exists** at [prisma/schema.prisma:568](prisma/schema.prisma) and **IS set to true** in production code at [lib/services/portal.ts:53](lib/services/portal.ts) (`logAutomatedEmail()`), invoked from `logPortalMilestoneConfirm` ([:397, 439, 471](lib/services/portal.ts)), `sendRichMilestoneEmails` ([:849](lib/services/portal.ts)), `sendExchangeCompletionPack` ([:947, 967](lib/services/portal.ts)), `sendAdminMilestoneNotificationToPortal` ([:633](lib/services/portal.ts)). The "Automated" filter pill at [components/activity/ActivityTimeline.tsx:131–132](components/activity/ActivityTimeline.tsx) and the indigo "System email" badge are live working features.

The opps-doc is correct in a narrower sense: **no chase or reminder code path sets `isAutomated: true`** — every existing true-setter is on the portal-confirmation side. Agent-initiated chase emails ([app/api/chase/send-email/route.ts:42–51](app/api/chase/send-email/route.ts)) do not set the flag.

### 5. Schema gaps to be aware of

- **`MilestoneDefinition.actor` enum** — missing. The opps-doc was correct: [prisma/schema.prisma:408–424](prisma/schema.prisma) has `side` (vendor/purchaser) but no axis distinguishing "client physically does this" from "solicitor does this" from "agent confirms this." There is no allow/deny list for client-confirmable milestones today either; the only filter is `side` matching the Contact's `roleType`.
- **`Contact` consent fields** — none. [prisma/schema.prisma:272–288](prisma/schema.prisma) defines `email`, `phone`, `portalToken` but no `unsubscribedAt`, `consentedAt`, `communicationPreference`. `User.emailUnsubscribedAt` exists at [:85](prisma/schema.prisma); there's no Contact equivalent and no `Contact`-aware suppression helper in [lib/email.ts](lib/email.ts).
- **`OutboundEmailQueue.recipientUserId`** — required (`String`, not nullable) at [prisma/schema.prisma:860](prisma/schema.prisma). Cannot queue to a Contact today.
- **`PropertyTransaction.portalToken`** — does NOT exist. Portal tokens live on `Contact` (per-contact, [prisma/schema.prisma:279](prisma/schema.prisma)), not transaction. A transaction with 2 vendors + 2 purchasers has 4 independent tokens.
- **`MilestoneCompletion.completedById`** — `String?` foreign key to `User` at [prisma/schema.prisma:439, 448](prisma/schema.prisma). Cannot hold a Contact id (would violate FK). The portal path correctly leaves it `null`; `confirmedByPortal` carries the provenance instead.

---

## PART A — Confirmation path and full blast radius

### A1. Confirmation path: agent confirm today, end-to-end

#### Server-action entry points (all in [app/actions/milestones.ts](app/actions/milestones.ts))

- `confirmMilestoneAction` at [:47–275](app/actions/milestones.ts) — agent UI entry point. Wraps the primary + bilateral counterpart writes in `prisma.$transaction(ptx => ...)`.
- `markNotRequiredAction` at [:277–304](app/actions/milestones.ts) → `markNotRequiredWithCascade` at [lib/services/milestones.ts:836](lib/services/milestones.ts).
- `reverseMilestoneAction` at [:306–338](app/actions/milestones.ts).
- `getUndoImpactAction` / `executeUndoMilestoneAction` at [:342–378](app/actions/milestones.ts).
- `confirmExchangeReconciliationAction` at [:455–651](app/actions/milestones.ts) — sweeps outstanding milestones with `reconciledAtExchange: true`, then completes the primary + bilateral counterpart.
- `reconcileClaimMilestonesAction` at [:672–763](app/actions/milestones.ts) — used immediately after `/api/claim`. Writes upserts directly with `reconciledAtClaim: true` and custom `summaryText`, calls only `unlockDirectDependents`. **Bypasses `completeMilestone` entirely** — no prereq guard, no reminder cancellation, no exchange-gate unlock, no chain notifications.

#### Existing portal-confirm path (already wired)

- `portalCompleteMilestone` at [lib/services/portal.ts:204–278](lib/services/portal.ts), invoked by [app/api/portal/milestone/route.ts:11](app/api/portal/milestone/route.ts) (POST `/api/portal/milestone`).
- Writes `confirmedByPortal: true`, leaves `completedById: null`, calls `unlockDirectDependents`, `autoCompleteRemindersForMilestone`, `maybeUnlockExchangeGate(side, null)`, then `logPortalMilestoneConfirm` and `sendExchangeCompletionPack` for VM19/PM26 only.

#### DB writes (agent confirm path)

Inside the `$transaction` at [app/actions/milestones.ts:82–115](app/actions/milestones.ts):

1. **`completeMilestone(primary, ptx)`** — [lib/services/milestones.ts:453–567](lib/services/milestones.ts). Upserts `MilestoneCompletion`:
   - `state: "complete"`
   - `completedAt: new Date()` (or `input.completedAt` if provided)
   - `eventDate: input.eventDate ?? null`
   - `completedById: session.user.id` (**User FK** — see [prisma/schema.prisma:437–448](prisma/schema.prisma))
   - `summaryText: generateSummaryText(...)` (only when `def.summaryTemplate` is set — [lib/services/milestones.ts:481–483](lib/services/milestones.ts))
   - `notRequiredReason: null` on update
2. **Bilateral counterpart `completeMilestone`** — same upsert against PM26↔VM19 or PM27↔VM20 ([app/actions/milestones.ts:91–104](app/actions/milestones.ts)). Same `completedById`.
3. **`PropertyTransaction.expectedExchangeDate`** set from `eventDate` when confirming VM19/PM26 ([:107–112](app/actions/milestones.ts)).

Post-transaction:

4. **`PropertyTransaction.completionDate`** synced when confirming VM20/PM27 if `eventDate` differs by >12h ([:128–144](app/actions/milestones.ts)).

#### Side effects (in order they fire) inside `completeMilestone`

[lib/services/milestones.ts:453–567](lib/services/milestones.ts):

1. **Prerequisite guard** at [:463–479](lib/services/milestones.ts) — throws "Prerequisites not complete" if any direct prereq isn't complete/not_required. Awaited.
2. **`generateSummaryText`** at [lib/services/summary.ts:47–63](lib/services/summary.ts) — reads `Contact` rows to resolve `{agent}/{vendors}/{purchasers}/{solicitor}/{broker}` tokens. `{agent}` = `input.completedByName`. Awaited.
3. **`milestoneCompletion.upsert`** at [:485–509](lib/services/milestones.ts). Awaited.
4. **`unlockDirectDependents`** at [lib/services/milestones.ts:156–203](lib/services/milestones.ts). Flips locked dependents to available when prereqs satisfied. Awaited.
5. **`autoCompleteRemindersForMilestone`** at [lib/services/reminders.ts:655–683](lib/services/reminders.ts). Cancels pending `ChaseTask` rows + marks `ReminderLog` rows `completed` with `statusReason: "Milestone completed"`. Awaited.
6. **`maybeUnlockExchangeGate(side, completedById)`** at [lib/services/milestones.ts:210–269](lib/services/milestones.ts). If VM18/PM25 was locked and all `blocksExchange` peers on this side are clear, flips the gate to available AND writes an `OutboundMessage` (`type: "internal_note"`, content: `"{Side} side ready to exchange — all required milestones complete"`, `createdById = completedById`). Awaited.
7. **Self-resolve `outOfOrderCompletion` flags** at [:517–554](lib/services/milestones.ts) — re-evaluates which previously-flagged completions now have their full prereq chain satisfied; clears the flag. Awaited.
8. **`touchLastActivity(transactionId)`** at [lib/services/activity.ts:3–8](lib/services/activity.ts). Updates `PropertyTransaction.lastActivityAt = new Date()`. **Fire-and-forget** (`.catch(() => {})` at [:556](lib/services/milestones.ts)). **Runs on the default client, not on the parent `ptx`** — NOT atomic with the milestone write.
9. **Chain milestone notifications** at [:559–564](lib/services/milestones.ts). For VM19/PM26: `enqueueChainMilestoneNotifications(txId, "EXCHANGE")`. For VM20/PM27: same with "COMPLETION" plus `maybeEnqueueCelebration`. Both fire-and-forget. Implementation in [lib/email/chainNotifications.ts:337](lib/email/chainNotifications.ts) and [:444+](lib/email/chainNotifications.ts).

Outside the transaction in `confirmMilestoneAction` (after `$transaction` commits):

10. **`revalidateTx(transactionId)`** at [:5–8, 118](app/actions/milestones.ts) — `revalidatePath` for `/transactions/[id]` and `/agent/transactions/[id]`.
11. **`revalidatePath("/portal", "layout")`** at [:119](app/actions/milestones.ts).
12. **`trackServerEvent(... MILESTONE_CONFIRMED ...)`** at [:120–125](app/actions/milestones.ts). PostHog event keyed to `session.user.id`. Fire-and-forget.
13. **`pushToTransaction`** at [:170–174](app/actions/milestones.ts). Web push to all subscribed portal contacts. Fire-and-forget.
14. **`sendAdminMilestoneNotificationToPortal`** at [:177–182](app/actions/milestones.ts) → [lib/services/portal.ts:531–635](lib/services/portal.ts). Per-recipient rich emails to all vendor/purchaser portal contacts; for VM19/PM26 delegates to `sendExchangeCompletionPack`. Fire-and-forget.
15. **`maybeFireFirstExchangeEmail(session.user.id, txId)`** at [:185–187](app/actions/milestones.ts) → [lib/services/retention.ts:109](lib/services/retention.ts). Retention email for first-time exchange. Keyed off `session.user.id`. Fire-and-forget.
16. **`notifyOutsourcedMilestoneConfirmed`** at [:202–208](app/actions/milestones.ts) → [lib/services/notifications.ts:37–54](lib/services/notifications.ts). Creates a `Notification` row for the assigned SP on outsourced files when an agency role (director/negotiator/viewer) confirms. Gated on `serviceType === "outsourced"`, `tx.assignedUserId`, `assignedUserId !== session.user.id`, and `isAgencyRole`. Fire-and-forget.
17. **Notification-status build** at [:212–267](app/actions/milestones.ts) — non-blocking inspection of who will receive emails; returned to UI so the toast can say "queued/skipped".

#### Branches / variants

- **Vendor vs purchaser**: no divergence in `completeMilestone` — `side` only used by `maybeUnlockExchangeGate`. Bilateral pairing applies only to VM19↔PM26 and VM20↔PM27.
- **Gate milestones (VM18/PM25)**: no special path on confirm. Created in `locked` state at file-init ([lib/services/milestones.ts:115–116](lib/services/milestones.ts)) and unlocked by `maybeUnlockExchangeGate` when all same-side `blocksExchange` peers go complete/NR. `EXCHANGE_GATE_CODES = new Set(["VM18", "PM25"])` at [:37](lib/services/milestones.ts).
- **Exchange (VM19/PM26)**: triggers (a) bilateral counterpart write, (b) `expectedExchangeDate` write, (c) push body "Contracts exchanged!", (d) `maybeFireFirstExchangeEmail`, (e) chain "EXCHANGE" enqueue, (f) `sendAdminMilestoneNotificationToPortal` delegates entirely to `sendExchangeCompletionPack`.
- **Completion (VM20/PM27)**: triggers (a) bilateral counterpart write, (b) `completionDate` sync if >12h mismatch, (c) chain "COMPLETION" + `maybeEnqueueCelebration`.
- **Reconciliation-on-claim**: `reconcileClaimMilestonesAction` writes `reconciledAtClaim: true`, `completedAt = now + i`, `eventDate = agent-supplied or null`, custom `summaryText` (`"Recorded on claim — happened on..."`). Calls only `unlockDirectDependents` per row. **Skips** prereq guard, `autoCompleteRemindersForMilestone`, `maybeUnlockExchangeGate`, `touchLastActivity`, chain notifications, `outOfOrderCompletion` self-resolve. Each row written individually (no `$transaction`).
- **Reconciliation-at-exchange**: `confirmExchangeReconciliationAction` sweeps outstanding milestones via raw `milestoneCompletion.upsert` with `reconciledAtExchange: true` — bypasses `completeMilestone` for swept rows but manually cancels reminders for swept codes ([:534–554](app/actions/milestones.ts)). Primary + counterpart still go through `completeMilestone`.

### A2. Downstream blast radius

#### Analytics ([lib/services/analytics.ts](lib/services/analytics.ts))

- `getAgencyAnalytics` at [:66–69, 113–155](lib/services/analytics.ts) — reads `milestoneCompletions { state: "complete" }`. "Avg days to exchange" uses `completedAt`. **No `confirmedByPortal` or `reconciledAtClaim` filter**. Portal confirmations count identically.
- `getMonthlyExchangeStats` at [:293–303](lib/services/analytics.ts) — filters `reconciledAtClaim: false` but not `confirmedByPortal`. Portal confirms count.
- `getSolicitorExchangeStats` at [:333–352](lib/services/analytics.ts) — `state: "complete"` only.
- `getKpiTrendsForAgency` at [:434–456](lib/services/analytics.ts) — filters both `reconciledAtExchange: false` and `reconciledAtClaim: false`, not `confirmedByPortal`.
- `getAvgDaysToExchange` at [:543–557](lib/services/analytics.ts) — same flags.
- `getFilesAtRisk` at [:587–652](lib/services/analytics.ts) — "stalled" filter at [:617–619](lib/services/analytics.ts): `milestoneCompletions: { none: { state: "complete", completedAt: { gte: fourteenDaysAgo } } }`. Portal confirms count as activity.
- `getAuditLog` at [lib/services/audit.ts:53–71](lib/services/audit.ts) — reads `confirmedByPortal`, shows actor as `"Client (portal)"` when true ([:91–93](lib/services/audit.ts)). Already client-aware.
- `getReports` (weekly) at [lib/services/reports.ts:38–50, 86–91](lib/services/reports.ts) — reads `completedByName` from joined User. **Shows `null` for portal-confirmed rows.** Already partially handled: `completedByName: c.completedBy?.name ?? null` ([:90](lib/services/reports.ts)).

#### Prediction ([lib/services/fees.ts](lib/services/fees.ts))

- `computeEffectiveStartDate` at [:203–214](lib/services/fees.ts) — reads `reconciledAtClaim + eventDate`. Indifferent to confirmer.
- `calculatePhaseAwarePrediction` at [:216–243](lib/services/fees.ts) — reads `completedMilestoneCodes` only. Indifferent.
- `detectPhase` at [:111–131](lib/services/fees.ts) — same.
- `computeChainLinkPrediction` at [lib/services/chains.ts:253–297](lib/services/chains.ts) — same.
- **Medians learning** at [app/api/cron/medians-ready-check/route.ts:60–110](app/api/cron/medians-ready-check/route.ts) — filters `reconciledAtClaim: false` only. **Not filtered on `confirmedByPortal`** — portal confirmations would feed into learned medians once the 50-transaction threshold crosses. `MEDIANS_READY` currently `false` at [lib/services/milestone-staleness.ts:29](lib/services/milestone-staleness.ts).

#### Chain celebration detection

- `enqueueChainMilestoneNotifications` at [lib/email/chainNotifications.ts:337–442](lib/email/chainNotifications.ts) — fired from `completeMilestone` ([lib/services/milestones.ts:559–560](lib/services/milestones.ts)), fire-and-forget. Indifferent to confirmer identity.
- `maybeEnqueueCelebration` at [lib/email/chainNotifications.ts:444+](lib/email/chainNotifications.ts). Same.
- **NOT fired from `portalCompleteMilestone`.** Portal path only calls `sendExchangeCompletionPack` for VM19/PM26 ([lib/services/portal.ts:273–275](lib/services/portal.ts)). **Chain mates would NOT receive exchange/completion email if a customer confirms via portal today** — divergence between the two paths.

#### Stale-file / freshness / `lastActivity` signals

- `PropertyTransaction.lastActivityAt` — written by `touchLastActivity` at [lib/services/activity.ts:3–8](lib/services/activity.ts), called fire-and-forget from `completeMilestone` ([lib/services/milestones.ts:556](lib/services/milestones.ts)). **NOT called by `portalCompleteMilestone`** — portal confirmations today do not refresh `lastActivityAt`.
- `getHubPipelineStats` "stalled" at [lib/services/hub.ts:147–187](lib/services/hub.ts) — uses `completedAt` filter + `reconciledAtExchange: false` + `reconciledAtClaim: false`. Portal confirms count as activity.
- `getHubRecentActivity` at [lib/services/hub.ts:648–704](lib/services/hub.ts) — most-recent `milestoneCompletion` row by `completedAt`. Uses `summaryText` as description. Portal confirms have `summaryText: null`; description falls back to `milestoneDefinition.name` ([:696](lib/services/hub.ts)). Functional but loses voice.
- `work-queue.ts` stale detection at [lib/services/work-queue.ts:90–131](lib/services/work-queue.ts) — mirrors hub, portal confirms count as fresh.
- `milestone-staleness.ts` at [lib/services/milestone-staleness.ts:122–137](lib/services/milestone-staleness.ts) — uses `completion.completedAt`. Confirmer-agnostic.

#### Reminder re-evaluation

- `autoCompleteRemindersForMilestone` at [lib/services/reminders.ts:655–683](lib/services/reminders.ts) — called by both `completeMilestone` AND `portalCompleteMilestone`. Confirmer-agnostic.
- `evaluateTransactionReminders` at [lib/services/reminders.ts:213–392](lib/services/reminders.ts) — anchor-date logic at [:282–296](lib/services/reminders.ts) special-cases `reconciledAtClaim` (uses `eventDate`, deactivates rule if null). Not gated on `confirmedByPortal`. Portal confirms with `reconciledAtClaim: false` flow normally.

#### Reconciliation flags

- `reconciledAtExchange` — set only in `confirmExchangeReconciliationAction` ([app/actions/milestones.ts:519, 527](app/actions/milestones.ts)); cleared on undo at [lib/services/milestones.ts:1098, 1114](lib/services/milestones.ts).
- `reconciledAtClaim` — set only in `reconcileClaimMilestonesAction` ([app/actions/milestones.ts:730, 739](app/actions/milestones.ts)). Not cleared on undo (only `reconciledAtExchange` is cleared — see [lib/services/milestones.ts:1098](lib/services/milestones.ts)).

#### Metrics rollups ([lib/services/metrics-rollup.ts:167–195](lib/services/metrics-rollup.ts))

Three `milestoneCompletion.count` calls — exchange, completion, total — all filter `reconciledAtClaim: false`. **Not filtered on `confirmedByPortal`**. Portal confirms would count in monthly metric snapshots.

#### Hub freshness / agent dashboard

- `getAgentTransactions` at [lib/services/transactions.ts:31–77](lib/services/transactions.ts) — reads `milestoneCompletions { state: "complete", orderBy: completedAt desc, take: 1 }`. The "X confirmed" activity-verb chip at [:104–107](lib/services/transactions.ts) uses `milestoneDefinition.name`. Portal confirms render the same — no client-confirmed marker.
- `getAgentMilestoneActivity` at [lib/services/agent.ts:215–233](lib/services/agent.ts) — has explicit `portalOnly` filter (`confirmedByPortal: true`). Reads `completedBy.name`.

#### Risk / file health / problem detection ([lib/services/problem-detection.ts](lib/services/problem-detection.ts))

- `detectAndStoreFlags` at [:115–128](lib/services/problem-detection.ts) — "overdue milestone" flag uses sorted `completedAt` desc. Portal confirm refreshes this fine. Confirmer-agnostic.
- `milestone_stalled` flag at [:60–72](lib/services/problem-detection.ts) — uses `_count.milestoneCompletions`. Confirmer-agnostic.

#### Cron jobs

- [/api/cron/medians-ready-check](app/api/cron/medians-ready-check/route.ts) — reads MilestoneCompletion (see Prediction above).
- The reminder engine (invoked from [/api/reminders/run](app/api/reminders/run/route.ts)) reads via `transaction.milestoneCompletions` ([lib/services/reminders.ts:217](lib/services/reminders.ts)).
- No other cron under `app/api/cron/*` reads `MilestoneCompletion` directly.

#### Comms / activity feed

- `getCommsActivity` at [lib/services/comms.ts:60–92](lib/services/comms.ts) — reads `confirmedByPortal`, derives `confirmerName = "Client (portal)"` when true. Already client-aware.
- `/agent/comms` page at [app/agent/comms/page.tsx:62](app/agent/comms/page.tsx) — passes `confirmedByPortal` to UI.
- `CommsActivityFeed.tsx:90+` — different icon colour (violet vs emerald) + "Client confirmed" badge based on `confirmedByPortal`. Already wired.

#### Cross-cutting concerns flagged in Part A

- **`completedById` foreign key**: [prisma/schema.prisma:437–448](prisma/schema.prisma) — references `User`. A `Contact.id` written here would violate FK. Portal path correctly leaves it null.
- **`summaryText` token resolution** at [lib/services/summary.ts:13–41](lib/services/summary.ts) — the `{agent}` token expands to `completedByName` (the User's name passed in). Today portal confirmations have `summaryText: null`; [lib/services/hub.ts:696](lib/services/hub.ts) falls back to `milestoneDefinition.name` and [lib/services/comms.ts:84](lib/services/comms.ts) allows null.
- **PostHog `MILESTONE_CONFIRMED` event** at [app/actions/milestones.ts:120–125](app/actions/milestones.ts) — keyed to `session.user.id` and `agencyId`. Not fired from `portalCompleteMilestone`. Any "events by user role" report misses client-triggered events entirely.
- **Retention `first_exchange` email** at [lib/services/retention.ts:109–148](lib/services/retention.ts) — keyed by `userId`. Only fires from `confirmMilestoneAction`. If a client portal-confirms VM19/PM26, the agent does NOT get the first-exchange retention email today.
- **`maybeUnlockExchangeGate.createdById`** at [lib/services/milestones.ts:210–269](lib/services/milestones.ts) — when the gate unlocks, writes `OutboundMessage` with `createdById = passed parameter`. Agent path passes `completedById` (User id). Portal path passes `null` ([lib/services/portal.ts:262](lib/services/portal.ts)).
- **`outOfOrderCompletion` self-resolve loop** at [lib/services/milestones.ts:517–554](lib/services/milestones.ts) — does not run in `portalCompleteMilestone`. A client confirming an upstream milestone does not clear `outOfOrderCompletion` flags on downstream rows.
- **Chain notifications** — `enqueueChainMilestoneNotifications` and `maybeEnqueueCelebration` NOT fired from `portalCompleteMilestone`. Significant fork — other chain agents not notified via the chain queue if a buyer/seller portal-confirms exchange/completion.

### A — Surprises / entanglements

1. **Portal-confirm path exists today and diverges from agent path on ~9 side effects** (see Cross-cutting #1 above). Each downstream service must be evaluated against both paths.
2. **`MilestoneCompletion.completedById` is a User FK** ([prisma/schema.prisma:448](prisma/schema.prisma)). It is nullable as a column but cannot hold a `Contact.id`. The dedicated portal-confirm signal is `confirmedByPortal: Boolean` at [:438](prisma/schema.prisma) — exactly the pattern a client-chase arc would extend.
3. **No bilateral counterpart write on portal exchange/completion.** `portalCompleteMilestone` confirms ONLY the side matching the Contact's `roleType` ([lib/services/portal.ts:215–219](lib/services/portal.ts)). The agent path writes both halves. If a portal-driven client chase confirms VM19, the schema shows VM19 complete but PM26 still available. Downstream queries that test "exchanged" via `code IN ["VM19", "PM26"]` (e.g. [hub.ts:101, 139](lib/services/hub.ts), [analytics.ts:114, 138, 357](lib/services/analytics.ts)) would still detect any-of, but code treating exchange as "both sides" would see asymmetric data.
4. **Reconciliation-at-claim bypasses `completeMilestone` entirely.** `reconcileClaimMilestonesAction` upserts directly and only calls `unlockDirectDependents`. No reminder cancellation, no exchange-gate touch, no `lastActivityAt`, no chain notifications. Each row try/catch — partial success intentional, but creates inconsistent intermediate states.
5. **`completeMilestone` runs `touchLastActivity` fire-and-forget AFTER its own `$transaction` returns** ([lib/services/milestones.ts:556](lib/services/milestones.ts)). When called from `confirmMilestoneAction`'s parent `$transaction`, the `touchLastActivity` write happens on the default client, NOT the parent's `ptx`. `lastActivityAt` writes are not atomic with the milestone write.
6. **The chase reminder system uses `targetMilestoneCode`** — a client-confirmed milestone deactivates the chase reminder identically to an agent-confirmed one (both set `state: "complete"`). The chase loop does not re-fire after a client confirms. Good.
7. **`MEDIANS_READY = false`** in [lib/services/milestone-staleness.ts:29](lib/services/milestone-staleness.ts) — the slowness badge is feature-flagged off until learned medians replace the hardcoded constants. Once flipped on, portal-confirmed milestones would feed into the learning corpus via [app/api/cron/medians-ready-check/route.ts](app/api/cron/medians-ready-check/route.ts) (filters `reconciledAtClaim: false` only, not `confirmedByPortal`).
8. **`PropertyTransaction.completionDate`** auto-synced from VM20/PM27 `eventDate` if mismatched by >12h ([app/actions/milestones.ts:128–144](app/actions/milestones.ts), [:594–611](app/actions/milestones.ts)). A client-triggered completion confirmation with a date that disagrees with the agent's planned completion date would silently overwrite it.
9. **`expectedExchangeDate` set from VM19/PM26 `eventDate` unconditionally** ([app/actions/milestones.ts:107–112](app/actions/milestones.ts)). Same trust asymmetry.

---

## PART B — Reminder/chase machinery

### B3. Inventory of reminder/chase creation sources

#### Main reminder engine ([lib/services/reminders.ts](lib/services/reminders.ts))

All ReminderLog/ChaseTask creation flows through this file. Five write sites:

- **[:115](lib/services/reminders.ts)** — `getReminderLogsForTransaction` (READ path with WRITE side effect). On every load of a transaction page's reminders, any *active* log whose `nextDueDate <= todayUK` and which has no pending `ChaseTask` gets one created. Writes `chaseTask.create` with `{ status: "pending", priority: "normal", chaseCount: 0, dueDate: log.nextDueDate }`. **No `assignedToId` set on this path.** Then recurses via `return getReminderLogsForTransaction(...)`.
- **[:181](lib/services/reminders.ts)** — `getAgentReminderLogs` (the work-queue read path). Same pattern — fills in missing pending ChaseTasks for active logs that are due-or-overdue. Recursive self-call after the writes.
- **[:329](lib/services/reminders.ts)** — `evaluateTransactionReminders` → `reminderLog.create`. Fired per transaction × per active `ReminderRule`. Creates with `{ status: "active", nextDueDate: anchor + graceDays, sourceDateUsed }`.
- **[:373](lib/services/reminders.ts)** — `evaluateTransactionReminders` → `chaseTask.create`. Same loop. Only when `log.nextDueDate <= todayUK` and there's no open task. Sets `assignedToId: transaction.assignedUserId`, `priority: "normal"`, `chaseCount: 0`.
- **[:413](lib/services/reminders.ts)** — `createInitialRemindersInline` → `reminderLog.createMany`. Bulk insert for newly-created transactions. Only handles rules with `anchorMilestoneId: null` AND `requiresExchangeReady: false`. Skips rules whose `targetMilestoneCode` is already in `completedMilestoneCodes` (MOS-uploaded files).
- **[:437](lib/services/reminders.ts)** — `createInitialRemindersInline` → `chaseTask.createMany`. Companion bulk insert for due-immediately logs.

#### Engine invocations (do not write directly, but trigger the engine which may write)

- [app/api/transactions/route.ts:84](app/api/transactions/route.ts) — `void evaluateTransactionReminders(tx.id)` after creating an agent-side transaction (fire-and-forget).
- [app/actions/transactions.ts:169](app/actions/transactions.ts) — `createInitialRemindersInline(...)` synchronously, then `evaluateTransactionReminders(tx.id)` fire-and-forget after creating a new transaction via the form-submit action.
- [app/actions/transactions.ts:840](app/actions/transactions.ts) — `evaluateTransactionReminders(draftId)` fire-and-forget when a quick-add draft is promoted to active.
- [app/actions/tasks.ts:44](app/actions/tasks.ts) — `void evaluateTransactionReminders(transactionId)` after `completeTaskAction` (to activate downstream rules whose anchor just completed).
- [app/actions/tasks.ts:107, :109](app/actions/tasks.ts) — `runReminderEngineAction` calls `runReminderEngine(...)`. Scoped per role (SP gets `assignedUserId`, others get `agencyId`).
- [app/api/reminders/run/route.ts:30](app/api/reminders/run/route.ts) — cron entry point, calls `runReminderEngine()` with **no scope** (platform-wide).
- [components/reminders/AgentRemindersList.tsx:593](components/reminders/AgentRemindersList.tsx) — runs `runReminderEngineAction("/agent/work-queue")` on every mount of the work-queue list (useEffect, unconditional).
- [components/reminders/RemindersSection.tsx:464](components/reminders/RemindersSection.tsx) — manual "↻ Run engine" button on the file detail Reminders section.
- [app/api/seed-demo/route.ts:102](app/api/seed-demo/route.ts) — demo data seed runs the engine for the seeded transaction.

#### `chaseCount` increments (writes to ChaseTask but no new row)

- [lib/services/comms.ts:172–176](lib/services/comms.ts) — when `createCommunicationRecord` is called with `type === "outbound"` AND `chaseTaskId` provided, increments `chaseTask.chaseCount`. Runtime hook for "agent sent an outbound chase email tied to a task."
- [app/actions/tasks.ts:74–77](app/actions/tasks.ts) — `recordManualChaseAction` increments `chaseCount` for the manual "I chased them" button. Also creates an `OutboundMessage` with `content: "Chased manually (recorded by agent)"`.
- [app/actions/tasks.ts:100](app/actions/tasks.ts) — `escalateTaskAction` sets `priority: "escalated"`.
- [app/api/ai/generate-chase/route.ts:414](app/api/ai/generate-chase/route.ts) — reads `maxChaseCount` for the AI chase prompt context; does not write.

#### Helpers in `reminders.ts` that update (not create)

- [:316–320](lib/services/reminders.ts) — update due date when shifted.
- [:362–369](lib/services/reminders.ts) — escalate priority + bump `dueDate` when openTask is stale.
- [:516–524](lib/services/reminders.ts) — `deactivateLog` (sets log → `inactive`, pending tasks → `inactive`).
- [:562–570](lib/services/reminders.ts) — `advanceChaseTask` (bump `chaseCount` + log nextDueDate).
- [:590–604](lib/services/reminders.ts) — `completeChaseTask` (set task `done`, optionally set log `completed`).
- [:616–619](lib/services/reminders.ts) — `cancelChaseTask` (set status `cancelled`).
- [:631–639](lib/services/reminders.ts) — `snoozeReminderLog` (sets task `cancelled` and log `snoozedUntil`).
- [:649–652](lib/services/reminders.ts) — `wakeUpReminderLog` (clear snooze, set due now).
- [:674–682](lib/services/reminders.ts) — `autoCompleteRemindersForMilestone` (cancel pending tasks + mark logs `completed` for rules targeting a milestone).

#### Milestone-triggered auto-resolve (the only paths that close reminders on milestone confirm)

- [lib/services/milestones.ts:512](lib/services/milestones.ts) — `completeMilestone(...)` calls `autoCompleteRemindersForMilestone(input.transactionId, def.code, tx)`. THE auto-close path.
- [lib/services/milestones.ts:653](lib/services/milestones.ts) — `bulkCompleteMilestones` calls the same helper per milestone.
- [lib/services/portal.ts:261](lib/services/portal.ts) — buyer/seller portal milestone confirmation triggers the same helper.
- [app/actions/milestones.ts:535–553](app/actions/milestones.ts) — `confirmExchangeWithSweep` (the exchange sweep) manually closes reminder logs targeting any "swept" milestone code (`statusReason: "Exchange confirmed"`).
- [lib/services/milestones.ts:1142–1160](lib/services/milestones.ts) — `reverseMilestone` cancels active reminder logs targeting a reversed milestone code (`statusReason: "Milestone reversed"`).
- [app/actions/transactions.ts:1117–1124](app/actions/transactions.ts) — Edit Sale Details flow (`editSaleDetailsAction`). When milestones get NR'd because of tenure/purchase-type change, logs → `inactive` (`statusReason: "Marked not required — sale details changed"`), tasks → `inactive`.

#### Seed / scripts (NOT runtime)

- [prisma/seed-help-library.ts:883–901](prisma/seed-help-library.ts) — direct `reminderLog.create` + `chaseTask.create` for demo help library files. Has a find-before-create check at [:878](prisma/seed-help-library.ts).
- [prisma/seed.ts:25–26](prisma/seed.ts) — `deleteMany` of both tables.
- [scripts/seed-staging-test-data.ts:44–45](scripts/seed-staging-test-data.ts) — `deleteMany` of both tables.
- [scripts/reset-db.ts:248–249](scripts/reset-db.ts) — scoped `deleteMany` per transaction id.

#### Idempotency / dedup

- **Reminder engine main loop** at [lib/services/reminders.ts:310–343](lib/services/reminders.ts) — "find-before-create" on `reminderLog.findFirst({ where: { transactionId, reminderRuleId, status: "active" } })`. Pure application-level dedup; **no DB unique constraint** in the schema. Only `@@index([transactionId, reminderRuleId])` and `@@index([status, nextDueDate])` at [prisma/schema.prisma:491](prisma/schema.prisma).
- **ChaseTask creation in engine** at [:353](lib/services/reminders.ts) — finds open task on `{ reminderLogId, status: "pending" }`. No DB constraint. Same "no open task" guard appears in the two read-path side-effect creators ([:110, :176](lib/services/reminders.ts)).
- **`createInitialRemindersInline`** — not idempotent in itself; relies on caller being run once at transaction creation. The `reminderLog.createMany` at [:413](lib/services/reminders.ts) would create duplicates if called twice on the same transaction.
- **`seed-help-library`** at [:878](prisma/seed-help-library.ts) — has its own find-before-create.

#### Cron triggers

Only **one** cron writes reminders/chases:

- [/api/reminders/run](app/api/reminders/run/route.ts) — schedule `0 7 * * *` (daily 07:00 UTC, per [vercel.json:5](vercel.json)). Calls `runReminderEngine()` with no scope → fetches all active transactions platform-wide ([lib/services/reminders.ts:454–460](lib/services/reminders.ts)) and batches `evaluateTransactionReminders` 8 at a time. No `CRON_SECRET` check — auth is via NextAuth gate (the path falls through middleware allowlist).
- No agency scoping at the cron level — intentional, platform daily sweep.

Other crons that read but don't write:
- [/api/cron/morning-digest](app/api/cron/morning-digest/route.ts) — reads `reminderLog.findMany` for digest counting ([lib/services/morning-digest.ts:58](lib/services/morning-digest.ts)).
- [/api/cron/agent-weekly-brief](app/api/cron/agent-weekly-brief/route.ts) — reads `chaseTasks` via include ([lib/services/agent-weekly-brief.ts:55](lib/services/agent-weekly-brief.ts)).
- [/api/cron/detect-problems](app/api/cron/detect-problems/route.ts) — reads `chaseTasks` via include for overdue-chase detection ([lib/services/problem-detection.ts:187](lib/services/problem-detection.ts)).

No cron touches ReminderLog/ChaseTask for `withdrawn`/`completed` transactions cleanup — those are filtered out by `status: "active"` on the engine's read of transactions ([lib/services/reminders.ts:454](lib/services/reminders.ts)) and by the read paths ([:144](lib/services/reminders.ts) filters transaction status `["active", "on_hold"]`).

### B4. Ladder mechanics

#### Rule fields and their effect

`prisma/schema.prisma:456–473`:

```
model ReminderRule {
  id                    String   @id @default(cuid())
  name                  String
  description           String?
  anchorMilestoneId     String?
  targetMilestoneCode   String?
  graceDays             Int      @default(3)
  repeatEveryDays       Int      @default(5)
  escalateAfterChases   Int      @default(3)
  requiresExchangeReady Boolean  @default(false)
  useEventDate          Boolean  @default(false)
  isActive              Boolean  @default(true)
  ...
}
```

As used by the engine in [lib/services/reminders.ts:257–391](lib/services/reminders.ts):

- **`isActive`** — engine filters at [:249](lib/services/reminders.ts) and at [:27](lib/services/reminders.ts) (`getGraceDaysByMilestoneCode`). False rules are ignored. No deactivation cascade — flipping `isActive` to false leaves existing logs in place.
- **`anchorMilestoneId`** at [:276–301](lib/services/reminders.ts) — controls the anchor date for `graceDays`. If the anchor milestone isn't complete, `deactivateLog(...)` with reason `"Anchor milestone not yet confirmed"`. If `reconciledAtClaim` is true on the anchor AND `eventDate` is null, deactivates with the long "no anchor available" message ([:288–294](lib/services/reminders.ts)). Null anchor → uses `transaction.createdAt`.
- **`targetMilestoneCode`** at [:264–271](lib/services/reminders.ts) — if the target milestone is `complete` or `not_required`, deactivates with reason `"Target milestone confirmed"`. Also used by `autoCompleteRemindersForMilestone` ([:666](lib/services/reminders.ts)) to close logs when the milestone is confirmed via another path.
- **`graceDays`** at [:307](lib/services/reminders.ts) — `firstDueDate = anchorDate + graceDays`. First chase date.
- **`repeatEveryDays`** at [:359, :367](lib/services/reminders.ts) — cadence after first chase. When `taskAge % repeatEveryDays === 0` and `taskAge > 0`, the engine escalates the existing open task: bumps `chaseCount`, recomputes priority, sets `dueDate = openTask.dueDate + repeatEveryDays`.
- **`escalateAfterChases`** at [:361](lib/services/reminders.ts) — priority becomes `escalated` once `chaseCount >= escalateAfterChases`. Same logic in `advanceChaseTask` at [:555](lib/services/reminders.ts).
- **`requiresExchangeReady`** at [:259](lib/services/reminders.ts) — if true AND not all `blocksExchange: true` milestones are complete-or-NR, deactivates with reason `"Exchange not yet ready"`.
- **`useEventDate`** at [:298](lib/services/reminders.ts) — when `true` AND `anchorCompletion.eventDate` is set, uses `eventDate` for the anchor; otherwise uses `completedAt` (falls back to `transaction.createdAt`). Overridden by the `reconciledAtClaim` branch (always uses eventDate).
- **`name`** — used in audit notes and surfaced in cards.
- **`description`** — included in `getReminderLogsForTransaction` shape ([:91](lib/services/reminders.ts)) and surfaced in cards.

#### Engine entry points

See "Engine invocations" under B3.

#### Write sequence on rule fire

Inside `evaluateTransactionReminders` ([lib/services/reminders.ts:213–392](lib/services/reminders.ts)), per matching active rule:

1. **Pre-flight deactivation** ([:259–271, :278–294](lib/services/reminders.ts)) — exchange-not-ready, anchor-not-confirmed, target-already-confirmed, or claim-reconcile-without-eventDate → `deactivateLog(...)` runs ([:504–532](lib/services/reminders.ts)): sets log → `inactive`, pending tasks → `inactive`, writes an `internal_note` `OutboundMessage`.
2. **`ReminderLog` create-or-update**:
   - Existing active log AND due-date drift > 1h ([:316](lib/services/reminders.ts)): `reminderLog.update` with `nextDueDate` + `sourceDateUsed`, audit `OutboundMessage` via `writeEngineAudit` ([:497–502](lib/services/reminders.ts)).
   - Else ([:329](lib/services/reminders.ts)): `reminderLog.create` with `status: "active"`, `nextDueDate: firstDueDate`, `sourceDateUsed: anchorDate`. Writes audit `OutboundMessage` `"Reminder engine: reminder created for ..."`.
3. **`ChaseTask` create-or-escalate** ([:352–390](lib/services/reminders.ts)):
   - Open task exists AND `taskAge > 0 && taskAge % repeatEveryDays === 0` ([:359](lib/services/reminders.ts)): `chaseTask.update` bumping `chaseCount`, recomputing `priority`, shifting `dueDate`. **No audit message.**
   - Else if no open task AND log is due-or-overdue ([:372](lib/services/reminders.ts)): `chaseTask.create` with `assignedToId: transaction.assignedUserId`, `dueDate: log.nextDueDate`, `status: "pending"`, `priority: "normal"`, `chaseCount: 0`. Writes audit `OutboundMessage` `"Reminder engine: chase task created for ..."`.
4. **Email — NOT sent by the engine.** The engine never calls `sendEmail`, `enqueueEmail`, or `sendChainEmail`. Email is the agent's responsibility via the manual "Send chase" flow at [app/api/chase/send-email/route.ts](app/api/chase/send-email/route.ts) (which doesn't touch ChaseTask except via `comms.createCommunicationRecord` incrementing `chaseCount` when `chaseTaskId` is supplied), or via `recordManualChaseAction` at [app/actions/tasks.ts:74–87](app/actions/tasks.ts). Grepped: zero `sendEmail|enqueueEmail|sendChainEmail` calls in `lib/services/reminders.ts`.
5. **Audit trail** — only via `writeEngineAudit` at [:497–502](lib/services/reminders.ts), which writes to `OutboundMessage` with `type: "internal_note"` and `createdById: assignedUserId`. **If `assignedUserId` is empty string** (default when `transaction.assignedUserId` is null), `writeEngineAudit` early-returns at [:498](lib/services/reminders.ts) — engine writes for unassigned files are silent in the comms feed. `Activity` is not touched by the engine. `CommunicationRecord` not directly touched.

#### Escalation

- **Trigger sites**:
  - [lib/services/reminders.ts:361](lib/services/reminders.ts) (engine loop): `const newPriority: TaskPriority = newChaseCount >= rule.escalateAfterChases ? "escalated" : "normal"`. Applied at [:362–369](lib/services/reminders.ts) (`chaseTask.update`).
  - [lib/services/reminders.ts:555](lib/services/reminders.ts) (`advanceChaseTask`): same formula, applied at [:562–565](lib/services/reminders.ts).
  - [app/actions/tasks.ts:92–101](app/actions/tasks.ts) (`escalateTaskAction`): manual escalation; sets `priority: "escalated"` directly regardless of chaseCount.
- **Effect**: priority becomes `"escalated"`. This is the ONLY state change. **No recipient change. No different email path. No re-anchored due date beyond the normal repeat cadence.** Escalated tasks are grouped at the top of `AgentRemindersList` (urgency group `"escalated"`) and counted on the file detail page ([app/agent/transactions/[id]/page.tsx:295](app/agent/transactions/[id]/page.tsx)).

#### Agent-visible surface

- **File detail page reminders section**:
  - [app/agent/transactions/[id]/page.tsx:67](app/agent/transactions/[id]/page.tsx) — `getReminderLogsForTransaction(id, session.user.agencyId).catch(() => [])`.
  - [app/agent/transactions/[id]/page.tsx:577–579](app/agent/transactions/[id]/page.tsx) — renders `<RemindersSection reminderLogs={reminderLogs} ... />`.
  - [components/reminders/RemindersSection.tsx](components/reminders/RemindersSection.tsx) — renders escalated/overdue/due_today/upcoming groups.
  - Internal staff `/transactions/[id]` mirror: [app/transactions/[id]/page.tsx:54](app/transactions/[id]/page.tsx) and [:367–369](app/transactions/[id]/page.tsx).
  - Badge count on the milestones tab at [app/agent/transactions/[id]/page.tsx:232](app/agent/transactions/[id]/page.tsx) (`reminderBadgeCount`) and [:295](app/agent/transactions/[id]/page.tsx) (`escalatedCount`).
- **Work queue (agent ladder hub)**:
  - [app/agent/work-queue/page.tsx:47](app/agent/work-queue/page.tsx) — `getAgentReminderLogs(vis)`.
  - [app/agent/work-queue/page.tsx:132](app/agent/work-queue/page.tsx) — `<AgentRemindersList logs={reminderLogs} hideChase={session.user.role === "admin"} />`.
  - Counts shown at [:56–85](app/agent/work-queue/page.tsx) (computed from `reminderLogs` in JS, not via `getWorkQueueCounts`).
- **Hub / dashboard attention items**:
  - [lib/services/hub.ts:505–570](lib/services/hub.ts) — `getHubAttentionItems(vis)` returns `{ id, urgency, reminderName, transaction, nextDueDate }[]`.
  - Urgency at [:550–553](lib/services/hub.ts): `escalated` (via openTask.priority), `overdue` (due-date < today), `due_today`.
- **Morning digest email**: [lib/services/morning-digest.ts:58–74](lib/services/morning-digest.ts) counts overdue + due-today reminder logs per progressor.
- **Agent weekly brief email**: [lib/services/agent-weekly-brief.ts:55–74](lib/services/agent-weekly-brief.ts) counts escalated pending tasks per agent.
- **Work-queue counts service**: [lib/services/tasks.ts:109–138](lib/services/tasks.ts) — `getWorkQueueCounts` returns `{ total, pending, overdue, escalated, mine, snoozed }`. **Currently filters `progressedBy: "progressor"`** at [:114](lib/services/tasks.ts) — only outsourced files. Used by SP/admin dashboard surface.

#### Resolution paths

- **Auto-resolve on target milestone confirmation**:
  - Primary: [lib/services/milestones.ts:512](lib/services/milestones.ts) (`completeMilestone` → `autoCompleteRemindersForMilestone(transactionId, code, tx)`).
  - Bulk: [lib/services/milestones.ts:653](lib/services/milestones.ts).
  - Portal-driven: [lib/services/portal.ts:261](lib/services/portal.ts).
  - Helper itself at [lib/services/reminders.ts:655–683](lib/services/reminders.ts) — pending tasks → `cancelled`, logs → `completed` with `statusReason: "Milestone completed"`.
  - Engine-time fallback: [lib/services/reminders.ts:264–271](lib/services/reminders.ts) — `deactivateLog(...)` if target already complete (`statusReason: "Target milestone confirmed"`).
- **Manual dismiss (completing the task closes the log if no target milestone)**:
  - [lib/services/reminders.ts:573–607](lib/services/reminders.ts) (`completeChaseTask`) — sets task `done`. If `targetMilestoneCode` is null, also closes the log with `statusReason: "Chase task marked done"`. If non-null, caller ([app/actions/tasks.ts:25–39](app/actions/tasks.ts)) is expected to call `completeMilestone`, which closes via `autoCompleteRemindersForMilestone`.
  - Fallback at [app/actions/tasks.ts:34–37](app/actions/tasks.ts) — if `completeMilestone` throws (prereq not met), closes the log directly with `statusReason: "Chase task marked done"`.
- **Cancel chase task (no reminder log change)**:
  - [lib/services/reminders.ts:609–620](lib/services/reminders.ts) (`cancelChaseTask`) — sets task `cancelled`. **Does not touch the log.** Next engine run will re-create a task.
- **Snooze**:
  - [lib/services/reminders.ts:622–640](lib/services/reminders.ts) (`snoozeReminderLog`) — sets task `cancelled` AND log `snoozedUntil` + `nextDueDate` to the same future time. Hub/work-queue surfaces filter `snoozedUntil > now` ([lib/services/hub.ts:528](lib/services/hub.ts), [lib/services/tasks.ts:124, :145](lib/services/tasks.ts)).
  - **No status change** — log stays `active`. Snooze encoded purely in `snoozedUntil`/`nextDueDate`.
- **Wake-up**: [lib/services/reminders.ts:642–653](lib/services/reminders.ts) (`wakeUpReminderLog`) — clears `snoozedUntil`, sets `nextDueDate` to now.
- **Exchange sweep**: [app/actions/milestones.ts:535–554](app/actions/milestones.ts) — logs targeting any swept code → `completed` with `statusReason: "Exchange confirmed"`.
- **Milestone reverse**: [lib/services/milestones.ts:1142–1160](lib/services/milestones.ts) — tasks → `cancelled`, logs → `cancelled` with `statusReason: "Milestone reversed"`.
- **NR via Edit Sale Details**: [app/actions/transactions.ts:1117–1124](app/actions/transactions.ts) — tasks → `inactive`, logs → `inactive` with `statusReason: "Marked not required — sale details changed"`.
- **Engine-side deactivation reasons** (all via `deactivateLog`, log → `inactive`, pending tasks → `inactive`):
  - [:260](lib/services/reminders.ts) — `"Exchange not yet ready"`
  - [:268](lib/services/reminders.ts) — `"Target milestone confirmed"`
  - [:279](lib/services/reminders.ts) — `"Anchor milestone not yet confirmed"`
  - [:289–293](lib/services/reminders.ts) — `"Anchor milestone was reconciled at claim without an eventDate — no anchor available for scheduling"`

#### Full `statusReason` enumeration

- `"Exchange not yet ready"` — [lib/services/reminders.ts:260](lib/services/reminders.ts)
- `"Target milestone confirmed"` — [lib/services/reminders.ts:268](lib/services/reminders.ts)
- `"Anchor milestone not yet confirmed"` — [lib/services/reminders.ts:279](lib/services/reminders.ts)
- `"Anchor milestone was reconciled at claim without an eventDate ..."` — [lib/services/reminders.ts:289–293](lib/services/reminders.ts)
- `"Chase task marked done"` — [lib/services/reminders.ts:602](lib/services/reminders.ts) and [app/actions/tasks.ts:36](app/actions/tasks.ts)
- `"Milestone completed"` — [lib/services/reminders.ts:681](lib/services/reminders.ts)
- `"Exchange confirmed"` — [app/actions/milestones.ts:552](app/actions/milestones.ts)
- `"Milestone reversed"` — [lib/services/milestones.ts:1158](lib/services/milestones.ts)
- `"Marked not required — sale details changed"` — [app/actions/transactions.ts:1123](app/actions/transactions.ts)

#### Terminal status enums

- `ReminderLogStatus` values: `active`, `completed`, `cancelled`, `inactive` ([prisma/schema.prisma:495–500](prisma/schema.prisma)).
- `ChaseTaskStatus` values: `pending`, `done`, `cancelled`, `inactive` ([prisma/schema.prisma:525–530](prisma/schema.prisma)).

#### Dedup mechanism

- **`ReminderLog`** — application-level find-before-create at [lib/services/reminders.ts:310–314](lib/services/reminders.ts) (`findFirst` on `{ transactionId, reminderRuleId, status: "active" }`). **No DB unique constraint** — only `@@index([transactionId, reminderRuleId])` at [prisma/schema.prisma:491](prisma/schema.prisma). Two concurrent engine runs on the same transaction can race and create two active logs for the same rule.
- **`ChaseTask`** — application-level find-before-create at [lib/services/reminders.ts:353–356](lib/services/reminders.ts) (`findFirst` on `{ reminderLogId, status: "pending" }`), and at the two read paths ([:110, :176](lib/services/reminders.ts)). No DB constraint at [prisma/schema.prisma:502–523](prisma/schema.prisma).

### B — Surprises / entanglements

1. **The two READ helpers write to the database.** `getReminderLogsForTransaction` ([:113–119](lib/services/reminders.ts)) and `getAgentReminderLogs` ([:178–185](lib/services/reminders.ts)) both call `chaseTask.create` when they encounter due-but-task-less logs, then recurse. Every page load of the file detail page or work-queue page can mutate state. **Not a "pure read."** Read-path creators do not set `assignedToId`, unlike the engine's own `chaseTask.create` at [:373–377](lib/services/reminders.ts).
2. **The work-queue mounts the engine.** [components/reminders/AgentRemindersList.tsx:592–597](components/reminders/AgentRemindersList.tsx) fires `runReminderEngineAction("/agent/work-queue")` on every mount, unconditionally. Documented in `docs/done/role-coverage/follow-ups.md` as FU-18.
3. **The engine has no DB-level idempotency.** [prisma/schema.prisma:491](prisma/schema.prisma) shows only non-unique indexes on `ReminderLog`. Two concurrent `evaluateTransactionReminders` calls on the same `transactionId` can race past `findFirst` and create two active logs for the same rule. Risk surfaces with the AgentRemindersList useEffect + daily cron + manual button.
4. **The engine never sends email and never writes to `CommunicationRecord`/`Activity`.** Engine audit notes go to `OutboundMessage` `internal_note` via `writeEngineAudit` ([:497–502](lib/services/reminders.ts)). `writeEngineAudit` early-returns if `assignedUserId` is empty string — engine activity on **unassigned** transactions is invisible in the comms feed.
5. **`chaseCount` increments live in `comms.ts`, not in the engine.** [lib/services/comms.ts:170–176](lib/services/comms.ts) — ANY `createCommunicationRecord` call with `type: "outbound"` and `chaseTaskId` set bumps chaseCount. Path is shared between SendGrid replies, manual chases, AI chase generation, and the agent's send-email button.
6. **Withdrawal does not touch reminders/chases.** [app/actions/transactions.ts:300–351](app/actions/transactions.ts) (status change to `withdrawn`) writes a status update and ([:345–348](app/actions/transactions.ts)) notifies chain mates. **No reminderLog or chaseTask writes.** Withdrawn files become invisible to the engine via `status: "active"` filter ([lib/services/reminders.ts:454](lib/services/reminders.ts)). Existing reminders/tasks for a withdrawn file persist in `active`/`pending` state — orphaned but inert.
7. **Claim flow does not directly write reminders.** [app/api/claim/route.ts](app/api/claim/route.ts) calls `initializeMilestoneCompletions` and `reconcileClaimMilestonesAction`. **Neither creates reminder logs.** `reconcileClaimMilestonesAction` ([app/actions/milestones.ts:672–761](app/actions/milestones.ts)) calls `unlockDirectDependents` but NOT `evaluateTransactionReminders` or `createInitialRemindersInline`. The engine only picks up the claimed transaction on the next scheduled run or page mount. The `reconciledAtClaim` flag does affect the engine: [lib/services/reminders.ts:282–296](lib/services/reminders.ts) forces `eventDate` use and deactivates if eventDate is null.
8. **`createInitialRemindersInline` is fragile-by-design.** Does not check for existing logs before bulk-creating ([:413](lib/services/reminders.ts)). Assumes one-shot use. If called twice (e.g. wired into the claim flow without thought), silently duplicates active reminders for day-0 rules.
9. **The cron and the on-mount engine call use the same `runReminderEngine` but with different scopes.** Cron at [app/api/reminders/run/route.ts:30](app/api/reminders/run/route.ts) calls `runReminderEngine()` (all active transactions). On-mount call goes via `runReminderEngineAction` with role scope. Engine doesn't know it's being called from a cron vs UI mount.
10. **`bulkCompleteMilestones` bypasses the transactional client when closing reminders.** [lib/services/milestones.ts:653](lib/services/milestones.ts) calls `autoCompleteRemindersForMilestone(transactionId, def.code)` without the tx client (no third arg). Reminder closure is committed in a separate transaction from the milestone completion. By contrast, the single-milestone path ([:512](lib/services/milestones.ts)) passes `tx`. Bulk completion + reminder close are not atomic.
11. **`getWorkQueueCounts` filters to `progressedBy: "progressor"` only** ([lib/services/tasks.ts:114](lib/services/tasks.ts)). Non-`agentUserId` path returns counts limited to outsourced files. For self-managed files, count surface is page-level computation at [app/agent/work-queue/page.tsx:56–85](app/agent/work-queue/page.tsx), not this service.

---

## PART C — Client-facing / email / token infrastructure

### C5. Which milestones are client-confirmable today

#### Schema state

- **`MilestoneDefinition.actor` — MISSING.** [prisma/schema.prisma:408–424](prisma/schema.prisma): model has `id`, `code`, `name`, `side`, `orderIndex`, `blocksExchange`, `eventDateRequired`, `predecessorCode`, `canBeMarkedNr`, `summaryTemplate`, `weight`, `createdAt`. No `actor` column. Opps-doc claim correct.
- **`MilestoneDefinition.side` — enum `MilestoneSide { vendor | purchaser }`.** [prisma/schema.prisma:412, 426–429](prisma/schema.prisma). Only ownership marker.
- **`MilestoneCompletion.confirmedByPortal: Boolean @default(false)`** at [prisma/schema.prisma:440](prisma/schema.prisma). The "did a client confirm this" provenance flag — set by `portalCompleteMilestone` at [lib/services/portal.ts:249, 255](lib/services/portal.ts). Read by `getActivityTimeline` at [lib/services/comms.ts:78–79](lib/services/comms.ts) and portal timeline at [lib/services/portal.ts:1045](lib/services/portal.ts).
- **`MilestoneCompletion.completedById`** at [prisma/schema.prisma:439](prisma/schema.prisma) — points to `User`. Always `null` when client confirms via portal.
- **No other ownership-axis flags.** No "physically performed in real life" vs "can confirm in app" distinction anywhere.

#### Current portal confirmation path (wired today — yes)

1. Client clicks "Confirm" in [components/portal/PortalMilestoneList.tsx:246–252](components/portal/PortalMilestoneList.tsx) (or [PortalNextActionCard.tsx:72](components/portal/PortalNextActionCard.tsx)).
2. Optimistic `addOptimistic(milestoneId)` + `startTransition` invokes `portalConfirmMilestoneAction({ token, milestoneDefinitionId, eventDate })` at [components/portal/PortalMilestoneList.tsx:125](components/portal/PortalMilestoneList.tsx).
3. Server action `portalConfirmMilestoneAction` at [app/actions/portal.ts:10–22](app/actions/portal.ts) — **no auth gate, token-only**. Calls `portalCompleteMilestone(input)` then `revalidatePath` on three portal routes.
4. `portalCompleteMilestone` at [lib/services/portal.ts:204–278](lib/services/portal.ts):
   - Looks up `Contact` by `portalToken` ([:209–212](lib/services/portal.ts)). Throws "Invalid token" if no match.
   - Resolves `side` from `contact.roleType` ([:215](lib/services/portal.ts)): vendor → vendor, anything else → purchaser.
   - Fetches `MilestoneDefinition` filtered by both `id` AND `side` ([:217–219](lib/services/portal.ts)). **A vendor contact CANNOT confirm a purchaser milestone** — would throw "Milestone not found".
   - Refuses unless current state is `available` or `complete` ([:232–234](lib/services/portal.ts)). State `locked` or `not_required` → throws "Milestone not yet available for confirmation". **There is NO milestone-code allowlist** — any milestone matching the side, in available state, can be confirmed.
   - Upserts the completion with `confirmedByPortal: true`, `state: "complete"`, `completedAt: new Date()`, optional `eventDate`.
   - Calls `unlockDirectDependents`, `autoCompleteRemindersForMilestone`, `maybeUnlockExchangeGate`.
   - On VM19/PM26 specifically, calls `sendExchangeCompletionPack` ([:273–275](lib/services/portal.ts)).
   - Calls `logPortalMilestoneConfirm` ([:264–271](lib/services/portal.ts)) which writes an `OutboundMessage` `internal_note` AND sends rich emails to vendor/purchaser/agent/progressor.

There is also a separate `portalMarkNotRequired` path ([lib/services/portal.ts:1070–1113](lib/services/portal.ts)) which **does** enforce an allowlist: `PORTAL_NOT_REQUIRED_WHITELIST = { PM9: ["PM10"] }` ([:1066–1068](lib/services/portal.ts)). Only PM9 can be marked NR by a client, and it cascades to PM10.

#### Gate / exchange / completion milestones — what happens today

- **VM18 / PM25** (gate). Unlocked automatically by `maybeUnlockExchangeGate` at [lib/services/milestones.ts:210–269](lib/services/milestones.ts) when every same-side `blocksExchange` milestone is complete. State flips locked → available. **Once available, a client can confirm them via the portal exactly like any other milestone** — no special-case suppression. Portal UI groups them via `EXCHANGE_GATES_PORTAL = new Set(["VM18", "PM25"])` at [app/portal/[token]/progress/page.tsx:9](app/portal/[token]/progress/page.tsx), but they are still rendered as confirmable. Confirming triggers the "ready to exchange" push title at [lib/services/portal.ts:496–500](lib/services/portal.ts).
- **VM19 / PM26** (exchange). Same path. When confirmed via portal, `portalCompleteMilestone` triggers `sendExchangeCompletionPack` at [lib/services/portal.ts:273–275](lib/services/portal.ts) → rich "what happens next" emails to all contacts and (on VM19 only) to the agent. Push title "Contracts exchanged!" at [:487–490](lib/services/portal.ts).
- **VM20 / PM27** (completion). Same path. Push title "Completed!" at [:492–495](lib/services/portal.ts).
- **`POST_EXCHANGE` constants**: [app/portal/[token]/page.tsx:57](app/portal/[token]/page.tsx) and [app/portal/[token]/progress/page.tsx:8](app/portal/[token]/progress/page.tsx) define `new Set(["VM19", "VM20", "PM26", "PM27"])` — used for UI grouping only, not for blocking confirmation.

**Bottom line**: every milestone on the client's own side that has reached `available` state is confirmable from the portal — including the exchange gate, exchange itself, and completion. No `actor` axis distinguishing "client physically does this" from "agent/solicitor does this" — only `side`, which is too coarse (every side has both a party AND a solicitor).

### C6. Email infrastructure: can we send to a Contact?

#### Schema

- **`OutboundEmailQueue.recipientUserId: String` — REQUIRED (not nullable).** [prisma/schema.prisma:860](prisma/schema.prisma). Plain `String`, no `?`. Confirmed via inline comment at [:853](prisma/schema.prisma): `"recipientUserId is required: only claimed agents receive these emails (Model A)."` The `@@unique` at [:868](prisma/schema.prisma) presumes the column. Migration [prisma/migrations/20260520000001_email_arc_schema/migration.sql:20](prisma/migrations/20260520000001_email_arc_schema/migration.sql) — `"recipientUserId" TEXT NOT NULL`.
- **`Contact` schema** at [prisma/schema.prisma:272–288](prisma/schema.prisma):
  - `id String @id @default(cuid())`
  - `propertyTransactionId String`
  - `name String`
  - `phone String?`
  - **`email String?`** — yes, optional email field exists.
  - `roleType ContactRole` (enum: vendor, purchaser, solicitor, broker, other — at [:398–404](prisma/schema.prisma))
  - `portalToken String? @unique`
  - `lastVisitedPortalAt DateTime?`
  - `createdAt / updatedAt`
  - Relations: pushSubscriptions, portalMessages, documents
  - **NO consent fields. No `unsubscribedAt`, no `consentedAt`, no `communicationPreference`.**
- **`User.emailUnsubscribedAt: DateTime?`** at [prisma/schema.prisma:85](prisma/schema.prisma). Set globally on a User row. Used by `isUserEmailSuppressed` at [lib/email.ts:74–80](lib/email.ts).
- **`ChainLink.inviteUnsubscribedAt: DateTime?`** at [prisma/schema.prisma:802](prisma/schema.prisma). Used by `isInviteEmailSuppressed` at [lib/email.ts:83–89](lib/email.ts) — narrow scope (unclaimed-agent invite emails only).
- **Other consent fields on User**: `User.retentionEmailOptOut Boolean @default(false)` at [prisma/schema.prisma:84](prisma/schema.prisma) — retention emails only.

#### Current send paths

- **`enqueueEmail` signature** at [lib/email/outboundQueue.ts:86–115](lib/email/outboundQueue.ts). Required fields: `emailType: string`, `sourceId: string`, `recipientEmail: string`, `recipientUserId: string`, `payload: Record<string, unknown>`. **All required, none nullable.** `recipientUserId` is the suppression key.
- **Drain** at [lib/email/outboundQueue.ts:119–176](lib/email/outboundQueue.ts). Suppression check on every send: `isUserEmailSuppressed(record.recipientUserId)` ([:135](lib/email/outboundQueue.ts)). Marks suppressed records as sent with `errorMessage: "suppressed:unsubscribed"`.
- **`sendEmail` (raw SendGrid)** at [lib/email.ts:8–34](lib/email.ts). Takes `to: string`, no User lookup, no consent check. This is what the portal-side rich emails use directly ([lib/services/portal.ts:392, 426–438, 456–467, 838, 861, 873, 933, 953](lib/services/portal.ts)). **The portal currently sends to `Contact.email` addresses directly via `sendEmail` with no consent gate of any kind.**
- **`sendChainEmail`** at [lib/email.ts:41–71](lib/email.ts). Optional ASM unsubscribe group via `SENDGRID_UNSUBSCRIBE_GROUP_ID` env. Used by `drainOutboundQueue` and `chainNotifications.ts`. Suppression checked at the queue-drain layer.

#### Existing send-to-Contact path? — YES

- The portal milestone-confirmation flow sends emails directly to Contact.email addresses via `sendEmail()` (raw SendGrid send). See [lib/services/portal.ts:392, 426–438, 456–467, 838, 861, 873, 933, 953](lib/services/portal.ts). Logged via `logAutomatedEmail` at [lib/services/portal.ts:35–59](lib/services/portal.ts), which writes `OutboundMessage` with `isAutomated: true` and `createdById: null`.
- There is also an agent-initiated path — `replyPortalMessageAction` in [app/actions/portal.ts:44–68](app/actions/portal.ts) and `sendProgressorPortalReply` (referenced) write `PortalMessage` rows. This isn't email.
- `emailVisibleUpdateToClients` at [lib/services/comms.ts:193](lib/services/comms.ts) — triggered when an agent logs a comm with `visibleToClient: true`. Sends emails to client Contacts with the update content. Bypasses any consent check.

#### Sender domain / from-address

`resolveSenderForTransaction` at [lib/email.ts:112–178](lib/email.ts):
- **Internal staff** (sales_progressor/admin): looks up the transaction's agency, finds `VerifiedDomain` for that agency (status `verified`), then `UserVerifiedEmail` for the sending user at that domain. Sends as `${user.name} <${userEmail.email}>`.
- **Agent** (director/negotiator): finds the agent's most-recently-used `UserVerifiedEmail` regardless of agency (status `verified` or `legacy_single_sender`).
- **Fallback**: `Sales Progressor <updates@thesalesprogressor.co.uk>`, Reply-To = session user's email.

Schema: `VerifiedDomain` at [prisma/schema.prisma:899–914](prisma/schema.prisma); `UserVerifiedEmail` at [:928–943](prisma/schema.prisma).

**Portal automated emails do NOT use `resolveSenderForTransaction`** — they call `sendEmail` directly with no `from` override, going from platform default `updates@thesalesprogressor.co.uk` with the agency's progressor email as `replyTo` ([lib/services/portal.ts:325–327, 391–392](lib/services/portal.ts)). The agency's branded domain is NOT used for these.

#### Concrete gap — today → "send digest email to a buyer"

What exists today:
- Sending raw emails to `Contact.email` via `sendEmail()` works.
- Activity logging via `OutboundMessage` with `isAutomated: true` works.
- Per-Contact `portalToken` URL generation works.

What's missing:
1. **No Contact-side consent / suppression schema.** No `Contact.unsubscribedAt`, no `ContactSuppression` model. Portal emails today simply ignore the question.
2. **No Contact-targeted unsubscribe link infra.** The HMAC [lib/email/unsubscribe.ts](lib/email/unsubscribe.ts) only handles `user:{userId}` and `invite:{chainLinkId}` subjects ([:49–57](lib/email/unsubscribe.ts)). No `contact:{contactId}` subject; the `/api/unsubscribe` endpoint would need to handle setting a new Contact suppression column.
3. **`OutboundEmailQueue` can't queue to a Contact.** `recipientUserId` is required `String`, not nullable. Two refactor shapes: (a) make it nullable and add `recipientContactId`, or (b) use a parallel model. The queue's `@@unique([emailType, sourceId, recipientUserId])` at [:868](prisma/schema.prisma) also assumes one-User-per-source.
4. **`isUserEmailSuppressed`** at [lib/email.ts:74–80](lib/email.ts) only checks `User.emailUnsubscribedAt`. No parallel `isContactEmailSuppressed`.
5. **Domain identity** — portal automated emails send from `updates@thesalesprogressor.co.uk`, not the agency's `VerifiedDomain`. For a chase-style email that needs to feel like it's from the agency, the resolve-sender logic would need extending to handle "no session, but a transaction context".
6. **No reminder→email-to-Contact wire.** The reminder pipeline ([lib/services/reminders.ts](lib/services/reminders.ts)) creates `ChaseTask` rows processed by an agent opening `ChaseDrawer`. There is no fork that says "if reminder is due and rule is X, instead send to Contact directly".
7. **No `actor` enum on `MilestoneDefinition`** to tell the reminder which Contact (party vs solicitor) should receive the chase.

### C7. Token / portal infrastructure

#### Token shape

- **NOT on `PropertyTransaction`.** Searched [prisma/schema.prisma](prisma/schema.prisma) for `portalToken` — only hit at [:279](prisma/schema.prisma) on `Contact`. `PropertyTransaction` has no `portalToken` field.
- **`Contact.portalToken: String? @unique`** at [prisma/schema.prisma:279](prisma/schema.prisma). Per-Contact, not per-transaction. Each vendor/purchaser/solicitor/broker Contact can have its own token.
- **Generation**: `generatePortalTokenAction` at [app/actions/contacts.ts:79–94](app/actions/contacts.ts) uses `randomUUID()`. No expiry, no rotation, no scope payload. Bare UUID string. Idempotent — if a token already exists, returns without overwriting ([:88](app/actions/contacts.ts)).
- **Auto-created at transaction creation**: per `docs/help/_discovery/your-first-day.md:181, 240`, contacts supplied at transaction-creation time get a token by default (referenced at [app/actions/transactions.ts:113](app/actions/transactions.ts)). Contacts added later need an explicit "Set up portal" click.

#### Portal page — what it renders, what auth check runs

- **[app/portal/[token]/layout.tsx:35–98](app/portal/[token]/layout.tsx)** — root layout. Calls `getPortalData(token)` ([lib/services/portal.ts:76–122](lib/services/portal.ts)) which does the only "auth" check: looks up `Contact` by `portalToken`. If not found → `notFound()` (404 page). No session, no role check, no rate limit, no IP fingerprint. **The bare token is the only credential.** Fire-and-forget `logPortalView` (writes an `internal_note` `OutboundMessage` row, [:61](lib/services/portal.ts)) and `lastVisitedPortalAt` bump ([:62–81](lib/services/portal.ts)). Wraps everything in `PortalShell`.
- **Routes under `app/portal/[token]/`**:
  - [page.tsx](app/portal/[token]/page.tsx) — home (hero gradient, progress %, next action card, coming-up list, key dates, tips, latest updates feed)
  - [progress/page.tsx](app/portal/[token]/progress/page.tsx) — full milestone list (own side + read-only other side)
  - [updates/page.tsx](app/portal/[token]/updates/page.tsx) — timeline of milestones + comm entries with `visibleToClient: true`
  - [exchange/page.tsx](app/portal/[token]/exchange/page.tsx) — exchange-specific view
  - [complete/page.tsx](app/portal/[token]/complete/page.tsx) — completion-specific view
- **Server actions reachable from the portal** (all token-authenticated, no session):
  - `portalConfirmMilestoneAction` — confirm a milestone ([app/actions/portal.ts:10](app/actions/portal.ts))
  - `portalMarkNotRequiredAction` — mark milestone NR (PM9 only, per allowlist) ([app/actions/portal.ts:24](app/actions/portal.ts))
  - `portalSendMessageAction` — send a `PortalMessage` to the agent ([app/actions/portal.ts:35](app/actions/portal.ts))
- **API routes available**:
  - [app/api/portal/milestone/route.ts](app/api/portal/milestone/route.ts) — alternate POST endpoint for milestone confirmation (delegates to same `portalCompleteMilestone`)
  - [app/api/portal/manifest/[token]/route.ts](app/api/portal/manifest/[token]/route.ts) — PWA manifest
  - [app/api/portal/calendar-export/[token]/route.ts](app/api/portal/calendar-export/[token]/route.ts) — `.ics` download
  - [app/api/portal/push-subscribe/route.ts](app/api/portal/push-subscribe/route.ts) — web-push subscription registration
  - [app/api/portal/documents/route.ts](app/api/portal/documents/route.ts) — file upload (e.g. searches)
  - [app/api/portal/explain-email/route.ts](app/api/portal/explain-email/route.ts) — AI "explain this email" helper
  - [app/api/portal/invite/route.ts](app/api/portal/invite/route.ts) — sends portal invite email (invoked from agent side, not portal side)

#### Milestone confirmation from portal — wired today?

**Yes — fully wired and live.** See C5 above for the action chain. The confirmation appears on the agent file detail page via `getActivityTimeline` ([lib/services/comms.ts:77–92](lib/services/comms.ts)) as a milestone entry with `confirmedByClient: true` and `confirmerName: "Client (portal)"`.

#### Email-link-to-specific-milestone capability

Portal emails today link to `/portal/{token}` or `/portal/{token}/progress` (e.g. [lib/services/portal.ts:388, 413, 448, 581](lib/services/portal.ts)). **There is no route that takes a milestone code or ID as a path parameter.** [app/portal/[token]/progress/page.tsx](app/portal/[token]/progress/page.tsx) renders the whole milestone list at once with the active group expanded based on `activeGroupIdx` computed in [PortalMilestoneList.tsx:84–89](components/portal/PortalMilestoneList.tsx).

No deep-link route like `/portal/{token}/confirm/{milestoneCode}` or `/portal/{token}/milestone/{id}` exists. A client clicking through from a chase email today lands on the standard milestone list and has to find the row and click "Confirm" to open the bottom-sheet.

#### Limited-scope / one-time tokens

**None for portal actions.** The HMAC infra at [lib/email/unsubscribe.ts](lib/email/unsubscribe.ts) is the closest thing — short-lived, signed, no DB record, but hard-coded to two subject types (`user:`, `invite:`) and only supports unsubscribe.

Everything else flows through the long-lived per-Contact UUID `portalToken`. Valid forever once created. No per-action token, no expiry, no revocation flag (clear `Contact.portalToken` to revoke). No `Notification` or audit table tracks token usage beyond `Contact.lastVisitedPortalAt` and the `logPortalView` `OutboundMessage` rows.

### C8. Activity trail

#### `OutboundMessage` schema

[prisma/schema.prisma:539–617](prisma/schema.prisma). Field summary:

| Field | Type | Purpose |
|---|---|---|
| `id` | String (cuid) | PK |
| `agencyId` | String? | Optional agency scope (Command Centre use) |
| `channel` | OutboundChannel enum | email/sms/linkedin/twitter/in_app/other (Command Centre channels) |
| `purpose` | OutboundPurpose enum | chase/password_reset/retention_email/scheduled_post/digest/notification/other |
| `status` | OutboundStatus enum | draft/scheduled/queued/sent/delivered/opened/clicked/bounced/failed/cancelled |
| `transactionId` | String? | Nullable (non-transaction messages) |
| `chaseTaskId` | String? | Links to the ChaseTask if this is a chase send |
| `recipientName` / `recipientEmail` / `recipientHandle` | String? | Outbound target |
| `type` | CommType enum | The legacy axis: internal_note / outbound / inbound |
| `method` | CommMethod? | email/phone/sms/voicemail/whatsapp/post |
| `contactIds` | String[] | Array of Contact ids this comm relates to |
| `content` | String | Body of the comm |
| `subject` | String? | Optional subject line |
| `bodyFormat` | String @default("plain") | plain/html |
| `generatedText` / `tone` | String? | AI-draft provenance |
| `wasAiGenerated` | Boolean @default(false) | AI flag |
| `wasEdited` | Boolean @default(false) | Was AI draft edited |
| **`isAutomated`** | Boolean @default(false) | [:568](prisma/schema.prisma) — system-sent vs human-sent |
| `visibleToClient` | Boolean @default(false) | Should it surface on the portal timeline |
| `ccEmails` | String? | Comma-joined cc list |
| `aiModel` / `aiPromptVersion` / `aiTokensInput` / `aiTokensOutput` / `aiCostCents` | mixed | Command Centre AI provenance |
| `createdById` | String? | User who created the row (nullable for system rows) |
| **`createdByRole`** | String? | [:581](prisma/schema.prisma) — role of the creator |
| `createdAt` / `updatedAt` | DateTime | Timestamps |
| `scheduledFor` / `sentAt` / `deliveredAt` / `openedAt` / `clickedAt` / `failedAt` / `failureReason` | mixed | Email lifecycle |
| `requiresApproval` / `approvedByUserId` / `approvedAt` / `editedByHuman` | mixed | LinkedIn-flow approval |
| `providerMessageId` / `providerWebhookData` | String? / Json? | SendGrid provider data |
| `importBatchId` | String? | WhatsApp import batching |

#### `isAutomated` — exists, ever set true?

- **Field exists**: [prisma/schema.prisma:568](prisma/schema.prisma).
- **Set to `true` in production code at**:
  - [lib/services/portal.ts:53](lib/services/portal.ts) — inside `logAutomatedEmail()`, called from `logPortalMilestoneConfirm` ([:397, 439, 471](lib/services/portal.ts)), `sendRichMilestoneEmails` ([:849](lib/services/portal.ts)), `sendExchangeCompletionPack` ([:947, 967](lib/services/portal.ts)), `sendAdminMilestoneNotificationToPortal` ([:633](lib/services/portal.ts)).
- [lib/services/comms.ts:163](lib/services/comms.ts) — `createCommunicationRecord` accepts `isAutomated` as input with `?? false` default.
- [app/actions/draft-posts.ts:53](app/actions/draft-posts.ts) — explicitly sets `isAutomated: false`.
- Read sites: [components/activity/ActivityTimeline.tsx:37, 65, 131, 132](components/activity/ActivityTimeline.tsx) (filter pill "Automated", indigo dot, badge "System email"); [components/ui/TimelineIcon.tsx:116, 123](components/ui/TimelineIcon.tsx); [lib/services/comms.ts:41, 111](lib/services/comms.ts); [lib/services/transactions.ts:74, 113](lib/services/transactions.ts); `components/command/OutboundRow.tsx`.

**See Cross-cutting #4 above for the contradiction with the opps-doc.**

#### `createdByRole`

- [prisma/schema.prisma:581](prisma/schema.prisma) `createdByRole String?`. Migration: [prisma/migrations/20260519000002_add_created_by_role_to_outbound_message/migration.sql](prisma/migrations/20260519000002_add_created_by_role_to_outbound_message/migration.sql) — added 2026-05-19, backfilled from `User.role`.
- Set at write-time from `session.user.role` (see [app/actions/comms.ts:32, 65](app/actions/comms.ts)). Values: `superadmin` / `admin` / `sales_progressor` / `director` / `negotiator` / `viewer`.
- For portal-automated rows it's NULL (writes at [lib/services/portal.ts:53, 192–199, 309–316](lib/services/portal.ts) don't set it; `createdById: null` for automated ones).
- For chase-send-email rows it's NULL (the write at [app/api/chase/send-email/route.ts:42–51](app/api/chase/send-email/route.ts) doesn't set it — a small inconsistency).
- For comms logged through `logCommAction` → `createCommunicationRecord` it's set correctly.
- Read at [components/activity/ActivityTimeline.tsx:297](components/activity/ActivityTimeline.tsx) — passed to `AuthorPill` which adds " · SP" suffix when role is `sales_progressor` or `admin`.

#### Where would a system-sent client chase be logged today

If the system started sending a client chase, the existing infrastructure that would receive it:

- **`OutboundMessage` with `isAutomated: true`, `type: "outbound"`, `method: "email"`, `contactIds: [contactId]`, `createdById: null`** — `logAutomatedEmail` at [lib/services/portal.ts:35–59](lib/services/portal.ts) is the exact precedent. It writes the subject + body (line 55) into a single `content` string. **`subject` field is NOT used by this writer — it concatenates subject inline into `content`.**
- **No tracking of "no response yet"** — `OutboundMessage` has no `repliedAt`, no `inReplyTo`, no thread/conversation concept. Inbound matching would have to be heuristic (correlate inbound rows from same Contact within time window).
- **No tracking of "escalated to me on date Y"** — `ChaseTask.priority` enum has `normal` and `escalated` at [prisma/schema.prisma:534–537](prisma/schema.prisma). `ReminderLog.statusReason` could carry an explanation string. `ReminderRule.escalateAfterChases Int @default(3)` exists at [:466](prisma/schema.prisma) and the engine increments `chaseCount` on ChaseTask, but the escalation event itself isn't logged as a distinct `OutboundMessage` row.

#### Where would the client's response get logged

- **Portal milestone confirmation** → `MilestoneCompletion` row with `confirmedByPortal: true` ([lib/services/portal.ts:249, 255](lib/services/portal.ts)) AND an `internal_note` `OutboundMessage` via `logPortalMilestoneConfirm` ([:309–318](lib/services/portal.ts)). Both surface in `getActivityTimeline`.
- **Portal text message back to agent** → `PortalMessage` row (separate model, [prisma/schema.prisma:301–315](prisma/schema.prisma)). **Not in `OutboundMessage`** — lives in a parallel table; does NOT show up in `getActivityTimeline` directly. The activity timeline only includes `MilestoneCompletion` and `OutboundMessage` rows ([lib/services/comms.ts:59–75](lib/services/comms.ts)). PortalMessage is rendered separately on the agent file page (see `sendProgressorPortalReply` for the agent reply path).
- **Inbound email** → no automated capture. Would have to be manually logged via `logCommAction` with `type: "inbound"`.

#### Agent-visible activity feed — unified or separate?

- **Render**: [components/activity/ActivityTimeline.tsx](components/activity/ActivityTimeline.tsx) — receives `entries: ActivityEntry[]` already unified at the service layer.
- **Source**: `getActivityTimeline` at [lib/services/comms.ts:47–118](lib/services/comms.ts). Pulls from exactly two tables:
  1. `MilestoneCompletion` (where state in [`complete`, `not_required`]) — joined with `MilestoneDefinition` and `completedBy: User`.
  2. `OutboundMessage` (all rows for the transaction) — joined with `createdBy: User`.
- Sorted by event time (`sentAt ?? createdAt` for comms, `completedAt` for milestones) at [:116](lib/services/comms.ts).
- Filter pills at [ActivityTimeline.tsx:21–27](components/activity/ActivityTimeline.tsx): All / Steps / Comms / Automated / Notes. "Comms" excludes automated and internal_note ([:131](components/activity/ActivityTimeline.tsx)); "Automated" shows only `isAutomated: true` rows ([:132](components/activity/ActivityTimeline.tsx)).
- **`PortalMessage` is NOT in the unified feed.** Separate model rendered separately. **WhatsApp imports ARE** in the feed (stored as `OutboundMessage` rows with `importBatchId` set — `lib/services/parse-whatsapp.ts`).
- `lastVisitedPortalAt` portal-view events: written as `OutboundMessage` `internal_note` rows with `"viewed their client portal"` in the content ([lib/services/portal.ts:192–200](lib/services/portal.ts)). UI has a separate "Portal visits" toggle at [ActivityTimeline.tsx:183–190](components/activity/ActivityTimeline.tsx) that hides them by default.

### C — Surprises / entanglements

1. **The opps-doc claim that `isAutomated` is "never set to true anywhere" is wrong.** It IS set true on every portal-triggered automated email — see [lib/services/portal.ts:53](lib/services/portal.ts) and 7+ call sites. The "Automated" filter pill in the activity timeline ([components/activity/ActivityTimeline.tsx:131–132](components/activity/ActivityTimeline.tsx)) and the indigo "System email" badge are live features. The opps-doc is correct only in the narrow sense that **no chase or reminder code path sets `isAutomated: true`** — every existing true-setter is on the portal-confirmation side.
2. **`PropertyTransaction.portalToken` does not exist.** The opps-doc Q7 prompt asks about it, but the token is per-`Contact`, not per-transaction. A transaction with 2 vendors + 2 purchasers has 4 independent tokens. Email infrastructure that wants to "link to the buyer's portal" needs to pick which Contact. The existing code does this naturally by iterating contacts with `portalToken` in `sendRichMilestoneEmails` ([lib/services/portal.ts:832](lib/services/portal.ts)).
3. **The portal can already confirm exchange and completion milestones.** VM18, PM25, VM19, PM26, VM20, PM27 are all confirmable from the portal today via `portalCompleteMilestone` — no special-casing, no allow/deny list (only side match). If clients should NOT confirm exchange themselves, a deny path would need to be added.
4. **`portalCompleteMilestone` cross-side check is asymmetric.** Vendor Contact can only confirm vendor milestones; purchaser Contact can only confirm purchaser milestones ([lib/services/portal.ts:217–219](lib/services/portal.ts)). **But there is no equivalent check for the solicitor/broker Contacts** — `contact.roleType === "vendor" ? "vendor" : "purchaser"` ([:215](lib/services/portal.ts)) means a `solicitor` or `broker` Contact with a portal token would be silently routed to the `purchaser` side. `generatePortalTokenAction` doesn't check `roleType`. Probably a latent bug.
5. **The portal has its own email pipeline that bypasses `OutboundEmailQueue` entirely** (see Cross-cutting #2 above).
6. **`PortalMessage` is structurally separate from `OutboundMessage` and not in the activity feed.** Clients can type messages to their agent through `portalSendMessageAction` ([app/actions/portal.ts:35–42](app/actions/portal.ts) → `sendClientPortalMessage` in `lib/services/portal-messages.ts`). Rows live in `PortalMessage`, not `OutboundMessage`, and the agent's `ActivityTimeline` doesn't render them. If "inbound client replies should escalate the chase" is part of any future arc, either `PortalMessage` rows must feed into the timeline OR messaging must migrate into `OutboundMessage`.
7. **No `subject` field is used by the automated logger.** `OutboundMessage.subject` exists at [prisma/schema.prisma:560](prisma/schema.prisma) but `logAutomatedEmail` at [lib/services/portal.ts:55](lib/services/portal.ts) writes `content: \`Subject: ${subject}\n\n${stripped}\`` — concatenates subject into content, leaving `subject` column null. Searching by subject in the activity feed doesn't work for automated rows.
8. **`ReminderLog` has `status` and `statusReason` fields** ([prisma/schema.prisma:481, 484](prisma/schema.prisma)). The current engine mostly uses `active` / `completed` / `cancelled` / `inactive`. No `status = "auto_chased"` or `"escalated"` value used today, but the schema could carry that state without migration.
9. **`ChaseTask.communications: OutboundMessage[]` relation exists** ([prisma/schema.prisma:520](prisma/schema.prisma)) — every comm is linked to the chase task. If a system-sent chase wrote `OutboundMessage` with `chaseTaskId` and `isAutomated: true`, the existing `getReminderLogsForTransaction` query at [lib/services/reminders.ts:96–100](lib/services/reminders.ts) would automatically pick up the most-recent outbound on the task — no new wiring needed for "what was the last automated touch".
10. **Token expiry / revocation does not exist for `Contact.portalToken`.** Long-lived UUID, no rotation, no audit trail beyond `lastVisitedPortalAt`. Embedding portal links in chase emails inherits this property — links work forever, can be forwarded, can be screen-scraped. The HMAC-signed unsubscribe-token pattern at [lib/email/unsubscribe.ts](lib/email/unsubscribe.ts) is the only signed-token infrastructure in the codebase and it's narrow-scope (no expiry, two subjects only).

---

## Glossary — load-bearing schema columns referenced above

- **`MilestoneCompletion.state`** — `MilestoneState` enum: `locked` / `available` / `complete` / `not_required` ([prisma/schema.prisma:432](prisma/schema.prisma)).
- **`MilestoneCompletion.completedAt`** — DateTime?; system clock when the row was marked complete.
- **`MilestoneCompletion.eventDate`** — DateTime?; real-world date the event happened (may differ from `completedAt`).
- **`MilestoneCompletion.completedById`** — String? FK → `User`. Always null on portal confirms.
- **`MilestoneCompletion.confirmedByPortal`** — Boolean default false. Provenance flag for client-portal-driven confirmations.
- **`MilestoneCompletion.reconciledAtClaim`** — Boolean default false. Set only by `reconcileClaimMilestonesAction`.
- **`MilestoneCompletion.reconciledAtExchange`** — Boolean default false. Set only by `confirmExchangeReconciliationAction`.
- **`MilestoneCompletion.outOfOrderCompletion`** — Boolean default false. Set when a milestone is confirmed before its prereqs were complete (allowed in some paths). Cleared by the self-resolve loop.
- **`MilestoneDefinition.side`** — `MilestoneSide` enum: `vendor` / `purchaser`. Only ownership axis.
- **`MilestoneDefinition.code`** — unique string ("VM1"..."VM20", "PM1"..."PM27"). What `targetMilestoneCode` references.
- **`MilestoneDefinition.blocksExchange`** — Boolean default true. Used by `requiresExchangeReady` rule check and the exchange-gate unlock logic.
- **`ReminderRule.anchorMilestoneId`** — optional FK → `MilestoneDefinition.id`. The milestone whose completion is the timer anchor.
- **`ReminderRule.targetMilestoneCode`** — optional string. The milestone code being chased; auto-resolves the rule when complete.
- **`ReminderRule.graceDays`** — int default 3. Days after anchor before first chase.
- **`ReminderRule.repeatEveryDays`** — int default 5. Cadence between chases after first.
- **`ReminderRule.escalateAfterChases`** — int default 3. After this many chases, priority becomes `escalated`.
- **`ReminderRule.useEventDate`** — boolean. When true and anchor has `eventDate`, use that instead of `completedAt`.
- **`ReminderLog.status`** — enum: `active` / `completed` / `cancelled` / `inactive`.
- **`ReminderLog.nextDueDate`** — DateTime; when the next chase fires.
- **`ReminderLog.snoozedUntil`** — DateTime?; if set and in the future, hidden from work-queue / hub.
- **`ReminderLog.statusReason`** — string?; reason why log was deactivated/closed.
- **`ChaseTask.status`** — enum: `pending` / `done` / `cancelled` / `inactive`.
- **`ChaseTask.priority`** — enum: `normal` / `escalated`.
- **`ChaseTask.chaseCount`** — int. Bumped by the engine on each cadence tick AND by `comms.createCommunicationRecord` on outbound comms tied to the task.
- **`ChaseTask.assignedToId`** — String? FK → `User`. Set by the engine to `transaction.assignedUserId`. NOT set by the two read-path side-effect creators.
- **`Contact.portalToken`** — String? unique. Per-Contact UUID. Long-lived, no expiry, no rotation.
- **`Contact.email`** — String?. Optional.
- **`OutboundEmailQueue.recipientUserId`** — String, required. Cannot queue to a Contact today.
- **`OutboundMessage.isAutomated`** — Boolean default false. Set true on portal-driven automated emails. NOT set true on agent-initiated chase emails.
- **`OutboundMessage.createdByRole`** — String?. Role of creator; null for portal-automated and chase-send-email rows.
- **`OutboundMessage.chaseTaskId`** — String? FK → `ChaseTask`. When set, the engine sees the comm as part of the chase ladder.
- **`PortalMessage`** — separate model from `OutboundMessage`. Holds typed messages between client and agent. NOT in the agent ActivityTimeline.
- **`SystemNotification`** — added 2026-05-21 ([prisma/migrations/20260521230000_add_system_notification](prisma/migrations/20260521230000_add_system_notification/migration.sql)). One-shot flag keyed by string. First user: `medians_ready`.

---

*End of discovery. No design follows.*

---

## Sub-arc B post-arc follow-ups

Items that need fixing AFTER Sub-arc B ships but were not appropriate to bundle into the original commits. Do NOT forget these.

### 1. RemindersSection.tsx chip text per fallback kind

**Context:** B3 expanded the fallback chip in `components/reminders/AgentRemindersList.tsx` to render distinct text for each of the five `FallbackKind` values. The sibling component `components/reminders/RemindersSection.tsx` (the file-detail reminders panel) still renders a single generic chip — `"Client opted out — manual"` — for ALL fallback kinds.

**Why deferred:** at B3 commit time, `RemindersSection.tsx` had uncommitted auto-animate / optimistic-hide refactor work from a parallel conversation. Per the branch-hygiene protocol I stopped and flagged; the user chose to leave RemindersSection.tsx untouched in B3 rather than rush the parallel work to commit. Generic chip is acceptable in the interim because Sub-arc B's cron is flag-gated OFF — no fallback chips render in production until launch.

**What to do:** small follow-up commit AFTER the auto-animate work in the other conversation lands. Copy the same chip text mapping from `AgentRemindersList.tsx`'s chip-render block into `RemindersSection.tsx`'s equivalent block. Five kind→text mappings; one extra `<span>` per kind isn't needed if a mapping function handles all five.

**How to apply:** during launch prep (or earlier if the auto-animate refactor commits first), grep `AgentRemindersList.tsx` for `fallbackKind === "client_opted_out"` to find the existing block, copy the text mapping into `RemindersSection.tsx`, ship as a single-concern commit.

---

## Sub-arc B planning agenda (carried from A1 sign-off)

Items raised during Sub-arc A that need a deliberate decision when planning Sub-arc B. Do NOT act on these in Sub-arc A.

### 1. Portal-side hard block on client exchange/completion self-confirm

A1 unified the confirmation path so a client portal-confirm of VM18/PM25/VM19/PM26/VM20/PM27 now fires the full cascade — bilateral counterpart write, chain-mate notifications, retention email queue, SP notification. That's the correct cascade for any exchange/completion event regardless of who triggered it.

However, today's "exchange/completion is agent-only" rule is **only an auto-chase exclusion** — Sub-arc A's chaseable-milestone allowlist excludes those codes from being emailed about. The portal UI and `portalCompleteMilestone` still allow a client who navigates unprompted to confirm any available milestone, including the six bilateral ones.

After A1, the blast radius of a mistaken client exchange-confirm is larger than before (bilateral writes + chain-mate emails now also fire).

**Open question for Sub-arc B:** add a portal-side guard (probably in `portalCompleteMilestone` or its action wrapper) that hard-blocks client self-confirmation of `VM18`, `PM25`, `VM19`, `PM26`, `VM20`, `PM27` — making "agent-only" a real block, not just a chase exclusion.

Document the chosen position at the start of Sub-arc B planning. (Don't surprise yourself by inheriting today's default.)

