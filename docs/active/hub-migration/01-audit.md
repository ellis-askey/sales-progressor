# Legacy hub — exhaustive migration audit

**Source:** `app/agent/hub/legacy-hub.tsx` (1074 lines)
**Compiled:** 2026-07-28
**Method:** full-file audit + import trace through `lib/services/hub.ts` + `components/hub/*`

This is the definition of "correct" for the migration. Anything missed here becomes a regression.

## 1. Data flow

### Session / role setup (lines 149–161)
- `requireSession()` → `session.user { id, name, email, role, agencyId }`
- `role = session.user.role`
- `isInternalStaff = role === "admin" | "sales_progressor" | "viewer"`
- `isProgressor = role === "sales_progressor"` (note: hybrid SP with admin powers still returns `true`)
- `isAdmin = hasAdminPowers(session)` → `true` for role `admin`, `superadmin`, OR `sales_progressor` matching `isHybridAdminEmail` (only the "hybrid admin" carve-out)
- `canCreateSale = role === "director" | "negotiator" | "admin"`

### Visibility resolution (lines 159–161)
- Internal staff (`admin | sales_progressor | viewer`) → `resolveInternalVisibility(userId, role, isAdmin)` (synchronous, no DB). Sets `internalMode = "admin_all"` if role is `admin` OR `hasAdminPowers`, else `"assigned"`. Hybrid SP-admin gets `admin_all`, `agencyId = ""`.
- Agents (`director | negotiator`) → `await resolveAgentVisibility(userId, agencyId)`. Reads `user.role`, `user.canViewAllFiles`, `user.firmName`. Sets `seeAll = role === "director" || canViewAllFiles === true` and copies `firmName`. `internalMode` is `undefined`.

**`vis` shape** (`lib/services/agent.ts`):
```
{ userId, agencyId, seeAll, firmName, internalMode? }
```

Per role:

| Role | internalMode | seeAll | firmName | Effective scope |
|---|---|---|---|---|
| director | undefined | true | maybe | own agency (optionally firmName-filtered) |
| negotiator | undefined | false / canViewAllFiles | maybe | own assigned files OR whole agency if canViewAllFiles |
| sales_progressor | "assigned" | false | null | `assignedUserId = userId` |
| sales_progressor + hybridAdminEmail | "admin_all" | false | null | ALL outsourced files (still `isProgressor=true` in copy) |
| admin | "admin_all" | false | null | ALL outsourced files (buildTxWhere forces `serviceType: "outsourced"`) |
| superadmin | "admin_all" | false | null | same as admin (falls through agent-visibility path — quirk noted below) |
| viewer | "assigned" | false | null | own assigned files |

### Parallel service calls (Promise.all, lines 163–177)

All accept `vis`:

- `getHubPipelineStats(vis)` → `{ activeFiles, exchangingSoon, pipelineValuePence, newThisMonth, comingUp: { exchangingThisWeek, completingThisWeek, closingThisMonth: { total } }, stalled: { count, transactionIds } }`
- `getHubAttentionItems(vis)` → `HubAttentionItem[]` — reminders classified `escalated | overdue | due_today` (chased items filtered out). Each row has `id, urgency, reminderName, transaction{id,propertyAddress}, nextDueDate, escalationReason, escalatedAt, escalatedByName`.
- `getHubWins(vis)` → `HubWins { exchangesThisMonth, exchangesLastMonth, completionsThisMonth, completionsLastMonth, fastestExchangeDays, fastestExchangeAddress, stepsConfirmedThisWeek, newFilesThisMonth }`
- `getHubWeeklyForecast(vis)` → 5 × `WeekBucket { label, count, isCurrentWeek }`
- `getHubServiceSplit(vis)` → `{ selfManaged, outsourced }`
- `getHubRecentActivity(vis)` → `RecentActivity | null` = `{ kind: "comm" | "milestone", description, context, transactionId, at }`
- `getHubDiary(vis)` → `DiaryItem[]` = `[{ type: "exchange" | "completion", transactionId, address }]` (completions dedup'd first)
- `getHubUnassignedFiles(vis)` → `HubUnassignedFile[]` — **only non-empty for `internalMode === "admin_all"`**; else `[]`
- `getExpiredHolds(vis)` → `ExpiredHoldItem[]` — files with an open `TransactionHoldPeriod` whose `plannedEndAt < now`
- `getHubRelistsToAcknowledge(vis)` → `HubRelistAck[]` — **only non-empty for `internalMode = admin_all | assigned`**; agents get `[]`
- `getHubChainSetupPending(vis)` → `HubChainSetupPending[]` — non-empty for all roles (internal restricted to outsourced or assigned; agents scoped to agency)
- `getHubPipelineStages(vis)` → `HubPipelineStages { new, legals, ready, exchanging, completed }` each with count + stats

### Derived values (lines 180–189)
- `escalatedCount` = attentionItems where `urgency === "escalated"`
- `overdueCount` = attentionItems where `urgency === "overdue"`
- `attentionFileCount` = distinct `transaction.id` count across attentionItems
- `healthStatus` = `escalated>0 → "action"` / `overdue>0 → "watch"` / else `"on_track"` (computed but **never rendered** in this file)
- `next7Days` = `weeklyForecast[0].count ?? 0`
- `next30Days` = sum of `weeklyForecast[*].count`
- `savedHours` = `Math.round(serviceSplit.outsourced * 2.5)` — used only in the coral info-pill for non-admin
- `greeting` = time-of-day + first name + "👋" (via `getGreeting`); UK timezone; falls back to `"Hello, {first}"` on error
- `subtitle` = via `getSubtitle(isAdmin, isProgressor)` — 3 variants; **only used in the empty branch**; full-hub header hardcodes `"Here's what matters today."`
- `isEmpty` = `pipelineStats.activeFiles === 0 && attentionItems.length === 0`

---

## 2. Layout (top → bottom)

### Empty-state branch (isEmpty = true, lines 192–329)

| # | Section | Shows | Data | Conditional | Component |
|---|---|---|---|---|---|
| E1 | PageHeader | greeting + role-keyed subtitle, "New sale" (canCreateSale), "Send a note" (!isInternalStaff) | session, canCreateSale | Always in this branch | `PageHeader` |
| E2 | Welcome CTA card | isProgressor: "No assigned files yet." / else: "Add your first sale…" + Add-a-sale button | copy static | Always | inline `agent-glass` |
| E3 | Ghost Pipeline health | 4 skeleton stat tiles labelled Active / Exchanging soon / Need attention / Pipeline value | none | Always (opacity 0.35, no pointer events) | inline |
| E4 | Ghost Wins this month | 3 skeleton bars | none | Always | inline |
| E5 | Ghost Attention list | header "Needs your attention" + 3 skeleton rows | none | Always | inline |
| E6 | Ghost Exchange forecast | 5 skeleton bars | none | Always | inline |
| E7 | Ghost "Who's managing" | skeleton donut + 2 legend rows | none | Always | inline |

### Full-hub branch (lines 332–1071)

| # | Section | Shows | Data | Conditional | Component |
|---|---|---|---|---|---|
| F1 | PageHeader | greeting + hardcoded `"Here's what matters today."` + New-sale (canCreateSale) + Send-a-note (!isInternalStaff) | session | Always | `PageHeader` |
| F2 | PaymentBlockBanner | Amber "warning" / red "blocked" or nothing | `getPaymentBlockState(agencyId)` async in child | `role === "director" && agencyId` — child self-hides if state.kind === "ok" | `PaymentBlockBanner` (server) |
| F3 | PaymentMethodNudge | Trial banner with card-capture modal trigger | `agency.stripeCustomerId`, `firstSubmissionAt`, `feeTier` | `role === "director" && agencyId` — child self-hides when card exists, or trial+7d not elapsed (non-legacy tier only) | `PaymentMethodNudge` (server) → `TrialBannerWithModal` (client) |
| F4 | Today's diary | Header "N events today" pill + one row per exchange/completion scheduled today; each row is a link to the tx; left border coral (exchange) or success-green (completion) | `getHubDiary(vis)` | `diaryItems.length > 0` | inline card |
| F5a | ExpiredHoldsCard | Header "Holds needing attention" + rows for each expired hold; per-row `Take off hold`, `Extend`; extender expands to date input + `Set date`, `Indefinitely`, `Cancel`; take-off-hold opens portal modal with two options | `getExpiredHolds(vis)` | Card returns `null` when `items.length === 0 && !cardExiting`; auto-animates removal | `ExpiredHoldsCard` (client) |
| F5b | AttentionListView | Header "Needs your attention" + "All reminders" link (if any items); first 3 items; per-row urgency-colored border + pill; empty state = green dot "No reminders due. All clear." | `getHubAttentionItems(vis)` | Always rendered (has empty state) | `AttentionListView` (client) |
| F5c | UnassignedFilesView | Header "Needs assigning" + rows (address + agency); AssignInline dropdown per row | `getHubUnassignedFiles(vis)` | Returns `null` when files.length === 0 (i.e. anyone not internal-admin) | `UnassignedFilesView` (client) |
| F5d | NewBuyersToAcknowledgeView | Header "New buyer added" + rows with "Acknowledge" button | `getHubRelistsToAcknowledge(vis)` | Returns `null` when empty (agent roles always empty) | `NewBuyersToAcknowledgeView` (client) |
| F5e | ChainSetupPendingView | Header "Complete chain setup" + rows with "Mark as done" button (also linked address) | `getHubChainSetupPending(vis)` | Returns `null` when empty | `ChainSetupPendingView` (client) |
| F6 | PipelineAtAGlance | 5-stage flow (New→Legals→Ready→Exchanged→Completed), hover reveals stage popover | `getHubPipelineStages(vis)` | Always renders card; interior shows empty copy when `totalActive === 0 && completed.count === 0` | `PipelineAtAGlance` + `PipelineStageHover` (client) |
| F7a | Pipeline health card | Eyebrow + role-varied subtitle + 4 stat tiles (Active / Exchanging soon / Need attention / Pipeline value), each optionally links + shows delta subtext | `pipelineStats`, `attentionItems`, `escalatedCount` | Always (in 2fr:1fr grid with F7b) | inline `agent-glass` |
| F7b | WinsCard | 4-tier cascade: exchanges / completions / progress / fresh | `wins` | Always renders | `WinsCard` (server) |
| F7c | "Coming up" strip | 3 dotted links: exchanging this week · completing this week · £closing this month | `pipelineStats.comingUp` | Inside F7a; always | inline |
| F7d | Stalled files row | Either "All files have recent activity" (count=0) or link "N files need chasing, nothing logged in 14+ days" → work-queue | `pipelineStats.stalled` | Inside F7a; always | inline |
| F8a | Exchange forecast card | Eyebrow + role-varied subtitle; if `next30Days === 0` → empty copy; else `ExchangeForecastChart` + week labels; then "This week"/"Next 30 days" rows; if `next7Days > 0` → coral nudge line | `weeklyForecast` | Always | `ExchangeForecastChart` (client) |
| F8b | Service split card | Eyebrow + role-varied subtitle ("Service split" / "Who's managing"); `ServiceSplitDonut` + 2 legend rows (labels vary by admin); coral info-pill (if outsourced>0) with role-varied copy | `serviceSplit`, `savedHours` | Hidden when `isProgressor && !isAdmin`; grid collapses to 1fr | `ServiceSplitDonut` (client) |
| F9 | Activity ribbon | Icon (picked per kind/method — email, phone, whatsapp, sms, milestone) + "Last activity: {desc}" + `timeAgo · context` + "View file" link | `recentActivity` | `recentActivity !== null` | inline `agent-glass-light` |
| F10 | Pro tip banner | Amber Lightbulb + cascade copy | derived | Renders only if `tip !== null` | inline |

---

## 3. Conditional inventory

The row-by-row checklist Ellis walks in Phase 4. Each row = one thing that could regress.

| # | Rule | Location | Trigger | Effect |
|---|---|---|---|---|
| C1 | Empty state | 189, 192 | `activeFiles === 0 && attentionItems.length === 0` | Replaces full hub with welcome + ghosts |
| C2 | "New sale" button | 197, 336 | `canCreateSale` (`director \| negotiator \| admin`) | Renders header CTA |
| C3 | "Send a note to our team" | 203, 342 | `!isInternalStaff` | Renders `AgentFlagButton` |
| C4 | Welcome copy variant | 223 | `isProgressor` ternary | "No assigned files yet." vs "Add your first sale…" |
| C5 | Welcome subtitle variant | 226 | `isProgressor` | assigned wording vs generic |
| C6 | "Add a sale" button in welcome | 231 | `canCreateSale` | Renders |
| C7 | PaymentBlockBanner outer | 357 | `role === "director" && session.user.agencyId` | Mounts child (child self-hides on `ok`) |
| C8 | PaymentBlockBanner inner blocked | Banner:22 | `state.kind === "blocked"` | Red variant + "New file creation paused" |
| C9 | PaymentBlockBanner inner warning | Banner:65 | `state.kind === "warning"` | Amber variant + failed date + grace end date |
| C10 | PaymentMethodNudge outer | 364 | `role === "director" && agencyId` | Mounts child |
| C11 | PaymentMethodNudge — legacy tier | Nudge:49 | `feeTier !== "legacy"` | Applies trial+7d gate; legacy tier skips gate |
| C12 | PaymentMethodNudge — early return | Nudge:44 | `stripeCustomerId != null` | Renders null |
| C13 | PaymentMethodNudge — pre-submission | Nudge:50 | `firstSubmissionAt == null && !legacy` | Renders null |
| C14 | PaymentMethodNudge — trial+7d | Nudge:52 | elapsed < 21 days | Renders null |
| C15 | Today's diary card | 369 | `diaryItems.length > 0` | Whole card |
| C16 | Diary row per-type styling | 395 | `item.type === "completion"` | Green border+bg vs coral |
| C17 | Diary events pill text | 385 | `length === 1` | "event" vs "events" |
| C18 | Diary placeholder guard | hub.ts:1321 | `expectedExchangeDate === twelveWeekTarget` + no ready milestones | Skip exchange row |
| C19 | ExpiredHoldsCard self-hide | ExpiredHolds:57 | `items.length === 0 && !cardExiting` | Whole card gone |
| C20 | Extender row inline mode | ExpiredHolds:193 | `showExtenderFor === item.transactionId` | Show date input + Set date/Indefinitely/Cancel |
| C21 | Extender validity | ExpiredHolds:209, 215 | date before tomorrow-9am | Toast error + disable Save |
| C22 | Attention items visible | AttentionList:79 | `items.length > 0` | Slices first 3 |
| C23 | Attention "All reminders" link | AttentionList:57 | `items.length > 0` | Renders header link |
| C24 | Attention empty state | AttentionList:66 | `items.length === 0` | Green dot "All clear" |
| C25 | Attention Escalated tooltip | AttentionList:129 | `urgency === "escalated"` and (reason\|escalatedAt) | Title attr shows who/when/why |
| C26 | Unassigned card self-hide | Unassigned:92 | `files.length === 0` | Whole card gone (always for non-admin) |
| C27 | Unassigned agency name | Unassigned:138 | `file.agencyName` truthy | Shows secondary line |
| C28 | Unassigned assign dropdown | Unassigned:34 | `open` state | Toggle between "Assign" link and select/save/cancel |
| C29 | Unassigned data load | Unassigned:17 | first open + `users.length === 0` | Fetches `/api/agency/users` |
| C30 | NewBuyers self-hide | NewBuyers:35 | `rounds.length === 0` | Whole card gone |
| C31 | ChainSetup self-hide | ChainSetup:30 | `files.length === 0` | Whole card gone |
| C32 | PipelineAtAGlance empty content | AtAGlance:76 | `!anyProgress` (all counts 0) | Copy "Add your first sale and it will land in New" |
| C33 | PipelineStageHover empty branch | StageHover:169,184,199,218,232 | per stage `count === 0` | Renders `<Empty label=... />` |
| C34 | PipelineStageHover tone | StageHover:176,207,242 | `quietFiles>0` / `overdue>0` / SLA `>=0.75` | Toggles warn/good/neutral color |
| C35 | Bubble placement | StageHover:70 | `roomAbove > 140` | above vs below anchor |
| C36 | Pipeline health subtitle | 446 | `isAdmin` / `isProgressor` / else | 3 variants |
| C37 | Active files tile link | 458 | always | href `/agent/transactions` |
| C38 | Active files delta | 459 | `newThisMonth > 0` | "+N this month" |
| C39 | Exchanging soon tile | 466 | `exchangingSoon > 0` | Link vs static; else null href |
| C40 | Exchanging soon delta | 469 | `comingUp.exchangingThisWeek > 0` | "N this week" |
| C41 | Need attention color | 477 | `escalated>0` red / `attentionFileCount>0` warning / else primary | Value color |
| C42 | Need attention href | 478 | `attentionFileCount > 0` | Links to /work-queue |
| C43 | Need attention delta | 481 | `escalated>0` "N escalated" / `attentionFileCount===0` "All clear" / else null | Delta subtext + tone flip (down when escalated) |
| C44 | Pipeline value delta | 493 | `comingUp.closingThisMonth.total > 0` | "£X this month" |
| C45 | Coming-up link tone | 576, 594, 612 | count > 0 | secondary vs muted |
| C46 | Stalled empty branch | 629 | `stalled.count === 0` | "All files have recent activity" |
| C47 | Stalled link | 638 | `count > 0` | Chase link to work-queue |
| C48 | Grid columns | 680 | `isProgressor && !isAdmin` | `1fr` (drops service-split) vs `1fr 1fr` |
| C49 | Exchange forecast subtitle | 687 | `isAdmin` / `isProgressor` / else | 3 variants |
| C50 | Exchange forecast empty | 691 | `next30Days === 0` | Static copy replaces chart |
| C51 | Exchange forecast week label color | 709 | `w.isCurrentWeek` | Coral vs muted |
| C52 | "This week" count color | 742 | `label === "This week" && count > 0` | Coral vs primary |
| C53 | Ready-check nudge | 748 | `next7Days > 0` | Coral one-liner |
| C54 | Nudge singular/plural | 750 | `next7Days === 1` | copy branch |
| C55 | Service split card | 757 | `!isProgressor \|\| isAdmin` | Renders card (hidden for pure progressor) |
| C56 | Service split labels | 759 | `isAdmin` | "Service split / Self-managed / Outsourced to us" vs "Who's managing / Managed by you / Our team" |
| C57 | Service info pill | 814 | `serviceSplit.outsourced > 0` | Pill vs muted "All files self-managed" line |
| C58 | Service info-pill copy | 834 | `isAdmin` | "We're progressing N files across all client agencies" vs "Our team is handling N files, saving you X hours" |
| C59 | Saved hours mention | 846 | `savedHours > 0` | Appends "saving you around X hours this week" (non-admin only) |
| C60 | "self-managed by their agencies" copy | 861 | `isAdmin` | Admin plural vs generic |
| C61 | Activity ribbon | 869 | `recentActivity` truthy | Whole ribbon renders |
| C62 | Activity glyph selection | 90 (helper) | `kind === "milestone"` or description contains whatsapp/call/sms | Icon + colours |
| C63 | Pro tip cascade — stalled | 926 | `stalledCount > 0` | Loudest tier |
| C64 | Pro tip cascade — escalated | 938 | `escalatedCount > 0` | Next tier |
| C65 | Pro tip cascade — exchanging soon | 950 | `next7Days > 0` | Next tier |
| C66 | Pro tip cascade — attention count | 962 | `attentionFileCount > 0` | Next tier |
| C67 | Pro tip cascade — healthy (role variants) | 974–1009 | `activeFiles > 0` AND none of above; branches on `isAdmin` / `isProgressor` / else | 3 copy variants; agent branch's href only if canCreateSale |
| C68 | Pro tip render | 1012 | `tip !== null` | Whole banner |
| C69 | Pro tip wrapper | 1063 | `tip.href` truthy | Link vs div |

---

## 4. Controls inventory

Every clickable element. Migration must preserve every one at correct trigger scope.

### Page header (both branches)
- **"New sale"** → `/agent/transactions/new-v2` — gated by `canCreateSale` (director/negotiator/admin)
- **"Send a note to our team" / "Flag to progressor"** → opens inline textarea posting to `POST /api/agent/flag` — gated `!isInternalStaff`

### PaymentBlockBanner (director only)
- **"Update card →"** → `/agent/account/billing#payment-method` (both warning and blocked variants)

### PaymentMethodNudge (director only)
- **Trial banner CTA** → opens `TrialBannerWithModal` modal (embeds `CardCaptureForm` with pricing-terms acknowledgement step)

### Today's diary
- **Row link** → `/agent/transactions/{id}` — anyone with diary items

### ExpiredHoldsCard rows (per row)
- **Address link** → `/agent/transactions/{id}`
- **"Take off hold"** button → opens portal modal
  - Modal option **"Resume automation"** → `reactivateFile(id)` server action
  - Modal option **"Reactivate, keep emails paused"** → `reactivateFile(id)` + `pauseClientEmails(id)`
  - Modal **"Cancel"** / **×** / backdrop click → close
- **"Extend"** → toggles inline date picker
  - **Date input** (min = tomorrow 9am)
  - **"Set date"** button → `extendHoldAction(id, date)` (disabled without/past date)
  - **"Indefinitely"** button → `extendHoldAction(id, null)`
  - **"Cancel"** link → closes inline extender

### AttentionListView
- **"All reminders"** link → `/agent/work-queue` (only when items > 0)
- **Row link** → `/agent/transactions/{txId}?tab=reminders`
- Escalated pill has a **title tooltip** (not clickable) with escalation reason/actor/date

### UnassignedFilesView (admin_all only)
- **"Assign"** button → toggles inline dropdown (lazy-fetch `/api/agency/users`)
- **`<select>`** SP dropdown
- **"Save"** → `assignUserAction(txId, userId)` server action
- **"Cancel"** → closes dropdown

### NewBuyersToAcknowledgeView (admin_all + assigned)
- **"Acknowledge"** button → `acknowledgeRelistAction(roundId)`

### ChainSetupPendingView (all roles when data present)
- **Address link** → `/agent/transactions/{id}`
- **"Mark as done"** button → `clearChainSetupPendingAction(txId)`

### PipelineAtAGlance
- **Stage circles** (5) — hover/focus/tap toggles `PipelineStageHover` portal bubble (Esc / outside click / blur closes)
- Circles: `New`, `Legals`, `Ready`, `Exchanged`, `Completed`

### Pipeline health tiles
- **"Active files" tile** → `/agent/transactions`
- **"Exchanging soon" tile** → `/agent/transactions?filter=exchanging-next-30-days` (only if count>0)
- **"Need attention" tile** → `/agent/work-queue` (only if attentionFileCount>0)
- **"Pipeline value" tile** — non-clickable (`href: null`)

### Coming-up strip (3 links, always render but colour-dims when count 0)
- `/agent/transactions?filter=exchanging-this-week`
- `/agent/transactions?filter=completing-this-week`
- `/agent/transactions?filter=closing-this-month`

### Stalled row
- **"N files need chasing"** → `/agent/work-queue` (only if stalled.count > 0)

### Activity ribbon
- **"View file"** → `/agent/transactions/{recentActivity.transactionId}`

### Pro tip banner
- Wraps whole banner as `<Link>` when `tip.href` present; hrefs vary by tier: `/agent/work-queue`, `/agent/transactions?filter=exchanging-this-week`, `/agent/analytics` (admin), `/agent/transactions` (progressor), `/agent/transactions/new-v2` (agent, only if canCreateSale — else non-clickable div)

---

## 5. Empty / loading / error states

### Whole-hub empty state (isEmpty)
Renders when `activeFiles === 0 && attentionItems.length === 0`. Shows: header, welcome CTA card, ghost pipeline+wins row (opacity 0.35), ghost attention list (3 skeleton rows), ghost forecast+donut row. **Does not show** any of: PaymentBlockBanner, PaymentMethodNudge, Today's diary, ExpiredHolds, UnassignedFiles, NewBuyers, ChainSetup, PipelineAtAGlance, Activity ribbon, Pro tip.

### Per-section empty / null returns
- **Today's diary** — card not rendered if `diaryItems.length === 0`
- **ExpiredHoldsCard** — returns `null` when items empty
- **AttentionListView** — always renders; **inline empty state**: green dot + "No reminders due. All clear."
- **UnassignedFilesView** — returns `null` when empty (always empty for non-admin)
- **NewBuyersToAcknowledgeView** — returns `null` when empty (always empty for pure agent)
- **ChainSetupPendingView** — returns `null` when empty
- **PipelineAtAGlance** — when all buckets are 0, shows in-card copy "Add your first sale and it will land in the New column here." Also each stage popover has its own empty label when `count===0` (5 variants).
- **Pipeline health stalled row** — muted "All files have recent activity" line when `stalled.count===0`
- **Exchange forecast** — when `next30Days === 0` replaces chart with a muted paragraph
- **Service split** — when `outsourced === 0`, replaces coral pill with muted "All files are self-managed[. by their agencies.]"
- **WinsCard tier 4** — brand-new-account fallback (Rocket + "Nothing to celebrate yet")
- **Activity ribbon** — hidden if `recentActivity === null`
- **Pro tip** — hidden if no tier fires

### Loading / skeleton
- No per-section skeletons in the full hub — all data fetched server-side via `Promise.all`, so the whole page renders when the RSC finishes. Skeletons appear only in the isEmpty ghost cards.
- Client cards have `useTransition`/pending state on their action buttons (disabled/"…" text) but no visible full-card loading spinner.
- `PipelineAtAGlance` uses `useEffect` for hover-anchor rect (post-mount only).
- `PipelineStageHover` gates content on `mounted` (returns null pre-mount).

### Errors
- No error boundaries in this file.
- Toast-based error handling on `ExpiredHoldsCard` action failures (`toast.error(result.error ?? "Couldn't ...")`).
- Other action buttons swallow errors silently in try/finally.
- `getGreeting` has a `try/catch` fallback to `"Hello, {first}"`.

---

## 6. Banners / notifications (top of page, in render order)

1. **PaymentBlockBanner** — line 357. Trigger: `role === "director"` AND `session.user.agencyId` truthy. Child self-hides unless `getPaymentBlockState` returns `warning` (amber, "A payment failed") or `blocked` (red, "New file creation paused").
2. **PaymentMethodNudge** → `TrialBannerWithModal` — line 364. Trigger: `role === "director"` AND `agencyId`. Child self-hides if `stripeCustomerId` on file. For non-legacy tier: also requires `firstSubmissionAt` set AND ≥21 days elapsed. Legacy tier fires immediately when no card. Modal embeds `CardCaptureForm` and pricing-terms acknowledgement.
3. There are **no** chain-decline banners, session-expiry banners, network-error banners, feature-flag banners, or maintenance banners in this file.
4. The **"Pro tip"** banner at the bottom (F10) is content, not notification.

Note: No `PaymentBlockBanner` / `PaymentMethodNudge` in the empty branch — they only appear in the full-hub render path.

---

## 7. Role variants — matrix

| Section | director | negotiator | sales_progressor (pure) | admin | superadmin | Notes |
|---|---|---|---|---|---|---|
| Header greeting | ✓ | ✓ | ✓ | ✓ | ✓ | Same for all |
| Header subtitle (empty branch) | "…your pipeline today." | "…your pipeline today." | "…your assigned files today." | "…across the platform today." | "…across the platform today." | Full-hub subtitle is hardcoded "Here's what matters today." for everyone |
| "New sale" button | ✓ | ✓ | ✗ | ✓ | ✗ | `canCreateSale = director \| negotiator \| admin`; superadmin gets ✗ |
| "Send a note" button | ✓ | ✓ | ✗ | ✗ | ✗ | `!isInternalStaff` (isInternalStaff = admin/SP/viewer) |
| PaymentBlockBanner | ✓ (if failed) | ✗ | ✗ | ✗ | ✗ | Director only, plus agencyId truthy |
| PaymentMethodNudge | ✓ (if no card+past trial) | ✗ | ✗ | ✗ | ✗ | Director only |
| Today's diary | ✓ | ✓ | ✓ | ✓ (platform-wide) | ✓ | Data scope varies |
| ExpiredHoldsCard | ✓ | ✓ | ✓ (assigned) | ✓ (outsourced only) | ✓ | vis-scoped |
| AttentionListView | ✓ | ✓ | ✓ | ✓ | ✓ | Always mounted; scoped |
| UnassignedFilesView | ✗ | ✗ | ✗ | ✓ | ✓ | Only `admin_all` gets data; else returns null |
| NewBuyersToAcknowledgeView | ✗ | ✗ | ✓ (assigned) | ✓ (all outsourced) | ✓ | agents always get [] |
| ChainSetupPendingView | ✓ | ✓ | ✓ (assigned) | ✓ (outsourced) | ✓ | all roles |
| PipelineAtAGlance | ✓ | ✓ | ✓ | ✓ | ✓ | Scope differs |
| Pipeline health subtitle | "Where your business stands today." | same | "Your assigned files at a glance." | "Platform-wide pipeline at a glance." | same as admin | |
| Coming-up strip | ✓ | ✓ | ✓ | ✓ | ✓ | Always renders |
| Stalled row | ✓ | ✓ | ✓ | ✓ | ✓ | Always renders |
| WinsCard | ✓ | ✓ | ✓ | ✓ | ✓ | Tier picked from data |
| Exchange forecast card | ✓ | ✓ | ✓ | ✓ | ✓ | Subtitle varies |
| Exchange forecast subtitle | "When your files are due to exchange." | same | "Exchange forecast for your assigned files." | "Platform-wide exchange forecast." | same as admin | |
| Service split card | ✓ | ✓ | ✗ (hidden) | ✓ | ✓ | `(!isProgressor \|\| isAdmin)` — grid drops to 1fr for pure progressor. **Hybrid SP-admin still sees it** because isAdmin=true |
| Service-split card title | "Who's managing" | same | n/a | "Service split" | same | |
| Service legend labels | "Managed by you" / "Our team" | same | n/a | "Self-managed" / "Outsourced to us" | same as admin | |
| Service info-pill copy | "Our team is handling N files, saving you ~X hours this week." | same | n/a | "We're progressing N files across all client agencies." | same as admin | |
| Activity ribbon | ✓ | ✓ | ✓ | ✓ | ✓ | If any recentActivity |
| Pro tip — healthy-pipeline copy | "Pipeline is looking healthy." (href: canCreateSale ? /new-v2 : null) | same as director | "All your assigned files are healthy." → /agent/transactions | "Platform is ticking along nicely." → /agent/analytics | same as admin | Cascade fires stalled/escalated/exchanging/attention first for everyone |
| Empty-state welcome CTA copy | "Add your first sale…" | same | "No assigned files yet." | "Add your first sale…" | same | |
| Empty-state "Add a sale" button | ✓ | ✓ | ✗ | ✓ | ✗ | canCreateSale gate |

### Role-quirk notes to preserve
- **Hybrid SP-admin** (Ellis's account): `role === "sales_progressor"` (so `isProgressor === true`) but `isAdmin === true` via `hasAdminPowers` allowlist. Admin-flavoured strings win on pipeline-health subtitle, service-split card visibility+labels+copy, forecast subtitle, and pro-tip. `canCreateSale` remains `false`. `!isInternalStaff` is `false`.
- **Viewer** (`role === "viewer"`): included in `isInternalStaff`, gets `"assigned"` mode, no admin copy, no create-sale button, no send-note button. Copy branches on `isProgressor` (false for viewer) so viewer sees non-progressor/non-admin variants of every subtitle. Preserve as-is.
- **Superadmin** — not in `isInternalStaff`, falls through the agent-visibility path. Likely latent inconsistency. Treat as "same as director unless canViewAllFiles=false". Not fixing in migration.

Anything not in this audit is either a pure CSS token (`agent-glass`, `agent-radius-xl`, `agent-coral-*`) that lives in global CSS, or copy interpolation — both should be treated as invisible-but-load-bearing during migration.
