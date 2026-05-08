# Discovery: The property file (overview article)

**Discovery for:** The property file — shell, header, tabs, file-level actions
**Report file:** `docs/help/_discovery/property-file-overview.md`
**Word count:** ~4,200
**Code references:** ~55
**Worth-flagging items:** 10

**What this page actually is:** A per-transaction workspace where agents track every active sale — the header shows property identity and progress, the tab bar provides access to milestones, reminders, to-dos, activity, and an overview summary.

**Page scale:** Substantial shell. The route component is 417 lines. It renders content for all 5 tabs upfront via SSR, plus a persistent sidebar. It is not a thin shell — the header alone has ~10 distinct data elements, and the Overview tab has 9 distinct sections.

**Tabs identified (in order):** Overview · Milestones · Reminders · To-Do · Activity

**Default tab:** Overview

---

## 1. Route and page identity

**Route:** `/agent/transactions/[id]`
Confirmed: `app/agent/transactions/[id]/page.tsx` is the only file at this path. No layout file at `[id]/layout.tsx` — the route renders directly within the `AgentShell` layout inherited from `app/agent/layout.tsx`.

**Loading skeleton:** `app/agent/transactions/[id]/loading.tsx` — renders a flat skeleton (nav bar height, one hero-shaped block, three card-shaped blocks). Does not reflect the actual page structure.

**Page heading:** The property address rendered as `<h1>` inside `PropertyHero` — the first comma-segment of `transaction.propertyAddress`. There is no separate route-level title. The `<h1>` is the address.

**Subtitle:** The remainder of the address after the first comma (e.g., "Bath, BA1 1AA"), rendered as a smaller `<p>` beneath the h1. If the address has no comma, there is no subtitle.

**One-sentence summary:** The property file is the per-transaction workspace where agents track a single sale from offer-accepted to completion — managing milestones, reminders, contacts, solicitors, notes, and chain in one place.

**Scale:** Large. The server component (`AgentTransactionDetailPage`) fires a `Promise.all` of 6 data fetches plus up to 4 follow-up queries. All 5 tabs' data is loaded on every page visit. The component renders 417 lines in the route file, and delegates to approximately 20 distinct components.

---

## 2. Page structure — top to bottom

Root element: `<div className="glass-page agent-page">` at `page.tsx:239`.

### Invisible client components (rendered before any visible UI)

| Component | File | Purpose |
|---|---|---|
| `TransactionViewTracker` | `components/agent/TransactionViewTracker.tsx:7` | Fires PostHog `TRANSACTION_VIEWED` analytics event on mount. Returns null. |
| `MosConfirmedNotice` | `components/transaction/MosConfirmedNotice.tsx:7` | Handles `?mosConfirmed=1` toast. Returns null. Wrapped in `<Suspense>`. |
| `RemindersReadyNotice` | `components/transaction/RemindersReadyNotice.tsx:8` | Handles `?newFile=1` polling toast. Returns null. Wrapped in `<Suspense>`. |
| `ChainClaimedNotice` | `components/transaction/ChainClaimedNotice.tsx:7` | Handles `?claimed=1` toast. Returns null. Wrapped in `<Suspense>`. |

### PropertyHero (the page header block)

`components/transaction/PropertyHero.tsx` — full-width glassmorphic banner at the top of the page.

The component has two rendering branches (`page.tsx:255`, `PropertyHero.tsx:77-78`):
- **Agent variant** (warm cream glass): used when `backHref="/agent/dashboard"` — the path always passed from this route
- **Dark variant**: used for `/dashboard` (internal staff) — not relevant to this article

See Section 4 for the full element-by-element breakdown.

### PropertyFileTabs (the tab shell)

`components/transaction/PropertyFileTabs.tsx` — contains the tab bar, mobile sidebar, and all tab content.

