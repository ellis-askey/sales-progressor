# Hub + Analytics Audit
_Phase 0 — no code changes_

---

## Section 1: Existing Rules Engine

### Where it lives
| File | Purpose |
|------|---------|
| `lib/services/problem-detection.ts` | Core engine — 288 lines |
| `app/api/cron/detect-problems/route.ts` | Cron trigger — loops all agencies, calls engine per agency |

### How it's evaluated
**Stored/cached, not real-time.** `detectAndStoreFlags(agencyId)` scans all active + on_hold files, writes results to `TransactionFlag` table, then resolves stale flags. The cron hits `/api/cron/detect-problems` on a schedule (vercel.json — currently `0 3 * * *`, 3am daily). The hub reads pre-computed rows — no scan on page load.

### The 7 rules (FlagKind)

| Kind | Trigger condition | Data read | Severity implication |
|------|-----------------|-----------|----------------------|
| `long_silence` | No outbound or inbound comms ≥ 10 days (active files only) | `CommunicationRecord.createdAt`, `type` | Watch |
| `milestone_stalled` | < 25 milestones completed by week benchmark (> 25% behind 12-week target) | `MilestoneCompletion` count vs weeks elapsed since `createdAt` | Watch |
| `chase_unanswered` | Pending `ChaseTask` with `dueDate` ≥ 7 days ago | `ChaseTask.dueDate`, `status="pending"` | Overdue |
| `exchange_approaching_gaps` | ≤ 14 days to exchange AND < 25 milestones done | `expectedExchangeDate`, `MilestoneCompletion` count | Overdue |
| `on_hold_extended` | File on hold ≥ 14 days | `PropertyTransaction.updatedAt`, `status="on_hold"` | Watch |
| `no_portal_activity` | Active ≥ 14 days, portal contacts exist, zero inbound comms | `Contact.portalToken`, `CommunicationRecord.type="inbound"` | Attention |
| `overdue_milestone` | No new milestone completed ≥ 21 days, not near completion | `MilestoneCompletion.completedAt` | Attention |

### AI enhancement
Each new flag calls `generateReasons()` which hits the Claude API to produce a plain-English reason string (max 12 words, e.g. "No solicitor update in 11 days"). Falls back to raw context string on API failure. Stored on `TransactionFlag.reason`.

### Database model
```
TransactionFlag {
  id            String   @id
  transactionId String
  agencyId      String
  kind          String
  reason        String?
  resolvedAt    DateTime?
  detectedAt    DateTime
  createdAt     DateTime
  updatedAt     DateTime
  @@unique([transactionId, kind])
  @@index([agencyId, resolvedAt])
}
```

### Retrieval function
`getActiveFlags(agencyId)` — returns unresolved flags with full transaction + assignee context. Output is the direct input for the hub's "Needs your attention" section.

### Current UI exposure
Flags exist in the database but are **not currently surfaced on the agent-facing dashboard**. The agent dashboard (`/agent/dashboard`) shows the transaction table, forecast strip, and post-exchange strip — no flag list. The hub will be the first agent-facing surface for this data.

### Gaps / partial work
- **Severity mapping is implicit** — the 7 kinds don't have an explicit `severity` field on the model. The hub spec calls for severity-based sorting (overdue → watch → attention). A severity mapping will need to be derived from `kind` at query time:
  - `chase_unanswered`, `exchange_approaching_gaps` → **overdue**
  - `long_silence`, `milestone_stalled`, `on_hold_extended` → **watch**
  - `no_portal_activity`, `overdue_milestone` → **attention**
- **Cron frequency** — currently 3am daily. Flags could be up to ~21 hours stale by end of day. For v1 this is acceptable; the hub will show last-updated timestamp to set expectations.
- **No `resolvedAt` auto-clearing** — `detectAndStoreFlags` resolves flags that no longer apply on each run. Between runs, a flag may linger after the underlying issue is fixed. Again acceptable for v1.

---

## Section 2: Existing Analytics Queries

### File: `app/agent/analytics/page.tsx` (390 lines)
### Service: `lib/services/analytics.ts`

