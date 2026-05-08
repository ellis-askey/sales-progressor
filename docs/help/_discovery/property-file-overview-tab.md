# Discovery: The Overview Tab

**Route:** `/agent/transactions/[id]` (Overview tab, index 0)
**Report file:** `docs/help/_discovery/property-file-overview-tab.md`
**Word count:** ~4,800
**Code references:** ~55
**Worth-flagging items:** 12

---

**What this tab actually is (one-line summary):** The default landing surface on every property file — a single-scroll dashboard combining file health, contacts, solicitors, next actions, reminders, activity, risk scoring, property intelligence, and internal notes.

**Tab scale:** 9 distinct sections, approximately 25 interactive elements across the full tab. The densest page in the agent app.

**Sections identified (DOM order):**
1. FileHealthBanner (conditional)
2. Meta grid (Status / Assigned to / Last progress)
3. ContactsSection + SolicitorSection (2-col grid)
4. NextMilestoneWidget
5. RemindersWidget + RecentActivityWidget (2-col grid)
6. RiskScoreWidget + Property chain card (2-col grid)
7. PropertyIntelCard
8. TransactionNotes

**Specifically covered:**
- Tab identity and purpose: ✓
- Tab structure: ✓
- Each of 9 sections documented: ✓
- Layout (desktop vs mobile): ✓
- Director vs negotiator: ✓
- Empty states: ✓
- Component extraction assessment (per section): ✓
- Worth flagging items: 12 ✓
- Pre-existing claims (article 10) verified: ✓
- Page identity check: ✓

---

## 1. What this tab actually is

The Overview tab is the first of five tabs on the property file. It is the default tab — every visit to a file lands here. Its purpose is to give the agent a complete picture of a sale in a single scroll without navigating to any other tab: who is involved (contacts, solicitors), where things stand (next milestones, reminders), how the file is tracking (risk score, recent activity), what the property context is (Property Intel), and any team notes.

**Rendering:** The tab is server-rendered. The route component at `app/agent/transactions/[id]/page.tsx` is an async RSC (React Server Component). All data for all five tabs is fetched in a single `Promise.all` at the top of the component (lines 49–56). The Overview tab's content is the first child passed to `PropertyFileTabs`, rendered as `children[0]`. All five tabs' HTML is sent to the client on initial load; tab switching is opacity-based (see §13).

**Component boundaries:** The Overview tab's content is defined inline in the route RSC, not in a separate `OverviewTab.tsx` file. There is no such file. The content is the `<div className="space-y-5">` block at lines 260–352 of `app/agent/transactions/[id]/page.tsx`.

**Scale:** 9 sections, approximately 440 lines of JSX. The ContactsSection alone is 459 lines (`components/contacts/ContactsSection.tsx`). Every section except the meta grid and the chain card uses a named component imported from elsewhere. Two sections have their own client-side API fetches after page load (PropertyIntelCard and SolicitorIntelBadge — see §17 for the contradiction with the article 10 claim).

---

## 2. Tab structure — top to bottom

All nine sections render inside a `<div className="space-y-5">` (`page.tsx:260`). The wrapper has `space-y-5` (20px vertical gap between sections). Individual sections control their own internal spacing.

| # | Section | Component | File | Condition |
|---|---|---|---|---|
| 1 | Health banner | `FileHealthBanner` | `components/transaction/FileHealthBanner.tsx` | Conditional (see §3) |
| 2 | Meta grid | Inline JSX (MetaField helper) | `page.tsx:263–288` | Always |
| 3 | Contacts + Solicitors | `ContactsSection` + `SolicitorSection` | `components/contacts/ContactsSection.tsx`, `components/solicitors/SolicitorSection.tsx` | Always (even if empty) |
| 4 | Next steps | `NextMilestoneWidget` | `components/transaction/NextMilestoneWidget.tsx` | Hides if both next milestones are null |
| 5 | Reminders + Activity | `RemindersWidget` + `RecentActivityWidget` | `components/transaction/RemindersWidget.tsx`, `components/transaction/RecentActivityWidget.tsx` | Always |
| 6 | Risk score + Chain | `RiskScoreWidget` + inline chain card | `components/transaction/RiskScoreWidget.tsx`, `components/chain/ViewChainButton.tsx` | Always |
| 7 | Property Intel | `PropertyIntelCard` | `components/property/PropertyIntelCard.tsx` | Always (shows loading/error) |
| 8 | Notes | `TransactionNotes` | `components/transaction/TransactionNotes.tsx` | Always (shows empty state) |

**Data source — the Promise.all at page.tsx:49–56:**
- `getTransaction(id, agencyId)` — full transaction object including contacts, solicitor firms/contacts, assignedUser
- `getMilestonesForTransaction(id, agencyId)` — vendor and purchaser milestone arrays
- `getReminderLogsForTransaction(id, agencyId)` — all reminder logs with chase tasks
- `getActivityTimeline(id, agencyId)` — ordered activity entries (milestone completions + comms)
- `getLastUpdate(id)` — most recent milestone completion with summaryText
- `listManualTasksForTransaction(id, agencyId)` — manual to-do items (used for To-Do tab badge only, not Overview content)

Additional serial queries after Promise.all:
- MOS document signed URL (line 63–72) — used on Activity tab, not Overview
- `assignedUser` fields (line 74–79) — fetched if `assignedUserId` is set (outsourced files)
- `agentUser` name lookup (line 189–194) — for "Assigned to" display on self-managed files
- `recommendedFirms` (line 197–209) — director only, used in SolicitorSection

---

## 3. The FileHealthBanner

**File:** `components/transaction/FileHealthBanner.tsx` (59 lines)

**When it appears:**
```
overdueCount > 0 OR (onTrack === "at_risk" OR onTrack === "off_track")
```
Returns `null` (renders nothing) if `overdueCount === 0 && !isBehind`. The component uses `useTabContext` so it is a client component (`"use client"` at line 1).