```
PropertyFileTabs
  ├── Sticky tab bar (glass-nav, sticky top-0 z-20)
  ├── Mobile sidebar toggle ("File details" collapsible, lg:hidden)
  └── Main row
       ├── Tab panels (all rendered, opacity-switched, flex-1)
       │    ├── Tab 0: Overview
       │    ├── Tab 1: Milestones
       │    ├── Tab 2: Reminders
       │    ├── Tab 3: To-Do
       │    └── Tab 4: Activity
       └── Desktop sidebar (hidden lg:block, w-72, sticky top-[53px])
```

### TransactionSidebar

`components/transaction/TransactionSidebar.tsx` — rendered as a prop passed into `PropertyFileTabs`, displayed as:
- Desktop (≥1024px): persistent right column, 288px wide, sticky below tab bar
- Mobile/tablet (<1024px): collapsible under a "File details" toggle button

---

## 3. The tab navigation

**Tab definitions** (`page.tsx:181-187`):

```typescript
const tabs = [
  { key: "overview",   label: "Overview" },
  { key: "milestones", label: "Milestones" },
  { key: "reminders",  label: "Reminders", badge: activeReminderCount },
  { key: "todos",      label: "To-Do",     badge: openTodoCount },
  { key: "activity",   label: "Activity" },
];
```

Note: "To-Do" capitalises both words. Earlier articles and specs may use "Todos" or "To-do" — the canonical label from the code is **"To-Do"**.

**Badges:** Reminders tab shows a coral-coloured count of "active reminders that are due today or overdue or have a pending chase task" (computed at `page.tsx:124-127`). To-Do tab shows open task count (`page.tsx:152`).

**Route mechanism:** Client-side React state only. No URL change on tab switch (`PropertyFileTabs.tsx:24-27`). The `initialTab` value comes from `searchParams.tab` passed server-side (`page.tsx:46`); it is honoured only if the key exists in the tabs array.

**Default tab:** "overview" — the first tab (`tabs[0].key`).

**URL behaviour:** Landing on `/agent/transactions/[id]?tab=milestones` opens the Milestones tab. Switching tabs client-side does NOT update the URL. Browser back/forward does not restore tab state from within the page.

**Content rendering:** All 5 tab panels are rendered simultaneously in the DOM. Inactive tabs have `opacity: 0; position: absolute; pointer-events: none; overflow: hidden` applied (`PropertyFileTabs.tsx:122-130`). There is no unmounting — switching tabs is a pure CSS visibility change.

**Sidebar state persistence:** A module-scoped variable `_sessionSidebarOpen` (`PropertyFileTabs.tsx:21`) persists the sidebar open/closed state across SPA navigations within the browser session.

**Unsaved state within tabs:** Because all tab panels stay mounted, unsaved state (e.g. a note being typed) persists while switching between tabs within the same page visit. State is lost on SPA navigation away from the file.

---

## 4. The page header

The `PropertyHero` component (agent variant) renders the following elements in order from top to bottom:

### Breadcrumb row (top)
- **Back link**: `← My Files` linking to `/agent/dashboard`. SVG chevron + text. Style: small, tertiary text colour (`--agent-text-tertiary`). `PropertyHero.tsx:104-112`.
- **Agency name (desktop only)**: `· {agencyName}`. Shown inline after the back link on `md:` breakpoints. Hidden on mobile. `PropertyHero.tsx:113-115`.
- **Agency name (mobile only)**: Agency name displayed left in the header's right-hand row, `md:hidden`. `PropertyHero.tsx:118`.
- **Status pill (right)**: Coloured dot + label. Five states: Draft (slate), Active (emerald), On Hold (amber), Completed (blue), Withdrawn (gray). `PropertyHero.tsx:29-35`. This pill is **read-only** in the header — the interactive status control is in the Overview tab meta grid.

### Address block
- **h1 (property address line 1)**: First comma-segment of `transaction.propertyAddress`. `data-sensitive="true"`. `PropertyHero.tsx:131`. Font: 24px mobile / 30px desktop, bold, tight tracking.
- **Address line 2**: Remainder after the first comma, if any. `data-sensitive="true"`. `PropertyHero.tsx:132`.

