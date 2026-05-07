# Discovery: The Hub
_Research notes for the "The Hub" help article. Not a help article — raw findings only._

Primary source: `app/agent/hub/page.tsx` (976 lines)
Data layer: `lib/services/hub.ts` (537 lines)
Visibility: `lib/services/agent.ts:7–25`

---

## 1. Page structure — top to bottom

### Visibility resolution

Before any data is fetched, the page resolves visibility:

```ts
// app/agent/hub/page.tsx:107
const vis = await resolveAgentVisibility(session.user.id, session.user.agencyId);
```

`resolveAgentVisibility` (`lib/services/agent.ts:15–25`) fetches the user's `role`, `canViewAllFiles`, and `firmName`:

```ts
const seeAll = user?.role === "director" || user?.canViewAllFiles === true;
return { userId, agencyId, seeAll, firmName: user?.firmName ?? null };
```

`seeAll` is then used in `buildTxWhere` (`lib/services/hub.ts:17–24`) to scope every hub query:
- `seeAll = true`: returns `{ agencyId, agentUserId: { not: null } }` — all agency files with an assigned agent, OR `{ agencyId, agentUser: { firmName } }` if the user has a `firmName` set (branch scoping — see Worth Flagging §3)
- `seeAll = false`: returns `{ agencyId, agentUserId: vis.userId }` — only files assigned to this user

### Data loading

All seven data fetches run in parallel before any rendering (`hub/page.tsx:109–118`):

```ts
const [pipelineStats, attentionItems, momentum, weeklyForecast, serviceSplit, recentActivity, diaryItems] =
  await Promise.all([...]);
```

The page is **entirely server-rendered**. There is no client-side data fetching for page content. The `RefreshButton` triggers `router.refresh()` which re-executes the server component.

### Empty state condition

```ts
// hub/page.tsx:130
const isEmpty = pipelineStats.activeFiles === 0 && attentionItems.length === 0;
```

When `isEmpty` is true, the page returns early with the empty state layout. All seven queries still run — the empty state check is on the results, not a pre-check.

---

### Empty state layout (top to bottom)

| Element | Component/source | Behaviour |
|---|---|---|
| Header | Inline JSX (`hub/page.tsx:137–184`) | Identical to full hub header — greeting, tagline, RefreshButton, New sale, Send note to progressor |
| Welcome CTA | `HubEmptyWelcomeCard` (`components/agent/HubEmptyWelcomeCard.tsx`) | "Your pipeline starts here. / Add your first sale..." with "Add a sale" button → `/agent/transactions/new` |
| Ghost pipeline health + momentum | Inline JSX (`hub/page.tsx:193–215`) | `opacity: 0.3, pointerEvents: "none"`. Shows skeleton bars for 4 stat cells and a skeleton circle for the ring |
| Ghost attention | Inline JSX (`hub/page.tsx:218–247`) | `opacity: 0.3, pointerEvents: "none"`. "Needs your attention" header + 3 skeleton rows with fake-width bars |
| Ghost exchange forecast + service split | Inline JSX (`hub/page.tsx:250–271`) | `opacity: 0.3, pointerEvents: "none"`. Bar chart skeletons + donut skeleton |

**Not shown in empty state:** Today's diary, any live data, activity ribbon. The OnboardingChecklist (covered in article 3, cross-link) is rendered by `AgentShell`, not by the hub page itself — it appears on top of the hub in both empty and populated states.

---

### Populated state layout (top to bottom)

| Order | Element | Conditional? |
|---|---|---|
| 1 | Page header | Always |
| 2 | Today's diary | Only if `diaryItems.length > 0` |
| 3 | Needs your attention | Always (shows "All clear" empty state) |
| 4 | Pipeline health + Momentum (2fr:1fr grid) | Always |
| 4a | — Pipeline health card | Always |
| 4b | — Momentum card | Always |
| 5 | Exchange forecast + Service split (1fr:1fr grid) | Always |
| 6 | Activity ribbon | Only if `recentActivity !== null` |

---

## 2. Each element — detailed

### Page header

**Component:** Inline JSX in both empty and populated states (`hub/page.tsx:137–184` empty, `hub/page.tsx:282–338` populated)

**Always rendered.** Identical in both states.