**Variants:**

Red variant (`bg-red-50 border-red-200`) — triggered when BOTH conditions are true: `overdueCount > 0` AND `onTrack === "at_risk" || onTrack === "off_track"`.

Amber variant (`bg-amber-50 border-amber-200`) — triggered when exactly one condition is true: overdue count alone, or behind-schedule alone.

**Exact copy:**
- If `overdueCount > 0`: `"{n} reminder{s} overdue"` (plural: "reminders" when n ≠ 1)
- If `isBehind`: `"File may be behind schedule"`
- Both lines can appear simultaneously in the red variant

**Action:** "View reminders →" button — only rendered when `overdueCount > 0` (`page.tsx` line 46). If the banner shows amber because `isBehind` only (no overdue reminders), there is no action button. The button calls `setActiveTab("reminders")` via `useTabContext` — client-side tab switch, not navigation.

**Dismissibility:** Not dismissible. It shows on every page load while the conditions are met.

**`overdueCount` definition** (computed at `page.tsx:129–132`):
```typescript
const overdueCount = activeReminders.filter((l) => {
  const due = new Date(l.nextDueDate); due.setHours(0, 0, 0, 0);
  return due < today;  // strictly before today, midnight
}).length;
```
Reminders due exactly today are NOT counted as overdue for the banner purpose (but are styled differently in RemindersWidget). A reminder's `status` must be `"active"` to be counted.

---

## 4. The meta grid

**Defined inline in route RSC, `page.tsx:263–288`.** Not a named component — uses a local `MetaField` helper function defined at the bottom of the file (lines 409–416).

**Layout:**
- Mobile: `grid-cols-2` with a border-top separator — Status and Assigned to sit side by side; Last progress spans `col-span-2` below them
- Desktop (md+): `md:grid-cols-[130px_160px_1fr]` — fixed-width Status (130px), fixed-width Assigned to (160px), flex Last progress. All three in one row with `divide-x` dividers

The glass-card wrapping the grid has `clipPath: "inset(0 round 20px)"` to clip child content at the card's border radius.

**Cell 1 — Status:**
Renders `<StatusControl transactionId currentStatus>` from `components/transaction/StatusControl.tsx`. StatusControl is a client component that renders a small button showing the current status badge. Clicking it opens a portal-rendered dropdown (portal-rendered to ensure it isn't clipped by the card's `clipPath`). The four options are Active, On Hold, Completed, Withdrawn.

The Completed gate: `changeStatusAction` (the server action StatusControl calls) throws "Cannot mark as completed before confirming exchange..." if VM19/PM26 and VM20/PM27 aren't both confirmed. The catch block in StatusControl (`StatusControl.tsx:81–82`) checks for the "Cannot mark as completed" prefix and surfaces the exact message in a toast. All other errors show a generic "Couldn't update status — please try again" toast.

The Withdrawn flow: selecting Withdrawn opens a portal-rendered modal asking for a fall-through reason (10 preset options + "Other" with a free-text field). The withdrawal cannot be confirmed without selecting a reason. Documented in full in article 10.

**Cell 2 — Assigned to (`page.tsx:268–275`):**
```typescript
transaction.assignedUser?.name
  ?? (transaction.serviceType === "self_managed"
    ? (agentUser?.name ?? <span>Self-progressed</span>)
    : <span>Unassigned</span>)
```

Resolution order:
1. `transaction.assignedUser.name` — the explicitly assigned SP team member (only set on outsourced files, set via admin assignment). If set, shows their name.
2. For `self_managed` files: `agentUser.name` — the file owner (the agent who created the file). Fallback to italic "Self-progressed" if agentUser lookup returned null.
3. For `outsourced` files with no assignment: italic "Unassigned"

This field is pure display — no edit button, no interaction. Read-only for all agent-side users.

**Cell 3 — Last progress (`page.tsx:277–285`):**
Source: `getLastUpdate(transactionId)` from `lib/services/summary.ts:69–83`. Queries `prisma.milestoneCompletion.findFirst` ordered by `completedAt desc`, filtered to `state: "complete"` and `summaryText: { not: null }`.

`summaryText` is a pre-generated natural language string stored on the MilestoneCompletion record at the time of confirmation. Rendered with `line-clamp-2` so long strings are truncated.

Date: formatted via `relativeDate(completedAt)` which returns "Today", "Yesterday", "{n} days ago", "Last week", "{n} weeks ago", or "{n} months ago" (`lib/services/summary.ts:88–104`).

Fallback: italic "No progress yet" if `lastUpdate` is null (no milestones confirmed on this file).

---

## 5. The NextMilestoneWidget

**File:** `components/transaction/NextMilestoneWidget.tsx` (~145 lines)

**State computation in route RSC — `computeMilestoneSideState()` helper:**

Each side (vendor, purchaser) is computed to one of three states via a `MilestoneSideState` discriminated union:

```typescript
type MilestoneSideState =
  | { state: "hasNext"; milestone: NextMilestone }
  | { state: "gatePending"; gateType: "exchange_gate" | "post_exchange" }
  | { state: "allComplete" };
```

The helper runs through milestones in order:
1. If there is an available, incomplete, non-required milestone outside `EXCHANGE_GATES` and `POST_EXCHANGE` → `"hasNext"` (with that milestone)
2. Else if any gate milestone (VM18/PM25) is incomplete and non-required → `"gatePending"` with `gateType: "exchange_gate"`
3. Else if any post-exchange milestone (VM19/VM20/PM26/PM27) is incomplete and non-required → `"gatePending"` with `gateType: "post_exchange"`
4. Otherwise → `"allComplete"`

Props: `vendorSide: MilestoneSideState`, `purchaserSide: MilestoneSideState`, `transactionId: string`.

