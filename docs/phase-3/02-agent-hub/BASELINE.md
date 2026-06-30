# Phase 3 · Surface 2 · Agent Hub · Behavioural Baseline

**Route:** [`/agent/hub`](../../../app/agent/hub/page.tsx)
**Status:** baseline pinned per [Law 17](../../../CLAUDE.md#law-17--behavioural-baseline-before-remediation). No code touches this surface until [AUDIT.md](AUDIT.md) and [PLAN.md](PLAN.md) ship and the founder signs the PLAN.
**Drafted:** 2026-06-30.

This doc is **what the hub does today**. It is the pinned reference the post-remediation re-capture is diffed against. If the post-remediation behaviour diverges from anything in this doc, that's a regression unless explicitly approved.

---

## 1. Route + auth

- **Route:** `app/agent/hub/page.tsx` — single async server component, no nested routes.
- **Layout:** `AgentShell` (loaded by `app/agent/layout.tsx`).
- **Auth:** `requireSession()` — redirects to `/login` if not signed in.
- **Allowed roles:** `director`, `negotiator`, `sales_progressor`, `admin`, `viewer`.
- **Excluded:** `superadmin` — uses `/command/*` surface instead (different visual system per Law 9).

---

## 2. Data fan-out

Page renders after **11 parallel queries** resolve. All routed through `vis: AgentVisibility` which differs by role:

- **Internal staff** (`admin`, `sales_progressor`, `viewer`): `resolveInternalVisibility(userId, role, isAdmin)` — no DB lookup, scope set by role.
- **Agent staff** (`director`, `negotiator`): `resolveAgentVisibility(userId, agencyId)` — single DB query for the visibility scope.

| # | Fetcher | Returns | Used by |
|---|---|---|---|
| 1 | `getHubPipelineStats(vis)` | activeFiles, exchangingSoon, pipelineValuePence, newThisMonth, comingUp{thisWeek/month}, stalled.count | Pipeline-health card + Coming-up strip + Stalled row |
| 2 | `getHubAttentionItems(vis)` | array of items with urgency (escalated/overdue/etc) | AttentionListView |
| 3 | `getHubMomentum(vis)` | thisMonth, lastMonth, percent | Momentum card (MomentumRing) |
| 4 | `getHubWeeklyForecast(vis)` | 5 weeks of { count, label, isCurrentWeek } | Exchange forecast card (ExchangeForecastChart) |
| 5 | `getHubServiceSplit(vis)` | { selfManaged, outsourced } | Service split donut |
| 6 | `getHubRecentActivity(vis)` | last activity event for the visible scope | Activity ribbon at bottom |
| 7 | `getHubDiary(vis)` | items[] with { transactionId, address, type: "exchange" \| "completion" } | Today's diary card |
| 8 | `getHubUnassignedFiles(vis)` | files needing an SP assigned (internal staff only) | UnassignedFilesView |
| 9 | `getExpiredHolds(vis)` | files whose hold ended | ExpiredHoldsCard |
| 10 | `getHubRelistsToAcknowledge(vis)` | files where a new buyer round was recently created | NewBuyersToAcknowledgeView |
| 11 | `getHubChainSetupPending(vis)` | files with chain links waiting on setup | ChainSetupPendingView |

All 11 are in a single `Promise.all`. If any reject without a `.catch`, the whole page errors. As of baseline date none have local catches at the page level — they bubble.

---

## 3. Render branches

The page has **two distinct render branches** controlled by `isEmpty`:

```ts
const isEmpty = pipelineStats.activeFiles === 0 && attentionItems.length === 0;
```

### 3a. Empty state ([page.tsx:125-260](../../../app/agent/hub/page.tsx#L125-L260))

For brand-new accounts with no files + no attention items:
- PageHeader (greeting + maybe "New sale" button + maybe AgentFlagButton)
- Welcome CTA card ("Add your first sale...") with primary "Add a sale" Link
- Ghost (disabled, opacity 0.35, pointer-events none) pipeline-health card
- Ghost momentum card
- Ghost attention card (3 placeholder rows)
- Ghost exchange forecast + ghost who's-managing

### 3b. Full hub ([page.tsx:263-829](../../../app/agent/hub/page.tsx#L263-L829))

Conditional sections (top to bottom):

| Section | Visibility condition | Source |
|---|---|---|
| **PageHeader** (greeting + actions) | always | [`PageHeader`](../../../components/layout/PageHeader.tsx) |
| **PaymentBlockBanner** | `role === "director" && session.user.agencyId` | [`PaymentBlockBanner`](../../../components/billing/PaymentBlockBanner.tsx) self-hides for non-critical billing states |
| **PaymentMethodNudge** | `role === "director" && session.user.agencyId` | [`PaymentMethodNudge`](../../../components/billing/PaymentMethodNudge.tsx) self-hides during trial + 7d grace |
| **Today's diary** | `diaryItems.length > 0` | inline (no separate component) |
| **ExpiredHoldsCard** | always rendered; self-hides if no expired holds | [`ExpiredHoldsCard`](../../../components/hub/ExpiredHoldsCard.tsx) |
| **AttentionListView** | always (renders empty state internally if `items=[]`) | [`AttentionListView`](../../../components/hub/AttentionListView.tsx) |
| **UnassignedFilesView** | self-hides if no unassigned files | [`UnassignedFilesView`](../../../components/hub/UnassignedFilesView.tsx) (internal staff only — fed empty for agents) |
| **NewBuyersToAcknowledgeView** | self-hides if no rounds to acknowledge | [`NewBuyersToAcknowledgeView`](../../../components/hub/NewBuyersToAcknowledgeView.tsx) |
| **ChainSetupPendingView** | self-hides if no pending setups | [`ChainSetupPendingView`](../../../components/hub/ChainSetupPendingView.tsx) |
| **Pipeline health card** | always | inline (4 stat cells + Coming-up strip + Stalled row) |
| **Momentum card** | always | inline (uses [`MomentumRing`](../../../components/hub/HubCharts.tsx)) |
| **Exchange forecast card** | always | inline (uses [`ExchangeForecastChart`](../../../components/hub/HubCharts.tsx)) |
| **Service split card** | hidden if `isProgressor && !isAdmin` | inline (uses [`ServiceSplitDonut`](../../../components/hub/HubCharts.tsx)) |
| **Activity ribbon** | `recentActivity` truthy | inline |

The five "attention stack" widgets (ExpiredHoldsCard, AttentionListView, UnassignedFilesView, NewBuyersToAcknowledgeView, ChainSetupPendingView) are wrapped in [`AnimatedSection`](../../../components/hub/AnimatedSection.tsx) so they shift smoothly when any collapses out.

---

## 4. Role variations

The hub renders five distinct shapes by role. The differences are computed once near the top of the render:

```ts
const role = session.user.role;
const isInternalStaff = role === "admin" || role === "sales_progressor" || role === "viewer";
const isProgressor    = role === "sales_progressor";
const isAdmin         = hasAdminPowers(session);
const canCreateSale   = role === "director" || role === "negotiator" || role === "admin";
```

| Role | "New sale" button | AgentFlagButton | Billing banners | Service split | Pipeline scope | Header copy |
|---|---|---|---|---|---|---|
| **director** | ✓ | ✓ | ✓ (if agencyId set) | "Who's managing" + agent-perspective copy | their agency | "Where your business stands today." |
| **negotiator** | ✓ | ✓ | ✗ (director-only) | same as director | their agency | same as director |
| **sales_progressor** | ✗ | ✗ | ✗ | **hidden entirely** | their assigned files | "Your assigned files at a glance." |
| **admin** | ✓ | ✗ (internal staff) | ✗ | "Service split" + admin-perspective copy | platform-wide | "Platform-wide pipeline at a glance." |
| **viewer** | ✗ | ✗ | ✗ | hidden (treated as progressor) | role-derived | progressor copy |

Pipeline health card's `Need attention` cell color: red if `escalatedCount > 0`, amber if `attentionFileCount > 0`, neutral otherwise.

---

## 5. Outbound navigation map

Every clickable element on the hub and where it goes:

| Element | Target | Visibility |
|---|---|---|
| `PageHeader` "New sale" button | `/agent/transactions/new-v2` | `canCreateSale` |
| `PageHeader` AgentFlagButton | opens modal, sends note via server action | `!isInternalStaff` |
| Welcome-state "Add a sale" Link | `/agent/transactions/new-v2` | empty-state + canCreateSale |
| Diary item Link | `/agent/transactions/${item.transactionId}` | per item |
| Pipeline stats — "Active files" cell | `/agent/transactions` | always |
| Pipeline stats — "Exchanging soon" cell | `/agent/transactions?filter=exchanging-next-30-days` | when count > 0 |
| Pipeline stats — "Need attention" cell | `/agent/work-queue` | when attentionFileCount > 0 |
| Pipeline stats — "Pipeline value" cell | (no Link) | — |
| Coming up — "exchanging this week" | `/agent/transactions?filter=exchanging-this-week` | always |
| Coming up — "completing this week" | `/agent/transactions?filter=completing-this-week` | always |
| Coming up — "closing this month" | `/agent/transactions?filter=closing-this-month` | always |
| Stalled row | `/agent/work-queue` | when `pipelineStats.stalled.count > 0` |
| Activity ribbon "View file" | `/agent/transactions/${recentActivity.transactionId}` | when recentActivity exists |

Plus internal navigation inside the attention-stack widgets (AttentionListView, UnassignedFilesView, etc.) — handled within those components.

---

## 6. Mutations + side-effects

The hub itself runs no mutations. Side-effects fire from the embedded widgets:

| Widget | Action | Side-effect |
|---|---|---|
| `ChainSetupPendingView` | "Set up chain" (via useTransition) | server action — creates a ChainLink; revalidates hub on success |
| `ExpiredHoldsCard` | "Reactivate" / "Dismiss" (useTransition) | server actions — `reactivateHoldAction` / `dismissExpiredHoldAction` |
| `NewBuyersToAcknowledgeView` | "Acknowledge" (useTransition) | server action — marks the round acknowledged |
| `UnassignedFilesView` | "Assign" (useState + fetch + useTransition) | `fetch("/api/agency/users")` to populate dropdown + server action to assign |
| `AgentFlagButton` | open modal + submit | server action — creates an AgentFlag record + Slack notification (if wired) |
| `PaymentBlockBanner` | "Update payment" link | redirect to Stripe portal |
| `PaymentMethodNudge` | "Add card" link | redirect to Stripe portal |

No mutation that lives directly on the hub page itself.

---

## 7. Visual primitives in use (component inventory)

This is the surface scope for canonicalisation. Counted via `grep`:

### glass-card / agent-glass / agent-glass-strong / agent-glass-light usages

| File | Class | Count |
|---|---|---|
| `app/agent/hub/page.tsx` | `agent-glass` (cards) | ~7 |
| `app/agent/hub/page.tsx` | `agent-glass-strong` (ghost attention) | 1 |
| `app/agent/hub/page.tsx` | `agent-glass-light` (activity ribbon) | 1 |
| `app/agent/hub/loading.tsx` | `agent-glass` | ~5 |
| `app/agent/hub/loading.tsx` | `agent-glass-strong` | 1 |
| `components/hub/AttentionListView.tsx` | — | (audit pending) |
| `components/hub/UnassignedFilesView.tsx` | — | (audit pending) |
| `components/hub/NewBuyersToAcknowledgeView.tsx` | — | (audit pending) |
| `components/hub/ChainSetupPendingView.tsx` | — | (audit pending) |
| `components/hub/ExpiredHoldsCard.tsx` | — | (audit pending) |
| `components/hub/HubCharts.tsx` | (chart wrappers — pure SVG) | n/a |
| `components/hub/AnimatedSection.tsx` | (motion wrapper, no surfaces) | n/a |

### agent-btn / agent-btn-* (buttons)

`app/agent/hub/page.tsx` uses `agent-btn agent-btn-primary` for the two "New sale" buttons + the empty-state "Add a sale". Internal widgets have their own button surfaces (audit pending).

### Inline empty states

- Welcome state ([page.tsx:144-174](../../../app/agent/hub/page.tsx#L144-L174))
- Pipeline-card "All files have recent activity" row ([page.tsx:533-541](../../../app/agent/hub/page.tsx#L533-L541))
- Exchange forecast empty ([page.tsx:635-637](../../../app/agent/hub/page.tsx#L635-L637))
- Service split all-self-managed line ([page.tsx:780-782](../../../app/agent/hub/page.tsx#L780-L782))

Each is a candidate for the canonical `<EmptyState>` primitive — judged case-by-case in the audit (see [docs/POLISH_TBD.md](../../POLISH_TBD.md) for Surface 1 grandfather precedents).

### Custom inline accordions / collapses

None on the page-level render. The widgets (AttentionListView etc.) may have their own — audit pending.

---

## 8. Loading skeleton ([loading.tsx](../../../app/agent/hub/loading.tsx))

A bespoke skeleton composer that mirrors the layout of the full hub. Five card-shaped skeleton blocks with inner `agent-skeleton` bars. Roughly matches the visual silhouette so the Suspense boundary doesn't snap.

After Surface 1, the canonical `<Skeleton>` primitive is the inner-row target (per the PanelSkeletons pattern). The composer itself stays bespoke (encodes hub-grid knowledge).

---

## 9. Screenshot configurations (for re-capture diff)

Captured at desktop 1280px and mobile 375px per [Law 17](../../../CLAUDE.md#law-17--behavioural-baseline-before-remediation). Per-role variation matters here because the hub differs structurally by role.

| Capture | Role | Viewport | State |
|---|---|---|---|
| 1 | director | 1280 | full hub (active files > 0) |
| 2 | director | 375 | full hub (active files > 0) |
| 3 | director | 1280 | empty state (zero active files) |
| 4 | negotiator | 1280 | full hub |
| 5 | sales_progressor | 1280 | full hub (service split hidden) |
| 6 | sales_progressor | 1280 | empty state (no assigned files) |
| 7 | admin | 1280 | full hub (platform-wide aggregates) |
| 8 | director | 1280 | with at least 1 expired hold visible |
| 9 | director | 1280 | with at least 1 diary item today |
| 10 | director | 1280 | with attention stack non-empty |

Capture script will live at `e2e/baseline-agent-hub.spec.ts` (Phase 3 Surface 2 Step 1 deliverable, modeled on `e2e/baseline-file-detail.spec.ts`). Output to `docs/phase-3/02-agent-hub/screenshots/before/`.

Per-role caveat: the `phase3Director` seeded user is the only autonomous-capture-friendly identity. The negotiator / progressor / admin shapes need real staging accounts or fresh seeds — covered as Step 1b in the workflow.

---

## 10. Known oddities to preserve

Things that look broken but aren't — preserve verbatim through the remediation, flag in the AUDIT if they're surfaced for fixing.

- **"Coming up" link colours**: links read `var(--agent-text-muted)` when their count is zero (so "0 exchanging this week" doesn't shout). Intentional. Don't unify the colour at audit time.
- **Service split copy varies admin vs agent**: `"Service split"` vs `"Who's managing"`, plus "Self-managed by agencies" vs "Managed by you". Both branches deliberately written.
- **Momentum copy gating**: "On pace with last month" only renders when `percent === 100` exactly; "Ahead" for > 100; "Below" for < 100. Edge equality matters.
- **Hub-diary today filter ([2026-06-29 fix](../../active/TODO.md))**: file detail's `expectedExchangeDate` being a 12-week target placeholder caused the diary to show "Exchange today" for files ≥9 weeks out. Fix is in `getHubDiary` server-side; do not regress.
- **The four pipeline-stat cells share visual layout**: the click target is the whole cell. Hover (`agent-press-cell`) applies only when the cell has an `href`. The fourth cell ("Pipeline value") has no href on purpose — non-interactive.
- **Empty-state ghost cards**: opacity 0.35 + pointer-events none. They are intentionally not real placeholders — they preview the shape of what the hub will look like once data lands.
- **Activity ribbon uses `agent-glass-light` (not `agent-glass`)**: deliberate lighter chrome so it doesn't compete with the cards above.

---

## 11. What's NOT in scope for Surface 2 remediation

Per Law 5 (one concern per PR) and the Phase 3 workflow, Surface 2 will NOT touch:

- **Embedded widget internals** (AttentionListView, UnassignedFilesView, NewBuyersToAcknowledgeView, ChainSetupPendingView, ExpiredHoldsCard) — these are scoped to their own surface remediation when their primary route comes up (Reminders / Work Queue / etc.). Surface 2 only canonicalises what the hub page itself renders + the wrapper chrome it controls.
- **HubCharts internals** (ExchangeForecastChart, ServiceSplitDonut, MomentumRing) — pure SVG with no canonical primitive overlap.
- **PaymentBlockBanner / PaymentMethodNudge** — billing component domain. Their own surface pass.
- **AgentFlagButton modal** — flag-modal pattern is shared across the agent app; canonicalised separately.
- **`getHubDiary` and other server services** — data layer. Surface remediation is presentation-only.
- **AnimatedSection** — already a thin wrapper around motion primitives. No canonicalisation target.
- **Loading.tsx structure** — bespoke composer per Skeleton primitive contract.

The Surface 2 scope is therefore: the **hub page itself (`app/agent/hub/page.tsx`)**, plus the **hub loading skeleton** (`app/agent/hub/loading.tsx`) for the Skeleton primitive sub-swap.

---

## 12. Exit baseline (locked)

This BASELINE.md is pinned as of 2026-06-30. Any deviation from items in §§ 1–10 during remediation must surface in the PR description as an intentional change. Silent deviations are regressions.