| Sub-element | Detail |
|---|---|
| Greeting | `getGreeting(session.user.name)` (`hub/page.tsx:29–41`). Time-of-day aware: "Good morning" (< 12), "Good afternoon" (12–17), "Good evening" (≥ 17), using `Europe/London` timezone. Falls back to "Hello" on error. Uses `extractFirstName()` — first word of name |
| Tagline | Hard-coded: "Here's what matters today." (`hub/page.tsx:167–169`) |
| RefreshButton | `RefreshButton` from `components/hub/HubCharts.tsx:13–31`. Shows "As of HH:MM" (London time) and triggers `router.refresh()` on click. Time is the server render time, not updated client-side |
| New sale | `<Link href="/agent/transactions/new">` with `agent-btn-primary` style. Always visible |
| Send note to progressor | `AgentFlagButton` (`components/agent/AgentFlagButton.tsx`) with `transactionId={null}` and `address="general"`. Submits a flag not tied to any specific transaction — a general message to the internal team |

**No DirectorJoinedBanner in current code.** The previous discovery document described it at `hub/page.tsx:121–128`. It is not present anywhere in the current codebase — not imported, not rendered, not referenced in any component file. It has been removed.

---

### Today's diary

**Source:** `getHubDiary(vis)` → `lib/services/hub.ts:421–458`
**Renders:** Only when `diaryItems.length > 0`

**What qualifies:**
- **Exchanges:** Active transactions where `expectedExchangeDate` OR `overridePredictedDate` falls within today (midnight–23:59:59)
- **Completions:** Active OR completed transactions where `completionDate` falls within today

**Display order:** Completions first (higher significance), then exchanges. Deduplication by `transactionId` — if a file has both a completionDate and an exchangeDate both falling today, it appears once as a completion.

**Per row:** Property address + type badge ("Completion" in green / "Exchange" in coral). Each row is a `<Link href="/agent/transactions/[id]">`.

**Header badge:** "N events today" in green.

**Empty state:** Section not rendered at all — no entry in the ghost UI.

---

### Needs your attention

**Source:** `getHubAttentionItems(vis)` → `lib/services/hub.ts:359–411`
**Renders:** Always (including in populated hub). Shows "All clear" message when no items.

**What qualifies:** `ReminderLog` records where:
- `transaction.status = "active"`
- `status = "active"`
- `nextDueDate ≤ today (start of day)`
- Not snoozed: `snoozedUntil = null` OR `snoozedUntil ≤ now`

**Urgency classification** (hub/page.tsx:81–100, hub.ts:391–398):
- `escalated` — open `ChaseTask` on this log with `priority = "escalated"`
- `overdue` — `nextDueDate < today`
- `due_today` — `nextDueDate = today`

**Sort order:** escalated → overdue → due_today, then by `nextDueDate` ascending within each tier.

**Display:** Maximum **3 rows** inline on the hub (`attentionItems.slice(0, 3)`, `hub/page.tsx:453`). Each row shows address + reminder name (with `"Chase: "` prefix stripped) + urgency badge. Links to `/agent/transactions/[id]?tab=reminders`.

**"Reminders" link:** Appears in the section header when `attentionItems.length > 0` → `/agent/work-queue`. Hidden when 0 items.

**Empty state:** Green dot + "No reminders due right now. All clear." (`hub/page.tsx:443–450`)

**Note:** This is a reminder-log-based system. A separate `getHubFlags()` function exists in `hub.ts:209–236` that reads from the `TransactionFlag` table, but it is **not called by the hub page**. The flags system and the attention items system are distinct; only the reminder-based system appears on the hub.

---

### Pipeline health card

**Source:** `getHubPipelineStats(vis)` → `lib/services/hub.ts:38–196`
**Layout:** 4 stat cells in a grid, then Coming up strip, then Stalled files row. All inside one `agent-glass` card.

#### The four stat cells

| Stat | Calculation | Filter | Links to |
|---|---|---|---|
| Active files | `count` where `status = "active"` | Visibility-scoped | `/agent/dashboard` |
| Exchanging soon | `count` where `status = "active"` AND (`expectedExchangeDate` OR `overridePredictedDate`) ≤ now + 30 days | Visibility-scoped | `/agent/completions` |
| Need attention | `new Set(attentionItems.map(i => i.transaction.id)).size` — distinct file count, not reminder count (`hub/page.tsx:123`) | Same scope as attentionItems | `/agent/work-queue` (only when count > 0) |
| Pipeline value | Sum of `purchasePrice` for all active files; null prices contribute £0. Formatted: £Xbn / £X.XXm / £X,XXX | Visibility-scoped | Not a link |

**Active files delta:** Shows `+N this month` in green when `pipelineStats.newThisMonth > 0`. "New this month" = non-draft transactions created since start of current calendar month.