### Bottom row (price/pills + exchange/progress)
- **Purchase price**: `£X,XXX,XXX` formatted from pence. `data-sensitive="true"`. Hidden if `purchasePrice` is null. `PropertyHero.tsx:138-140`.
- **Tenure pill**: "Freehold" or "Leasehold". Hidden if `tenure` is null. Warm glass style (white/65, coral border). `PropertyHero.tsx:143-147`.
- **Purchase type pill**: Formatted `purchaseType`. "Cash buyer" not "Cash_buyer". Only three types rendered — see Worth Flagging item 4. Hidden if null. `PropertyHero.tsx:148-151`.
- **Service type pill**: Shown only when `serviceType` is set. "Outsourced to us" (blue pill) or "Self-managed" (green pill). `PropertyHero.tsx:152-161`.
- **Exchange countdown**: "EXCHANGE" uppercase label + countdown. Format: `{N}d`, "Today" (0 days), `{N}d overdue` (past). Colour: red for overdue, amber for ≤14 days, primary text otherwise. Hidden if `expectedExchangeDate` is null. `PropertyHero.tsx:167-174`.
- **Progress bar**: "PROGRESS" label + percentage + coloured bar. Colours: emerald (on_track), amber (at_risk), red (off_track), blue (unknown). Always shown, even at 0%. Animated shimmer on the bar. `PropertyHero.tsx:176-193`.

**Decorative elements:** Three radial gradient "blooms" (coral top-right, gold bottom-left, gold centre) are absolutely positioned behind the content. `PropertyHero.tsx:93-97`.

**Data sources:**
- `transaction.propertyAddress`, `status`, `tenure`, `purchaseType`, `purchasePrice`, `expectedExchangeDate`, `serviceType` — from `getTransaction()` at `lib/services/transactions.ts:101`
- `progress.percent`, `progress.onTrack` — from `calculateProgress()` at `lib/services/fees.ts`
- `agencyName` — from `transaction.agency.name` included in the `getTransaction` query

---

## 5. File-level actions

### Status change
**Where:** Overview tab, "Status" cell in the meta grid. `StatusControl` component (`components/transaction/StatusControl.tsx`).

**How:** Clicking the status badge opens a portal-rendered dropdown with four options: Active, On Hold, Completed, Withdrawn. Current status has a blue checkmark. `StatusControl.tsx:11-16`.

**"Withdrawn" flow:** Selecting Withdrawn opens a separate modal: "Mark as Withdrawn — Record why this transaction fell through." Offers 10 preset reasons (Buyer withdrew, Seller withdrew, Chain broke, Mortgage / finance issue, Survey issues, Gazundering, Gazumping, Solicitor delays, Personal circumstances changed, Other) + a free-text field for "Other". Requires a reason before "Confirm withdrawal" button is enabled. `StatusControl.tsx:18-29`, `139-212`.

**"Completed" gate:** `changeStatusAction` checks that VM19 or PM26 (exchange) AND VM20 or PM27 (completion) milestones are confirmed. If not, throws `new Error("Cannot mark as completed before confirming exchange...")`. `transactions.ts:283-305`. **The error message is not surfaced to the user** — `StatusControl` catches all errors and shows `toast.error("Couldn't update status — please try again")` only. See Worth Flagging item 1.

**Database effect:** `PropertyTransaction.status` updated. `fallThroughReason` written for withdrawn. `OutboundMessage` created as `type: "internal_note"` with e.g. "Alex changed status from Active to On Hold." If completing: `sendCompletionSurveys()` fired async. `transactions.ts:307-333`.

**After:** `revalidateTx()` revalidates `/agent/transactions/[id]` and `/transactions/[id]`. Page re-renders with new status.

---

### Edit purchase price
**Where:** TransactionSidebar "Price & Fees" card. Inline "Edit" link → `PriceInput` + Save/Cancel. `TransactionSidebar.tsx:362-385`.
**Server action:** `savePriceAction` → updates `PropertyTransaction.purchasePrice`. `transactions.ts:336`.