**Three rendering branches per row:**

`state: "allComplete"` — emerald checkmark icon + "All milestones complete" in emerald-600.

`state: "gatePending"` — amber dot + either "Awaiting exchange-readiness" (exchange_gate) or "Awaiting exchange or completion" (post_exchange).

`state: "hasNext"` — existing quick-complete flow:
- `eventDateRequired: true` → "Complete →" link, calls `setActiveTab("milestones")`
- `eventDateRequired: false` → "Complete" button (filled, coral), calls `confirmMilestoneAction`. On success: `toast.success(milestone.name)`. On failure: `toast.error`. Loading: button → "…", disabled.

**Widget visibility:** Hidden only when BOTH sides are `"allComplete"`. All other combinations render the widget.

**Post-confirm:** Route calls `revalidatePath` after `confirmMilestoneAction`, triggering a server re-render. No local optimistic update in the widget.

**No director/negotiator difference** — same widget for both roles.

> **Fix applied (Phase 1):** Previously, exchange-gate and post-exchange milestones were excluded from the next-selection query, causing the widget to show "All milestones complete" when the file was actually waiting at VM18/PM25 or post-exchange. Replaced with the correct `"gatePending"` state. See §17 item 2.

---

## 6. The RemindersWidget

**File:** `components/transaction/RemindersWidget.tsx` (91 lines)

**Data passed from route (`page.tsx:134–139`):**
```typescript
const topReminders = activeReminders.slice(0, 2).map((l) => ({
  id: l.id,
  ruleName: l.reminderRule.name,
  nextDueDate: l.nextDueDate,
  pendingChaseCount: l.chaseTasks.filter((t) => t.status === "pending").length,
}));
```

The widget receives exactly 2 reminders maximum (sliced before being passed as props). `totalActive` = the full count of active reminders (not just the 2 shown). Header shows a coral badge with `totalActive` if > 0.

**Selection:** `activeReminders` = all reminder logs where `status === "active"`. These are then sliced to 2 in order (whatever order `getReminderLogsForTransaction` returns them — ordered by `nextDueDate` ascending based on the service query). So the 2 shown are the 2 with the soonest due dates.

**Per-row display:**
- Rule name (truncated)
- Due status:
  - `days < 0` (overdue): `"{n} day{s} overdue"` in red, row background `bg-red-50/60`
  - `days === 0` (due today): "Due today" in coral
  - `days > 0` (upcoming): `"Active from {formatted date}"` in muted
- Pending chases badge (coral) shown if `pendingChaseCount > 0`: `"{n} chase{s}"`

`daysUntil()` is from `lib/utils`. The `nextDueDate` date field determines the status; days are computed relative to now.

**"View all →" button:** calls `setActiveTab("reminders")` — client-side tab switch.

**Empty state copy (verbatim):** `"No reminders due"` (italic, centered)

Note: the empty state condition is `reminders.length === 0` — this triggers when the top-2 slice is empty, i.e. no active reminders at all.

---

## 7. The RecentActivityWidget

**File:** `components/transaction/RecentActivityWidget.tsx` (89 lines)

**Data:** receives the full `activityEntries` array from the route. Takes first 3: `const recent = entries.slice(0, 3)` (line 25). `activityEntries` from `getActivityTimeline` is ordered most-recent-first.

**Entry types and display:**

Milestone entries (`entry.kind === "milestone"`):
- Emerald dot
- Name: `"{isNotRequired ? "N/A — " : ""}{milestoneName}"` (truncated)
- Relative date via `relativeDate(entry.at)`

Comm entries (`entry.kind === "comm"`):
- Dot colour: `internal_note` → slate/20, `outbound` → blue-400, `inbound` → emerald-400
- Type label: "Note", "Outbound", "Inbound"
- Method (if present): `· {method}`
- Content: `entry.content` (truncated)
- Relative date

**"View all →" button:** calls `setActiveTab("activity")`.

**Empty state copy (verbatim):** `"No activity yet"` (italic, centered)

The widget shows a maximum of 3 entries regardless of total activity volume. There is no "Show more" within the widget.

---

## 8. The RiskScoreWidget

**File:** `components/transaction/RiskScoreWidget.tsx` (~100 lines)
**Calculation:** `lib/services/risk.ts` (~124 lines), function `calculateRiskScore(input: RiskInput)`

**Inputs (computed in route RSC, `page.tsx:173–179`):**
```typescript
const riskInput = {
  onTrack: progress.onTrack,          // "on_track" | "at_risk" | "off_track" | "unknown"
  escalatedTaskCount: escalatedCount,  // chase tasks with status "pending" AND priority "escalated"
  overdueTaskCount: overdueCount,      // active reminders with nextDueDate < today
  daysSinceLastActivity,               // days since activityEntries[0].at (the most recent entry)
  daysStuckOnMilestone,                // days since the most recently completed milestone
};
```

`daysSinceLastActivity` = null if `activityEntries.length === 0`.
`daysStuckOnMilestone` = null if no milestone has ever been completed (`lastMilestoneCompletion` is undefined).

**Four risk levels (`RiskLevel` type):** `"low"`, `"medium"`, `"high"`, `"no_data"`.

**No-data detection:** Before evaluating factors, `calculateRiskScore` checks whether all signals are absent: `escalatedTaskCount === 0`, `overdueTaskCount === 0`, `daysSinceLastActivity === null`, `daysStuckOnMilestone === null`, `onTrack === "unknown"`. If all five are true, returns `{ level: "no_data", score: 0, factors: [] }` immediately — no factors evaluated.

**The 7 factors (`lib/services/risk.ts`):**

