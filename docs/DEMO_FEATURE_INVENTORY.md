# Demo Feature Inventory

**Status:** Step zero of the demo system build. Read-only audit. No code was changed.
**Method:** `app/**/page.tsx` glob + middleware analysis + cross-cutting trace. Citations are file:line; uncited claims are noted as such.
**Scan date:** 2026-06-05
**Sign-off gate:** Ellis replies **"Audit approved"** before any demo code is written.

---

## Acceptance checklist

```
[x] Every agent-reachable route inventoried (glob + middleware analysis — count stated below)
[x] Every state row has a seed-term "data required" entry or an explicit n/a
[x] Volume requirements stated for hub, analytics, work queue, transaction list
[x] Section A (data model / milestone mechanics) answered with citations
[x] Section B (email + side-effect dispatch and suppression) answered — flagged, BLOCKING
[x] Section C (auth / account minting) answered with citations
[x] Section D (portal token + view) answered with citations
[x] Section E (staging DB separation + safety rail options) answered
[x] Section F (reset surface + teardown order) answered
[x] Docs gaps section present
[x] No code was changed
```

---

## Route counts

**Glob `app/agent/**/page.tsx`:** 39 files.
**Glob `app/portal/[token]/**/page.tsx`:** 6 files.
**Glob `app/help/**/page.tsx`:** 1 file.

**In scope for demo (production agent + portal):** 14 production agent pages + 1 help page + 6 portal pages = **21 pages.**
**Excluded (dev/preview/audit, with one-line reason — see "Excluded routes" at end):** 18 agent files.