### Time-period filters
**Yes — fully implemented.** Four periods: `week`, `month`, `year`, `all`. Default: `month`. Applied via URL param `?period=`. Each filters `PropertyTransaction.createdAt` (or milestone `completedAt`) to the relevant window.

### Stats — what they compute and whether they're period-filtered

| Stat | Period-filtered | Source |
|------|----------------|--------|
| Files submitted | ✓ | Count of transactions with `createdAt` in period |
| Exchanged | ✓ | Files where exchange milestone (VM12/PM16) `completedAt` in period |
| Completed | ✓ | Files where completion milestone (VM13/PM17) `completedAt` in period |
| Pipeline value | ✓ | Sum of `purchasePrice` for files created in period |
| Value exchanged | ✓ | Sum of `purchasePrice` for exchanged files in period |
| Total fee pipeline | ✓ | Sum of `agentFeeAmount` + computed percentage fees in period |
| Fees from exchanged | ✓ | Fee sum for exchanged-in-period files |
| Average fee | ✓ | Mean fee across period |
| Service split | ✗ (all-time) | Count of active `serviceType` = self_managed vs outsourced |
| Pipeline health | ✗ (all-time) | 30-day exchange window + milestone % + missing-fee count |
| Referral income | ✓ | Referral fees for referred files in period |

### Bar chart (existing)
Manual SVG bar chart in analytics page. Auto-adapts X-axis labels to period:
- **Week:** 7 days (Mon–Sun labels)
- **Month:** 6-month rolling window
- **Year:** 12-month rolling window
- **All:** Last 12 months

Bars represent files submitted per bucket. No charting library — inline CSS percentage heights.

### Team filter (director-only)
`AnalyticsFilterClient` component provides a team member picker. URL param `?user={userId}` scopes queries to one agent's files. Not visible to negotiators.

### Average time-to-exchange
`getAnalytics()` computes agency-wide average days (creation → VM12/PM16 completion). Returns `avgDaysToExchange: number | null`. **Not broken down per solicitor firm** — new query needed for the analytics overhaul.

### Reusable server-side aggregations
- `getAgentTransactions(vis)` — full transaction list with visibility scoping; base for most stats
- `getExchangeForecast()` — 4-month lookahead grouped by year-month
- `getAnalytics()` — returns `avgDaysToExchange`, can be extended
- `resolveAgentVisibility(userId, agencyId)` — director vs negotiator scope

---

## Section 3: Reusable Components

### Glass surface primitives
All live in `app/agent/styles/agent-system.css`. CSS class-based, no component wrapper needed:

| Class | Use |
|-------|-----|
| `.agent-glass` | Standard card surface (backdrop-filter, 50% white bg) |
| `.agent-glass-strong` | Higher contrast card (70% white bg) — use for attention list |
| `.agent-glass-subtle` | Light surface (35% white bg) |
| `.glass-card` | Legacy variant (still used in transaction pages) |

### Stat / number display
No dedicated `<StatCard>` component exists — stat cards are currently composed inline with CSS classes. Pattern from `app/agent/dashboard/page.tsx`:
```tsx
<div className="agent-glass" style={{ padding: "16px 20px" }}>
  <p style={{ fontSize: "var(--agent-text-micro)", color: "var(--agent-text-muted)", ... }}>LABEL</p>
  <p style={{ fontSize: "var(--agent-text-h2)", color: "var(--agent-coral)", ... }}>VALUE</p>
</div>
```
Reuse this pattern; no new component needed for simple stats.

### Status pills
`.agent-pill-active`, `.agent-pill-hold`, `.agent-pill-completed`, `.agent-pill-withdrawn` — defined in CSS. For severity pills on the hub (overdue/watch/attention), use inline styles with `--agent-danger`, `--agent-warning`, `--agent-coral` tokens.

### Skeleton loading
`.agent-skeleton` class provides shimmer animation. Can be applied to any div.

### Other reusable components
| Component | Location | Notes |
|-----------|----------|-------|
| `EmptyState` | `components/ui/EmptyState.tsx` | Configurable icon, title, description, action button |
| `ForecastStrip` | `components/transactions/ForecastStrip.tsx` | Month-grouped exchange list — reference for hub forecast card |
| `PostExchangeStrip` | `components/transactions/PostExchangeStrip.tsx` | Urgency-grouped completed files |
| `TransactionListWithSearch` | `components/transactions/TransactionTable.tsx` | Full file table with search |