**Color coding for "Need attention":** Danger red if `escalatedCount > 0`; warning amber if `attentionFileCount > 0`; default text colour if 0.

**Important distinction:** The stat card shows the count of **distinct files** with attention items, while the attention section below shows up to 3 individual **reminder logs**. A file with 2 overdue reminders counts as 1 in the stat but 2 potential rows in the list.

#### Coming up strip

Rendered inside the pipeline health card below the four stats (`hub/page.tsx:594–668`). Three inline links separated by dots:

| Link text | What it counts | Filter |
|---|---|---|
| "N exchanging this week" | Active files where `expectedExchangeDate` in next 7 days AND VM19/PM26 not complete | `lib/services/hub.ts:83–98` |
| "N completing this week" | Active files where `completionDate` in next 7 days AND VM20/PM27 not complete | `hub.ts:101–117` |
| "£X closing this month" | Sum of `purchasePrice` for active files where `expectedExchangeDate` in current calendar month AND VM19/PM26 not complete | `hub.ts:120–136` |

**All three links go to `/agent/transactions?filter=...`** but the filter params (`exchanging-this-week`, `completing-this-week`, `closing-this-month`) are **not yet implemented** on the transactions page. There are explicit `// TODO: implement filter on /agent/transactions` comments at `hub/page.tsx:615`, `hub/page.tsx:634`, `hub/page.tsx:653`. Clicking them navigates to All Files with no filtering applied.

**Colour:** Each link shows in `agent-text-muted` when count is zero, `agent-text-secondary` when non-zero.

#### Stalled files row

Rendered below the coming up strip (`hub/page.tsx:670–716`).

**Definition:** Active transactions with no genuine (non-reconciled) milestone completion in the last 14 days AND not already exchanged (`hub.ts:139–163`). The `reconciledAtExchange: false` filter excludes milestone completions that were auto-completed as part of exchange reconciliation.

| State | Renders |
|---|---|
| 0 stalled | "All files have recent activity" in muted text |
| N > 0 stalled | AlertCircle icon + "N files stalled — no activity in 14+ days" → links to `/agent/work-queue` |

---

### Momentum card

**Source:** `getHubMomentum(vis)` → `lib/services/hub.ts:240–277`
**Component:** `MomentumRing` from `components/hub/HubCharts.tsx:35–81`

**What it measures:** Count of milestone completions for VM19 or PM26 (exchange milestones) in the current calendar month vs the previous calendar month.

**Calculation:**
```ts
percent = lastMonth > 0 ? Math.min(200, Math.round((thisMonth / lastMonth) * 100)) : null
```

**Display states:**
- `percent = null` (lastMonth = 0): "No comparison yet / Compares exchanges month over month. Data appears after your first completed month." (`HubCharts.tsx:38–47`)
- `percent >= 100`: Ring fills fully + "Ahead of last month" / "On pace with last month" in green
- `percent < 100`: Ring partial + "Below last month" in warning amber

**Detail below ring:** "This month: N exchanges / Last month: N exchanges" — only shown when `percent !== null` (`hub/page.tsx:735`)

**No empty state ghost in populated hub.** The card always renders; the null state is handled within the component.

---

### Exchange forecast

**Source:** `getHubWeeklyForecast(vis)` → `lib/services/hub.ts:283–332`
**Component:** `ExchangeForecastChart` from `components/hub/HubCharts.tsx:107–131` (Recharts bar chart)

**Window:** 5 calendar weeks starting from Monday of the current week. Labels: "This wk", "+1w", "+2w", "+3w", "+4w".

**What it counts:** Active transactions where `overridePredictedDate` OR `expectedExchangeDate` falls within each week's range, **excluding** files where VM19 or PM26 is already marked complete (`hub.ts:311–320`). When both dates are set on a file, `overridePredictedDate` takes priority for bucketing (`hub.ts:327`).

**Empty state:** When `next30Days === 0` (all 5 weeks empty): "No exchange dates set in the next 30 days. Add expected exchange dates to active files to build your forecast." (`hub/page.tsx:779–781`)

**Summary stats below chart:** "This week: N exchanges" / "Next 30 days: N exchanges". "This week" value shown in coral when > 0. When `next7Days > 0`, a prompt: "N exchange(s) due this week — make sure files are ready."

**Current week bar:** Full opacity (`fillOpacity: 1`). Future weeks fade (`0.75 - i * 0.08`, floor 0.35).

---