### Edit predicted exchange date
**Where:** TransactionSidebar "Exchange Forecast" card. "Edit" link → date `<input>` + Save/Cancel. `TransactionSidebar.tsx:246-276`.
**Server action:** `saveOverrideDateAction` → updates `PropertyTransaction.overridePredictedDate`. Shows "(overridden)" badge in blue when set. `transactions.ts:364`.

### Edit completion date
**Where:** TransactionSidebar "Exchange Forecast" card. Only visible once `exchangeConfirmed` is true (VM19 or PM26 milestone complete). "Edit" link → date `<input>` + Save/Cancel. `TransactionSidebar.tsx:278-306`.
**Server action:** `saveCompletionDateAction` → updates `PropertyTransaction.completionDate`. `transactions.ts:240`.

### Edit tenure and purchase type
**Where:** TransactionSidebar "Price & Fees" card. "Edit" button on the tenure/purchaseType pills row. Opens `EditSaleDetailsModal`. Two-step flow: select new values → "Preview changes" shows a delta (milestones becoming NR, milestones being re-activated, before/after progress %) → "Update sale details" confirms. `TransactionSidebar.tsx:401-418`.
**Server actions:** `getSaleDetailsDelta` (dry run), `confirmSaleDetailsAction` (apply). `transactions.ts:783`, `865`.
**Note:** The edit modal only offers 3 purchase types (mortgage, cash_buyer, cash_from_proceeds) — see Worth Flagging item 4.

### Edit agent fee
**Where:** TransactionSidebar "Price & Fees" card. "Set"/"Edit" button. Inline edit: Fixed £ or %, + VAT toggle (Inc VAT / + VAT). Director-only (`showOurFee` prop). `TransactionSidebar.tsx:430-524`.
**Server action:** `saveAgentFeeAction` → updates `agentFeeAmount`, `agentFeePercent`, `agentFeeIsVatInclusive`. `transactions.ts:~390`.

### Set/edit referral fee
**Where:** TransactionSidebar "Price & Fees" card. Only shown if `recommendedFirms.length > 0` or `referredFirmName` is set. Director-only (`recommendedFirms` loaded only for directors). Select firm from dropdown, enter fee amount. `TransactionSidebar.tsx:527-573`.
**Server action:** `saveReferralAction`.

### Add internal note
**Where:** Overview tab, "Notes" section (bottom of tab content). `TransactionNotes` component. Textarea + "Add note" button. Optimistic UI. `components/transaction/TransactionNotes.tsx`.
**Server action:** `addNoteAction` (comms service). Notes are `OutboundMessage` records with `type: "internal_note"`.

### Delete internal note
**Where:** Hover "Delete" link on each note row in `TransactionNotes`. `TransactionNotes.tsx:132-138`.
**Server action:** `deleteCommAction`.

### Quick-complete next milestone
**Where:** Overview tab, `NextMilestoneWidget` ("Next steps" card). Separate rows for vendor and purchaser next pending milestones. `NextMilestoneWidget.tsx:102`.
- If milestone requires an event date: "Complete →" button switches to Milestones tab (via `TabContext`).
- If no event date required: "Complete" button fires directly. `NextMilestoneWidget.tsx:67-99`.
**Server action:** `confirmMilestoneAction`.

### View property chain
**Where:** Overview tab, "Property chain" card (second card in the bottom two-column row). `ViewChainButton` component. Opens the chain drawer.

---

### Actions that are NOT present at the file level (for article authors)

- **Archive / delete file** — no such action exists on this page or anywhere visible in the agent app.
- **Send portal invite** — handled per-contact inside `ContactsSection` (in the Overview tab). There is no file-level "invite all" button.
- **Change assignment** — `AssignControl` component exists (`components/transaction/AssignControl.tsx`) but is NOT rendered anywhere on the agent-facing property file page. `assignUserAction` requires admin scope and throws "Forbidden: only admin can assign a progressor" for all agent users. The "Assigned to" field in the Overview meta grid is display-only for agents.