| Factor | Impact | Threshold |
|---|---|---|
| Escalated chases | High (40pts) | escalatedTaskCount > 0 |
| Progress vs pace | High (40pts) | onTrack === "off_track" |
| Multiple overdue tasks | Medium (20pts) | overdueTaskCount >= 2 |
| Slow progress pace | Medium (20pts) | onTrack === "at_risk" |
| No recent activity | Medium (20pts) | daysSinceLastActivity >= 21 |
| Single overdue task | Low (10pts) | overdueTaskCount === 1 |
| No recent milestone | Low (10pts) | daysStuckOnMilestone >= 14 |

Maximum possible score: 40 + 40 + 20 + 20 + 20 + 10 + 10 = 160, but capped at 100 (`Math.min(100, ...)`).

**Level thresholds (for files with data):** score ≥ 55 → "high" (At risk, red), score ≥ 20 → "medium" (Watch, amber), score < 20 → "low" (On track, emerald).

**Deduplication (`lib/services/risk.ts`):** Two factors are hidden from the visible list to avoid double-counting:
- "Single overdue task" hidden if `overdueTaskCount >= 2` (the "Multiple overdue tasks" factor covers it)
- "Slow progress pace" hidden if `onTrack === "off_track"` (the higher-severity "Progress vs pace" factor covers it)

The raw `score` still counts all triggered factors regardless of deduplication — deduplication is display-only.

**Widget display (`RiskScoreWidget.tsx`):**
- Header: "Fall-through risk" + subtitle "Based on live file data, not a guess" + status badge (No data yet / On track / Watch / At risk)
- Score bar: `{score} / 100` text + filled progress bar (grey for no_data, green/amber/red otherwise, minimum 3% width for visibility)
- `no_data` state: italic "Risk factors will appear as the file progresses." replaces factor lists
- "Active risk factors" section: triggered factors as cards with coloured impact dots (red=high, amber=medium, blue=low) and detail text
- "Not flagged" section: non-triggered factors with emerald checkmarks

The score is computed at render time (in the client component) from the props passed at server render. It does not update between page visits without a full page reload or server revalidation.

No interactive explanation or drill-down — all factor detail text is visible directly in the widget.

**`onTrack` source:** `calculateProgress()` from `lib/services/fees.ts`, using milestone weights, completion state, transaction creation date, and override exchange date.

> **Fix applied (Phase 1):** Previously, a brand-new file with no data scored level "low" / badge "On track" (0/100, no factors triggered). The new `no_data` level is returned when all five signals are absent, and the widget shows "No data yet" instead. See §17 item 6.

---

## 9. The ContactsSection

**File:** `components/contacts/ContactsSection.tsx` (459 lines)
**Data:** `transaction.contacts` (all contacts, loaded via `getTransaction` which includes contacts with `id, name, phone, email, roleType, portalToken, lastVisitedPortalAt, createdAt`)

**Display per contact row:**
- `ContactAvatar` with role-based colour (vendor=blue, purchaser=emerald, solicitor=violet, broker=amber, other=slate)
- Name (with `data-sensitive="true"` attribute)
- Role badge (colour-coded, uses `CONTACT_ROLE_LABELS`)
- Portal view date: "Viewed {relative}" if `lastVisitedPortalAt` exists AND `portalToken` is set
- Email: links to `mailto:` (if email set)
- Phone (if set): Phone icon + `tel:` link for the number + separate WhatsApp icon linking to `whatsapp://send?phone=...`. Clicking the number initiates a phone call; the WhatsApp icon opens WhatsApp.
- Action row: portal actions + Edit + Remove

**No limit on contacts displayed** — all contacts from `transaction.contacts` are rendered, no cap. The section header shows a count badge.

**Role types:** vendor, purchaser, solicitor, broker, other. No side grouping — all contacts listed sequentially in the order they appear on the transaction.

**Portal actions (vendor and purchaser contacts only):**

If contact has no `portalToken`:
- "Set up portal" button → calls `generatePortalTokenAction(contactId, transactionId)` (server action). Presumably creates a portal token for the contact.

If contact has `portalToken`:
- If contact has email: "Send invite" button → POST `/api/portal/invite` with `{ token }`. On success: toast "Invite sent to {name}" with description "They'll receive an email shortly". `inviteSent` state shows "✓ Sent" for 3 seconds.
- Always: "Portal link" button → `navigator.clipboard.writeText(origin + "/portal/" + token)`. Shows "✓ Copied" for 2 seconds.

**Editing a contact:**
Clicking "Edit" opens an inline form (replaces the contact row) with 3 fields: name, phone, email. No role field in edit mode (role cannot be changed after creation). Save calls `updateContactAction({ id, transactionId, name, phone, email })`.

**Adding a contact:**
"+ Add contact" in section header opens a separate form below existing contacts. Fields: name (required), role (required, dropdown with 5 options), email, phone. Save calls `createContactAction({ propertyTransactionId, name, email, phone, roleType })`. Name is `titleCase`-transformed before saving.

**Deleting a contact:** "Remove" button → `deleteContactAction(contactId, transactionId)`.

**Empty state:** "No contacts yet" with description "Add vendors, purchasers, solicitors, and other parties." and a "Add first contact" button — rendered inside a glass-card via `<EmptyState>`.

**No director/negotiator difference** inside ContactsSection — no role check in the component.

> **Fix applied (Phase 1):** Previously the phone number was a single WhatsApp link — clicking it opened WhatsApp, not the phone dialer. Now shows a Phone icon + `tel:` link + separate WhatsApp icon. Consistent with solicitor phone links in SolicitorSection. See §17 item 7.

---

## 10. The SolicitorSection

**File:** `components/solicitors/SolicitorSection.tsx` (292 lines)

**Data passed from route:**
- `vendor: { firm, contact }` — firm name/id, contact name/phone/email (all nullable)
- `purchaser: { firm, contact }` — same structure
- `recommendedFirms` — array of agency-recommended firms with default referral fees. Non-null for directors only (route RSC line 197: `isDirectorRole ? await ... : null`). `recommendedFirms ?? undefined` is passed to SolicitorSection (line 310), so negotiators receive `undefined`.
- `referredFirmId`, `referralFee` — for the referral fee display at the bottom

