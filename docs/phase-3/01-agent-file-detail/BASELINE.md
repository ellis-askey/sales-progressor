# Phase 3 · Surface 1 · Agent File Detail · Behavioural Baseline

**Surface:** `/agent/transactions/[id]`
**Route file:** [app/agent/transactions/[id]/page.tsx](../../../app/agent/transactions/[id]/page.tsx) (445 lines)
**Audience:** director, negotiator (also viewed by sales_progressor, admin via internal-visibility resolver)
**Estimated remediation:** 2 weeks (largest surface in the Phase 3 queue)
**Baseline captured:** 2026-06-29

This document is the "before" state per [Law 17](../../../CLAUDE.md#law-17--behavioural-baseline-before-remediation). After remediation we re-capture the same data and any unexplained diff is a regression.

---

## 1. Page architecture

The page is a **streaming server component** (Next.js App Router). Refactored 2026-06-03 for perf — the critical path waits for the minimum needed to render the shell; tab bodies stream in under Suspense.

### 1.1 Critical-path queries (awaited before any render)

| Order | Query | What it returns | Why on critical path |
|---|---|---|---|
| 1a | `getTransactionCached(id, agencyId)` OR `getTransactionByScopeCached(id, scope)` | The transaction row + canonical includes (agency, assignedUser, agentUser, contacts, solicitor firms/contacts, broker, referredFirm, holdPeriods, activeBuyerRound, buyerRounds) | Header / hero needs every field |
| 1b | `getMilestonesCached(id, agencyId)` | `{ vendor: Milestone[], purchaser: Milestone[] }` with completion data | Hero progress + sidebar progress + shared across all 5 tab panels via React.cache |
| 1c | (conditional) `prisma.user.findUnique({ id: transaction.agentUserId })` | `{ id, name, email, firmName }` | Hero's `assignedUserName` fallback when no SP is assigned |
| 1d | (conditional, internal staff only) `prisma.verifiedDomain.findFirst` + `prisma.userVerifiedEmail.findFirst` | SP/admin sender identity for ActivityPanel ComposeEmail | Resolves once, passed down to ActivityPanel |
| 1e | (conditional, director on self-managed file) `listAssignableAgentsForAgency(agencyId)` | List of agents the director can reassign to | Populates ReassignOwnerControl |

All five fire in `Promise.all` where possible. Total critical-path time: depends on slowest of 1a + 1b. Profiled at 3-5s on staging before the 2026-06-03 refactor; sub-second now.

### 1.2 Streamed panels (each fans out under Suspense)

| Panel | Component | Own queries |
|---|---|---|
| Sidebar | [`SidebarPanel`](../../../components/transaction/SidebarPanel.tsx) | Solicitor firm + broker resolution, contact details, chain link state |
| Overview tab | [`OverviewPanel`](../../../components/transaction/OverviewPanel.tsx) | Activity preview, next-action computation |
| Steps tab | [`StepsPanel`](../../../components/transaction/StepsPanel.tsx) | Milestone definitions + completion state (cached) |
| Reminders tab | [`RemindersPanel`](../../../components/transaction/RemindersPanel.tsx) | ReminderLog + ChaseTask rows |
| To-Do tab | [`ToDoPanel`](../../../components/transaction/ToDoPanel.tsx) | Manual tasks + auto-generated todos |
| Activity tab | [`ActivityPanel`](../../../components/transaction/ActivityPanel.tsx) | OutboundMessage + comms history |
| Claim welcome | [`ClaimWelcomeAsync`](../../../components/transaction/ClaimWelcomeAsync.tsx) | New-user claim banner state |
| Reconcile later | [`ReconcileLaterAsync`](../../../components/transaction/ReconcileLaterAsync.tsx) | Reconciliation pending state |

Each panel renders its own skeleton via `<RevealSlot skeleton={...}>` while loading.

### 1.3 Visible UI elements (top-down)

| Element | Component | Conditional on |
|---|---|---|
| Chain decline notif banner | (in app/agent/layout.tsx) | Recent decline event |
| Claim welcome modal | `ClaimWelcomeAsync` | `?newUser=1` query string |
| Chain setup failed banner | `ChainSetupFailedBanner` | `?chainSetupFailed=1` query string |
| On-hold banner | `OnHoldBanner` | `tx.status === "on_hold"` |
| Relist banner | `RelistBanner` | `tx.status === "withdrawn"` |
| MOS confirmed notice | `MosConfirmedNotice` | First load after PM2 confirm |
| Reminders ready notice | `RemindersReadyNotice` | Reminder log seeded but not yet visible |
| Reconcile later banner | `ReconcileLaterAsync` | Reconciliation outstanding |
| Property hero | `PropertyHero` | always — header card with address, status, agency, agent, breadcrumbs |
| Round chip | `RoundChip` | tx is multi-round (relist history) |
| AI summary button | `AiSummaryButton` | always (in hero) |
| Portal confirm email toggle | `PortalConfirmEmailToggle` | always (debug toggle for SP/admin) |
| Tab strip | `PropertyFileTabs` | always — Overview / Steps / Reminders / To-Do / Activity |
| Sidebar (right column) | `SidebarPanel` | always |
| Tab body | one of 5 panels | which tab is active (`?tab=...`) |
| Claimed toast | `ClaimedToast` | first load after a claim |
| Transaction view tracker | `TransactionViewTracker` | always (logs view, fire-and-forget) |
| File time tracker | `FileTimeTracker` | always (logs time-on-file, fire-and-forget) |
| Perf overlay | `PerfOverlay` | `?perf=1` (debug only) |

---

## 2. Server actions called (from this surface)

Pulled by grepping the page + its panel components for `"use server"` imports. Each is a write-path; each is a regression target.

| Action | Triggered by | Side-effects |
|---|---|---|
| `confirmMilestoneAction` | Click confirm on a milestone row (Steps tab) | DB write (MilestoneCompletion), bilateral counterpart auto-completion, push notifications, portal emails (via richMilestoneEmails), chase cron knock-on, optional tx.status auto-flip on VM20/PM27 |
| `unconfirmMilestoneAction` | Undo a milestone confirmation | Reverse of above |
| `pauseClientEmails` / `resumeClientEmails` | Automation controls toggle | DB write (`clientEmailsPaused` field), revalidate path |
| `pauseFileAutomation` / `reactivateFile` | Hold flow | DB write (`status` field), close open hold periods, cancel chases for the new state |
| `relistTransactionImpl` | Relist modal submit | Creates new buyer round, archives old contacts, rotates portal tokens, sets new VM/PM rows, cancels old reminders |
| `updateTransactionStatus` | Status dropdown change | DB write (`status` field), per-status side-effects (cancel/restore CCS + ReminderLogs, hold-period management, command-centre event log) |
| `addContactAction` / `editContactAction` / `removeContactAction` | Contacts panel | DB write (Contact rows), portal token generation/rotation, revalidate path |
| `reassignAgentAction` | Director ReassignOwnerControl | DB write (`agentUserId`), revalidate |
| `setMilestoneEventDateAction` | Event-date picker on a milestone | DB write (`eventDate` field) |
| `setExpectedExchangeDateAction` | Sidebar Expected exchange editor | DB write (`expectedExchangeDate`) |
| `setCompletionDateAction` | Sidebar Completion date editor | DB write (`completionDate`) |
| `addReminderAction` / `dismissReminderAction` / `snoozeReminderAction` | Reminders panel actions | DB write (ReminderLog), chase cron knock-on |
| `markTaskDoneAction` / `addManualTaskAction` | To-Do panel | DB write (ChaseTask) |
| `sendComposeEmailAction` | Activity tab ComposeEmail | SendGrid send, OutboundMessage row |
| `togglePortalConfirmEmailsAction` | PortalConfirmEmailToggle (SP/admin only) | DB write (`suppressPortalConfirmEmails`) |

Roughly **20+ server actions** are reachable from this surface. Each one is a regression vector.

---

## 3. Email + push + DB side-effects (summary)

Side-effects categorised by trigger:

### Milestone confirmation (the hottest path)

- DB: `MilestoneCompletion` row insert, optional `MilestoneCompletion` bilateral-counterpart insert
- DB: optional `tx.completionDate` sync (VM20/PM27)
- DB: optional `tx.status` auto-flip to "completed" (VM20+PM27 both confirmed, status=active)
- DB: `Event` log row (`milestone_confirmed`)
- DB: `OutboundMessage` rows for the milestone-confirmation digest
- Emails: portal emails to vendor + purchaser contacts via `sendAdminMilestoneNotificationToPortal` (queued 3min batching) OR `fireAutoCounterpartEmails` (immediate for VM19/PM26/VM20/PM27)
- Push: web push to all subscribed portal contacts
- Cron knock-on: ClientChaseState upserts when chases land

### Status change

- DB: `tx.status` update
- DB: `ReminderLog` cancellations (PM rows on the active round)
- DB: `ChaseTask` cancellations
- DB: `ClientChaseState` cancellations (added 2026-06-17 fix)
- DB: `TransactionHoldPeriod` open/close
- DB: Command-centre `Event` log row (`transaction_status_changed`, `transaction_archived`)
- Activity feed: internal-note `OutboundMessage` row

### Reminder / task actions

- DB: `ReminderLog` insert / update / cancel
- DB: `ChaseTask` insert / update
- DB: `Event` log row

### Contact mutations

- DB: `Contact` row insert / update / delete (soft)
- DB: portal token rotation on email change

### View / time tracking (every page load)

- DB: `TransactionView` row (fire-and-forget)
- DB: file-time accumulation (fire-and-forget)

---

## 4. URL / query string behaviour

The page reads four query-string params:

| Param | Values | What it does |
|---|---|---|
| `tab` | `overview` / `milestones` / `reminders` / `todos` / `activity` | Selects the active tab. Default: `overview`. |
| `chainSetupFailed` | `1` | Renders the ChainSetupFailedBanner one-shot. |
| `newUser` | `1` | Renders the ClaimWelcomeModal. |
| `perf` | `1` | Renders the PerfOverlay (debug). |

---

## 5. Role-based variations

Five roles can land on this URL. Each sees a different shape.

| Role | Sees | Doesn't see |
|---|---|---|
| `director` | Hero, all tabs, sidebar with reassign control (self-managed only), all banners | Command Centre-only fields |
| `negotiator` | Same as director except no reassign control, file ownership check enforced (only files where `agentUserId === session.user.id`) | Cross-agency files |
| `sales_progressor` | Same shape; ComposeEmail uses SP sender identity (verified domain + email) | Reassign control hidden |
| `admin` | Cross-agency visibility via access scope helper; all controls | — |
| `superadmin` | Same as admin; can be on this surface but Command Centre is `/command/*` | — |

The ownership check at [page.tsx line 124](../../../app/agent/transactions/[id]/page.tsx#L124) is the gate: `!isInternalStaff && !isDirectorRole && transaction.agentUserId !== session.user.id` → `notFound()`.

---

## 6. Screenshots (to be captured locally during walk-through)

Each pinned screenshot is a "before" state. After remediation we re-capture the same configuration and diff.

### 6.1 Test transactions to capture

| Configuration | URL pattern | Note |
|---|---|---|
| Director, self-managed, active, mid-flow | `/agent/transactions/[id]?tab=overview` | Most common shape |
| Director, self-managed, active, on Steps tab | `/agent/transactions/[id]?tab=milestones` | Heaviest tab |
| Director, self-managed, on_hold | `/agent/transactions/[id]?tab=overview` | OnHoldBanner visible |
| Director, self-managed, withdrawn | `/agent/transactions/[id]?tab=overview` | RelistBanner visible |
| Director, self-managed, completed (post-VM20) | `/agent/transactions/[id]?tab=overview` | Completion banner state |
| Director, self-managed, multi-round (relisted) | `/agent/transactions/[id]?tab=overview` | RoundChip visible |
| Negotiator, ownership granted | as above | — |
| Negotiator, ownership NOT granted | as above | Should 404 |
| SP, outsourced file, mid-flow | `/agent/transactions/[id]?tab=overview` | ComposeEmail uses SP identity |
| Reminders tab with overdue items | `?tab=reminders` | Surface the auto-emails accordion |
| Activity tab with comms history | `?tab=activity` | ComposeEmail visible |
| To-Do tab with manual + auto tasks | `?tab=todos` | — |
| Loading skeleton (throttled network) | any | The `SidebarPanelSkeleton` + `TabPanelSkeleton` pose |
| Mobile 375px on each tab | any | Sidebar collapses; tab strip becomes scrollable |
| Error state | `/agent/transactions/invalid-id` | Should `notFound()` |

### 6.2 Screenshot capture instructions

For each row above:
1. Open the URL in Chrome
2. Capture full-page desktop at 1280px
3. Capture full-page mobile at 375px (DevTools device emulation)
4. Save to `docs/phase-3/01-agent-file-detail/screenshots/before/`
5. Filename convention: `<role>-<status>-<tab>-<viewport>.png`

These are pinned to compare against post-remediation captures.

### 6.3 Autonomous capture attempt (2026-06-29) — BLOCKED on credentials

Attempted Playwright autonomous capture using the existing `e2e/helpers.ts` login flow with `USERS.director` (`taylor@akeman-residential.co.uk`). The local `.env.test.local` provides `TEST_PASSWORD=password` which the staging auth handler rejects as "Incorrect email or password." Without the correct password for the staging Taylor account, the capture can't run.

To unblock either:
- Set `TEST_DIRECTOR_PASSWORD` in `.env.test.local` with the real staging password (treats this as a per-machine secret), OR
- Capture manually per the instructions in §6.2 above

A reusable autonomous-capture spec is **not** committed pending unblock — per [Law 13](../../../CLAUDE.md#law-13--never-half-build), a spec that always fails on first run is a dead control. When credentials are available we add the spec back as part of the visual regression CI work (Phase 5).

---

## 7. Inventory of components used on this surface (canonical migration targets)

Pulled by grepping the imports of `page.tsx` and each panel component.

| Pattern | Current usage | Canonical primitive |
|---|---|---|
| `glass-card` utility class | ~12 places | `Card` (Phase 2 §2.1) |
| `agent-btn` utility class | ~25 places | `Button` (Phase 2 §2.5) |
| `*Banner.tsx` (6 files used here) | OnHoldBanner, RelistBanner, ChainSetupFailedBanner, ChainDeclineBanner, ReconcileLaterBanner, FileHealthBanner | Already use AgentBanner / Banner (Phase 2 §2.3) — no migration |
| `*Modal.tsx` (6 files used here) | AddBrokerModal, AddFirmModal, UndoMilestoneModal, RelistFileModal, ReconciliationModal, SurveyNrConfirmModal | `Modal` (Phase 2 §2.2) |
| `*Drawer.tsx` (3 files used here) | ChainDrawer, ChaseDrawer, ArchivedRoundDrawer, EditSaleDetailsDrawer | `Drawer` (Phase 2 §2.4) |
| `agent-acc-*` classes | RemindersPanel (multiple sections), AutomatedEmailsCard, ToDoPanel sections | `Accordion` (Phase 2 §2.6) |
| Pills/chips | StatusBadge, RoundChip, various inline | `Pill` (Phase 2 §2.7) — RoundChip stays domain-specific (locked decision) |
| Toast usage | useAgentToast in milestone confirm + claim flows | `Toast` re-export (Phase 2 §2.8) — no migration |
| Skeleton usage | SidebarPanelSkeleton + TabPanelSkeleton (bespoke, panel-grid-specific) | `Skeleton` (Phase 2 §2.11) — keep bespoke composers but they wrap Skeleton internally |

**Estimated touch:** roughly 15-25 of the 121 to-extract bespoke components live on this surface. Each migration is hand-rolled per Law 16.

---

## 8. Out-of-scope for surface 1 remediation

Things explicitly NOT addressed by this surface's remediation (filed elsewhere):

- The `transactions-v2/` form folder (new-sale flow) — separate surface in Phase 3 queue
- The Sidebar's chain-link UI — chain arc has its own active-package scope; revisit during chain work
- The PerfOverlay — debug-only, stays as-is
- Bespoke skeleton implementations (`PanelSkeletons.tsx`) — they encode panel-grid layout knowledge that isn't a primitive concern; stay as domain composers that wrap `Skeleton` for rows

---

## 9. Next steps in Phase 3 Step 1 → Step 2

Step 1 (this doc) is complete except for the local screenshot capture pass (founder follow-up).

Step 2: **E2E happy-path test exists or gets written first.** Check `e2e/` for existing coverage of `/agent/transactions/[id]`:

- `polish-transaction-detail.spec.ts` exists — covers polish-preview routes, not the live surface
- `package-d-and-ws2.spec.ts` may cover assignment flows on this surface
- `smoke-agent.spec.ts` may cover navigation to this surface

A surface-1-specific happy-path test is likely needed. Outline next session:

1. Login as test director
2. Navigate to `/agent/transactions/[test-id]?tab=overview`
3. Assert hero renders address
4. Click each tab, assert content visible
5. Confirm a milestone, assert success toast + DB row
6. Click a sidebar field, assert edit-drawer opens

Then Step 3 (Audit doc against Definition of Done) and Step 4 (Plain-English plan + founder sign-off) before any code changes.

---

## Footnotes

- Captured by Claude Code on 2026-06-29 per [Law 17](../../../CLAUDE.md#law-17--behavioural-baseline-before-remediation).
- Re-captured (post-remediation) target: end of file-detail Phase 3 work, ~2 weeks from Step 5 start.
- Any unexplained diff in the re-capture is a regression that must be either explained, reverted, or accepted with sign-off.