### Service split

**Source:** `getHubServiceSplit(vis)` → `lib/services/hub.ts:336–347`
**Component:** `ServiceSplitDonut` from `components/hub/HubCharts.tsx:135–170` (Recharts pie chart)

**What it splits:** Count of active files by `serviceType`: `"self_managed"` vs `"outsourced"`.

**Visual:** Donut chart (92×92px, innerRadius 28, outerRadius 38). Coral = self-managed, warning amber = with progressor. If both counts are 0, renders a single grey "Empty" segment.

**Legend:** Each row shows label + count + percentage of total (rounded).

**Footer:**
- When `outsourced > 0`: "N file(s) being progressed by our team — saving you approximately N agent hours this week." `savedHours = Math.round(outsourced * 2.5)` — hardcoded 2.5 hrs/file/week estimate (`hub/page.tsx:127`).
- When `outsourced = 0`: "All files are self-managed. Move files to Sales Progressor to free up your time."

---

### Activity ribbon

**Source:** `getHubRecentActivity(vis)` → `lib/services/hub.ts:481–537`
**Renders:** Only when `recentActivity !== null` (`hub/page.tsx:925`)

**What it shows:** A single most-recent activity event — either the most recent `OutboundMessage` (type `outbound` or `inbound`) or the most recent completed `MilestoneCompletion`, whichever has the more recent timestamp. Draft transactions excluded.

**Comm descriptions** (`hub.ts:470–479`): Mapped by `type`/`method` to human labels: "Update received from party", "WhatsApp sent to party", "Email sent to party", "Call logged", "SMS sent to party", "Letter sent to party", etc.

**Milestone description:** `summaryText` if set, otherwise `milestoneDefinition.name`.

**Display:** Property address (truncated), activity description, time ago (just now / N mins / N hrs / N days / yesterday), "View file →" link to `/agent/transactions/[id]`.

**Empty state:** Ribbon not rendered at all. No placeholder.

---

## 3. Momentum — additional detail

Covered above. Key points:
- Calendar-month boundaries, not rolling 30 days
- Counts completions of VM19 or PM26 (both are exchange milestones — vendor and purchaser side respectively). A single transaction completing both counts as 2 exchanges.
- `percent` capped at 200 (`Math.min(200, ...)`)
- Appears in ghost UI in empty state (skeleton circle)

---

## 4. Needs your attention — additional detail

Covered in §2. The 3-item cap on the hub is the key point. The full list lives at `/agent/work-queue`. The hub's attention section is a preview, not the complete picture.

---

## 5. Exchange forecast — additional detail

Covered in §2. The `overridePredictedDate` priority and the VM19/PM26 exclusion are the key subtleties.

---

## 6. Service split — additional detail

Covered in §2. The 2.5 hrs/file estimate for savedHours is hardcoded.

---

## 7. Coming up / Stalled files

Both live inside the pipeline health card, not as standalone sections.

**Coming up strip:** Three inline statistics. All three destination links are currently non-functional filters (**TODO** in code at `hub/page.tsx:615, 634, 653`).

**Stalled files row:** Definition is 14 days without a genuine milestone completion, not exchanged. The `reconciledAtExchange` filter is significant — exchange reconciliation auto-completes milestone records, and those would otherwise reset the 14-day clock.

---

## 8. Activity ribbon — additional detail

Covered in §2. Single event only — not a list. The "most recent" comparison is by timestamp between the two query results. Ties go to the comm.

---

## 9. Director vs negotiator differences

All hub data passes through the same visibility resolution. There are no hub elements exclusive to one role.

| User type | `seeAll` | Files seen |
|---|---|---|
| Director | `true` | All agency files with an assigned agent |
| Negotiator, `canViewAllFiles = true` | `true` | All agency files with an assigned agent (identical to director) |
| Negotiator, `canViewAllFiles = false` | `false` | Only files where `agentUserId = vis.userId` |

**Source:** `lib/services/agent.ts:23`: `const seeAll = user?.role === "director" || user?.canViewAllFiles === true;`

**`buildTxWhere` implementation** (`lib/services/hub.ts:17–24`):
```ts
if (vis.seeAll) {
  return vis.firmName
    ? { agencyId: vis.agencyId, agentUser: { firmName: vis.firmName } }
    : { agencyId: vis.agencyId, agentUserId: { not: null } };
}
return { agencyId: vis.agencyId, agentUserId: vis.userId };
```