**Display per card (vendor + purchaser):**
- Side label ("Vendor solicitor" or "Purchaser solicitor") + Edit or "+ Add" button
- Avatar (violet, initials of contact name or Buildings icon if no contact)
- Firm name + contact name + contact phone (tel: link) + contact email (mailto: link)
- `SolicitorIntelBadge` — client-side fetch (see §17)

**SolicitorIntelBadge** (`SolicitorSection.tsx:59–95`):
Fires `fetch(/api/solicitor-intel?firmId={firmId})` on mount via `useEffect`. Returns null (renders nothing) if `intel === null` or `intel.totalFiles === 0`. Otherwise shows:
- Warning box (amber) if `intel.warning` is not null
- Stats row: `"{n} file{s} on record"`, avg weeks to exchange (if available), avg days searches (if available), rating label (Fast/Average/Slow/—)

**Edit mode:**
Both directors and negotiators can edit solicitor assignments. The difference is that directors, when editing a recommended firm, also see a "Referral fee" field (a `PriceInput` component). Negotiators don't see this because `recommendedFirms` is `undefined` for them, so `selectedRecommended` is always null.

Save calls `saveSolicitorsAction(transactionId, { vendorSolicitorFirmId, vendorSolicitorContactId, ... })`. The picker searches the shared solicitor firm database (not agency-specific).

**Referral fee row at bottom of glass-card:** shown only when `referredFirmId && referralFee != null` (line 281). Displays: "Referral fee: £{amount}". Read-only display — formatted as £X,XXX with up to 2 decimal places.

**Empty state:** "None added" (italic) in place of the firm name, with "+ Add" button.

---

## 11. The PropertyIntelCard

**File:** `components/property/PropertyIntelCard.tsx` (171 lines)
**Rendering:** `"use client"` — a client component. Fetches on mount via `useEffect`:
```typescript
fetch(`/api/property-intel?transactionId=${transactionId}`)
```

**API route:** `app/api/property-intel/route.ts`. Extracts postcode from the property address string using `extractPostcode()`. If no postcode can be extracted, returns `{ postcode: null, pricePaid: [], epc: null, links: null }`. Otherwise, runs two parallel requests to external services:
- `fetchPricePaid(postcode, paon)` → Land Registry SPARQL API (public, no auth)
- `fetchEpc(postcode, paon)` → EPC Register API (requires `EPC_API_EMAIL` + `EPC_API_KEY` env vars)

**No caching** — fresh fetch on every page load. No server-side or client-side cache.

**Loading state:** Text: `"Fetching property data…"` (centred, muted)

**Error state:** Text: `"Could not load property data."` (centred, muted) — triggered if the fetch throws or returns non-ok

**Populated state:**
- Disclaimer (italic): `"Data sourced from Land Registry and EPC Register. Always verify before use."`
- Left column: "Price Paid History" — up to 5 most recent Land Registry sales at the postcode. Per entry: price, property type, new build flag, estate type, date (month/year). If none found: "No sales found for this postcode."
- Right column (fixed 176px): "EPC" — rating badge (A–G, colour-coded), score/100, property type, built form, floor area m², inspection date, "View on GOV.UK →" link to EPC register
- External links in header: Rightmove, Zoopla, Land Reg (only shown when `data.links` is not null)

**EPC not configured state** (shown when `epcConfigured: false` in API response): displays `"EPC data is currently unavailable."` in muted italic — user-facing copy, no env var names exposed.

> **Fix applied (Phase 1):** Previously showed raw env var names as user-facing copy. See §17 item 3.

**Data granularity:** Price paid data is postcode-level from Land Registry. It shows recent sales from the same postcode, not specifically the sold property. Results may include neighbouring properties.

---

## 12. The TransactionNotes

**File:** `components/transaction/TransactionNotes.tsx` (159 lines)

**Storage:** Notes are `OutboundMessage` records with `type: "internal_note"`. Confirmed: `addNoteAction` calls `createCommunicationRecord({ type: "internal_note", contactIds: [] })` (`app/actions/comms.ts:15–30`), which calls `prisma.outboundMessage.create` in `lib/services/comms.ts:141`.

**Internal-only:** The `contactIds: []` empty array means no portal recipients. Notes do not appear on the client portal. Confirmed in article 10 discovery.

**Pre-filtering in route RSC (`page.tsx:102–108`):**
```typescript
const internalNotes = (activityEntries as ActivityEntry[])
  .filter((e): e is Extract<ActivityEntry, { kind: "comm" }> =>
    e.kind === "comm" &&
    e.type === "internal_note" &&
    !(typeof e.content === "string" && e.content.includes("viewed their client portal"))
  )
```
Portal view log entries (auto-generated when a client views their portal) are `internal_note` type in the DB, but are filtered out of `initialNotes` so they don't appear in the Notes section. They still appear in the Activity tab timeline.

**Display:**
- Header: `"Notes"` (uppercase, muted)
- Add note form: textarea with placeholder "Add a note…" (3 rows, no character limit, no `maxLength` attribute), + "Add note" button. Button disabled while pending or if draft is empty/whitespace.
- Existing notes: avatar (blue circle with initials), name, relative date, content (`whitespace-pre-wrap` — respects line breaks). Optimistic notes show `opacity: 0.65` and "just now" timestamp while saving.
- Delete: "Delete" text button, hidden until hover (`opacity-0 group-hover:opacity-100`). Disabled while any pending transition.
- Pagination: first 5 notes shown (`PAGE_SIZE = 5`). "Show {n} more note{s}" button expands all. No collapse-back option once expanded.

