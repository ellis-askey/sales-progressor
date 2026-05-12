# Inventory: Hub

**Route:** `/agent/hub`
**Stage 1 status:** Draft — awaiting Ellis approval
**Amendments:** (empty — populated if mid-flight discoveries occur in Stage 2)

---

## 1. Page identity

| Field | Value |
|---|---|
| Route | `/agent/hub` |
| File | `app/agent/hub/page.tsx` |
| Component type | Server component — pure async, no "use client". Client components imported: `AttentionListView`, `AgentFlagButton`, `ExchangeForecastChart`, `ServiceSplitDonut`, `MomentumRing` |
| Who sees it | Director, Negotiator |
| How they reach it | First screen on login (AgentShell redirects `/agent` → `/agent/hub`). Sidebar nav item. |
| Reachable without a transaction? | Yes — shows empty state (full ghost UI) when `pipelineStats.activeFiles === 0 && attentionItems.length === 0` |

---

## 2. Components rendered

| Component | File | Stage 4 scope | Notes |
|---|---|---|---|
| `AgentShell` | `components/layout/AgentShell.tsx` | No changes — already matches polish | Layout wrapper: sidebar, topbar, toaster. Not touched in hub pass. |
| `PageHeader` | `components/layout/PageHeader.tsx` | No changes — already matches polish | Same import used on transaction-detail. Accepts `title`, `subtitle`, `children` (actions). Visual structure already canonical. Copy changes (greeting, subtitle) are Stage 3 only — the component itself does not change. |
| `AgentFlagButton` | `components/agent/AgentFlagButton.tsx` | Match polish page | Header action — "Send note to progressor". Three render states: closed button / open textarea form / sent confirmation. Currently uses hardcoded `text-emerald-600 bg-emerald-50/60` for sent state. Needs `.agent-reveal-in` for form expand, `.agent-btn-ghost` for Cancel, and theme-aware sent state. |
| `AttentionListView` | `components/hub/AttentionListView.tsx` | Match polish page | "Needs your attention" card — shown always (not conditional). Urgency-coloured left-border rows. "Reminders →" link is inline-styled, not `.agent-link`. Hover uses `hover:brightness-[0.97]` (not `.agent-hover-row`). Header is inline-styled, not `agent-card-hdr`. |
| `MomentumRing` | `components/hub/HubCharts.tsx` | Match polish page | 80×80 SVG ring. No draw-on animation currently — static render at final offset. Stage 2: add A6 draw-on pattern (same as transaction-detail ProgressRing). `percent === null` state shows text placeholder. |
| `ExchangeForecastChart` | `components/hub/HubCharts.tsx` | Match polish page | recharts `BarChart` + `ResponsiveContainer`. Tooltip uses hardcoded white background. Colors already use CSS vars (`var(--agent-coral)`). Minimal changes expected. |
| `ServiceSplitDonut` | `components/hub/HubCharts.tsx` | Match polish page | recharts `PieChart` 92×92. Colors already use CSS vars. Minimal changes expected. |
| `RefreshButton` | `components/hub/HubCharts.tsx` | Out of scope | Exported from HubCharts but **not imported or used** in `app/agent/hub/page.tsx`. The page renders a `PageHeader` with actions instead. RefreshButton is visible in the old hub-preview but not production hub. Do not include in Stage 2. |
| `HubLoading` | `app/agent/hub/loading.tsx` | Match polish page | Next.js loading.tsx — renders before server data arrives. Skeleton layout must match the final hub layout (diary section is NOT skeletonised — it's conditional and will not appear in loading state; loading.tsx correctly omits it). Minor: skeleton for AgentFlagButton is a placeholder rectangle, not a real button skeleton. |
| `Link` (Next.js) | Built-in | No changes | Used for diary rows, attention rows, stat cells, coming-up strip links, stalled row, activity ribbon. |

---

## 3. Data dependencies

| Data | Source | Shape | Null / missing behaviour |
|---|---|---|---|
| `session` | `requireSession()` | `{ user: { id, name, agencyId, role } }` | Redirect to `/login` if session missing |
| `vis` | `resolveAgentVisibility(session.user.id, session.user.agencyId)` | `AgentVisibility { userId, agencyId, seeAll, firmName }` | `seeAll: true` for directors and users with `canViewAllFiles`; `seeAll: false` for negotiators. `firmName` scopes by firm within a large agency. |
| `pipelineStats` | `getHubPipelineStats(vis)` | `{ activeFiles, exchangingSoon, pipelineValuePence, newThisMonth, comingUp: { exchangingThisWeek, completingThisWeek, closingThisMonth: { total } }, stalled: { count } }` | All counts are 0 when no data. `closingThisMonth.total` is in pence. |
| `attentionItems` | `getHubAttentionItems(vis)` | `HubAttentionItem[] { id, urgency, reminderName, transaction: { id, propertyAddress }, nextDueDate }` | `[]` when no overdue/due-today reminders. `urgency`: `escalated` (pending chase with escalated priority), `overdue` (due date < today), `due_today`. |
| `momentum` | `getHubMomentum(vis)` | `{ thisMonth, lastMonth, percent }` | `percent === null` when `lastMonth === 0` (first month of use). `percent` capped at 200. |
| `weeklyForecast` | `getHubWeeklyForecast(vis)` | `WeekBucket[] { label, count, isCurrentWeek }[5]` | Always returns 5 buckets (This wk, +1w, +2w, +3w, +4w). Counts are 0 when no files have exchange dates in that window. |
| `serviceSplit` | `getHubServiceSplit(vis)` | `{ selfManaged, outsourced }` | Both 0 when no active files. |
| `recentActivity` | `getHubRecentActivity(vis)` | `RecentActivity { kind, description, context, transactionId, at } \| null` | `null` when no comms or milestone completions found. Most recent of comm vs milestone is shown. |
| `diaryItems` | `getHubDiary(vis)` | `DiaryItem[] { type, transactionId, address }` | `[]` when no exchanges/completions scheduled for today. Completions shown first; deduplicated by transactionId. |

**Derived values (computed in page, no extra queries):**
- `escalatedCount` — count of attention items where `urgency === "escalated"`
- `overdueCount` — count where `urgency === "overdue"`
- `attentionFileCount` — count of unique transaction IDs in attention items
- `healthStatus` — `"action"` | `"watch"` | `"on_track"` (computed; not currently rendered as a visible badge on the hub itself)
- `next7Days` — `weeklyForecast[0]?.count ?? 0`
- `next30Days` — sum of all 5 weekly bucket counts
- `savedHours` — `Math.round(serviceSplit.outsourced * 2.5)` — approximate hours saved by outsourcing
- `greeting` — time-based: "Good morning" / "Good afternoon" / "Good evening" + first name
- `isEmpty` — `pipelineStats.activeFiles === 0 && attentionItems.length === 0`

---

## 4. States

### Standard states

| State | Trigger condition | What the user sees |
|---|---|---|
| **Loading** | Server component awaiting all 7 parallel queries | `loading.tsx` skeleton — attention card (3 grey rows), pipeline health (4 stat skeletons), momentum (circle skeleton), exchange forecast (bar skeletons), service split (donut skeleton). No diary section in loading (correctly omitted — it's conditional). |
| **Populated (full hub)** | `isEmpty === false` — at least one active file OR at least one attention item | Full hub layout: greeting header, optional diary section, attention card, pipeline + momentum row, exchange + service split row, optional activity ribbon. |
| **Empty** | `isEmpty === true` — zero active files AND zero attention items | Welcome card ("Your pipeline starts here."), ghost pipeline + momentum (opacity 0.3, pointerEvents none), ghost attention section, ghost exchange + service split (opacity 0.3). "Add a sale" CTA. |

### Page-specific states

| State | Trigger condition | What the user sees |
|---|---|---|
| **Today's diary — visible** | `diaryItems.length > 0` | Full-width `agent-glass` card above the attention section. Rows for each exchange/completion today with coloured left border. |
| **Today's diary — hidden** | `diaryItems.length === 0` | Section not rendered at all. |
| **Attention — all clear** | `attentionItems.length === 0` | Green dot + "No reminders due right now. All clear." inside the attention card. "Reminders →" link not rendered. |
| **Attention — escalated** | `escalatedCount > 0` | Up to 3 rows; rows with `urgency === "escalated"` show red left border + red "Escalated" badge. |
| **Attention — overdue only** | `overdueCount > 0 && escalatedCount === 0` | Orange left border + orange "Overdue" badge on relevant rows. |
| **Attention — due today only** | `attentionFileCount > 0 && escalatedCount === 0 && overdueCount === 0` | Coral left border + coral-deep "Due today" badge. |
| **Attention — truncated** | `attentionItems.length > 3` | Only 3 rows shown; "Reminders →" link leads to full work queue. No "show more" on the hub. |
| **Momentum — no data** | `momentum.percent === null` | Ring area replaced by text placeholder: "No comparison yet" + explanatory sentence. Month comparison rows not rendered. |
| **Momentum — populated** | `momentum.percent !== null` | SVG ring at calculated fill. "This month / Last month" comparison rows. Verdict text (ahead / on pace / below). |
| **Exchange forecast — empty** | `next30Days === 0` | No chart. Text message instead: "No exchange dates set in the next 30 days. Add expected exchange dates to active files to build your forecast." |
| **Exchange forecast — populated** | `next30Days > 0` | `ExchangeForecastChart` bar chart + 5 week labels + summary stat rows. |
| **Exchange urgency — shown** | `next7Days > 0` | Coral-deep urgency text below the summary stat rows. |
| **Exchange urgency — hidden** | `next7Days === 0` | No urgency text rendered. |
| **Stalled — clean** | `pipelineStats.stalled.count === 0` | "All files have recent activity" text at 13px/muted, no link. |
| **Stalled — files stalled** | `pipelineStats.stalled.count > 0` | Amber warning icon + "N files stalled — no activity in 14+ days" as a Link to `/agent/work-queue`. |
| **Service split — outsourced** | `serviceSplit.outsourced > 0` | "N files being progressed by our team — saving you approximately N agent hours this week" (savedHours part conditional on savedHours > 0). |
| **Service split — all self-managed** | `serviceSplit.outsourced === 0` | "All files are self-managed. Move files to Sales Progressor to free up your time." |
| **Pipeline delta — shown** | `pipelineStats.newThisMonth > 0` | "+N this month" shown in green below the Active files number. |
| **Pipeline delta — hidden** | `pipelineStats.newThisMonth === 0` | No delta text. |
| **Activity ribbon — visible** | `recentActivity !== null` | Slim glass-background ribbon at bottom: coral avatar, activity description + timestamp, "View file →" link. |
| **Activity ribbon — hidden** | `recentActivity === null` | Ribbon not rendered at all. |
| **Need attention stat colour** | Dynamic | `agent-danger` if `escalatedCount > 0`; `agent-warning` if `attentionFileCount > 0 && escalatedCount === 0`; `agent-text-primary` if 0. |
| **Coming up strip colour** | Dynamic | Each link renders at `agent-text-muted` when count === 0; `agent-text-secondary` when count > 0. |

---

## 5. Interactive elements

| Element | Location | Action | Disabled when | Disabled behaviour |
|---|---|---|---|---|
| "New sale" button | PageHeader actions | Navigate to `/agent/transactions/new` | Never | n/a |
| "Send note to progressor" (AgentFlagButton — closed) | PageHeader actions | Expands textarea form | Never | n/a |
| AgentFlagButton — "Send" | Expanded flag form | POST `/api/agent/flag` with message + transactionId (null for hub) | `sending === true` OR `!message.trim()` | `opacity: 0.5` (inline style on button) |
| AgentFlagButton — "Cancel" | Expanded flag form | Collapses form, clears message | Never | n/a |
| AgentFlagButton — sent state | After submit | Auto-dismisses in 2s | n/a | Not a button — renders "Sent!" confirmation div |
| Today's diary row | Diary section | Navigate to `/agent/transactions/[id]` | Never (always a Link) | n/a |
| Attention item row (up to 3) | AttentionListView | Navigate to `/agent/transactions/[id]?tab=reminders` | Never (always a Link) | n/a |
| "Reminders →" link | Attention section header | Navigate to `/agent/work-queue` | `items.length === 0` | Not rendered (conditionally omitted) |
| Active files stat cell | Pipeline health | Navigate to `/agent/dashboard` | Never — always has href | Always a Link |
| Exchanging soon stat cell | Pipeline health | Navigate to `/agent/transactions?filter=exchanging-next-30-days` | `exchangingSoon === 0` | Renders as `div`, no navigation |
| Need attention stat cell | Pipeline health | Navigate to `/agent/work-queue` | `attentionFileCount === 0` | Renders as `div`, no navigation |
| Pipeline value stat cell | Pipeline health | None | Always | `div`, non-interactive |
| "N exchanging this week" | Coming up strip | Navigate to `/agent/transactions?filter=exchanging-this-week` | Never — always a Link | Muted colour when count = 0 |
| "N completing this week" | Coming up strip | Navigate to `/agent/transactions?filter=completing-this-week` | Never — always a Link | Muted colour when count = 0 |
| "N closing this month" | Coming up strip | Navigate to `/agent/transactions?filter=closing-this-month` | Never — always a Link | Muted colour when count = 0 |
| "N files stalled" row | Pipeline health stalled section | Navigate to `/agent/work-queue` | `stalled.count === 0` | Not rendered — replaced by "All files have recent activity" text |
| "View file →" link | Recent activity ribbon | Navigate to `/agent/transactions/[recentActivity.transactionId]` | `recentActivity === null` | Entire ribbon not rendered |

---

## 6. Conditional renders

```tsx
// Empty state — full page swap
if (isEmpty) {
  return <EmptyHubLayout />;
}
// Shows: when pipelineStats.activeFiles === 0 AND attentionItems.length === 0
// Hides: when at least one active file OR one attention item (returns full hub)

// Today's diary section
{diaryItems.length > 0 && (
  <div> {/* agent-glass card */} </div>
)}
// Shows: any exchange or completion event scheduled for today
// Hides: no diary events (most days)

// AttentionListView — empty state vs rows
{items.length === 0 ? (
  <div> {/* green dot + "No reminders due right now. All clear." */} </div>
) : (
  items.slice(0, 3).map(...)
)}
// AttentionListView always renders — only the inner content varies

// "Reminders →" link in attention header
{items.length > 0 && (
  <Link href="/agent/work-queue">Reminders →</Link>
)}
// Shows: when there are any attention items
// Hides: always clear (link leads to work queue for full list)

// Pipeline "Need attention" stat cell as Link vs div
href={attentionFileCount > 0 ? "/agent/work-queue" : null}
// href present → renders as Link; href null → renders as div

// Pipeline "Exchanging soon" stat cell as Link vs div
href={pipelineStats.exchangingSoon > 0 ? "/agent/transactions?filter=exchanging-next-30-days" : null}
// href present → renders as Link; href null → renders as div

// Pipeline delta "+N this month"
{delta && (
  <span>{delta}</span>
)}
// Shows: when pipelineStats.newThisMonth > 0 (delta string is only set in that case)
// Hides: when newThisMonth === 0

// Momentum comparison rows
{momentum.percent !== null && (
  <div> {/* This month / Last month rows + verdict text */} </div>
)}
// Shows: when lastMonth > 0 (percent is non-null)
// Hides: first month of use (no prior month data)

// Exchange forecast — chart vs empty message
{next30Days === 0 ? (
  <p>No exchange dates set in the next 30 days...</p>
) : (
  <ExchangeForecastChart ... />
)}
// Always renders one or the other

// Exchange urgency text
{next7Days > 0 && (
  <p>N exchanges due this week — make sure files are ready.</p>
)}
// Shows: when there are exchanges in the next 7 days
// Hides: otherwise

// Stalled row — clean vs stalled
{pipelineStats.stalled.count === 0 ? (
  <div>All files have recent activity</div>
) : (
  <Link href="/agent/work-queue">N files stalled...</Link>
)}
// Always renders one or the other

// Service split — outsourced vs all self-managed
{serviceSplit.outsourced > 0 ? (
  <p>N files being progressed by our team{savedHours > 0 && <> — saving you...</>}</p>
) : (
  <p>All files are self-managed...</p>
)}
// Always renders one or the other

// Hours saved (nested)
{savedHours > 0 && (
  <> — saving you approximately {savedHours} agent hours this week</>
)}
// Shows: when outsourced > 0 AND Math.round(outsourced * 2.5) > 0
// Hides: when savedHours === 0 (fractional outsourced count that rounds to 0)

// Recent activity ribbon
{recentActivity && (
  <div> {/* glass ribbon */} </div>
)}
// Shows: when any comm or milestone completion found across visible transactions
// Hides: no activity found (recentActivity === null)
```

---

## 7. Copy inventory

**Verbatim rule:** Variants (singular/plural, loading, conditional) each get their own line. Dynamic values shown as `[dynamic]`.

```
# PageHeader
"Good morning, [first name]"     [greeting — before 12:00 Europe/London]
"Good afternoon, [first name]"   [greeting — 12:00–16:59 Europe/London]
"Good evening, [first name]"     [greeting — 17:00+ Europe/London]
"Hello, [first name]"            [greeting — fallback if Date/timezone fails]
"Here's what matters today."     [subtitle]
"New sale"                       [primary button]
"Send note to progressor"        [AgentFlagButton label — closed state]

# AgentFlagButton — expanded form
"Flag for: [address]…"           [form label — shows first 30 chars of address + "…"]
"e.g. Client called in, asked about exchange date"  [textarea placeholder]
"Send"                           [button — idle]
"Sending…"                       [button — loading]
"Cancel"                         [button — closes form]
"Sent!"                          [confirmation state — auto-dismisses after 2s]
                                 ← NOTE: "Sent!" uses Tailwind hardcoded emerald; not theme-aware.
                                    Stage 2 must redesign this state with agent tokens.

# Today's diary (conditional)
"Today's diary"                  [section heading]
"Exchanges and completions scheduled for today"  [subtitle]
"1 event today"                  [count badge — singular]
"N events today"                 [count badge — plural]
[property address]               [diary row — dynamic]
"Completion"                     [diary row type label]
"Exchange"                       [diary row type label]

# Needs your attention (AttentionListView)
"Needs your attention"           [section heading]
"Files where something's stuck or due"  [subtitle]  ← FLAG for voice pass (Rule 2/3: "stuck" is vague and passive)
"Reminders"                      [header link to /agent/work-queue — shown when items > 0]
"No reminders due right now. All clear."  [empty state]
"Escalated"                      [urgency badge]
"Overdue"                        [urgency badge]
"Due today"                      [urgency badge]
[property address]               [row — dynamic]
[reminder name]                  [row — dynamic, Chase: prefix stripped from reminderRule.name]

# Pipeline health card
"Pipeline health"                [eyebrow label]
"Where your business sits right now"  [subtitle]  ← FLAG for voice pass (Rule 3: "right now" is filler)
"Active files"                   [stat label]
"Exchanging soon"                [stat label]
"Need attention"                 [stat label]
"Pipeline value"                 [stat label]
"+N this month"                  [active files delta — conditional when newThisMonth > 0]
"Coming up:"                     [strip label]
"N exchanging this week"         [coming up strip — Link]
"N completing this week"         [coming up strip — Link]
"[fmtCompact(N)] closing this month"  [coming up strip — Link, e.g. "£142k closing this month"]
"All files have recent activity" [stalled row — clean state]
"N files stalled"                [stalled row count — conditional]  ← FLAG for voice pass (Rule 3: passive — could be "N files need a chase")
"— no activity in 14+ days"     [stalled row description]

# Momentum card
"Momentum"                       [eyebrow label]
"Exchanges this month vs last"   [subtitle]  ← FLAG for voice pass (Rule 3: passive/system description)
"No comparison yet"              [ring empty state heading]
"Compares exchanges month over month. Data appears after your first completed month."  [ring empty state body]
                                 ← FLAG for voice pass (Rule 1: "Compares exchanges" = system self-reference)
"This month"                     [comparison row label]
"Last month"                     [comparison row label]
"N exchange"                     [row value — singular]
"N exchanges"                    [row value — plural]
"Ahead of last month"            [verdict — percent > 100]
"On pace with last month"        [verdict — percent === 100]
"Below last month"               [verdict — percent < 100]

# Exchange forecast card
"Exchange forecast"              [eyebrow label]
"When your sales expect to exchange"  [subtitle]  ← FLAG for voice pass (Rule 1: "your sales expect" is system language — sales don't expect, people do)
"No exchange dates set in the next 30 days. Add expected exchange dates to active files to build your forecast."
                                 [empty state body]
"This wk"                        [week label — current week bar]
"+1w" / "+2w" / "+3w" / "+4w"   [week labels — future bars]
"This week"                      [summary stat row label]
"Next 30 days"                   [summary stat row label]
"N exchange"                     [stat row value — singular]
"N exchanges"                    [stat row value — plural]
"1 exchange due this week — files should be ready."  [urgency text — singular]
"N exchanges due this week — make sure files are ready."  [urgency text — plural]
                                 ← FLAG for voice pass (Rule 3: "make sure files are ready" is passive)

# Service split card
"Service split"                  [eyebrow label]  ← FLAG for voice pass (Rule 2: jargon — already in VOICE_GUIDELINES.md translation table, target: "Who's managing each file")
"How your active files are being progressed"  [subtitle]  ← FLAG for voice pass (Rule 1: already in VOICE_GUIDELINES.md, "being progressed" = system language)
"Self-managed"                   [legend label]
"With progressor"                [legend label]
"N file being progressed by our team"   [body — outsourced === 1]  ← FLAG for voice pass (Rule 1: VOICE_GUIDELINES.md)
"N files being progressed by our team"  [body — outsourced > 1]   ← FLAG for voice pass (Rule 1: VOICE_GUIDELINES.md)
"— saving you approximately N agent hours this week"  [body suffix — savedHours > 0]
                                 ← FLAG for voice pass (Rule 3: "approximately" + "agent hours" is vague — better: "saving around N hours this week")
"All files are self-managed. Move files to Sales Progressor to free up your time."  [body — outsourced === 0]

# Recent activity ribbon (conditional)
"Last activity: [description]"   [primary text — dynamic from commDescription() or milestoneDefinition.name]
"[timeAgo] · [address]"          [secondary text — e.g. "3 mins ago · 14 High Street, Maidstone"]
"View file"                      [link text]

# Empty state (full page — isEmpty === true)
"Your pipeline starts here."     [welcome heading]
"Add your first sale and we'll track it from offer to completion."  [welcome body]
"Add a sale"                     [welcome CTA button]
"Pipeline health"                [ghost card eyebrow — opacity 0.3]
"Momentum"                       [ghost card eyebrow — opacity 0.3]
"Active files"                   [ghost stat label — opacity 0.3]
"Exchanging soon"                [ghost stat label — opacity 0.3]
"Need attention"                 [ghost stat label — opacity 0.3]
"Pipeline value"                 [ghost stat label — opacity 0.3]
"Needs your attention"           [ghost attention heading — opacity 0.3]
"Exchange forecast"              [ghost card eyebrow — opacity 0.3]
"Service split"                  [ghost card eyebrow — opacity 0.3]
```

---

## 8. Desktop view

| Field | Value |
|---|---|
| Breakpoint | ≥ 768px (see `@media (max-width: 767px)` in `app/globals.css:543`) |
| Layout | `AgentShell` sidebar (fixed, 240px left). Main content flows right of sidebar, below fixed topbar. Single-column flex layout within main content. |
| Navigation | AgentShell renders full sidebar permanently. |
| Page-specific layout | Two responsive grid rows: hub-grid-main (2fr+1fr) and hub-grid-half (1fr+1fr). Both are flex column on mobile, grid on desktop. |
| Desktop-only elements | None — all elements are visible on mobile too (just stacked) |

```
Desktop layout (≥ 768px):
┌─ AgentShell sidebar (240px fixed) ─┬────────────────────────────────────────────────────┐
│ logo                                │  PageHeader: "Good morning, [Name]"                │
│ navigation links                    │             "Here's what matters today."             │
│ user strip                          │             [New sale]  [Send note to progressor]   │
│                                     ├────────────────────────────────────────────────────┤
│                                     │  [Today's diary — conditional, full width]          │
│                                     │  [Needs your attention — full width]                │
│                                     │  ┌──── Pipeline health (2fr) ──────┬─ Momentum ──┐ │
│                                     │  │ [4 stat cols] [Coming up strip] │ [80px ring] │ │
│                                     │  │ [Stalled row]                   │ [month rows]│ │
│                                     │  └─────────────────────────────────┴─────────────┘ │
│                                     │  ┌──── Exchange forecast (1fr) ───┬ Svc split ──┐  │
│                                     │  │ [bar chart or empty msg]       │ [donut]     │  │
│                                     │  │ [week labels]                  │ [legend]    │  │
│                                     │  │ [summary stat rows]            │ [body text] │  │
│                                     │  └───────────────────────────────┴─────────────┘  │
│                                     │  [Recent activity ribbon — conditional, full width] │
└─────────────────────────────────────┴────────────────────────────────────────────────────┘
```

---

## 9. Mobile view

| Field | Value |
|---|---|
| Breakpoint | ≤ 767px (`@media (max-width: 767px)` in `app/globals.css:543`) |
| Layout | Single column. AgentShell sidebar collapses to slide-in overlay from left, triggered by hamburger in topbar. |
| Navigation | Hamburger in topbar → sidebar slides in as overlay (`transform: translateX(0)` when open). Backdrop overlay when open. |
| Content padding | `hub-content-pad` reduces to `16px 16px` (overrides inline `32px 24px`). |
| Grid collapses | `hub-grid-main` (2fr 1fr) → 1 column (Pipeline health stacks above Momentum). `hub-grid-half` (1fr 1fr) → 1 column (Exchange forecast stacks above Service split). |
| Stats grid | `hub-stats-grid` (4 cols) → 2 cols — "Active files | Exchanging soon" on row 1, "Need attention | Pipeline value" on row 2. The `borderLeft` separator between cols remains — the 2nd col of each row retains its left border. |
| PageHeader | Becomes flex column (`agent-page-header` overrides): greeting/subtitle above, actions row below. Padding reduces to `20px 16px 14px`. |
| Activity ribbon layout | Uses `flex flex-col gap-2 sm:flex-row` — at `sm` (640px) becomes row; below 640px stacks description above "View file" link. |
| Elements hidden on mobile | None — all sections present, just stacked. |
| Touch targets | "New sale" and flag button are `agent-btn-sm` — sufficient touch target. Attention rows and diary rows have 13px vertical padding — borderline; Stage 2 should verify at 375px. |
| MomentumRing (80px) | Fine at 375px — fits within single-column card. |
| ServiceSplitDonut (92px) | Fine at 375px — flex row: donut left, legend right. |
| ExchangeForecastChart | `ResponsiveContainer width="100%"` — fills card width, adapts to mobile. |

**Common mobile questions:**
- Does the sidebar become a drawer? Yes — slides from left as overlay with backdrop.
- Does the status dropdown become a bottom sheet? No dropdowns on hub.
- Any tables become stacked cards? No tables on hub — sections already stack.
- Sticky footer bar? No.
- Swipe gestures? No.

```
Mobile layout (375px):
┌─────────────────────────────────┐
│ [☰]  Hub                        │  ← topbar (sticky, fixed)
├─────────────────────────────────┤
│ Good morning, [Name]             │
│ Here's what matters today.       │
│ [New sale]  [Send note to prog.] │
├─────────────────────────────────┤
│ [Today's diary — conditional]    │
│ [Needs your attention]           │
│ ┌────────── Pipeline health ──┐  │  ← hub-grid-main collapses
│ │ Active  | Exchanging        │  │  ← hub-stats-grid: 2×2
│ │ Attention | Pipeline value  │  │
│ │ Coming up strip (wraps)     │  │
│ │ Stalled row                 │  │
│ └─────────────────────────────┘  │
│ ┌──────────── Momentum ───────┐  │  ← below pipeline on mobile
│ │     [80px ring]             │  │
│ │   This month | Last month   │  │
│ └─────────────────────────────┘  │
│ ┌───────── Exchange forecast ─┐  │  ← hub-grid-half collapses
│ │   [bar chart or msg]        │  │
│ │   This week | Next 30 days  │  │
│ └─────────────────────────────┘  │
│ ┌──────── Service split ──────┐  │  ← below exchange forecast
│ │ [donut]  Self-managed       │  │
│ │          With progressor    │  │
│ │   [body text]               │  │
│ └─────────────────────────────┘  │
│ [Recent activity ribbon]         │
│  Last activity: [description]    │  ← stacks vertically on mobile
│  View file →                     │
└─────────────────────────────────┘
```

**Stage 2 mobile decision point:** The 4-column stats grid renders as 2×2 on mobile. The current `borderLeft` separator is positioned on every cell with `i > 0` — this produces correct separators in 4-col layout but may produce unexpected borders in the 2×2 layout (the 3rd stat cell, `i=2`, shows a `borderLeft` even though it's the first cell in the second row). Stage 2 should verify this visually at 375px and decide whether to suppress left borders on mobile or accept the current output.

---

## 10. Animations / transitions already in place

| Element | Animation | Source | Notes |
|---|---|---|---|
| Pipeline stat cell hover | `background: hover:bg-black/[0.04]` | Tailwind class on `Link` cells | Not theme-aware — hardcoded black tint |
| Today's diary row hover | `filter: hover:brightness-[0.97]` | Tailwind class on `Link` | Not canonical — should become `.agent-hover-row` |
| Attention item row hover | `filter: hover:brightness-[0.97]` | Tailwind class in `AttentionListView` | Not canonical — same issue |
| Stalled row hover | `background: var(--agent-hover-tint-warning)` | `.stalled-row-link` class in `agent-system.css` | Already canonical and theme-aware |
| Coming up links hover | `text-decoration: underline` | `.coming-up-link` class in `agent-system.css` | Already canonical |
| All agent-btn buttons | `scale(0.98)` press-down, hover brightness | `.agent-btn:active` in `agent-system.css` | "New sale" button inherits; flag form buttons inherit |
| MomentumRing SVG | None currently | — | **Stage 2 candidate: A6 draw-on animation** (see §10.5). Ring currently renders at final `strokeDashoffset` with no transition — static on mount. |
| AgentFlagButton form reveal | None — instant show/hide via React state | — | **Stage 2 candidate: `.agent-reveal-in` on textarea form mount** |

---

## 10.5. Global animation and interaction inheritance

Which canonical classes does hub use or need? Reference: `docs/polish-pass/ANIMATION_STANDARDS.md`.

**Animation classes (§1–6):**

| Class | Applies to hub? | Where it fires | Status |
|---|---|---|---|
| `.agent-acc` / `.agent-acc-in` | No | No collapsible sections on hub | N/A |
| `.agent-reveal-in` / `.agent-reveal-out` | Yes — needs wiring | AgentFlagButton: textarea form expands/collapses on flag button click. Currently instant React state toggle. | Needs wiring in Stage 4 |
| `.agent-dropdown-in` | No | No dropdowns on hub | N/A |
| `.agent-row-flash` | No | No optimistic confirm pattern on hub | N/A |
| `.agent-row-exit` | No | No deletable rows on hub | N/A |
| `.agent-btn` (press-down + hover) | Yes — already wired | "New sale" (`agent-btn agent-btn-primary agent-btn-sm`), flag form "Send" (`agent-btn agent-btn-primary agent-btn-sm`), "Cancel" (`agent-btn agent-btn-ghost agent-btn-sm`) | Already present |

**Interactive-state classes (§6–12):**

| Class | Applies to hub? | Where it fires | Status |
|---|---|---|---|
| `.agent-segment-pill` | No | No segment toggles on hub | N/A |
| `.agent-link` / `.agent-link-muted` | Yes — needs wiring | "Reminders →" in AttentionListView header (currently inline-styled). "View file →" in activity ribbon (currently inline-styled). | Needs wiring in Stage 4 |
| `.agent-btn-ghost-bordered` | No | No bordered ghost CTAs on hub | N/A |
| `.agent-acc-hdr` | No | Hub card headers use `agent-eyebrow` pattern (see §13 notes) — not `agent-card-hdr` | N/A — deliberate pattern difference |
| `.agent-icon-btn` | No | No circular icon/close buttons on hub | N/A |
| `.agent-card-hdr` / `.agent-card-title` | Yes — needs wiring for diary + attention section headers | Today's diary header and Needs your attention header use inline styles. Should use `agent-card-hdr` / `agent-card-title`. Pipeline health, Momentum, Exchange Forecast, Service Split use `agent-eyebrow` pattern (different — see §13). | Needs wiring in Stage 4 |
| `.agent-hover-row` | Yes — needs wiring | Today's diary rows, attention rows, pipeline stat cell hover — currently use `hover:brightness-[0.97]` (Tailwind) or hardcoded `hover:bg-black/[0.04]`. Should use `.agent-hover-row` (theme-aware). | Needs wiring in Stage 4 |

**Per-page JS patterns:**

| Pattern | Applies? | Notes |
|---|---|---|
| A5 — tab indicator hook | No | No tabs on hub |
| A6 — progress ring draw-on | Yes — needs wiring | `MomentumRing` SVG should animate on mount (draw from 0 to percent). Follows same A6 pattern as transaction-detail's `ProgressRing`. Needs: `useState` for offset starting at `circ`, `useEffect` with 60ms delay, `transition: stroke-dashoffset 900ms cubic-bezier(0.4,0,0.2,1)`. Reduced-motion: offset set directly to `target` on mount. `MomentumRing` is a client component ("use client" in HubCharts.tsx) — no barrier. |

---

## 11. Known edge cases

- **Director vs negotiator data scope:** Director sees all transactions in the agency (`seeAll: true`). Negotiator sees only their assigned files (`seeAll: false`). The hub stats, attention items, and activity ribbon all reflect different data per role. Stage 2 must be tested against both role types (or documented as "requires Ellis walkthrough with both role accounts"). A negotiator with no assigned files will hit the empty state even if the agency has many active files.

- **Momentum ring at 200%:** `momentum.percent` is capped at 200 in `getHubMomentum`. The SVG ring fill is `Math.min(100, Math.max(0, percent)) / 100` — so at 200, the ring fills to 100% (full circle). The percentage label inside the ring shows "200%". This is correct and intentional. Stage 2 should render this state.

- **MomentumRing null state:** When `percent === null`, the ring is replaced entirely by a text block. The card's flex-column layout with `flex: 1` on the ring container will push this text block to center — the vertical spacing may look different in null vs populated states. Stage 2 should render both.

- **Activity ribbon responsive breakpoint:** The ribbon uses Tailwind `sm:flex-row` (640px breakpoint), not the 767px hub breakpoint. Between 640px and 767px (tablet range), the ribbon is a row but the hub grids are still columns. This is correct and intentional.

- **Stats grid 2×2 on mobile:** The `hub-stats-grid` override gives 2 columns on mobile (`repeat(2, 1fr)`). Cell borders use `borderLeft: i > 0`. In a 4-col layout, only the 2nd–4th cells get the border — correct. In a 2-col layout, the 2nd and 4th cells get the border — correct (right column of each row). The 3rd cell (`i=2`) ALSO gets the border (`i > 0` is true), meaning it gets a left border even as the first cell of the second row. This is a visual edge case — see §9 decision note.

- **`savedHours` precision:** `savedHours = Math.round(serviceSplit.outsourced * 2.5)`. If `outsourced = 1`, `savedHours = 3` (correct). If `outsourced = 0` (handled by outsourced > 0 guard). The `2.5 hours per file per week` is a product assumption, not a user-configurable value. Do not surface this formula to users.

- **Empty pipeline with attention items:** `isEmpty` requires BOTH `activeFiles === 0` AND `attentionItems.length === 0`. If an agent has attention items but zero active files (unusual but possible — e.g. all files moved to withdrawn), the full hub renders (not empty state). The attention card shows the reminders. Pipeline stats all show 0. Stage 2 should render this edge state.

---

## 12. Out of scope for redesign

- All server-side data queries in `lib/services/hub.ts` — not touched
- `resolveAgentVisibility` logic in `lib/services/agent.ts` — not touched
- recharts library choice and configuration (BarChart, PieChart) — library is not changed
- `savedHours` formula (`outsourced * 2.5`) — product assumption, not changed
- `coming-up-link` and `stalled-row-link` CSS class definitions in `agent-system.css` — already canonical; hub uses them correctly
- Hub-specific responsive overrides in `app/globals.css` (hub-grid-main, hub-grid-half, hub-stats-grid, hub-content-pad) — these are the correct breakpoint system; Stage 4 does not add or remove these
- `/api/agent/flag` API endpoint — server-side, not touched
- `getHubFilteredIds` function (used by the `/agent/transactions?filter=...` route) — not part of hub page; touched only if the transaction list page is affected

---

## 13. Per-section visual specification

**Baseline:** Transaction-detail is the absolute quality bar (Stage 4 signed off 2026-05-12). Patterns already established there — glass-card wrapping, agent-card-hdr/agent-card-title for section headers, agent-hover-row for interactive rows — apply here where structurally appropriate. Where hub sections differ (e.g. internal-padded eyebrow headers on stat cards), the difference is justified in the notes column.

| Section name | Polish-page structure | Production component(s) | Current state vs polish | Stage 4 changes required |
|---|---|---|---|---|
| **PageHeader** | `agent-page-header` div: h1 26px/700/`--agent-text-primary`/`-0.02em`, subtitle 13px/`--agent-text-tertiary`. Actions: `agent-page-header-actions`. On mobile: flex-column layout via CSS. | `components/layout/PageHeader.tsx` | Already canonical — same component as transaction-detail. | None. Verify renders correctly at both breakpoints. |
| **Today's diary** | `agent-glass overflow-hidden rounded-[var(--agent-radius-xl)]`. Header: `agent-card-hdr` pattern — "Today's diary" as `agent-card-title`, subtitle 11px/muted, count badge (green pill: `agent-success-bg`, `agent-success-border`, 11px/700). Rows: `agent-hover-row` with `padding: 13px 20px 13px 17px`, `borderLeft: 3px solid [color]`, `background: [tinted]`, `borderTop` between rows. Text: address 12px/500/primary, type label 11px/600/[color]. | `app/agent/hub/page.tsx` (inline JSX — no separate component) | Header uses raw inline `div` with inline flex styles + inline font styles (not `agent-card-hdr`). Rows use `hover:brightness-[0.97]` (not `.agent-hover-row`). Type label text ("Completion" / "Exchange") is inline-styled. | Convert header to `agent-card-hdr` + `agent-card-title`. Convert rows to `.agent-hover-row`. Verify left-border colours use `var(--agent-success)` and `var(--agent-coral)` (already do). Follows transaction-detail pattern for coloured-border rows. |
| **Attention (AttentionListView)** | `agent-glass-strong overflow-hidden rounded-[var(--agent-radius-xl)]`. Header: `agent-card-hdr` — Clock icon + "Needs your attention" as `agent-card-title` (13px/500 — NOTE: this is larger than the standard `agent-card-title` 12px/600; Stage 2 must decide which applies), subtitle 11px/muted, "Reminders →" as `.agent-link`. Rows: `agent-hover-row` with `padding: 13px 20px 13px 17px`, coloured `borderLeft`, coloured `bg`, `borderTop` between rows. Empty state: green dot + text. | `components/hub/AttentionListView.tsx` | Header uses inline flex div (not `agent-card-hdr`). "Reminders →" is inline-styled Link (not `.agent-link`). Rows use `hover:brightness-[0.97]` (not `.agent-hover-row`). | Convert header to `agent-card-hdr` + `agent-card-title` (or hub-appropriate equivalent if 13px title is intentional). Convert "Reminders" link to `.agent-link`. Convert row hover to `.agent-hover-row`. NEW PATTERN: `agent-glass-strong` as the surface (vs `agent-glass` used on stat cards) — intentional distinction: attention is a priority surface. |
| **Pipeline health card** | `agent-glass` card, `padding: 20px 24px`. Internal header: `agent-eyebrow` "Pipeline health" + subtitle `fontSize: 12/muted` — **NOT `agent-card-hdr`** (internal-padded header pattern, no border-bottom, eyebrow style not title style). 4-column stats row: `agent-hover-row` on clickable cells (replaces `hover:bg-black/[0.04]`). Coming up strip: `.coming-up-link` (already canonical). Stalled row: `.stalled-row-link` (already canonical). | `app/agent/hub/page.tsx` (inline JSX) | Stat cell hover uses hardcoded `hover:bg-black/[0.04]` — not theme-aware. `borderLeft: "1px solid var(--agent-border-subtle)"` — already theme-aware. | Convert stat cell hover from `hover:bg-black/[0.04]` to `.agent-hover-row`. NEW PATTERN for hub: `agent-eyebrow` + 12px subtitle = the hub card header style. This is deliberately different from `agent-card-hdr` because hub stat cards have no border-bottom separator — content flows directly under the label. Stage 2 must canonicalise this pattern consistently across all 4 stat cards. |
| **Momentum card** | `agent-glass` card, `padding: 20px 24px`. Internal header: same `agent-eyebrow` + subtitle pattern as pipeline health. `MomentumRing` SVG with A6 draw-on animation on mount. Month comparison rows: `flex justifyContent: space-between`, 11px/muted label, 12px/600/primary count, singular/plural. Verdict: 11px/500, right-aligned, success or warning color. Null state: centred text block. All six themes: ring stroke uses `var(--agent-coral)` — correct, theme-aware. Track uses `rgba(var(--agent-coral-base-rgb),0.18)` — theme-aware. | `components/hub/HubCharts.tsx` — `MomentumRing` | No draw-on animation — ring renders static at final `strokeDashoffset`. | **Add A6 draw-on animation to MomentumRing** — identical pattern to transaction-detail `ProgressRing`: `useState` for offset, 60ms paint delay, `stroke-dashoffset 900ms cubic-bezier(0.4,0,0.2,1)`. Reduced-motion: offset at target on mount (no transition). Theme-awareness already correct. |
| **Exchange forecast card** | `agent-glass` card, `padding: 20px 24px`. Internal header: `agent-eyebrow` + subtitle. `ExchangeForecastChart` (BarChart) or empty message. Week labels: 10px/[weight by isCurrentWeek]. Summary stat rows: 12px, "This week" count coral-deep when > 0. Urgency text: 11px/500/coral-deep. Tooltip: glass-background (not hardcoded white). All six themes: bar fill uses `var(--agent-coral)` — theme-aware. | `components/hub/HubCharts.tsx` — `ExchangeForecastChart`, `ForecastTooltip` | Tooltip background is hardcoded `rgba(255,255,255,0.97)` with hardcoded border. | Convert tooltip to glass pattern: `background: rgba(255,255,255,0.88)`, `border: 0.5px solid var(--agent-glass-border)`, `backdropFilter: blur(12px)`. Follows transaction-detail glass tooltip pattern. |
| **Service split card** | `agent-glass` card, `padding: 20px 24px`. Internal header: `agent-eyebrow` + subtitle. `ServiceSplitDonut` (PieChart). Legend: two rows — 10×10 `borderRadius: 2` swatch + label + count + pct. Body text: 12px/secondary. All six themes: donut uses `var(--agent-coral)` (self-managed) and `var(--agent-warning)` (outsourced) — theme-aware. | `components/hub/HubCharts.tsx` — `ServiceSplitDonut`, `app/agent/hub/page.tsx` (legend inline JSX) | Minimal visual gaps. Voice changes needed (see §7 flags). Body text line-height and spacing already correct. | Voice copy changes only (Stage 3 → Stage 4 apply). No structural changes needed. |
| **Recent activity ribbon** | Slim glass panel, full width. `background: rgba(255,255,255,0.42)`, `backdropFilter: blur(16px)`, `border: 0.5px solid var(--agent-glass-border)`, `borderRadius: var(--agent-radius-lg)`, `padding: 12px 20px`. Flex row (stacks on mobile via Tailwind `sm:flex-row`). Coral circle (24px) with Plus icon. Description: 12px/500/primary, truncated. Timestamp: 11px/muted. "View file" as `.agent-link` (or `.agent-link-primary`). | `app/agent/hub/page.tsx` (inline JSX) | "View file →" rendered as inline-styled `Link` (not `.agent-link`). Glass background NOT using `.agent-glass` class (uses inline styles that replicate glass). | Convert "View file →" to `.agent-link` with ArrowRight icon. Evaluate whether to convert inline glass to `.agent-glass` class or leave inline (inline is acceptable if it differs from the standard `.agent-glass` values — the `rgba(255,255,255,0.42)` is lighter than `.agent-glass` — leave inline but annotate). |
| **Loading skeleton** | Follows full hub layout: attention card skeleton → pipeline+momentum row → exchange+service split row. No diary skeleton (diary is conditional, not shown in loading state). Skeleton sizes match final content exactly. | `app/agent/hub/loading.tsx` | Loading.tsx skeleton mostly matches. AgentFlagButton renders as plain rectangle skeleton (height 32, width 168) rather than a real button skeleton. | Verify skeleton proportions match final layout after Stage 2 designs the polish page. If cards change size or structure, update loading.tsx accordingly. Minor: the flag button skeleton `width: 168` should match the final rendered button width. |

---

## 14. Amendments

_(Empty — populated if mid-flight discoveries occur in Stage 2.)_

| Date | Discovery | Added to which section |
|---|---|---|
| — | — | — |