---

## 6. Post-create state

Three query parameters are consumed on the property file page after arriving from file creation. All are handled by invisible client components wrapped in `<Suspense>` (`page.tsx:241-243`).

### `?newFile=1`

Handled by `RemindersReadyNotice` (`components/transaction/RemindersReadyNotice.tsx`).

On mount: URL is cleaned immediately via `router.replace(pathname)`. A polling interval starts, calling `getTransactionReminderCountAction(transactionId)` every 1500ms, for up to 8 attempts (12 seconds total).

On first response where `count > 0`:
- Clears interval
- Fires: `toast.success("Chase reminders are active", { description: "Check the Reminders tab to see what needs following up." })`

If 8 attempts pass without a non-zero count, interval clears silently (no toast).

This handles the delay between file creation and the async reminder initialisation completing.

### `?mosConfirmed=1`

Handled by `MosConfirmedNotice` (`components/transaction/MosConfirmedNotice.tsx`).

On mount: URL cleaned immediately. Fires once:
- `toast.success("MOS confirmed for both sides", { description: "Seller and buyer MOS received milestones auto-confirmed from the uploaded memo." })`

`fired.current` ref prevents double-firing if the component re-renders.

### `?claimed=1`

Handled by `ChainClaimedNotice` (`components/transaction/ChainClaimedNotice.tsx`).

On mount: URL cleaned immediately. Fires once:
- `toast.success("You've claimed your position in this chain.", { description: "Open the chain panel to see other agents." })`

This param is set when an agent claims their chain position via the chain claim flow (`/claim/*`).

**All three toasts are auto-dismissing** (AgentToaster behaviour — no modal, no persist-on-page-refresh since URL is cleaned). The page itself shows no banner, modal, or persistent element after creation — only the transient toast.

---

## 7. Director vs negotiator differences

### Access gate

`page.tsx:59-60`:
```typescript
const isDirectorRole = session.user.role === "director";
if (!isDirectorRole && transaction.agentUserId !== session.user.id) notFound();
```

- **Directors** can open any file in their agency (bounded by `getTransaction(id, agencyId)` at `page.tsx:50`).
- **Negotiators** can only open files they own (`agentUserId === session.user.id`). Any other file → `notFound()` → Next.js 404.

**Critical mismatch**: `canViewAllFiles` is consulted on the All Files page to let negotiators see all agency files in the list. It is NOT consulted on the detail page. A negotiator with `canViewAllFiles=true` can see a file in the list but will get a 404 when clicking into it, unless they own it. This is a genuine inconsistency. `lib/services/agent.ts:14-24` defines `canViewAllFiles`; it has no effect on `page.tsx`.

### Director-only features

- **Recommended firms / referral fee section in sidebar**: `recommendedFirms` only loaded for `isDirectorRole` (`page.tsx:197-209`). Negotiators see an empty referral section.
- **Progressor fee row in sidebar**: `showOurFee={session.user.role === "director"}` (`page.tsx:229`). Negotiators do not see the "Progressor fee" or "Total agency income" rows.

### Shared features (same for both roles)

- PropertyHero (same layout, same data)
- Tab navigation (same tabs, same badges)
- StatusControl (both roles can change status)
- EditSaleDetailsModal (both roles can edit tenure/purchaseType)
- Edit purchase price, exchange date, completion date
- ContactsSection, SolicitorSection (same for both roles)
- Notes (add/delete)
- All tab content

### Page chrome

Identical visual chrome for both roles. The eyebrow/firm name from the session is not shown on this page (unlike the new-transaction page header). The agency name appears in the breadcrumb row only.

---

## 8. Live component extraction assessment