**Important:** When `seeAll = true` and `firmName = null`, the filter is `agentUserId: { not: null }`. This means files with no assigned agent (`agentUserId = null`) are **excluded from all hub stats**, even for directors. If outsourced files have no `agentUserId` set, they would not appear in a director's hub.

**firmName scoping:** If a user has `firmName` set, `seeAll` directors only see files where the `agentUser.firmName` matches. This is a branch/team segmentation mechanism with no UI explanation anywhere.

**No role-specific widgets.** Both directors and negotiators see the same page structure. The numbers differ; the layout is identical.

---

## 10. Live component extraction assessment

| Element | File | Score | Reason |
|---|---|---|---|
| Page header | Inline in `hub/page.tsx:137–184` / `282–338` | Hard | Requires server-computed greeting, `AgentFlagButton` (complex client component with API calls), `RefreshButton` (needs router). Multiple concerns tightly coupled |
| Today's diary | Inline in `hub/page.tsx:344–398` | Medium | Pure display once data is provided. Could extract `DiaryCard` taking `DiaryItem[]`. No interactive logic |
| Needs your attention | Inline in `hub/page.tsx:400–495` | Medium | Could extract `AttentionList` taking `HubAttentionItem[]`. "Reminders" link is a simple `<Link>` |
| Pipeline health card (4 stats) | Inline in `hub/page.tsx:500–591` | Hard | Four stat cells + delta + links; the "Need attention" cell value comes from a derived count not in the stats object. Cannot be trivially extracted without restructuring props |
| Coming up strip | Inline in `hub/page.tsx:594–668` | Medium | Pure display. Could extract taking `comingUp` object. Links are broken anyway |
| Stalled files row | Inline in `hub/page.tsx:670–716` | Medium | Pure display taking `{ count, transactionIds }` |
| MomentumRing | `components/hub/HubCharts.tsx:35–81` | **Already done** | Standalone component, takes `{ percent: number \| null }` |
| ExchangeForecastChart | `components/hub/HubCharts.tsx:107–131` | **Already done** | Standalone Recharts component, takes `WeekBucket[]` |
| ServiceSplitDonut | `components/hub/HubCharts.tsx:135–170` | **Already done** | Standalone Recharts component, takes `{ selfManaged, outsourced }` |
| Exchange forecast card wrapper | Inline in `hub/page.tsx:769–838` | Medium | Card wrapping the already-extracted chart. Could extract the summary stats block |
| Service split card wrapper | Inline in `hub/page.tsx:841–921` | Medium | Card wrapping the already-extracted donut. savedHours calculation would move into props |
| HubEmptyWelcomeCard | `components/agent/HubEmptyWelcomeCard.tsx` | **Already done** | Used in both hub and help article |
| Activity ribbon | Inline in `hub/page.tsx:924–971` | Easy | Pure display. Takes a single `RecentActivity` object. No interactive elements |
| RefreshButton | `components/hub/HubCharts.tsx:13–31` | **Already done** | Standalone, takes `{ updatedLabel }` |

---

## 11. Worth flagging

1. **Coming up strip links are non-functional.** All three (`?filter=exchanging-this-week`, `?filter=completing-this-week`, `?filter=closing-this-month`) navigate to `/agent/transactions` but the filters are explicitly noted as unimplemented with `// TODO` comments at `hub/page.tsx:615, 634, 653`. Users clicking them land on the unfiltered All Files page.

2. **"Need attention" stat and attention section count different things.** The stat card shows the count of distinct files (`attentionFileCount = new Set(...).size`, `hub/page.tsx:123`). The section below shows up to 3 individual reminder log rows. A file with 3 overdue reminders counts as 1 in the stat but occupies all 3 visible rows in the section. The hub gives no indication of this distinction.

3. **firmName branch scoping has no UI explanation.** When a user has `firmName` set on their `User` record, `seeAll = true` directors only see files assigned to agents with the same `firmName`. This is a multi-branch segmentation mechanism. Nothing in the UI surfaces this filtering. A director at a two-branch agency with `firmName = "North Branch"` would see a hub showing only North Branch files, with no indication the South Branch exists.

4. **Pipeline value excludes files with no price, silently.** `purchasePrice = null` contributes £0. An agency with 20 active files but only 5 with prices set shows a pipeline value for those 5 only. The UI does not flag this. The number can look misleadingly low.

5. **Momentum uses calendar months, not rolling 30 days.** On the 1st of a new month, "This month" resets to 0 exchanges regardless of recent activity. An agency that exchanged 5 files on the last day of last month would show 0% momentum on the 1st. The label "Exchanges this month vs last" is accurate but users may interpret "last month" as "recent past" rather than the strict calendar boundary.