**Optimistic update:** Uses `useOptimistic` — the new note appears immediately with a temp id. On save success: `toast.success("Note added")`. On failure: `setError("Failed to save note — please try again")` shown below the textarea.

**No character limit** on the textarea — no `maxLength` attribute visible in the component.

**Empty state (verbatim):** `"No notes yet"` (italic)

---

## 13. Layout — desktop vs mobile

**Outer shell:** `PropertyFileTabs` (`components/transaction/PropertyFileTabs.tsx:142 lines`)

**Tab bar:** Sticky (`top-0, z-20, glass-nav`). Horizontally scrollable on mobile (`overflow-x-auto scrollbar-hide`). Blur effect increases on scroll.

**Mobile/tablet sidebar toggle (< lg):** A "File details" collapsible row (`lg:hidden`) sits between the tab bar and the content area. Shows `TransactionSidebar` when expanded. State persists across SPA navigations via a module-scoped variable (`let _sessionSidebarOpen = false`).

**Content + sidebar layout (`PropertyFileTabs.tsx:117`):**
```
px-4 lg:px-8, py-5 lg:py-7
flex-col on mobile / flex-row on lg+
```
Desktop sidebar: `hidden lg:block w-72 flex-shrink-0 sticky top-[53px]`

**Within the Overview tab (`page.tsx:260–352`):**

Full-width sections (always single column):
- FileHealthBanner
- Meta grid (its internal columns are responsive, but the card is full-width)
- NextMilestoneWidget
- PropertyIntelCard
- TransactionNotes

Two-column grids (single-column on mobile, 2-col on `md+`):
- Contacts + Solicitors: `grid grid-cols-1 gap-5 md:grid-cols-2` (line 290)
- Reminders + Activity: `grid grid-cols-1 gap-5 md:grid-cols-2` (line 332)
- Risk + Chain: `grid grid-cols-1 gap-5 md:grid-cols-2` (line 337)

**Meta grid internal layout:**
- `< md`: `grid-cols-2` — Status top-left, Assigned to top-right, Last progress spans `col-span-2` with a `border-t`
- `≥ md`: `md:grid-cols-[130px_160px_1fr]` — all three in one row, fixed widths for first two

**Mobile ordering:** Sections are stacked in the exact order they appear in the JSX — no reordering between breakpoints. Within the 2-column grids, the left component is always first on mobile (stacks above).

**No sections hidden on mobile** — all 9 sections render at all breakpoints. The sidebar (Price & Fees, Exchange Forecast, etc.) moves from a desktop sticky column to the mobile collapsible toggle.

---

## 14. Director vs negotiator differences inside this tab

**Route-level gate (`page.tsx:59–60`):**
```typescript
const isDirectorRole = session.user.role === "director";
if (!isDirectorRole && transaction.agentUserId !== session.user.id) notFound();
```
Negotiators can only access files they own. Directors can open any file in their agency.

**Inside the Overview tab specifically:**

| Section | Director | Negotiator | Difference |
|---|---|---|---|
| Meta grid | Same | Same | None |
| ContactsSection | Same | Same | None |
| SolicitorSection (view) | Same | Same | None |
| SolicitorSection (edit) | Sees referral fee field when editing a recommended firm | Does not see referral fee field | `recommendedFirms` is null for negotiators, so `selectedRecommended` is always null |
| SolicitorIntelBadge | Same | Same | None — both see intel if firm has data |
| NextMilestoneWidget | Same | Same | None |
| RemindersWidget | Same | Same | None |
| RecentActivityWidget | Same | Same | None |
| RiskScoreWidget | Same | Same | None |
| Property chain card | Same | Same | None |
| PropertyIntelCard | Same | Same | None |
| TransactionNotes | Same | Same | None |

**Summary:** The only director-specific difference inside the Overview tab is the referral fee field in the SolicitorSection edit flow. The broader director-only features (progressor fee, referral fee display in sidebar, `recommendedFirms` loading) are in `TransactionSidebar`, which is out of scope for this article.

---

## 15. Empty states for the whole tab

**File just created (no milestones confirmed, no contacts, no solicitors, no notes):**
- FileHealthBanner: hidden (overdueCount = 0, onTrack likely "unknown")
- Meta grid: "No progress yet" in Last progress cell; status = Active
- ContactsSection: "No contacts yet" with "Add first contact" button
- SolicitorSection: "None added" for both vendor and purchaser
- NextMilestoneWidget: If milestones were generated, shows VM1/PM1 with `"hasNext"` state. If milestone generation failed, `milestoneData` is null → both sides → `"allComplete"` → widget hidden
- RemindersWidget: "No reminders due" (chase reminders may not yet have fired)
- RecentActivityWidget: "No activity yet"
- RiskScoreWidget: All five signals absent → `level: "no_data"`, badge "No data yet", italic "Risk factors will appear as the file progresses."
- PropertyIntelCard: fetches and shows intel if postcode can be extracted (immediate, client-side)
- TransactionNotes: "No notes yet"

**File mid-life, normal populated state:**
All sections populated. FileHealthBanner may or may not appear based on overdue/risk state.

**Completed file:**
No visual change to the Overview tab layout. Status badge in meta grid shows "Completed". NextMilestoneWidget: both sides → `"allComplete"` → widget hidden. RemindersWidget and RecentActivityWidget reflect the file state.

**Withdrawn file:**
Same as completed — no special empty state. Status badge shows "Withdrawn". Milestone, reminder, and activity data remain visible.

**File with missing partial data (no contacts, solicitors set, notes empty):**
- ContactsSection renders the empty state with "Add first contact" button
- SolicitorSection renders "None added" on both sides (no card collapse — the glass-card always renders)
- TransactionNotes renders "No notes yet"
- No layout collapse or missing-section messages — the sections always take up space

---

## 16. Live component extraction assessment