| Element | Component | Extractability | Notes |
|---|---|---|---|
| Status pill (header) | Inline in `PropertyHero.tsx:121-124` | **Easy** | Static display, takes `status: TransactionStatus` |
| PropertyHero (full header block) | `PropertyHero.tsx` | **Medium** | Many serialisable props; `isAgent` determined by `backHref` hack (prop smell) |
| Tab bar strip | Part of `PropertyFileTabs.tsx:64-95` | **Hard** | Stateful (active, badges, scroll), TabBadgeContext, scroll-on-active effect |
| FileHealthBanner | `components/transaction/FileHealthBanner.tsx` | **Easy** | Takes `overdueCount` + `onTrack`; uses TabContext for "View reminders →" (extractable with an `onViewReminders` callback) |
| Meta grid (Status/Assigned to/Last progress) | Inline in `page.tsx:263-288` | **Medium** | StatusControl is interactive; grid layout serialisable |
| StatusControl | `components/transaction/StatusControl.tsx` | **Hard** | Full server action wiring, portal dropdown, withdrawal modal, optimistic update |
| ProgressRing (sidebar SVG ring) | Inner component in `TransactionSidebar.tsx:5-44` | **Easy** | Pure SVG, takes `percent` + `onTrack` |
| RiskScoreWidget | `components/transaction/RiskScoreWidget.tsx` | **Easy** | Takes `RiskInput`, pure display |
| NextMilestoneWidget | `components/transaction/NextMilestoneWidget.tsx` | **Hard** | Uses TabContext + `confirmMilestoneAction` + AgentToast |
| RemindersWidget | `components/transaction/RemindersWidget.tsx` | **Medium** | Uses TabContext for "View all →"; static display otherwise |
| RecentActivityWidget | `components/transaction/RecentActivityWidget.tsx` | **Medium** | Uses TabContext for "View all →"; static display otherwise |

---

## 9. Worth flagging

### 1. "Completed" gate error message is lost

When a user tries to mark a file as Completed before exchange and completion milestones are confirmed, `changeStatusAction` throws:
```
"Cannot mark as completed before confirming exchange and legal completion milestones. Please confirm those milestones on the file first."
```
(`transactions.ts:300-304`)

But `StatusControl.tsx:79` catches all errors generically:
```typescript
toast.error("Couldn't update status — please try again");
```

The user sees "Couldn't update status — please try again" with no explanation of why. The actionable message (go to Milestones tab, confirm VM19/VM20 or PM26/PM27) is silently dropped. **This is a product bug.**

### 2. `canViewAllFiles` creates a split between list and detail visibility for negotiators

A negotiator with `canViewAllFiles=true` can see all agency files on the All Files page. Clicking through to any file they don't own throws a 404 on the detail page (`page.tsx:60`). The detail page does not check `canViewAllFiles` at all. The inconsistency makes `canViewAllFiles` partially misleading — it grants list visibility but not detail access. `lib/services/agent.ts:23` defines the logic; `page.tsx:59-60` ignores it.

### 3. `AssignControl` component exists but is never reachable from the agent surface

`components/transaction/AssignControl.tsx` is a fully built component for assigning a user to a transaction. `assignUserAction` (`transactions.ts:424`) immediately throws "Forbidden: only admin can assign a progressor" for any non-admin scope. The component is not rendered on the property file page at all — "Assigned to" is a static display. The article should not imply agents can change assignment here.

### 4. EditSaleDetailsModal only offers 3 of the 6 purchase types

The new transaction form offers 6 purchase types at creation: Mortgage, Cash, Cash from Proceeds, Shared Ownership, Help to Buy, First Home Scheme. `EditSaleDetailsModal.tsx:10-14` only offers 3: mortgage, cash_buyer, cash_from_proceeds. Files created with Shared Ownership, Help to Buy, or First Home Scheme cannot have their purchase type changed via the edit modal — those options are simply absent.

### 5. EmailParseWidget on Activity tab is a non-functional placeholder

`components/activity/EmailParseWidget.tsx` renders a fully disabled widget (`opacity: 0.6; pointer-events: none`) with the label "Smart email reader — coming soon" and a subtitle "Paste an email and we'll suggest which milestones to update. We're refining this — check back soon." The `transactionId` prop is named `_` and is never used. It can be dismissed with an `×` button. The Activity tab article should note this or omit it; this overview article should not claim it exists as a functional feature.