6. **Momentum percent is capped at 200.** `Math.min(200, Math.round((thisMonth / lastMonth) * 100))`. An agency that doubles its exchanges shows 200% — but an agency that triples them also shows 200%. The ring maxes out visually at 100% (full circle). Anything above 100% is shown as 100% visual fill with the number printed inside.

7. **Stalled files excludes `reconciledAtExchange: true` completions.** Exchange reconciliation auto-completes certain milestones. Those completions have `reconciledAtExchange: true` and are excluded from the "has there been activity in 14 days?" check (`hub.ts:148–149`). A file that exchanged 20 days ago and then had no further activity is correctly excluded from stalled (it's post-exchange). But a file with only synthetic completions in the last 14 days (no real agent activity) could avoid the stalled flag when it arguably should be flagged.

8. **Today's diary completions include status = "completed" files.** The exchange query filters `status = "active"` only. The completion query filters `status: { in: ["active", "completed"] }` (`hub.ts:440–444`). A file that has legally completed — and is in `completed` status — still appears in the diary if its `completionDate` is today. This is intentional but worth knowing.

9. **Service split "saved hours" is a hardcoded marketing estimate.** `savedHours = Math.round(outsourced * 2.5)` (`hub/page.tsx:127`). The UI says "saving you approximately N agent hours this week" — the 2.5 hours per outsourced file per week is a fixed assumption, not measured data.

10. **`getHubFlags()` exists but isn't used by the Hub page.** `lib/services/hub.ts:209–236` exports a `getHubFlags()` function that reads from the `TransactionFlag` table (a separate problem-detection system). The Hub page uses `getHubAttentionItems()` (reminder-log-based) for the attention section. The two systems coexist; only reminders surface on the hub.

11. **The page is fully server-rendered with all 7 queries blocking the response.** There is no progressive rendering or skeleton loading on initial page load. On slow connections or high database load, the whole hub waits for all 7 queries before any content appears. The RefreshButton re-triggers the full server render.

12. **Empty state condition does not consider diary items.** `isEmpty = pipelineStats.activeFiles === 0 && attentionItems.length === 0` (`hub/page.tsx:130`). In practice this is not a real-world problem (diary items come from active transactions, so `activeFiles` would be > 0), but theoretically an agency with completion-status files and a `completionDate = today` (and no active files) would see the empty state layout with no diary. The diary never appears in the empty state path.

---

## 12. Pre-existing assumptions — verification

| Claim | Source of claim | Status |
|---|---|---|
| Ghost UI uses 30% opacity | Prior discovery | **Confirmed.** `opacity: 0.3` at `hub/page.tsx:193, 219, 250` |
| "New sale" button always present | Prior discovery | **Confirmed.** Present in both empty state header (`hub/page.tsx:172`) and full hub header (`hub/page.tsx:322`) |
| Empty state condition is `pipelineStats.activeFiles === 0 && attentionItems.length === 0` | Prior discovery | **Confirmed.** `hub/page.tsx:130` |
| Exchange forecast excludes already-exchanged files via `NOT milestoneCompletions.some(...)` clause | Prior discovery | **Confirmed.** `hub.ts:312–319`: `NOT: { milestoneCompletions: { some: { state: "complete", milestoneDefinition: { code: { in: ["VM19", "PM26"] } } } } }` |
| Recent activity only rendered when data exists | Prior discovery | **Confirmed.** `hub/page.tsx:925`: `{recentActivity && (` |
| DirectorJoinedBanner renders on hub for negotiators | Prior discovery (`your-first-day.md:117–119`) | **Not confirmed — component does not exist in codebase.** No import, no reference in any component or page file. The discovery document described it but it is absent from current code |

---

## Cross-links to other articles

The following are referenced by hub elements but covered in separate articles:
- **The OnboardingChecklist** — rendered by `AgentShell`, visible on the hub; covered in "Your first day"
- **The WelcomeModal** — appears on first hub load (`hasSeenAgentWelcome = false`); covered in "Your first day"
- **The property file** — every attention item and diary entry links to `/agent/transactions/[id]`; property file article covers what's inside
- **Reminders / Work queue** — `/agent/work-queue`, linked from "Reminders" and stalled files; its own article
- **All Files page** — `/agent/dashboard` and `/agent/transactions`; its own article
- **Analytics** — not linked from the hub; its own article