| Section | Extractability | Reason |
|---|---|---|
| FileHealthBanner | **Easy** | Pure JSX, takes overdueCount + onTrack as props. Uses TabContext (client dependency), but that can be passed as an onAction callback instead |
| Meta grid | **Hard** | No standalone component — defined inline in the RSC with StatusControl (portal + modal) and Assigned to logic that references live state. Demoing realistically requires mocking StatusControl |
| NextMilestoneWidget | **Medium** | Takes `vendorSide`/`purchaserSide` MilestoneSideState props + transactionId, fires real server actions and uses TabContext. A view-only extraction showing all three state variants (hasNext, gatePending, allComplete) with canned data is feasible |
| RemindersWidget | **Easy** | Takes a plain array of reminder items and a count. No server actions, no live fetches. Clean for a help example |
| RecentActivityWidget | **Easy** | Takes an array of ActivityEntry objects. Renders purely from props. Only dependency is TabContext (for "View all →") |
| RiskScoreWidget | **Already done** — partially | The `calculateRiskScore` function is standalone and pure; passing a RiskInput object with canned values produces a fully functional widget. Minimal wiring needed |
| ContactsSection (whole) | **Hard** | Deep interactive state (add/edit/delete/portal token/invite) and multiple server actions. A single contact row sub-component would be extractable |
| ContactsSection (single row) | **Medium** | A read-only contact card showing name/role/email/phone/portal status is extractable without the action handlers |
| SolicitorSection | **Medium** | View state (non-editing) is extractable with static data. Edit mode involves SolicitorPicker (complex search component) and server actions |
| SolicitorIntelBadge | **Hard** | Fires a live client-side fetch on mount. Would need to be mocked or shown in a loaded state |
| RiskScoreWidget | **Easy** | Pure from props — `calculateRiskScore(input)` is deterministic given the input. Pass any RiskInput to get a fully rendered widget |
| TransactionNotes (single note row) | **Easy** | The read-only note row (avatar, name, date, content) is extractable. The add/delete interactions are harder |
| PropertyIntelCard | **Hard** | Fires a fetch on mount. Would need a mocked API response or a separate static-data version to use in a help example |

---

## 17. Worth flagging

### 1. SolicitorIntelBadge is also a client-side lazy fetch
Article 10's discovery stated "PropertyIntelCard is the only client-side lazy-loaded element on the page." This is incorrect. `SolicitorIntelBadge` (`SolicitorSection.tsx:59–95`) also fires a `useEffect` fetch to `/api/solicitor-intel?firmId=` for each solicitor firm displayed. If both vendor and purchaser solicitors are set, there are two additional client-side fetches on the Overview tab. The article 10 claim needs correcting.

### 2. NextMilestoneWidget shows "All milestones complete" when it isn't — FIXED
~~When VM18 or PM25 is the next pending milestone, `vendorNext`/`purchaserNext` was `null`, causing the widget to show the "All milestones complete" state for that side even though milestones were outstanding. Similarly, after exchange but before completion, both sides showed "All milestones complete".~~

**Fixed in Phase 1.** The widget now uses a `MilestoneSideState` discriminated union (`"hasNext"` / `"gatePending"` / `"allComplete"`). The `"gatePending"` branch shows an amber dot and contextual copy. Widget is hidden only when both sides are genuinely `"allComplete"`.

### 3. EPC unconfigured message exposes env var names to agents — FIXED
~~`PropertyIntelCard.tsx`: if EPC env vars aren't set, the card rendered: `"Add EPC_API_EMAIL and EPC_API_KEY to .env.local to enable."` — a development instruction visible to end-user agents in production.~~

**Fixed in Phase 1.** Now renders: "EPC data is currently unavailable." in muted italic.

### 4. "Assigned to" conflates two different things
For self-managed files, "Assigned to" shows the agent who owns the file (via `agentUser?.name`). For outsourced files, it shows the SP team member assigned to the file (via `transaction.assignedUser?.name`). The field is labelled "Assigned to" in both cases, but the meaning is different:
- Self-managed: "the agent responsible for this file"
- Outsourced: "the progressor handling this file for you"

There's no disambiguation in the UI — same label, same cell, different meaning. The article should explain this distinction clearly.

### 5. `canViewAllFiles` negotiator bug — confirmed
`page.tsx:60`: `if (!isDirectorRole && transaction.agentUserId !== session.user.id) notFound()`. A negotiator granted `canViewAllFiles` can see files on All Files but gets a 404 when opening them if they don't own the file. This is a bug. The article should not describe `canViewAllFiles` as enabling full file access — negotiators with this flag can list files they don't own but cannot open them.

### 6. Risk score shows "On track" for brand-new empty files — FIXED
~~A file with no milestones confirmed, no activity, no overdue reminders, and `onTrack: "unknown"` scored 0/100, level "low", badge "On track" — misleading for a file that hasn't started.~~

**Fixed in Phase 1.** When all five signals are absent, `calculateRiskScore` returns `level: "no_data"`. The widget shows "No data yet" badge and italic copy: "Risk factors will appear as the file progresses."

### 7. Contact phone numbers link to WhatsApp, not the phone dialer — FIXED
~~`ContactsSection.tsx`: contact phone numbers used `whatsapp://send?phone=...` as the href. Clicking a phone number opened WhatsApp, not the phone dialer, inconsistent with solicitor phone links in SolicitorSection which used `tel:`.~~

**Fixed in Phase 1.** Contact phone rows now show a Phone icon + `tel:` link for the number + a separate WhatsApp icon. Clicking the number initiates a call; the WhatsApp icon opens WhatsApp.

### 8. RemindersWidget header count vs. rows shown
The widget header badge shows `totalActive` (all active reminders for the file) but only 2 reminders are displayed. A file with 8 active reminders shows "8" in the header but only 2 rows. The "View all →" link mitigates confusion, but a user who doesn't notice the "View all →" might think only 2 reminders exist. The article should explicitly note that the widget shows up to 2; the Reminders tab shows all.