### Chart components
**None exist.** No charting library installed. The analytics page's bar chart is manual SVG.

---

## Section 4: Data Freshness

| Data | Freshness | Permission scope |
|------|-----------|-----------------|
| Transaction list (active/on_hold) | Real-time on page load (Prisma query) | Director → all agency files; Negotiator → own files (`agentUserId`) |
| TransactionFlag (needs attention) | Up to ~21 hours stale (3am cron) | Scoped by `agencyId`; hub should further filter to visibility scope |
| Exchange forecast | Real-time on page load | Visibility-scoped via `getExchangeForecast()` |
| Milestone completions | Real-time | Transaction-scoped |
| CommunicationRecord (activity ribbon) | Real-time | Transaction-scoped |
| Analytics aggregations | Real-time (computed on page load from Prisma) | Visibility-scoped via `getAgentTransactions(vis)` |
| Service split | Real-time | Visibility-scoped |

**Note on flag staleness:** The hub must display a "Data as of [time]" indicator. Use the max `detectedAt` across returned flags as the freshness timestamp. A manual refresh button re-fetches the server component (Next.js router.refresh()).

**Permission gap to address:** `getActiveFlags(agencyId)` currently returns all agency flags regardless of assignee. For negotiators, the hub should filter flags to only their own files. This requires joining on `TransactionFlag.transactionId → PropertyTransaction.agentUserId` at query time, or filtering in the page.

---

## Section 5: Charting Library Decision

**Nothing is installed.** The analytics page uses a hand-rolled SVG bar chart (percentage-height CSS bars, no library).

**Recommendation: Recharts.**

Reasons:
- Standard React charting library, wide adoption
- Composable component API fits the existing component patterns
- `ResponsiveContainer` handles fluid widths without manual resize logic
- Custom tooltip and legend components trivially replace defaults — clean integration with agent design tokens
- No D3 knowledge required
- Bundle size acceptable (~160KB gzipped for full package; can tree-shake to subset)

Install: `npm install recharts`

No other library has a compelling reason to displace Recharts here.

---

## Scope Confirmation Answers (Five Questions)

### 1. Audit document location
`/notes/hub-analytics-audit.md` — confirmed, created here.

### 2. Charting library
Nothing installed. **Recommend Recharts** — install before Phase 1 begins. All charts (bar, line, donut/pie, sparklines) covered by one library. Design tokens integrate cleanly via `fill`/`stroke` props.

### 3. Existing dashboard route
`/agent/dashboard` **exists and is the current All Files page** — it renders the transaction table, status filters, forecast strip, and post-exchange strip. It is NOT a hub; it is already the "All Files" browsing surface the spec says to preserve.

**Recommended approach:**
- Build the hub at `/agent/hub` (new page)
- `/agent/dashboard` stays exactly as-is → it becomes the "All Files" nav item
- After login, redirect to `/agent/hub` instead of `/agent/dashboard`
- Add a redirect: `/agent/dashboard` → `/agent/hub` is **not needed** (dashboard stays as All Files)
- Update the default post-login redirect (in auth callback / middleware) from `/agent/dashboard` → `/agent/hub`

### 4. Rules engine evaluation
**Pre-computed and stored.** Flags are written to `TransactionFlag` by the cron job (3am daily). The hub page calls `getActiveFlags(agencyId)` which is a fast DB read — no scan on page load. Staleness: up to ~21 hours. Acceptable for v1; surface timestamp via `max(detectedAt)`.

One gap to fix: `getActiveFlags` needs a visibility filter for negotiators (currently returns all agency flags). Will add `agentUserId` scoping in the hub data fetch.

### 5. Time-to-exchange data
**Agency-wide average exists** (`getAnalytics()` → `avgDaysToExchange`). **Per-solicitor breakdown does not exist** — new Prisma query required for the analytics overhaul. Will compute: for each `SolicitorFirm` linked to transactions that have exchanged, calculate mean days from `createdAt` to VM12/PM16 `completedAt`. Flagged for Phase 2.