The agent middleware is at [middleware.ts](middleware.ts). Agent-allowed prefixes (line 161): `/agent`, `/api`, `/portal`, `/claim`, `/invite`, `/invite-negotiator`, `/help`, `/helpdrawertest`, `/drawertest`, `/bgtest`. Anything else for `director` / `negotiator` redirects to `/agent/hub` ([middleware.ts:162-164](middleware.ts#L162-L164)). The Command Centre `/command/*` requires `superadmin` or a hybrid-superadmin email ([middleware.ts:41-112](middleware.ts#L41-L112)).

Access scope is resolved by `getAccessScope(session)` at [lib/security/access-scope.ts:26-43](lib/security/access-scope.ts#L26-L43): director/negotiator/viewer are agency-scoped, `sales_progressor` is scoped to `assignedUserId`, admin/superadmin (and the hybrid sales_progressor case via `hasAdminPowers`) see everything. Customer-agency users have `agencyId` set; internal staff have `agencyId = null`.

---

## Per-page inventory

> Format note: every page uses `requireSession()` from [lib/session.ts](lib/session.ts). The middleware has already gated entry by role; the per-page `notFound()` / `redirect()` calls below are the secondary checks. "Roles" rows quote the page-level check, not the middleware.

---

### Hub
Route: `/agent/hub`        File: [app/agent/hub/page.tsx](app/agent/hub/page.tsx)
Roles: All authenticated agents + internal staff. Branches on `isInternalStaff` ([hub/page.tsx:86](app/agent/hub/page.tsx#L86)) and `isProgressor` ([hub/page.tsx:87](app/agent/hub/page.tsx#L87)); no `notFound()` gate.
In PAGE_LIST.md: yes (position 3)

Purpose: The post-login landing page. A glance-level view of pipeline health, urgent attention items, exchange forecast, today's diary, momentum vs last month, service split (self-managed vs outsourced), and recent activity.

Key actions:
- "New sale" → links to [/agent/transactions/new-v2](app/agent/transactions/new-v2) ([hub/page.tsx:129](app/agent/hub/page.tsx#L129), [266](app/agent/hub/page.tsx#L266))
- "Send a note to our team" — `AgentFlagButton` ([hub/page.tsx:135](app/agent/hub/page.tsx#L135), agent-only)
- Drill into filtered transactions via the "Pipeline health" tiles and "Coming up" links (e.g. `?filter=exchanging-this-week`)
- Acknowledge expired holds (`ExpiredHoldsCard`), unassigned files, new relist buyer rounds — all server-action backed widgets
- Open today's diary items linking to `/agent/transactions/[id]` ([hub/page.tsx:317](app/agent/hub/page.tsx#L317))

Demo-visible states:

| State | Trigger condition | Data required to produce it | Demo note |
|---|---|---|---|
| Empty (first-login) | `pipelineStats.activeFiles === 0 && attentionItems.length === 0` ([hub/page.tsx:120](app/agent/hub/page.tsx#L120)) | A demo agency with **zero** PropertyTransactions for the logged-in user's scope | Renders the welcome-card variant with ghost skeletons. Useful to show as the "before" state if we demo a clean account, but not the primary demo target. |
| Full hub — healthy | ≥3 active files spread across the next 30 days; no escalated reminders | ≥6 PropertyTransactions, `status="active"`, with `expectedExchangeDate` populated and spread across upcoming weeks; ReminderLogs in `due_today` or `upcoming` buckets only | The natural "this is what a real agent's morning looks like" shot. |
| Attention urgency: escalated / overdue / on-track | `escalatedCount > 0` → "action"; else `overdueCount > 0` → "watch"; else "on_track" ([hub/page.tsx:115](app/agent/hub/page.tsx#L115)) | ReminderLog rows whose computed bucket is `escalated` (chase count ≥ rule's `escalateAfterChases`) or `overdue` (`nextDueDate < today`) | Strong moment — the red-pill "needs attention" stat tile is the most visible thing. Want at least 2 escalated + 3 overdue across 3+ files. |
| Today's diary populated | ≥1 transaction with `expectedExchangeDate = today` OR `completionDate = today` | ≥1 PropertyTransaction with one of those date fields = today | Both colour variants (exchange = coral, completion = green) render side-by-side if you have both. |
| Pipeline value visible | At least one transaction with `purchasePrice` set | Set `purchasePrice` (pence) on every demo transaction. £350k–£1.2M spread looks real. | Formatter switches to "£1.2m" / "£142k" / "£X" via `fmtCurrency` ([hub/page.tsx:51](app/agent/hub/page.tsx#L51)). |
| Service split (donut) | Mixed `serviceType` across the visible set | ≥2 `self_managed` + ≥2 `outsourced` transactions | Hidden for `sales_progressor` unless admin ([hub/page.tsx:620](app/agent/hub/page.tsx#L620)). For an agent demo, the split is one of the strongest "we save you time" moments — keep both sides populated. |
| Stalled files row | `pipelineStats.stalled.count > 0` ([hub/page.tsx:530](app/agent/hub/page.tsx#L530)) | ≥1 active transaction with `lastActivityAt` ≥14 days ago | Backdate `createdAt` 30 days and stop short of confirming any recent milestone. |
| Momentum percent populated | `momentum.percent !== null` ([hub/page.tsx:587](app/agent/hub/page.tsx#L587)) | ≥1 exchange in current month AND ≥1 exchange in previous month (`exchangedAt` field on PropertyTransaction) | The ring renders flat if either side is 0. To show "ahead of last month" need ≥1 exchange this month, fewer last month. |
| Payment block / nudge banners | Director only, `agencyId` set, `paymentFailedAt` or trial elapsed without card | Agency with `paymentFailedAt = now-7d` for block; agency with `firstSubmissionAt = now-15d` and no `stripeCustomerId` for nudge | Probably **skip** in demo — billing banners are noise during a feature tour. Easy to suppress by setting `firstSubmissionAt = now` and `stripeCustomerId = "demo-stub"` on the agency. |

Volume requirement: **≥6 active transactions** spread across 2 assigned users (so the donut/momentum/forecast all render meaningfully). For the "needs attention" tile to be coloured: ≥2 reminders in the `escalated` bucket.

Maturity: Polished. Evidence: tokenised throughout (`var(--agent-coral)` etc.), no `prisma as any`, no TODOs in file.
Evidence: read [hub/page.tsx](app/agent/hub/page.tsx) in full.

---

### Transactions list (All Files / My Files)
Route: `/agent/transactions`        File: [app/agent/transactions/page.tsx](app/agent/transactions/page.tsx)
Roles: All authenticated. Director/admin sees "All Files"; negotiator/SP sees "My Files" (title branches at [transactions/page.tsx:138](app/agent/transactions/page.tsx#L138)). The `agencyId` filter applies for director/negotiator; internal staff use `getAccessScope` ([transactions/page.tsx:82](app/agent/transactions/page.tsx#L82)).
In PAGE_LIST.md: yes (position 5, with position 6 dashboard absorbed in 2026-05-12)

Purpose: The canonical list of every transaction the user can see. Status tabs (active / on_hold / completed / withdrawn), hub deep-link filters (`?filter=…`), month forecast pills (`?exchanging=YYYY-MM`), search, and the Activity-Forward table IA locked 2026-05-13.

Key actions:
- Click into a transaction → `/agent/transactions/[id]`
- "New sale" button (hidden for SP/viewer — [transactions/page.tsx:147](app/agent/transactions/page.tsx#L147))
- Filter by status / hub bucket / month
- `AgentFlagButton` (agent-only)
- The `TransactionListWithSearch` client component handles in-page search

Demo-visible states:

| State | Trigger condition | Data required to produce it | Demo note |
|---|---|---|---|
| Empty (first-login) | `allTransactions.length === 0` ([transactions/page.tsx:232](app/agent/transactions/page.tsx#L232)) | No transactions in scope | "Create your first sale" CTA renders. Useful if showing a fresh agent flow. |
| Empty (filtered) | `filteredTransactions.length === 0 && allTransactions.length > 0` | Any combination of filters resolving to zero | Three branches: hub-filter / month-filter / status. Each has its own copy. |
| Active list with all status tabs populated | Counts for all four statuses > 0 | Mix: ≥4 active, ≥1 on_hold, ≥1 completed, ≥1 withdrawn | Strong moment — proves the status tabs aren't dead. |
| ForecastStrip visible | `forecastMonths.length > 0` and not hub-filtered | Transactions spanning ≥2 future months by `expectedExchangeDate` | Refactored 2026-05-12 from a tall card to a single-row month-pill strip. |
| Last-activity verb chip populated | Each transaction needs `lastActivityType` + `lastActivityLabel` on `HealthRaw` | These are derived server-side from the latest milestone / outbound message ([transactions/page.tsx:77](app/agent/transactions/page.tsx) — header note, citing PAGE_LIST.md row 5 "Table IA (2026-05-13)") | Not verified in this audit which exact write populates them. **Could not determine from code in this scan — needs a runtime check on a seeded transaction.** |
| Assigned-to column shown | role !== "negotiator" && role !== "sales_progressor" ([transactions/page.tsx:97](app/agent/transactions/page.tsx#L97)) | For a director demo, populate `assignedUserId` and `agentUserId` across ≥2 users so the column shows different names | Single-name column reads as dead — needs 2+ assignees minimum. |

Volume requirement: **≥8 active transactions** (so search filtering and the activity chip cluster look alive), spread across **≥2 agents** for the assigned-to column, with **≥1 in each status** so all four tabs have content.

Maturity: Polished. Evidence: heavily commented for the 2026-05-12 merge of `/agent/dashboard`, tokenised, no `prisma as any` in this file.

---

### Transaction detail
Route: `/agent/transactions/[id]`        File: [app/agent/transactions/[id]/page.tsx](app/agent/transactions/[id]/page.tsx)
Roles: All authenticated, with explicit ownership guard at [transactions/[id]/page.tsx:124](app/agent/transactions/[id]/page.tsx#L124): "Agent ownership check: director sees all; negotiator only sees their own files." Internal staff bypass via `getTransactionByScope`.
In PAGE_LIST.md: yes (position 2; Stage 4 complete 2026-05-11)

Purpose: The single most-visited page in the app. The hero strip (address, price, predicted exchange, on-track ring), tabs (Overview, Steps, Reminders, To-Do, Activity), sidebar (Price & Fees, exchange forecast, hold periods, reassign control), and contextual banners (claim welcome, reconcile-later, chain setup failed, on-hold, relist).

Key actions:
- Confirm a milestone (StepsPanel → `confirmMilestoneAction` — see Section A for full side-effect chain)
- Send a chase via the Reminders panel
- Add a to-do (manual task) for the file
- Compose an email to a solicitor / contact (Activity panel; uses `resolveSenderForTransaction` from [lib/email.ts:148](lib/email.ts#L148))
- Director-only: reassign the file owner (`ReassignOwnerControl` — [transactions/[id]/page.tsx:260](app/agent/transactions/[id]/page.tsx#L260))
- Internal-staff only: toggle "Suppress portal confirm emails" (`PortalConfirmEmailToggle` — [transactions/[id]/page.tsx:357](app/agent/transactions/[id]/page.tsx#L357), backed by `PropertyTransaction.suppressPortalConfirmEmails` field)
- Internal-staff only: AI summary button (ellis-only — [transactions/[id]/page.tsx:351](app/agent/transactions/[id]/page.tsx#L351))

Demo-visible states:

| State | Trigger condition | Data required to produce it | Demo note |
|---|---|---|---|
| Active mid-journey | `status="active"`, mix of complete/available/locked milestones | Freehold × Mortgage; MilestoneCompletion rows for VM1–VM5, PM1–PM4 in `complete` state; VM6–VM17 / PM5+ `available` or `locked`; `purchasePrice`, `expectedExchangeDate ~6 weeks out` set | The default demo file — every panel has something to show. |
| Exchange-ready (gate unlocked) | All VM1–VM17 (blocksExchange=true) complete or NR; all PM1–PM24 (blocksExchange=true) complete or NR | Both VM18 and PM25 transitioned to `available` by `maybeUnlockExchangeGate` (per agent A's trace, [lib/services/milestones.ts:248-290](lib/services/milestones.ts#L248-L290)) — meaning every prior milestone is complete or NR | Strong moment — proves the gate concept. Sets up the confetti animation if the next click confirms VM19/PM26. |
| Exchanged (post-exchange) | `exchangedAt` set; VM19 + PM26 both complete | Mark all milestones VM1–VM19 + PM1–PM26 complete; `exchangedAt` is stamped by `maybeStampExchange` ([lib/services/billing-trigger.ts:53-56](lib/services/billing-trigger.ts#L53-L56)) | Renders the `ExchangeBanner` (in portal — agent side shows VM19/PM26 ticks + completion countdown). |
| Completed | `status="completed"`; `completionDate` set | All milestones complete including VM20 + PM27; flip `status="completed"`; `completionDate` set; `billedAtExchange` populated for fee history | Useful for the "post-completion" view + analytics inputs. |
| On hold | `status="on_hold"` | Set `status="on_hold"` plus create a `TransactionHoldPeriod` row | Renders the `OnHoldBanner` ([transactions/[id]/page.tsx:294](app/agent/transactions/[id]/page.tsx#L294)). |
| Withdrawn pre-exchange (relist candidate) | `status="withdrawn"` AND `exchangedAt === null` | Set status + leave exchangedAt null | Triggers `RelistBanner` ([transactions/[id]/page.tsx:295](app/agent/transactions/[id]/page.tsx#L295)). Strong moment if we want to demo the relist arc. |
| In a chain | `chainLinkId` is non-null | Create a `PropertyChain` + `ChainLink` row pointing back; set `transaction.chainLinkId` to the link id | Renders the `inChain` badge in the hero. |
| MOS just confirmed | URL search param `newUser=1` OR transient note | `MosConfirmedNotice` is shown by a query-param signal ([transactions/[id]/page.tsx:289](app/agent/transactions/[id]/page.tsx#L289)) | Probably skip — flash UI not central to demo. |
| Reassign owner control visible (director, self-managed) | Viewer is director AND `serviceType="self_managed"` AND ≥2 assignable agents | `assignableAgents.length > 1` ([transactions/[id]/page.tsx:260](app/agent/transactions/[id]/page.tsx#L260)) | Need ≥2 director/negotiator users in the agency for this to render. |

Volume requirement (per file): ≥4 contacts (2 vendor, 2 purchaser names for the "& Sarah" formatting), vendor + purchaser solicitor contacts attached, at least one OutboundMessage in the activity timeline.

Maturity: Polished. Evidence: huge structured file with documented perf refactor 2026-06-03 (lines 1–25), no `prisma as any`, all panels are `<Suspense>`-wrapped server components.

---

### New sale (new-v2)
Route: `/agent/transactions/new-v2`        File: [app/agent/transactions/new-v2/page.tsx](app/agent/transactions/new-v2/page.tsx)
Roles: All authenticated agents and internal staff. Trial-expired gate only blocks directors without a Stripe card after the 14-day window ([new-v2/page.tsx:26-77](app/agent/transactions/new-v2/page.tsx#L26-L77)); negotiators get `BillingNegotiatorModal` from elsewhere; internal staff bypass entirely.
In PAGE_LIST.md: yes (position 1, X-Large)

Purpose: The X-Large composite form to create a `PropertyTransaction`. Two-column desktop, single-column mobile; MOS drop zone, chain section expansion, solicitor picker, multi-party contact entry (up to 2 vendors, 2 purchasers).

Key actions:
- Submit → `createTransactionAction` (Section A trace). Side effects: PropertyTransaction + BuyerRound created, MilestoneCompletion rows initialised, optional MOS auto-confirm, initial reminders seeded, **outsource intro email** fire-and-forget if `progressedBy="progressor"` ([app/actions/transactions.ts:259-262](app/actions/transactions.ts#L259-L262)).
- Optional chain creation alongside the file
- Form delegates to `NewSaleFlow` component ([components/transactions-v2/NewSaleFlow.tsx](components/transactions-v2/NewSaleFlow.tsx))

Demo-visible states:

| State | Trigger condition | Data required to produce it | Demo note |
|---|---|---|---|
| Standard form (director with card / inside trial) | Director with `stripeCustomerId` set OR `firstSubmissionAt > now-14d` | On the demo agency: set `firstSubmissionAt = now` and `stripeCustomerId = "demo-stub"` | The form is the centrepiece of the new-sale demo. |
| Trial-expired modal (director, no card, past 14d) | `noCard && (isLegacy || trialElapsed)` ([new-v2/page.tsx:45](app/agent/transactions/new-v2/page.tsx#L45)) | Set `firstSubmissionAt = now-15d` + `stripeCustomerId=null` | Probably **avoid** in the main demo flow (billing gate is not what we're selling). Could be a dedicated scenario for the "expired trial recovery" story. |
| Legacy fee tier | `feeTier="legacy"` on Agency | Set `feeTier="legacy"` + `legacyOutsourcedFeePence` (pence integer) | Cuts the trial window. Skip unless we want to show legacy contract handling. |
| Form completed → file lands on detail page | Successful submit → `redirect("/agent/transactions/[id]")` | n/a — just a flow demo | Strongest moment. **Watch the side-effect surface — see Section B.** The outsource intro email will fire if `progressedBy="progressor"`. |

Volume requirement: n/a (page is single-instance).

Maturity: Polished but uses `prisma as any` cast (per PAGE_LIST.md uncertainty note for position 1). Not visible at this page level — the cast is inside `NewSaleFlow` / `components/transactions-v2/`. Did not deep-read the form tree.

---

### Work queue (Reminders)
Route: `/agent/work-queue`        File: [app/agent/work-queue/page.tsx](app/agent/work-queue/page.tsx)
Roles: All authenticated. Branches on `isInternalStaff` ([work-queue/page.tsx:46](app/agent/work-queue/page.tsx#L46)).
In PAGE_LIST.md: yes (position 4)

Purpose: All reminders grouped into Overdue / Due Today / Coming Up (next 3 business days). Plus a `FileAlertsStrip` at the top for file-level health alerts (stalled, slow, no-activity). Admin viewers see the list with chase buttons hidden ([work-queue/page.tsx:137](app/agent/work-queue/page.tsx#L137) — `hideChase={session.user.role === "admin"}`).

Key actions:
- Chase (per reminder) — sends a chase email via `OutboundMessage` flow
- Snooze a reminder (kebab menu)
- Click reminder → linked transaction detail
- Per the recent commit `fc62548 fix(reminders): gate ReminderCard's snooze + kebab listeners on open`, snooze/kebab listeners are gated

Demo-visible states:

| State | Trigger condition | Data required to produce it | Demo note |
|---|---|---|---|
| Empty (no files, no reminders) | `reminderLogs.length === 0 && activeFileCount === 0` | No transactions | Renders ghost reminder skeletons. |
| Empty (files exist, no reminders) | Files exist but no reminders due | All ReminderLog rows have `nextDueDate > now+3d` OR are completed | Different empty path. |
| Overdue + Due today + Coming up — all populated | Spread reminders across the three buckets | ReminderLogs: ≥2 with `nextDueDate < today` (overdue); ≥1 with `nextDueDate = today`; ≥2 with `nextDueDate` in next 3 business days | The strongest moment — header stat pills all light up. |
| Escalated | `chaseCount >= rule.escalateAfterChases` for a ReminderLog | Set `chaseCount` to ≥ the rule threshold (e.g. 3) | Rolls into "overdue" pill colour but adds the escalation flag on the card. |
| Snoozed (hidden from buckets) | `snoozedUntil > now` on the log | Set `snoozedUntil = now + 3d` on ≥1 reminder | Reminder disappears from the queue. Skip in demo unless we want to show snooze. |
| FileAlertsStrip visible | `items.length > 0` from `getWorkQueueItems(vis)` ([work-queue/page.tsx:51](app/agent/work-queue/page.tsx#L51)) | A transaction matching the stalled / slow / no-activity heuristics — likely backdated `lastActivityAt` 14+ days | The amber strip at the top is high-signal — keep ≥1 visible. |

Volume requirement: **≥5 reminders distributed across all three buckets** + ≥1 file alert.

Maturity: Polished. Evidence: clean classification helper extraction ([lib/reminders/classify.ts](lib/reminders/classify.ts)), no `prisma as any`.

---

### Completions
Route: `/agent/completions`        File: [app/agent/completions/page.tsx](app/agent/completions/page.tsx)
Roles: All authenticated. Subtitle branches on admin / progressor / agent ([completions/page.tsx:113](app/agent/completions/page.tsx#L113)).
In PAGE_LIST.md: yes (position 8)

Purpose: Post-exchange files awaiting completion, grouped by completion-date urgency (Overdue / This week / Next week / Later / No date set). Pipeline summary line shows file count, total fees, total sale value.

Key actions:
- Drill into a file
- (No mutations from this page — it's a curated read of `exchangedAt IS NOT NULL AND completionDate >= today OR completionDate IS NULL`)

Demo-visible states:

| State | Trigger condition | Data required to produce it | Demo note |
|---|---|---|---|
| Empty | `files.length === 0` | No exchanged files | Renders ghost group skeleton. |
| Populated with all five urgency groups | One file in each bucket | Need ≥5 exchanged files (`exchangedAt` set): 1 with `completionDate < today`; 1 within 7d; 1 within 14d; 1 after 14d; 1 with `completionDate = null` | Shows the colour-coded grouping. |
| Pipeline summary visible | `files.length > 0` | Set `purchasePrice` and `agentFeeAmount` on at least some files | The "£X total fees / £Y in sales" line is a strong revenue moment. |

Volume requirement: **≥5 files with `exchangedAt` set**, ideally spread across all five urgency buckets; ≥3 of them with `agentFeeAmount` populated.

Maturity: Polished. Tokenised, no `prisma as any`.

---

### Updates (comms / activity feed)
Route: `/agent/comms`        File: [app/agent/comms/page.tsx](app/agent/comms/page.tsx)
Roles: All authenticated. Title "Updates" (renamed from "Comms"). Subtitle branches on admin / progressor / agent ([comms/page.tsx:84](app/agent/comms/page.tsx#L84)).
In PAGE_LIST.md: yes (position 7)

Purpose: Day-grouped feed of completed `MilestoneCompletion` rows across files. Filter toggle: All milestones / Client confirmations only.

Key actions:
- Toggle filter (`?filter=portal`)
- Click an entry to drill into the transaction
- Day buckets default-open for Today / Yesterday only ([comms/page.tsx:75](app/agent/comms/page.tsx#L75))

Demo-visible states:

| State | Trigger condition | Data required to produce it | Demo note |
|---|---|---|---|
| Empty | `milestones.length === 0` | No MilestoneCompletion rows (`completedAt IS NOT NULL`) | Ghost preview. |
| Filter=portal, no client confirms | Filter set, but no rows with `confirmedByPortal=true` | Distinct empty copy. |
| Populated with today + yesterday + earlier buckets | MilestoneCompletions spanning days | Confirm milestones at varying `completedAt` timestamps: ≥2 today, ≥2 yesterday, ≥3 across the prior week | The day-grouping is the visual; need ≥2 buckets for it to read. |
| Client confirmation flag (✓ from portal) | `confirmedByPortal=true` on a MilestoneCompletion row | When seeding, set this column to true on ≥2 rows | "Confirmation card" gets a special icon. |

Volume requirement: **≥7 MilestoneCompletion rows across ≥3 days**; ≥2 with `confirmedByPortal=true`.

Maturity: Polished.

---

### To-Do
Route: `/agent/to-do`        File: [app/agent/to-do/page.tsx](app/agent/to-do/page.tsx)
Roles: All authenticated. Internal staff (SP / admin / superadmin) see additional `listInternalSelfAssignedTasks()` ([to-do/page.tsx:22](app/agent/to-do/page.tsx#L22)); progressors see `listProgressorInboxTasks()` (the "from agents" queue).
In PAGE_LIST.md: yes (position 9)

Purpose: Manual notes the agent has captured for themselves, plus (for agents) anything they've flagged to their progressor, plus (for progressors) the inbox of agent requests.

Key actions:
- Add a to-do (own)
- Resolve / complete / re-open
- (Progressor) work an inbound agent request

Demo-visible states:

| State | Trigger condition | Data required to produce it | Demo note |
|---|---|---|---|
| Empty | No `ManualTask` rows in scope | No ManualTasks created | Plain empty list. |
| Own tasks populated | `ownOpen.length > 0` | `ManualTask` rows where `assigneeId = session.user.id`, `isAgentRequest=false`, `status="open"` | Need ≥3 to show grouping. |
| With-progressor populated | `progOpen.length > 0` | `ManualTask` rows where `isAgentRequest=true`, attached to the agent's transactions | Demonstrates the agent ↔ SP workflow. |
| Overdue red flag | Open task with `dueDate < today − 4 days` ([to-do/page.tsx:32](app/agent/to-do/page.tsx#L32)) | Set `dueDate = now - 5d` on ≥1 task | Triggers the red-overdue tone. |

Volume requirement: ≥4 ManualTask rows split across own-tasks and (if demoing outsourced flow) progressor-requests; ≥1 overdue.

Maturity: Polished.

---

### Analytics
Route: `/agent/analytics`        File: [app/agent/analytics/page.tsx](app/agent/analytics/page.tsx)
Roles: All authenticated. Director-only widgets: team filter, CSV export, referral stats, broker referral stats ([analytics/page.tsx:78-79](app/agent/analytics/page.tsx#L78-L79)).
In PAGE_LIST.md: yes (position 10, last deferred Stage 4 trigger for new-v2)

Purpose: Pipeline funnel, speed-to-exchange, monthly trends, KPI sparklines, files at risk, solicitor exchange stats, referral income, broker referral income. Period filter (week / month / year / all).

Key actions:
- Filter by period
- Director: filter by team member (`?user=<id>`)
- Director: export CSV (`/api/agent/analytics-export?period=…`)
- Drill into a file from the "no fee" list or "at risk" list

Demo-visible states:

| State | Trigger condition | Data required to produce it | Demo note |
|---|---|---|---|
| Empty (no files) | `transactions.length === 0` ([analytics/page.tsx:94](app/agent/analytics/page.tsx#L94)) | Zero transactions in scope | Shows the "Submit your first sale" CTA + ghost analytics preview. |
| Populated month view | Default period, ≥1 transaction | ≥3 active transactions + ≥1 exchanged + ≥1 completed, all with `agentFeeAmount` / `purchasePrice` set | The core analytics tour. |
| Solicitor exchange stats populated | Multiple files share solicitor firms | Reuse 2–3 `SolicitorFirm` rows across ≥6 transactions, half exchanged | The stat reads "Firm X handled 3 exchanges, avg 78 days" — looks alive only with repeat firms. |
| Referral income (director) | `referralStats` non-empty | ≥1 transaction with `referredFirmId` set + `referralFee` populated | Director-only widget. |
| Broker referral income (director) | `brokerReferralStats` non-empty | ≥1 transaction with `brokerFirmId` + `brokerReferralFee` populated; ideally `purchaserBrokerReferral=true` for the "incoming" leg | Director-only widget. |
| Files at risk | `filesAtRisk` returned by `getFilesAtRisk(vis)` | Stalled or behind-pace files (heuristic in `lib/services/analytics.ts` — not deep-read) | **Could not fully determine the exact trigger from code in this scan — needs a runtime check.** Likely a combination of `lastActivityAt`, predicted vs expected exchange date, and milestone-velocity. |
| No-fee files list | Active files with no fee data | ≥1 active transaction with `agentFeeAmount=null` AND `agentFeePercent=null` | The widget exists ([analytics/page.tsx:87](app/agent/analytics/page.tsx#L87)) so a couple of these is realistic. |

Volume requirement: **≥10 transactions** with mixed statuses, multiple solicitor firms reused, fees populated on ≥6; **≥2 exchanged + ≥2 completed** so the funnel and speed-to-exchange charts have inputs.

Maturity: Polished, but a Director-heavy page — the negotiator view is much thinner.

---

### Partners (solicitors + brokers directory)
Route: `/agent/partners`        File: [app/agent/partners/page.tsx](app/agent/partners/page.tsx)
Roles: All authenticated. Director-only sub-cards: preferred broker setting + recommended solicitors setting ([partners/page.tsx:77](app/agent/partners/page.tsx#L77)).
In PAGE_LIST.md: yes (position 12)

Purpose: Directory of every solicitor firm + contacts the agency has interacted with, plus director-only configuration of preferred broker + recommended solicitor list (drives analytics referral income).

Key actions:
- Director: toggle a firm as "recommended", set default referral fee
- Director: set the preferred mortgage broker
- Drill into transactions where a contact appears

Demo-visible states:

| State | Trigger condition | Data required to produce it | Demo note |
|---|---|---|---|
| Empty | `firms.length === 0` | No transactions have referenced any SolicitorFirm | "No solicitor firms yet" empty card. |
| Populated directory | ≥1 `SolicitorFirm` referenced by transactions | Create 3–4 SolicitorFirm rows + SolicitorContact rows; set `vendorSolicitorFirmId` + `purchaserSolicitorFirmId` on transactions | Looks alive with ≥4 firms. |
| Recommended toggle on (director) | `AgencyRecommendedSolicitor` row exists for the agency + firm | Insert a row with `defaultReferralFeePence` | Shows the analytics-feeding setup. |
| Preferred broker configured | `AgencyPreferredBroker` row exists for the agency | Insert pointing at a `BrokerFirm` | Demonstrates the auto-prefill on new-sale. |

Volume requirement: **≥3 SolicitorFirm rows + ≥2 contacts per firm + ≥1 BrokerFirm row** (for the preferred-broker card to be filled).

Maturity: Mixed. Uses `prisma as any` cast at [partners/page.tsx:13](app/agent/partners/page.tsx#L13), per the PAGE_LIST.md uncertainty flag.

---

### Automation settings (director-only)
Route: `/agent/settings/automation`        File: [app/agent/settings/automation/page.tsx](app/agent/settings/automation/page.tsx)
Roles: Director only — explicit `notFound()` for anyone else ([settings/automation/page.tsx:25](app/agent/settings/automation/page.tsx#L25)).
In PAGE_LIST.md: **NO — NOT IN DOCS** (PAGE_LIST.md mentions only `/agent/settings` as position 13, but the parent `/agent/settings/page.tsx` does NOT exist as of this scan).

Purpose: Master toggle for automated client-facing chase emails (`Agency.chaseEmailsEnabled`) + per-milestone editing of `graceDays` and `repeatEveryDays` on `ReminderRule` rows. Settings edits are forward-only (existing transactions keep their `chaseRuleSnapshot`).

Key actions:
- Toggle master switch
- Edit grace / repeat per milestone (chaseable codes only — filtered by `isClientChaseable` at [settings/automation/page.tsx:54](app/agent/settings/automation/page.tsx#L54))

Demo-visible states:

| State | Trigger condition | Data required to produce it | Demo note |
|---|---|---|---|
| Default (chase enabled) | `Agency.chaseEmailsEnabled = true` (default) | Standard demo agency seed | The form lists every chaseable milestone with editable numeric inputs. |
| Chase paused | `chaseEmailsEnabled = false` | Toggle off | The fallback "client_emails_paused" chip would appear on ChaseTask rows (per schema comment at [prisma/schema.prisma:25-30](prisma/schema.prisma#L25-L30)). |

Volume requirement: n/a — single-row config page.

Maturity: Polished. Single-purpose director utility.

---

### Automated emails (cross-role)
Route: `/agent/automated-emails`        File: [app/agent/automated-emails/page.tsx](app/agent/automated-emails/page.tsx)
Roles: All authenticated. Scoping branches per role ([automated-emails/page.tsx:23-34](app/agent/automated-emails/page.tsx#L23-L34)).
In PAGE_LIST.md: **NO — NOT IN DOCS** (introduced after the 2026-05-10 scan).

Purpose: Platform-wide list of automated emails. Tabs: Pending / Sent (30d) / Errored / Upcoming (14d forecast). Deep-linkable by `?fileId=<id>`.

Key actions:
- Switch tab
- Director: "mine only" toggle (`?mine=1`)
- Drill into a file from a row

Demo-visible states:

| State | Trigger condition | Data required to produce it | Demo note |
|---|---|---|---|
| Pending tab populated | `OutboundEmailQueue` rows with `sentAt IS NULL` and `scheduledFor <= soon` | Insert ≥3 rows of `emailType="CLIENT_CHASE"` and `emailType="MILESTONE_CONFIRMATION"`, with `scheduledFor` in the next few hours; recipient = a seeded contact | Shows the operational pipeline before drain. |
| Sent (30d) tab | Rows with `sentAt` populated in the last 30 days | Pre-stamp `sentAt` on a batch | Demonstrates the "what went out" audit trail. |
| Errored tab | Rows with `errorAt` set | Set `errorAt` + `errorMessage` on ≥1 row | Useful to show resiliency UI. |
| Upcoming forecast | Rows with `scheduledFor` 24h–14d ahead | Seed scheduled future rows | The 14d forecast tab. |
| File-scoped view | `?fileId=<id>` query param + matching transaction in scope | Provide a transaction id to deep-link | Renders "Automated emails for <address>." |

Volume requirement: **≥10 OutboundEmailQueue rows spread across all four tab states**; mix of `emailType` values.

Maturity: Polished, with documented role branching in the file header.

---

### Admin (single-user)
Route: `/agent/admin`        File: [app/agent/admin/page.tsx](app/agent/admin/page.tsx)
Roles: Only `ellis@thesalesprogressor.co.uk` — `notFound()` for any other email ([admin/page.tsx:27-31](app/agent/admin/page.tsx#L27-L31)).
In PAGE_LIST.md: **NO — NOT IN DOCS**.

Purpose: Founder-only management page in the agent shell. Three cards: agency fee management (legacy override), milestone definitions (read-only), reminder rules (read-only).

Key actions: Set per-agency `feeTier="legacy"` + `legacyOutsourcedFeePence` via `AgencyFeeCard`. (The other two cards are pure read.)

Demo-visible states: This page is **out of demo scope** (single-user ellis gate). Mention only for completeness.

Maturity: Functional. No `prisma as any`. Sensible founder utility.

---

### Help
Route: `/help`        File: [app/help/page.tsx](app/help/page.tsx)
Roles: All authenticated; agent middleware allows `/help` prefix ([middleware.ts:161](middleware.ts#L161)).
In PAGE_LIST.md: yes (position 14)

Purpose: In-app help centre. Renders `.mdx` files from `docs/help/` as a sidebar + content layout ([help/page.tsx:10-48](app/help/page.tsx#L10-L48)).

Key actions: Browse articles, ToC anchor navigation, in-page search via `HelpSidebar`.

Demo-visible states:

| State | Trigger condition | Data required to produce it | Demo note |
|---|---|---|---|
| Populated | docs/help/*/*.mdx exists | The repo already ships help content — n/a for seeding | Show if a client asks "is there documentation?". Self-service moment. |

Volume requirement: n/a (static).

Maturity: Filesystem-backed; functional.

---

## Portal pages (read-only-ish — client-facing buyers/sellers)

> Authentication: portal pages bypass NextAuth via `authorized` callback at [middleware.ts:176](middleware.ts#L176) (`if (pathname.startsWith("/portal")) return true;`). Resolution is by `contact.portalToken` ([lib/services/portal.ts:216-227](lib/services/portal.ts#L216-L227)). Portal token is `randomUUID()` ([lib/services/contacts.ts:6,40](lib/services/contacts.ts#L40)). Creating a `Contact` with a token does NOT send an invite email — the email is only sent when `/api/portal/invite` is POSTed.

> For seeding: write `Contact` rows with `portalToken: randomUUID()`. Purchaser-side contacts must also have `buyerRoundId = tx.activeBuyerRoundId` (per the round-attribution rule used by the existing `/api/seed-demo` route at [app/api/seed-demo/route.ts:101](app/api/seed-demo/route.ts#L101)).

---

### Portal home
Route: `/portal/[token]`        File: [app/portal/[token]/page.tsx](app/portal/[token]/page.tsx)
Roles: Token-auth (no NextAuth gate).
In PAGE_LIST.md: deferred (portal pass)

Purpose: Hero strip + next-action card + circular progress ring + upcoming milestones list + recent activity timeline + key dates + stage tips. Branches vendor vs purchaser by `contact.roleType`.

Demo-visible states:

| State | Trigger condition | Data required to produce it | Demo note |
|---|---|---|---|
| Pre-exchange, mid-journey | Active file, several milestones complete, several pending | Standard mid-journey transaction (≥6 milestones complete on each side) | Default. |
| Exchanged | `transaction.exchangedAt` set | Mark VM19 + PM26 complete on the file | `ExchangeBanner` renders. |
| Completed | `transaction.status="completed"` | Set `status` + `completionDate` | `CompletionBanner` renders. |
| Dead round (round withdrawn) | `result.kind === "deadRound"` | `Contact.buyerRoundId` points at a round whose status is not `active` | `notFound()` returned. Skip in demo. |

Volume requirement: n/a (single contact per visit).

Maturity: Polished. Mobile-first.

---

### Portal respond (the only portal page with mutations)
Route: `/portal/[token]/respond`        File: [app/portal/[token]/respond/page.tsx](app/portal/[token]/respond/page.tsx)
Roles: Token-auth.

Purpose: Lists currently-due `ClientChaseState` milestones with confirm / set-date / leave-note controls per row. Source of truth is the DB's active ClientChaseState rows ([respond/page.tsx:54-60](app/portal/[token]/respond/page.tsx#L54-L60)); the `?items=` query-param from the chase digest URL is **ignored** for display. Engagement tracking: every page-load updates `lastEngagedAt` on the contact's active ClientChaseState rows.

Key actions:
- Confirm a milestone (calls `completeMilestone` server action — same side-effect chain as agent-side)
- Set an event date
- Leave a note

Demo-visible states:

| State | Trigger condition | Data required to produce it | Demo note |
|---|---|---|---|
| Items to respond to | ≥1 active `ClientChaseState` row for this contact | The client-chase cron normally creates these — for a static seed, insert ClientChaseState rows directly with `status="active"` | Strong demo moment if we want to show the "buyer confirms via portal" path. |
| All caught up | All ClientChaseState rows for this contact are `status != "active"` | Standard portal state when nothing is due | Empty branch. |

Volume requirement: ≥2 active ClientChaseState rows on the demo purchaser to make the page non-trivial.

Maturity: Polished. `export const dynamic = "force-dynamic"` ([respond/page.tsx:29](app/portal/[token]/respond/page.tsx#L29)) — never cached, always fresh.

---

### Portal progress (full milestone view)
Route: `/portal/[token]/progress`        File: [app/portal/[token]/progress/page.tsx](app/portal/[token]/progress/page.tsx)
Roles: Token-auth.

Purpose: Step-count pill + weighted % progress + full milestone list (own side + other side, with a pre-exchange filter and a next-up highlight).

Demo-visible states: Same as portal home — populated by the underlying transaction's milestones. Read-only.

Volume requirement: n/a.

Maturity: Polished.

---

### Portal updates (timeline)
Route: `/portal/[token]/updates`        File: [app/portal/[token]/updates/page.tsx](app/portal/[token]/updates/page.tsx)
Roles: Token-auth.

Purpose: Day-grouped timeline of `OutboundMessage` + `MilestoneCompletion` events for this contact's transaction/round. Method badges (email, phone, SMS, voicemail, WhatsApp, post) per entry.

Demo-visible states:

| State | Trigger condition | Data required to produce it | Demo note |
|---|---|---|---|
| Populated | ≥1 `OutboundMessage` row attached to this transaction | Insert OutboundMessage rows with varied `method` values (email / phone / sms / voicemail) and varied `createdAt` to fill day buckets | The timeline reads dead with <3 entries — aim for ≥6. |
| Empty | No messages, no completions visible to this contact | Don't insert any | Probably skip — empty timeline is a weak demo state. |

Volume requirement: **≥6 OutboundMessage rows** spread across multiple days; mix `method` values to show all six coloured badges.

Maturity: Polished.

---

### Portal exchange / portal complete (static checklists)
Routes: `/portal/[token]/exchange` ([app/portal/[token]/exchange/page.tsx](app/portal/[token]/exchange/page.tsx)) and `/portal/[token]/complete` ([app/portal/[token]/complete/page.tsx](app/portal/[token]/complete/page.tsx))
Roles: Token-auth.

Purpose: Pre-baked vendor/purchaser checklists for exchange day and completion day. Pure static content keyed on `contact.roleType` (vendor vs purchaser).

Demo-visible states: Single state per role (vendor checklist vs purchaser checklist). No data required beyond the contact + transaction.

Maturity: Polished, static content.

---

## Cross-cutting investigations

### A. Data model for seeding

**Minimum viable PropertyTransaction (verified against [prisma/schema.prisma:224-364](prisma/schema.prisma#L224-L364)):**
- Required, no default: `id` (cuid), `propertyAddress` (string), `agencyId` (string).
- Required relation: `agency` via `agencyId`.
- Critical for downstream rendering even though nullable: `status` (defaults `active`), `tenure` and `purchaseType` (control milestone auto-NR initialisation), `purchasePrice` (pence), `expectedExchangeDate` (auto-set to `createdAt + 84 days` in [lib/services/transactions.ts:869](lib/services/transactions.ts#L869) if absent), `assignedUserId` / `agentUserId`.
- Auto-stamped during create: `activeBuyerRoundId` (a `BuyerRound` with `roundNumber=1` is created in the same `$transaction` per [lib/services/transactions.ts:898-913](lib/services/transactions.ts#L898-L913)); `freeOnExchange` stamped from `agency.firstSubmissionAt`; `serviceType` derived from `progressedBy`.

**tenure × purchaseType controls auto-NR:** Auto-NR set defined at [lib/milestone-auto-nr.ts:26-46](lib/milestone-auto-nr.ts#L26-L46):
- Freehold (tenure=`freehold`) → VM8, VM9, PM12 are NR (no leasehold management pack).
- Cash purchase (purchaseType=`cash_buyer` OR `cash_from_proceeds`) → PM5, PM6, PM11 are NR (no mortgage).
- Cash-from-proceeds specifically → PM24 ALSO NR (deposit comes from own sale equity).

**Milestone codes:** Defined in [prisma/seed.ts:71-314](prisma/seed.ts#L71-L314). Vendor side VM1–VM20 (VM19 = contracts exchanged → bilateral exchange trigger; VM20 = completed). Purchaser side PM1–PM27 (PM26 = bilateral exchange trigger; PM27 = completed). Exchange gates are VM18 (vendor side) and PM25 (purchaser side) — they unlock to `available` when every same-side `blocksExchange=true` milestone is complete or NR ([lib/services/milestones.ts:248-290](lib/services/milestones.ts#L248-L290)).

**Dependency map:** At [lib/milestone-prerequisites.ts](lib/milestone-prerequisites.ts). Key cross-side dep: PM12 depends on VM9 (purchaser waits for vendor management pack).

**"Not required" handling:** Field `canBeMarkedNr` on `MilestoneDefinition` — values `never` / `auto_only` / `manual_allowed`. Manual NR via `markNotRequired()` at [lib/services/milestones.ts:1037-1055](lib/services/milestones.ts#L1037-L1055) — sets state, clears `completedAt`, records `notRequiredReason`, unlocks dependents, re-evaluates reminders.

**CRITICAL — how a completion is legitimately recorded:**

The full chain is `completeMilestone(input, tx?)` at [lib/services/milestones.ts:537-741](lib/services/milestones.ts#L537-L741). On a single completion call the following fire **atomically inside the same transaction**:

1. Prerequisite guard ([milestones.ts:558-588](lib/services/milestones.ts#L558-L588)) — throws if any prereq isn't `complete` or `not_required`.
2. Find-or-create the `MilestoneCompletion` row (scoped per BuyerRound for purchaser-side).
3. `unlockDirectDependents()` — promotes `locked` dependents to `available`.
4. `autoCompleteRemindersForMilestone()` — marks related ReminderLogs / ChaseTasks complete.
5. `maybeUnlockExchangeGate()` — flips VM18 or PM25 to `available` when all blockers are met.
6. Out-of-order flag resolution.
7. `touchLastActivity()` — sets `PropertyTransaction.lastActivityAt = now()`.
8. `maybeStampExchange()` for VM19/PM26 — sets `exchangedAt`, plus `billedAtExchange` + `priceAtExchange` (race-safe NULL-guarded write) for non-trial files ([lib/services/billing-trigger.ts:35-75](lib/services/billing-trigger.ts#L35-L75)).
9. Chain notifications enqueued ([milestones.ts:704-709](lib/services/milestones.ts#L704-L709)) for VM19 / VM20 / PM26 / PM27.
10. Command Centre event log written ([milestones.ts:715-738](lib/services/milestones.ts#L715-L738)).

**Decision needed before building the seed:** Can the demo seed write `MilestoneCompletion` rows DIRECTLY (the path the current [/api/seed-demo route does, lines 114-125](app/api/seed-demo/route.ts#L114-L125)), or must it route through `completeMilestone()`?

- **Direct insert** is what the existing `/api/seed-demo` does. It works for the limited "show me a mid-journey file" demo because none of the side-effect writes (auto-complete reminders for that code, chain notifications, exchange stamp, command-centre event) are needed for the rendered page. The trade-off: derived state stays inconsistent — ReminderLog rows that target a completed milestone won't be auto-cleared; `lastActivityAt` won't get touched; `exchangedAt` / `billedAtExchange` will be wrong if VM19/PM26 is in the completed set.
- **Route through `completeMilestone`** gives a consistent demo agency that behaves identically to a real one — at the cost of more complex seed code (constructing `Confirmer` context, running per-completion server-action calls instead of a bulk insert).

Recommendation flagged for sign-off (not a decision): use `completeMilestone()` for any milestone the demo *renders as complete*. Direct insert is acceptable for milestones whose only purpose is to satisfy prerequisites for other milestones the demo cares about, but VM19/PM26 specifically should always go through `completeMilestone` so `exchangedAt` / `billedAtExchange` write correctly.

**Automation that fires on PropertyTransaction create** (chronological, from [app/actions/transactions.ts:30+](app/actions/transactions.ts)):

1. Atomic `$transaction`: PropertyTransaction + BuyerRound created ([transactions.ts:839-914](lib/services/transactions.ts#L839-L914)).
2. `initializeMilestoneCompletions(tx.id, tenure, purchaseType, createdById, activeBuyerRoundId)` — only if both `tenure` and `purchaseType` are supplied ([app/actions/transactions.ts:209](app/actions/transactions.ts#L209)).
3. `prisma.contact.createMany()` for contacts ([transactions.ts:191-204](app/actions/transactions.ts#L191-L204)) — purchaser contacts stamped with `activeBuyerRoundId`.
4. Optional MOS auto-confirm (VM2 + PM2) via two `completeMilestone()` calls ([transactions.ts:214-230](app/actions/transactions.ts#L214-L230)).
5. Optional `TransactionDocument` create with `source="mos"`.
6. `createInitialRemindersInline(...)` — seeds ReminderLog rows for every active ReminderRule ([transactions.ts:250](app/actions/transactions.ts#L250)).
7. Fire-and-forget `evaluateTransactionReminders(tx.id)` for anchor-based / exchange-gated rules ([transactions.ts:252](app/actions/transactions.ts#L252)).
8. **Outsource intro email** fire-and-forget when `progressedBy="progressor"` ([transactions.ts:259-262](app/actions/transactions.ts#L259-L262)) — calls `sendOutsourceIntroForTransaction(tx.id, ...)`. **This is an email-sending side-effect on transaction-create.** See Section B.
9. Optional chain creation + invite sends ([transactions.ts:264-321](app/actions/transactions.ts#L264-L321)).
10. `revalidatePath()` on the transaction list pages.

For a demo seed, the safest practice is to bypass `createTransactionAction` entirely and replicate steps 1, 2, 3, 6 directly — skipping steps 4 (MOS), 8 (outsource intro email), and 9 (chain). This is what the current `/api/seed-demo` route does (no MOS, no email send).

---

### B. Side effects — BLOCKING

**Verified critical finding:** The two SendGrid wrappers at [lib/email.ts](lib/email.ts) behave differently with respect to `EMAIL_SANDBOX_MODE`:

- `sendEmail()` at [lib/email.ts:8-41](lib/email.ts#L8-L41) — **does NOT honour `EMAIL_SANDBOX_MODE`**. Calls `sgMail.send()` with no `mailSettings.sandboxMode` flag. Will send real emails to whatever address it's given.
- `sendChainEmail()` at [lib/email.ts:54-93](lib/email.ts#L54-L93) — **does** honour `EMAIL_SANDBOX_MODE`. Sets `mailSettings: { sandboxMode: { enable: isSandbox } }` at line 91.

This asymmetry means that on staging today, with `SENDGRID_API_KEY` set, the demo agency seed WILL send real emails the moment any `sendEmail()` call site fires. The protections vary by trigger:

**Trigger sites that fire `sendEmail()` (NOT sandbox-protected):**

| Trigger | Call site | Recipient resolution | Demo risk |
|---|---|---|---|
| Milestone confirm of VM19/VM20/PM26/PM27 (exchange/completion) | [lib/services/portal.ts:1547](lib/services/portal.ts#L1547) — `sendRichMilestoneEmails` | `c.email` (contact email) for each in-scope contact | HIGH — any time the demo confirms an exchange milestone via `completeMilestone`, a real email goes out unless the recipient address is non-deliverable |
| Portal message from client → agent | [lib/services/portal-messages.ts:144-165](lib/services/portal-messages.ts#L144-L165) | `assignedUser.email` | HIGH — if the demo agent has a real email and the demo buyer "replies via portal" |
| Portal message from agent → client | [lib/services/portal-messages.ts:215-238](lib/services/portal-messages.ts#L215-L238) | `contact.email` | HIGH |
| Portal invite manual send | [app/api/portal/invite/route.ts:58-97](app/api/portal/invite/route.ts#L58-L97) | `contact.email` | LOW — only fires if a user explicitly POSTs to the invite endpoint |
| Outsource intro on transaction create | `sendOutsourceIntroForTransaction` via `sendEmail` (per cross-cutting B agent trace) | Contact emails for the new file | MEDIUM — only fires when `progressedBy="progressor"`, so demos creating files via UI must use `progressedBy="agent"` |
| Welcome / claim / agent invites | `lib/emails/send-welcome.ts`, `send-claim-welcome.ts`, `negotiator-invitation.ts`, `director-invitation.ts` | User / contact emails | MEDIUM — fires from registration + invite-accept flows; not fired by core demo paths if we don't run those flows |

**Trigger sites that fire `sendEmail()` for batched/queued sends (NOT sandbox-protected at enqueue, ARE protected at drain via `sendChainEmail`):**

| Trigger | Enqueue | Drain |
|---|---|---|
| Milestone confirm of any non-exchange code | `enqueueEmail()` at [lib/email/outboundQueue.ts:102-148](lib/email/outboundQueue.ts#L102-L148) — pure DB write, no email send | `/api/cron/send-milestone-digests` calls `drainMilestoneDigests` every 3 minutes → calls `sendEmail()` for each group |

The drain uses `sendEmail()`, not `sendChainEmail()`, per the agent B trace. So MILESTONE_CONFIRMATION drains are also NOT sandbox-protected.

**Trigger sites that fire `sendChainEmail()` (ARE sandbox-protected when `EMAIL_SANDBOX_MODE=true`):**

- Client chase digest drain via `/api/cron/drain-outbound-email` ([lib/email/outboundQueue.ts:267-279](lib/email/outboundQueue.ts#L267-L279))
- Chain withdrawal / exchange / completion / celebration notifications
- Weekly briefs (per agent B trace)

**Existing env-var gates:**

- `EMAIL_SANDBOX_MODE=true` — gates only `sendChainEmail()` (incomplete — see above)
- `CLIENT_CHASE_ENABLED != "true"` — the client-chase cron at [/api/cron/client-chase/route.ts:29](app/api/cron/client-chase/route.ts#L29) returns `{ ok: true, skipped: "flag_disabled" }`, preventing any enqueue. Staging today has this OFF per the cross-cutting agent E findings.
- `SENDGRID_API_KEY` — module-init at [lib/email.ts:4](lib/email.ts#L4) does `sgMail.setApiKey(process.env.SENDGRID_API_KEY!)`. With `!`, the module will throw on import if the key is unset. **An empty-string key would not throw, but SendGrid would reject all calls** — not a clean suppression mechanism.

**What does NOT exist** (confirmed by direct grep — no callers found):
- No `EMAIL_DISABLED` flag.
- No `DEMO_MODE` flag.
- No `NODE_ENV === "production"` guard around any send call.
- No allowlist of recipient domains.

**Synthetic-address convention in the existing codebase:**

- `seed-{id}@spot-check.test` ([scripts/seed-staging-spot-check.ts:107](scripts/seed-staging-spot-check.ts#L107)) — `.test` is RFC 6761 reserved; not deliverable
- `seed-mildred@spot-check.test`, `seed-connor@spot-check.test` ([scripts/seed-darnley-contact-card-demo.ts:52,76,88](scripts/seed-darnley-contact-card-demo.ts#L52))
- `mitchell.demo@example.com`, `clarkes.demo@example.com` ([app/api/seed-demo/route.ts:88,97](app/api/seed-demo/route.ts#L88)) — `.com` example domains; SendGrid would attempt delivery and bounce
- Fixture agency domains in `seed-staging-test-data.ts`: `@hartwellpartners.co.uk`, `@brennanco.co.uk` — these are NOT guaranteed safe; could become real domains

**Recommendation flagged for sign-off (not a decision):** every seeded address should use `.test` or `.invalid` TLDs (RFC 6761 — guaranteed never to resolve / never to bounce a real inbox). The existing `@spot-check.test` convention is the right model; `@example.com` (used by the current `/api/seed-demo` route) is risky.

**Proposed but not built — the smallest safe suppression for the demo:**

Two-layered, both required:

1. **Address-level**: every seeded contact uses `*.test` or `*.invalid` TLDs.
2. **App-level**: add a single env-checked guard at the top of both `sendEmail()` and `sendChainEmail()` that short-circuits when `EMAIL_DEMO_SUPPRESS=true` is set. This is the only intervention that fixes the `sendEmail()` gap. Today, `EMAIL_SANDBOX_MODE` only protects the `sendChainEmail` half.

The second point requires a code change (one-line guard in two functions). I have flagged it but not implemented it — this is a read-only audit.

---

### C. Auth and account creation

**Agency creation:** [lib/auth/create-director-with-agency.ts:33-39](lib/auth/create-director-with-agency.ts#L33-L39). Fields: `name`, `signupAt`. All other Agency fields default.

**User creation paths:**

- Self-signup at `/register` → `app/api/register/route.ts:45-52` → `createDirectorWithAgency` → user row with `password` bcrypt-hashed (cost 12), `role` from request, `agencyId` linked, `firmName` set, `emailVerified=NULL`, `welcomeEmailSentAt=NULL` (then set by `sendWelcomeEmailIfNotSent`).
- Director invitation accept → [app/actions/accept-invitation-password.ts:44-86](app/actions/accept-invitation-password.ts#L44-L86) — bcrypt cost 12, role="director", linked to invitation's `agencyId`.
- Negotiator invitation accept → [app/actions/accept-negotiator-invitation.ts:40-50](app/actions/accept-negotiator-invitation.ts#L40-L50) — user row is pre-created with `password=NULL` at the director's invite step; acceptance updates `password`.
- Script-driven (admin) → e.g. [scripts/seed-test-accounts.ts:27-36](scripts/seed-test-accounts.ts#L27-L36) — `hashSync(password, 12)`, `role="sales_progressor"`, `agencyId=null`, `isInternal=false`.

**Password hashing:** `bcryptjs` at cost 12 across every path (`hash()` async or `hashSync()` sync — same library, same cost). Verified during login at [lib/auth.ts:84](lib/auth.ts#L84) via `compare()`.

**NextAuth Credentials config:** [lib/auth.ts:53-103](lib/auth.ts#L53-L103). `authorize()` returns `{ id, name, email, role, agencyId, firmName }`. JWT + session callbacks at [lib/auth.ts:139-148, 196-202](lib/auth.ts#L139) carry through.

**Minimum seed for a working Director login:**

1. One `Agency` row: `id` (cuid), `name`, `signupAt = NOW()`. Optional: set `firstSubmissionAt = NOW()` and `stripeCustomerId = "demo-stub"` to suppress the trial-expired and payment-method-nudge banners.
2. One `User` row: `name`, `email` (lowercased), `password = bcryptjs.hash(plaintext, 12)`, `role = "director"`, `agencyId = <agency.id>`, `firmName = <agency.name>`, `isInternal = false`, optionally `welcomeEmailSentAt = NOW()` to suppress retention email.

For a second user (negotiator), repeat with `role = "negotiator"` and the same `agencyId`. This is needed to render the "Assigned to" column on `/agent/transactions` with non-trivial content.

---

### D. Portal

**Portal token issuance:** `randomUUID()` from Node `crypto` ([lib/services/contacts.ts:6, 40](lib/services/contacts.ts#L6)). UUID v4, 36 chars, unique-indexed at the DB level ([prisma/schema.prisma](prisma/schema.prisma) — `Contact.portalToken` is `@unique`).

**Token issuance side effects:** None at write time. The token is generated when a Contact is created (e.g. during transaction-create's `contact.createMany`). The portal invite EMAIL is a separate explicit POST to `/api/portal/invite` ([app/api/portal/invite/route.ts:58-97](app/api/portal/invite/route.ts#L58-L97)). So seeding can attach `portalToken: randomUUID()` to every contact without triggering an email.

**Portal URL:** `/portal/[token]` resolves at [lib/services/portal.ts:216-227](lib/services/portal.ts#L216-L227) by `Contact.portalToken` lookup. If `null` → `notFound()`. If `result.kind === "deadRound"` (the Contact's `buyerRoundId` points at a withdrawn round) → `notFound()`.

**Portal sub-pages:** Already inventoried above. Only `/portal/[token]/respond` mutates (confirms milestones, sets event dates, leaves notes).

**Minting a demo portal token (safe pattern):** Use the existing pattern from [app/api/seed-demo/route.ts:83-104](app/api/seed-demo/route.ts#L83-L104) — insert `Contact` rows directly with `portalToken: randomUUID()`. Vendor contacts: `buyerRoundId: null`. Purchaser contacts: `buyerRoundId: tx.activeBuyerRoundId`. **Do not call `/api/portal/invite` from the seed** — that's the only side-effect path that sends an email.

---

### E. Environment and safety rails

**Env vars and DB pointers:**

- `.env.example` (lines 1–46 per cross-cutting agent E) is the template. `DATABASE_URL` is the single switch routing the app to either DB.
- Production: project ID `gmkfustgwipgihpmpjpr` (from CLAUDE.md and `.env.production`).
- Staging: project ID `etidawkbqctarmsdjoxp` (from CLAUDE.md and `.env.preview`).
- No runtime `process.env.VERCEL_ENV` branching that changes DB pointers — separation is purely by env file at deploy time.

**Existing safety guard pattern:** [scripts/seed-staging-test-data.ts:32-35](scripts/seed-staging-test-data.ts#L32-L35) refuses to run if `DATABASE_URL` contains the production project ID:

```typescript
if (process.env.DATABASE_URL?.includes("gmkfustgwipgihpmpjpr")) {
  throw new Error("ABORT: DATABASE_URL points to production. This script is staging-only.");
}
```

This is the only existing safety pattern. No script today requires an explicit `DEMO_SEED_ALLOWED=true` env flag.

**Existing seed scripts to extend (one-line summary each):**

| Script | One-line purpose |
|---|---|
| [scripts/seed-test-accounts.ts](scripts/seed-test-accounts.ts) | Creates the SP login `zero@progressor.com` and the multi-agency test fixture |
| [scripts/seed-staging-test-data.ts](scripts/seed-staging-test-data.ts) | Two agencies, 4 users, 4 transactions at varying statuses; uses wipe-before-create idempotency |
| [scripts/seed-staging-spot-check.ts](scripts/seed-staging-spot-check.ts) | Spot-check fixture for chase pipeline scenarios; supports `--cleanup` |
| [scripts/seed-staging-payments-tour.ts](scripts/seed-staging-payments-tour.ts) | Payment lifecycle demo (not deep-read) |
| [scripts/seed-darnley-contact-card-demo.ts](scripts/seed-darnley-contact-card-demo.ts) | Contact card UI demo for a single transaction |
| [scripts/seed-chain-fixtures.ts](scripts/seed-chain-fixtures.ts) | Chain / linked-transaction scenarios |
| [scripts/seed-trial-expired-account.ts](scripts/seed-trial-expired-account.ts) | Trial expiry behaviour demo |
| [scripts/seed-cotham-archived-sale.ts](scripts/seed-cotham-archived-sale.ts) | Archived transaction state demo |
| [scripts/seed-two-round-fixture.ts](scripts/seed-two-round-fixture.ts) | Relist / buyer-round feature demo |
| [scripts/seed-cutover-shapes.ts](scripts/seed-cutover-shapes.ts) | Migration / cutover test shapes |
| [scripts/seed-completions.ts](scripts/seed-completions.ts) | Milestone completion states |
| [app/api/seed-demo/route.ts](app/api/seed-demo/route.ts) | **Existing demo seed.** Single transaction + 15 completed milestones for `demo@agent.com`/`Demo1234!`. Direct MilestoneCompletion inserts (no `completeMilestone()` call). Middleware exempts `/api/seed-demo` from auth ([middleware.ts:211](middleware.ts#L211)). |

The closest pattern to extend is `seed-staging-test-data.ts` (idempotent multi-agency seed) combined with the route handler at `/api/seed-demo` for a one-click trigger.

**Proposed (not built) safety rail for `scripts/seed-demo.ts` + `scripts/reset-demo.ts`:**

```typescript
const STAGING_PROJECT_ID = "etidawkbqctarmsdjoxp";
const PROD_PROJECT_ID    = "gmkfustgwipgihpmpjpr";

if (process.env.DATABASE_URL?.includes(PROD_PROJECT_ID)) {
  throw new Error("ABORT: DATABASE_URL points to production. Demo seed is staging-only.");
}
if (!process.env.DATABASE_URL?.includes(STAGING_PROJECT_ID)) {
  throw new Error("ABORT: DATABASE_URL must point to staging.");
}
if (process.env.DEMO_SEED_ALLOWED !== "true") {
  throw new Error("ABORT: Set DEMO_SEED_ALLOWED=true to acknowledge this is a destructive operation.");
}
```

This combines the existing project-ID negative-allowlist with an explicit env-flag opt-in. Both gates are required.

---

### F. Reset surface

**Command Centre layout pattern:** Each `/command/(protected)/*/page.tsx` is an async server component using `commandDb` (isolated PrismaClient at `lib/command/prisma.ts`) for queries. Pages assemble inline with `<section>` blocks and Tailwind dark-theme classes. No shared shell beyond CommandSidebar.

**Auth guard pattern for destructive Command Centre actions:** Example from [app/actions/command-centre.ts:11-15](app/actions/command-centre.ts#L11-L15):

```typescript
async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) redirect("/dashboard");
  return session;
}
```

Then in the server action: `await requireSuperAdmin(); await commandDb.…mutation; revalidatePath("/command/…");`. The Reset Demo action should follow this exact pattern.

**Recommended Reset Demo location:** The CommandSidebar nav has an "Admin" section (Audit, Friction, Revenue per the cross-cutting agent F findings — citing [components/command/CommandSidebar.tsx:25-70](components/command/CommandSidebar.tsx#L25-L70)). The Reset Demo button is a destructive admin operation; it slots naturally there.

- Route: `/command/(protected)/admin/demo` or `/command/(protected)/demo` (either; the former groups with existing admin pages).
- File: `app/command/(protected)/admin/demo/page.tsx` (new).
- Nav entry to add to CommandSidebar: `{ href: "/command/admin/demo", label: "Reset Demo", Icon: RotateCcw }`.

**Teardown order for deleting a demo agency:**

Most leaf rows cascade automatically via `onDelete: Cascade` on the relevant FK. The list of `Cascade`d relations (no explicit delete needed) includes: `AgentPushSubscription`, `UserVerifiedEmail`, `RetentionEmailLog`, `Account`, `Session`, `BuyerRound`, `TransactionHoldPeriod`, `PortalPushSubscription`, `PortalMessage`, `ChainLink`, `ChainNotificationQueue`, `MilestoneCompletion`, `ReminderLog`, `ChaseTask`, `OutboundMessage`, `TransactionNote`, `TransactionDocument`, `TransactionFlag`, `OutsourcedAssignmentNotification`, `DirectorInvitation`, `NegotiatorInvitation`, `Invoice`, `CreditNote`, `PricingAcknowledgement`, `Contact` (cascades on transactionId).

Explicit deletion is needed in reverse-dependency order for rows whose FK is NOT cascade or is nullable. A safe sequence (verified citations are inline in cross-cutting agent F's full report, which used [prisma/schema.prisma](prisma/schema.prisma) line-by-line):

```typescript
await prisma.$transaction([
  // 1. Direct or transitive children that need explicit delete
  prisma.clientChaseState.deleteMany({ where: { transaction: { agencyId } } }),
  prisma.priceHistory.deleteMany({ where: { transaction: { agencyId } } }),
  prisma.outboundEmailQueue.deleteMany({ where: { recipientUser: { agencyId } } }),
  prisma.notification.deleteMany({ where: { user: { agencyId } } }),
  prisma.fileTimeSession.deleteMany({ where: { agencyId } }),
  prisma.manualTask.deleteMany({ where: { agencyId } }),

  // 2. Chain plumbing (PropertyChain has no cascade from Agency)
  prisma.chainNotificationQueue.deleteMany({ where: { chain: { agencyId } } }),
  prisma.chainLink.deleteMany({ where: { chain: { agencyId } } }),
  prisma.propertyChain.deleteMany({ where: { agencyId } }),

  // 3. Transactions — cascades to MilestoneCompletion, ReminderLog, ChaseTask,
  //    OutboundMessage, TransactionNote, TransactionDocument, TransactionFlag,
  //    OutsourcedAssignmentNotification, BuyerRound, TransactionHoldPeriod, Contact
  prisma.propertyTransaction.deleteMany({ where: { agencyId } }),

  // 4. Invoicing
  prisma.invoiceLine.deleteMany({ where: { invoice: { agencyId } } }),
  prisma.creditNote.deleteMany({ where: { agencyId } }),
  prisma.invoice.deleteMany({ where: { agencyId } }),

  // 5. Settings tables (Agency-scoped)
  prisma.agencyPreferredBroker.deleteMany({ where: { agencyId } }),
  prisma.agencyRecommendedSolicitor.deleteMany({ where: { agencyId } }),
  prisma.pricingAcknowledgement.deleteMany({ where: { agencyId } }),
  prisma.feedbackSubmission.deleteMany({ where: { agencyId } }),
  prisma.verifiedDomain.deleteMany({ where: { agencyId } }),

  // 6. Users (cascades to AgentPushSubscription, UserVerifiedEmail, RetentionEmailLog, Account, Session)
  prisma.user.deleteMany({ where: { agencyId } }),

  // 7. Cascading children of Agency (DirectorInvitation, NegotiatorInvitation, Invoice, CreditNote, PricingAcknowledgement) will be auto-cleaned
  prisma.agency.delete({ where: { id: agencyId } }),
]);
```

Cross-cutting agent F's full report (in this conversation's tool output) carries every individual `prisma/schema.prisma` line reference. Worth re-verifying line-by-line before building the reset action.

---

## Docs gaps (NOT IN DOCS)

These were found during the audit but are not represented in `docs/polish-pass/PAGE_LIST.md` or other source-of-truth docs. Each gets one line.

- **`/agent/automated-emails`** — Production-facing platform-wide automated emails feed, all roles. Not in PAGE_LIST.md (introduced after the 2026-05-10 scan).
- **`/agent/settings/automation`** — Director-only chase automation editor. PAGE_LIST.md lists `/agent/settings` (position 13) but the parent `app/agent/settings/page.tsx` was deleted; `/agent/settings` is handled by a 301 redirect to `/agent/account/profile` in [next.config.ts:33-36](next.config.ts#L33-L36) (Account-area cutover, 2026-05-25). PAGE_LIST.md is stale on this point — no missing-page risk.
- **`/agent/admin`** — Founder-only management page in the agent shell. Gated to `ellis@thesalesprogressor.co.uk`. Not documented.
- ~~**`/agent/billing/payment-method`** — File exists but it's a `redirect("/agent/account/billing#payment-method")`. The redirect TARGET (`/agent/account/billing`) does NOT exist...~~ **CORRECTED 2026-06-05 during the demo build:** The target DOES exist at [app/(account)/agent/account/billing/page.tsx](app/(account)/agent/account/billing/page.tsx) — served at `/agent/account/billing` via the `(account)` route group, which doesn't appear in the URL. The original audit's glob `app/agent/account/**/page.tsx` missed it. All CTAs ([PaymentBlockBanner.tsx:52,93](components/billing/PaymentBlockBanner.tsx#L52), Stripe `return_url` in [CardCaptureForm.tsx:131](components/billing/CardCaptureForm.tsx#L131), [BillingNegotiatorModal.tsx:47](components/billing/BillingNegotiatorModal.tsx#L47), [AgentShell.tsx:177](components/layout/AgentShell.tsx#L177), [AccountLeftNav.tsx:38](components/account/chrome/AccountLeftNav.tsx#L38)) point at the correct route. No fix needed.
- **`/agent/audit/before-after`, `/agent/audit/icons`, `/agent/audit/overlays`** — Designer audit galleries (`"use client"` mockups with theme selectors). Agent-reachable in production per middleware. Should probably be moved under `/agent/system-preview` or gated behind a feature flag for prod.
- **`/agent/polish/*`** (12 sub-routes: transaction-detail, hub, work-queue, transaction-list, new-sale-v2, comms, analytics, claim-flow, completions, to-do, chain-bottleneck-demo, chain-walkthrough, predicted-exchange-demo, slowness-demo, staleness-demo) — Polish-pass design previews. Agent-reachable in production. PAGE_LIST.md does not mention them.
- **`sendEmail()` does not honour `EMAIL_SANDBOX_MODE`** — see Section B. The comment block at [lib/email.ts:53](lib/email.ts#L53) ("Set `EMAIL_SANDBOX_MODE=true` on staging to validate without delivering") suggests the env var is the global sandbox switch, but the implementation only applies it to `sendChainEmail`. This asymmetry is undocumented and risky.
- **`/api/seed-demo`** route exists and is publicly reachable (middleware exempts it at [middleware.ts:211](middleware.ts#L211)) — this is intentional but is undocumented in any spec.

---

## Excluded routes (dev/preview/test) — one-line reason each

| Route | Reason |
|---|---|
| `/agent/anim-preview` | Design-system reference, not a production page |
| `/agent/system-preview` + `/toasts` | Dev component preview |
| `/agent/hub-preview` | Dev preview |
| `/agent/analytics-preview` | Dev preview |
| `/agent/polish/*` (12 routes) | Polish-pass design previews; should be flagged as gated-dev (see Docs gaps) |
| `/agent/audit/*` (3 routes) | Designer audit galleries (see Docs gaps) |
| `/agent/quick-add` | Redirect-only to `/agent/transactions/new-v2` |
| `/agent/transactions/new` | Redirect-only to `/agent/transactions/new-v2` |
| `/agent/dashboard` | Redirect-only to `/agent/transactions` |
| `/agent/solicitors` | Redirect-only to `/agent/partners` |
| `/agent/billing/payment-method` | Redirect-only — but to a broken target (see Docs gaps) |