### 9. Notes have no character limit
The textarea in TransactionNotes has no `maxLength` attribute. Users could paste very long content (contracts, letters) into a note field. There is no server-side length validation visible in `addNoteAction`. The article should not imply notes are intended for brief entries if there's no enforcement — but also shouldn't suggest they're suitable for long documents.

### 10. Property Intel data is postcode-level, not property-level
Land Registry price paid data is queried by postcode (and optionally PAON — Primary Addressable Object Name, i.e. the house number). A sale at "15 Birchwood Lane" may show sales from "12 Birchwood Lane" and "18 Birchwood Lane" in the same postcode area. The article should note this clearly alongside the "always verify" disclaimer already in the component.

### 11. `daysStuckOnMilestone` counts from last completion, not from file creation
If no milestone has ever been confirmed, `daysStuckOnMilestone` is `null`. The "No recent milestone" factor (low impact, 10pts) does NOT trigger when `null` — only when `>= 14 days`. So a file where nothing has ever happened scores 0 on this factor, not triggering the flag. A file that had VM1 confirmed 60 days ago and nothing since scores correctly (60 days → triggers). But a brand-new file (null) looks fine.

### 12. All five tabs' content is pre-rendered and in the DOM simultaneously
`PropertyFileTabs` renders all children and switches between them via CSS opacity (`opacity-0 ... pointer-events-none`). All five tabs are in the DOM from first load. This means the full React trees for all tabs are initialised on the Overview tab load, including client components like `MilestonePanel`, `RemindersSection`, `ManualTaskList`, `ActivityTimeline` — even when the user never visits those tabs. This is a performance consideration for very active files with many milestones, reminder logs, or activity entries.

---

## 18. Pre-existing claims from article 10 — verification

| Claim | Status | Evidence |
|---|---|---|
| Tab is server-rendered as part of the route RSC | **Confirmed** | `app/agent/transactions/[id]/page.tsx` is an async RSC; Overview content is JSX inline in that file |
| All five tabs' data is loaded eagerly | **Confirmed** | `Promise.all` at `page.tsx:49–56` loads all 6 data sources before any tab content renders |
| PropertyIntelCard is the only client-side lazy fetch | **Incorrect** | `SolicitorIntelBadge` also fires `useEffect` fetches — one per solicitor firm set (up to 2 on overview). See §17 item 1 |
| Notes are OutboundMessage records with type "internal_note" | **Confirmed** | `addNoteAction` → `createCommunicationRecord({ type: "internal_note" })` → `prisma.outboundMessage.create` |
| "Assigned to" field is read-only for agents | **Confirmed** | Pure display JSX, no edit button, no server action wired up |
| Status pill in page header is read-only; interactive control is in the meta grid | **Confirmed** | `PropertyHero` renders a static `StatusBadge` component; `StatusControl` is in the meta grid at `page.tsx:266` |
| "Last progress" comes from `getLastUpdate` | **Confirmed** | `page.tsx:54`; `lib/services/summary.ts:69–83` |
| Risk score comes from `calculateRiskScore` in `lib/services/risk.ts` | **Confirmed** | `lib/services/risk.ts:27–105`; called in `RiskScoreWidget.tsx:12` |
| The Completed gate error message now surfaces correctly | **Confirmed** | `StatusControl.tsx:80–86`: catches errors starting with "Cannot mark as completed" and passes them to `toast.error(msg)` directly |

Phase 1 fixes — confirmed applied:
- NextMilestoneWidget `"gatePending"` state: `app/agent/transactions/[id]/page.tsx` + `app/transactions/[id]/page.tsx` + `components/transaction/NextMilestoneWidget.tsx`
- RiskScoreWidget `no_data` level: `lib/services/risk.ts` + `components/transaction/RiskScoreWidget.tsx`
- EPC unconfigured copy: `components/property/PropertyIntelCard.tsx`
- Contact phone affordance: `components/contacts/ContactsSection.tsx`

Additional verified claims:
- `canViewAllFiles` does NOT grant detail page access for negotiators — confirmed at `page.tsx:60`
- Notes filtered to exclude portal-view log entries — confirmed at `page.tsx:102–108`
- SolicitorSection referral fee row read-only unless `referredFirmId && referralFee != null` — confirmed `SolicitorSection.tsx:281`

---

## 19. Page identity check

**Article name:** "The Overview tab" is the right name. "Overview tab" is how the tab label reads in the UI (defined at `page.tsx:182`). "Inside the Overview tab" would also work as an alternative framing. "The property file overview" risks confusion with article 10 ("The property file").

**Length assessment:** Article-8 territory. The Overview tab is the most content-dense tab. It has 9 sections, each with meaningful interactive elements, two role-specific behaviours, multiple empty states, and a complex layout. The article will need careful scoping to stay readable — the milestones, risk score calculation, and contacts portal flow could each fill a section on their own.

**Product gaps to flag in the article:**
1. **`canViewAllFiles` bug** (§17 item 5) — the article cannot claim negotiators with this permission can access files they don't own. Note it as a known limitation.
2. **NextMilestoneWidget exchange-gate state** (§17 item 2) — **Fixed.** The widget now correctly shows "Awaiting exchange-readiness" or "Awaiting exchange or completion" at gate milestones. No caveat needed in the article.
3. **EPC configuration dependency** (§17 item 3) — **Partially fixed.** The dev-instruction copy is gone. The article should still note that EPC data requires backend configuration; if unconfigured, the card shows "EPC data is currently unavailable." rather than data.
4. **Risk score "No data yet" for empty files** (§17 item 6) — **Fixed.** Brand-new files now correctly show "No data yet" badge. The article can accurately describe this state.