### 6. All 5 tabs' data is eagerly loaded on every page visit

`page.tsx:49-56` fetches in a single `Promise.all`: transaction (all relations), milestones, reminder logs, activity timeline, last update, manual tasks. All 5 tabs' data is always loaded regardless of which tab the user visits. The page does not lazy-load per tab. For files with extensive activity logs or many milestones, this means first-load cost is higher than a tab-by-tab approach. `PropertyIntelCard` is the only exception — it fetches client-side lazily.

### 7. Status pill in the header is read-only; changing status requires being on the Overview tab

The `PropertyHero` status pill is purely informational. The interactive `StatusControl` widget is inside the Overview tab's meta grid. If a user is on the Milestones tab and wants to change status, they must navigate to Overview first. The pill uses optimistic updates once a status change is made, but it is not clickable.

### 8. "Assigned to" and "Agent" display the same person on self-managed files

The Overview tab meta grid shows "Assigned to": `transaction.assignedUser?.name` (the internal SP team member assigned to the file). For self-managed files with no internal assignment, this falls back to `agentUser?.name` (the agency-side owner) — `page.tsx:271-273`. The sidebar separately shows an "Agent" card with the same `agentUser` — name, firm, email. On self-managed files, the same person appears twice under two different labels ("Assigned to" in the meta grid, "Agent" in the sidebar). The distinction is meaningful for outsourced files (where `assignedUser` is the internal SP team member and `agentUser` is the agency owner) but looks like a duplicate for self-managed files.

### 9. `?tab` parameter works on first load only; no URL sync on tab switch

Navigating to `/agent/transactions/[id]?tab=milestones` opens the Milestones tab. But once on the page, switching tabs does not update the URL. Browser back/forward does not restore tab positions. Deep-linking to a specific tab (e.g. from a notification or email) works, but the pattern is inconsistent — a user who bookmarks the page after switching tabs will not get the same tab on return.

### 10. Loading skeleton does not reflect actual page structure

`app/agent/transactions/[id]/loading.tsx` renders a minimal skeleton: one 56px nav placeholder, one hero-height skeleton block, three stacked card skeletons. The actual page has a complex PropertyHero with multiple data rows, a tab bar, and a two-column layout with a sidebar. The skeleton gives no hint of tabs or sidebar, creating a jarring layout shift on load.

---

## 10. Pre-existing assumptions to verify

| Claim | Status | Evidence |
|---|---|---|
| Route is `/agent/transactions/[id]` | ✓ Confirmed | `app/agent/transactions/[id]/page.tsx` |
| Tabs: Overview, Milestones, Reminders, To-do, Activity | ✓ Confirmed with correction | Labels at `page.tsx:181-187` are: "Overview", "Milestones", "Reminders", **"To-Do"** (capital D), "Activity" — not "To-do" |
| Default tab is Overview | ✓ Confirmed | `PropertyFileTabs.tsx:24-27`: `tabs[0].key = "overview"` when `initialTab` is absent or invalid |
| After creating a file, user lands on Overview tab with `?newFile=1` or `?mosConfirmed=1` | ✓ Confirmed | `NewTransactionForm.tsx:1006-1007` sets redirect suffix. `RemindersReadyNotice` handles `?newFile=1`; `MosConfirmedNotice` handles `?mosConfirmed=1`. A third param `?claimed=1` also exists (`ChainClaimedNotice`). |
| Status changes (active → on hold) happen here, not on All Files | ✓ Confirmed | `StatusControl` is only rendered on the property file page. All Files has no inline status change. |
| The page is server-rendered | ✓ Confirmed with nuance | The route component is an async RSC. All tab data is server-fetched. Sub-components (`StatusControl`, `PropertyHero`, `PropertyFileTabs`, etc.) are client components. `PropertyIntelCard` fetches client-side lazily. The page is SSR-heavy with interactive client islands. |

---

## 11. Page identity check

**Is "The property file" the right name?** Yes. The page is commonly referred to internally as "the property file" or "the file". The tab bar is labelled contextually but there is no in-page heading that names the concept — the h1 is the address. "The property file" is correct and natural.

**Will the article feel substantial enough?** Yes — provided it clearly scopes to the shell:
- The PropertyHero header has ~10 distinct labelled elements, several with conditional visibility rules
- The sidebar has 4 distinct cards with 6+ editable fields, some director-only
- Status change has a dedicated withdrawal-reason modal and a gated completion flow
- Three distinct post-create toast behaviors with different trigger conditions
- The director/negotiator access inconsistency deserves a paragraph

The risk is the article becomes a long list of fields. Structure it around user goals: "Where am I in this file?", "How do I change the file's status?", "What can I edit here vs. on individual tabs?"

**Product gaps that may need careful writing:**
1. The "Completed" status gate error — the modal blocks the action correctly, but the failure message is generic. The article can describe the correct pre-requisites without mentioning the broken error message.
2. EmailParseWidget on Activity tab — omit from this article (it's an Activity tab concern) or acknowledge it's a coming feature if mentioned at all.
3. `canViewAllFiles` inconsistency — the article should not describe `canViewAllFiles` as granting detail-page access; it doesn't. Frame it as "directors can access any file; negotiators can access files they own."

---

## Files read for this report

| File | Purpose |
|---|---|
| `app/agent/transactions/[id]/page.tsx` | Main route component — primary source |
| `app/agent/transactions/[id]/loading.tsx` | Loading skeleton |
| `components/transaction/PropertyHero.tsx` | Page header component |
| `components/transaction/PropertyFileTabs.tsx` | Tab shell + sidebar layout |
| `components/transaction/TransactionSidebar.tsx` | Persistent sidebar content |
| `components/transaction/StatusControl.tsx` | Status change dropdown + withdrawal modal |
| `components/transaction/EditSaleDetailsModal.tsx` | Tenure/purchaseType two-step edit modal |
| `components/transaction/FileHealthBanner.tsx` | Conditional warning banner (Overview tab) |
| `components/transaction/NextMilestoneWidget.tsx` | Quick-complete card (Overview tab) |
| `components/transaction/RemindersWidget.tsx` | Reminders preview card (Overview tab) |
| `components/transaction/RecentActivityWidget.tsx` | Activity preview card (Overview tab) |
| `components/transaction/RiskScoreWidget.tsx` | Fall-through risk card (Overview tab) |
| `components/transaction/TransactionNotes.tsx` | Internal notes (Overview tab) |
| `components/transaction/MosConfirmedNotice.tsx` | `?mosConfirmed=1` toast handler |
| `components/transaction/RemindersReadyNotice.tsx` | `?newFile=1` polling toast handler |
| `components/transaction/ChainClaimedNotice.tsx` | `?claimed=1` toast handler |
| `components/transaction/AssignControl.tsx` | Assignment widget (not mounted on agent surface) |
| `components/transaction/TabContext.tsx` | Tab switching context |
| `components/activity/EmailParseWidget.tsx` | Coming-soon placeholder (Activity tab) |
| `components/verified-emails/ComposeEmail.tsx` | Email compose widget (Activity tab) |
| `components/agent/TransactionViewTracker.tsx` | PostHog analytics tracker |
| `components/property/PropertyIntelCard.tsx` | Property intel (client-side lazy fetch) |
| `app/actions/transactions.ts` | All server actions: changeStatus, savePrice, saveOverrideDate, etc. |
| `lib/services/transactions.ts` | `getTransaction` query |
| `lib/services/risk.ts` | `calculateRiskScore` logic |
| `lib/services/fees.ts` | `calculateProgress`, `calculateOurFee` |
| `lib/services/summary.ts` | `getLastUpdate` (last milestone summary for meta grid) |
| `lib/services/agent.ts` | `canViewAllFiles` resolution |
