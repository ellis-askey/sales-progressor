# Reminders Page Refresh — Completion Report

## Summary

Full UX refresh of the agent-side Reminders page (`/agent/work-queue`). Changes cover the page header, filter bar, file alert banner, visual urgency, card structure, file-grouping, expanded details, empty states, snoozed view, and mobile layout. No business logic, snooze logic, chase logic, or the chase drawer was touched.

---

## Changes by section

### Section 1 — Page header cleanup + summary stat row

**What changed:**
- Removed agency name eyebrow line (`{session.user.firmName ?? "Agent Portal"}`) — redundant with sidebar
- Added stat row beneath subtitle showing live counts of overdue / due today / coming up reminders
- Each segment is a coloured anchor link scrolling to its corresponding section (`#section-overdue`, `#section-due_today`, `#section-upcoming`)
- Segments with a zero count are omitted; row is hidden entirely when all counts are zero
- Stat counts exclude snoozed logs and use the same `classifyActive` logic (including business-day calc) as the list, duplicated as `classifyForStats` in the server component
- Removed the "Milestone Reminders" `<h2>` section subheading — redundant with page title

**Why:** Eyebrow duplicated the sidebar. Stat row gives instant triage (how bad is today?) without scrolling. Subheading was visual noise on a page that's already named "Reminders".

**Files touched:**
- `app/agent/work-queue/page.tsx`

---

### Section 2 — Subheading rewording

**What changed:**
- Subtitle changed from "Chases and files that need your attention." → "What needs chasing, today and ahead."

**Why:** Shorter, more active framing. Focuses on what to do, not what the page is.

**Files touched:**
- `app/agent/work-queue/page.tsx`

---

### Section 3 — File alert banner upgrade

**What changed:**
- Restructured each alert row: address is now a standalone `<Link>` (general file nav), no longer wrapping the whole row
- Added a primary action button on the right of each row (e.g. "Add purchaser solicitor →", "Add vendor solicitor →", "Update exchange date →")
- Action buttons deep-link to `/agent/transactions/[id]?focus=[field]` (e.g. `?focus=purchaser-solicitor`)
- `getPrimaryAlert` selects the most actionable alert per file when multiple alerts exist (missing solicitor prioritised over exchange overdue, overdue over stale)
- Hover state on the row preserved via `hover:bg-white/20` on the container div

**Alert types audited — complete list currently implemented:**
1. `overdue_exchange` — exchange date is past and exchange milestone not yet completed
2. `missing_vendor_solicitor` — `vendorSolicitorFirmId` is null
3. `missing_purchaser_solicitor` — `purchaserSolicitorFirmId` is null
4. `stale` — no milestone completions in 14+ days (with 3-day grace on new files)

No new alert types were added.

**Focus behaviour on transaction page:** The `?focus=` URL parameter is written and navigates to the file page, but the file page does not yet read/respond to this parameter. Implementing focus/highlight on the transaction page was flagged in the spec as out-of-scope if it required more than a small addition to the file page. The link navigates correctly; the focus animation is deferred.

**Why:** Deep-links save the agent from hunting for the missing field. The action button names the exact next step.

**Files touched:**
- `components/reminders/FileAlertsStrip.tsx`

---

### Section 4 — Filter bar: rename "Due" → "Active", make sticky

**What changed:**
- `statusFilter` state type changed from `"due" | "snoozed"` to `"active" | "snoozed"`; all references updated
- Filter chip label "Due" → "Active"
- Filter bar container given `position: sticky; top: 0; z-index: 20` with a `rgba(255,245,236,0.93)` background and `backdropFilter: blur(16px)` so scrolling content doesn't bleed through
- Subtle `0.5px solid rgba(255,200,160,0.28)` bottom border always visible (serves as scrolled-content indicator)
- `flex-wrap: wrap` on the chip row so "Active / Snoozed" wraps below "All / Seller / Buyer" on very narrow screens

**Why:** "Due" was ambiguous on a page about things being due. "Active" vs "Snoozed" is the cleaner mental model. Sticky filter stops the agent from scrolling back up to change context.

**Files touched:**
- `components/reminders/AgentRemindersList.tsx`

---

### Section 5 — Visual urgency: left-border colour stripes

**What changed:**
- Each active reminder card now has a 4px `border-left` colour applied via inline style
- Colour mapping:
  - Escalated: `#dc2626` (red-600)
  - Overdue: `#ea580c` (orange-600, matches existing overdue text colour)
  - Due today: `#d97706` (amber-600, matches existing due-today text colour)
  - Coming up: `rgba(148,163,184,0.35)` (slate — very subtle, doesn't compete)
  - Snoozed: `rgba(168,85,247,0.5)` (purple tint, matches existing purple snoozed styling)
- `glass-card` previous `border border-orange-200` etc. removed — left-border replaces as the urgency signal; the glass gradient border continues on the other three sides
- Grouped file cards (section 7) apply the same colour to the outer container; inner rows do not repeat it

**Why:** Instant eye-triage without colour overload. Keeps the aesthetic calm — no neon.

**Files touched:**
- `components/reminders/ReminderCard.tsx`
- `components/reminders/AgentRemindersList.tsx` (GROUP_LEFT_BORDER for grouped cards)

---

### Section 6 — Card structure rebuild

**What changed:**

**Confirm button promoted to primary:**
- New `[Confirm]` button added as leftmost action — green styling using `--agent-success-bg / --agent-success / --agent-success-border` tokens
- Uses a `CheckCircle` (fill) icon from `@phosphor-icons/react`
- Calls `onComplete(openTask.id)` — same action as the former "Milestone confirmed ✓" menu item
- "Milestone confirmed ✓" removed from `KebabMenu`

**KebabMenu now contains:**
- Chased manually (unchanged)
- ↑ Escalate (unchanged)
- "Milestone confirmed ✓" removed

**Snooze button:**
- Replaced text-only trigger with `reminder-action-btn reminder-snooze-btn` styled button with `Clock` icon + "Snooze" label
- Dropdown continues to open upward (`bottom-full mb-1`) as previously set

**Show / Hide details toggle:**
- Was: `"+ More"` / `"− Less"` text buttons
- Now: `<CaretDown /> Show details` / `<CaretUp /> Hide details` using Phosphor icons (10px, bold weight) — inline with the text, no separate icon import needed beyond the icons already brought in

**`hasMoreDetails` logic:**
- Previously: only showed expand toggle if specific fields existed
- Now: shows toggle whenever `openTask` exists (always useful content in expanded panel)

**Mobile icon-only buttons:**
- On `≤767px`, `.reminder-btn-label` is `display: none` and `.reminder-action-btn` gets `min-width/min-height: 40px` and `justify-content: center`
- Affects "Confirm" and "Snooze" buttons
- `ChaseButton` renders its own trigger button (which says "Chase") — that label remains visible on mobile because the chase drawer is not touched; noted below in findings

**Why:** "Confirm" is the highest-value action and should be one tap, not buried in a menu. Icon-only on mobile gives 44px-class touch targets without the buttons overflowing the card.

**Files touched:**
- `components/reminders/ReminderCard.tsx`
- `app/globals.css`

---

### Section 7 — Group reminders by file

**What changed:**
- `groupByFile(logs)` function in `AgentRemindersList` groups reminder logs by `transaction.id` within each urgency section, preserving sort order (most-urgent first by insertion order, since logs are pre-sorted)
- Files with 1 reminder: render `<ReminderCard>` as before (with `showAddressLink`)
- Files with 2+ reminders in the same section: render `<GroupedFileCard>` — a shared address header + multiple inner `<ReminderCard grouped={true}>` rows separated by subtle dividers
- `GroupedFileCard` applies the section's left-border colour to the outer container
- Inner `ReminderCard` instances with `grouped={true}`: no glass-card wrapper, no left border, no address link, status bar radius is `0` (inherits parent's rounded corners)
- Address header shows file address as a `<Link>` to the transaction, plus a muted "[N] reminders" count chip
- Grouping is per-section only (one file with an overdue + a due-today reminder appears in both sections, not grouped across them)
- "Other active reminders on this file" line in the expanded panel is hidden for grouped cards (the group already makes this visible)

**Why:** Reduces visual clutter when one file has several open reminders. Agents can triage a file as a unit rather than hunting for cards by address.

**Files touched:**
- `components/reminders/AgentRemindersList.tsx`
- `components/reminders/ReminderCard.tsx` (`grouped` prop)

---

### Section 8 — Reframe expanded content

**What changed:**

Old expanded content:
- "Triggered by: [anchor milestone] on [date]"
- "Grace period: N days"

New expanded content (in order):
1. **Last contact** — "Last contact: via [method], [time ago]" derived from the most recent outbound communication across all chase tasks for the transaction. If none: "No contact logged on this file yet."
2. **Chase count** — "Not yet chased" or "Chased N× already"
3. **Other active reminders** — "[N] other reminder(s) active on this file" — only shown for non-grouped cards (grouped cards already surface this visually). Count derived from `totalActiveOnFile` pre-computed across `nonSnoozedLogs`.
4. **Reminder rule** — "Reminder rule: Chase after [anchor milestone name] ([N]d grace)" — shown when `description` is absent but `anchorMilestone` exists. When `description` is present, it's already shown in the card body above the expand toggle.

**Data availability findings:**
- `CommunicationRecord` table exists with `createdAt` and `method` fields ✅
- Last comm per chase task already queried (`take: 1, where: { type: "outbound" }`) ✅
- `chaseCount` stored directly on `ChaseTask` ✅
- "Other active reminders" derived client-side from the `nonSnoozedLogs` array (pre-computed in `AgentRemindersList` as `activeCountByTx`) ✅
- **Contact role on comm record**: `CommunicationRecord.contactIds` is a String array (not a join to Contact), so contact role is not directly available from the comm record without a separate query. Format simplified to "Last contact: via [method], [time ago]" rather than "to [contact role]". Flagged below.

**Why:** "Triggered by / Grace period" is system internals. "Last contact" and "Chased N×" is what an agent actually needs before deciding to chase again.

**Files touched:**
- `components/reminders/ReminderCard.tsx`
- `components/reminders/AgentRemindersList.tsx`

---

### Section 9 — Empty state rewording

**What changed:**
- Full empty state (zero logs): heading "All chase tasks clear" → **"All caught up"**; subtitle "No milestone reminders due right now." → **"No reminders due right now. We'll surface them here as files progress."**; green CheckCircle icon retained
- Filtered empty state (Seller/Buyer filter with no results): "No reminders for [Seller/Buyer] right now." — makes clear it's a filter result, not a system-wide empty
- Filter + search empty: "No reminders match the current filter."
- Snoozed tab empty: "No snoozed reminders." — short, no green tick, no celebratory tone

**Why:** "Chase tasks" is internal language. "All caught up" is the right emotional register. Filtered empties distinguish filter state from truly empty pipeline.

**Files touched:**
- `components/reminders/AgentRemindersList.tsx`

---

### Section 10 — Snoozed view confirmation

**What changed:**
- Sort order: already correct — `getAgentReminderLogs` orders by `nextDueDate: "asc"`, and `snoozeReminderLog` sets `nextDueDate = snoozedUntil` (expiry), so snoozed cards sort by wake-up date ascending ✅
- Snooze end date display: "Snoozed until [date]" → **"Wakes [date]"** — active voice, tells the agent when it comes back
- Wake button: "Wake up →" → **"Wake now"** — consistent with the action, no arrow decoration
- Confirm and Chase not available on snoozed cards: already the case — snoozed mode renders only the snooze-end header and "Wake now"; no action buttons ✅
- Snoozed card gets purple left-border (`rgba(168,85,247,0.5)`) matching existing purple-toned styling

**Why:** "Wakes" vs "Snoozed until" tells the agent what will happen, not what has happened. "Wake now" is clearer than "Wake up →".

**Files touched:**
- `components/reminders/ReminderCard.tsx`

---

### Section 11 — Final mobile pass

**What changed:**
- Added `reminders-page-pad` class (16px horizontal padding on mobile) in globals.css — available for future use if the outer `px-8 py-7` is refactored
- Reminder action button mobile styles: `.reminder-btn-label { display: none }`, `.reminder-action-btn { min-width/height: 40px, padding: 8px, justify-content: center }` — applies to Confirm and Snooze buttons
- Filter bar `flex-wrap: wrap` on the chip row — Active/Snoozed wraps below All/Seller/Buyer on very narrow screens
- Sticky filter bar uses `background: rgba(255,245,236,0.93)` which matches the warm page background on mobile (the mobile header is `rgba(255,245,236,0.92)`)
- Grouped file card address header uses `overflow: hidden; textOverflow: ellipsis; whiteSpace: nowrap` — truncates on narrow screens
- Snoozed "Wakes [date]" is a single line in a small header bar — fits at 375px without wrap

**Known gap — Chase button on mobile:** `ChaseButton` renders its own `<button>Chase</button>` internally. Since the chase drawer must not be touched, the "Chase" text label remains visible on mobile. At 375px, the four-button row (Confirm icon, Chase text, Snooze icon, ⋯) is compact but fits within a standard card width. Logged below as an out-of-scope item.

**Files touched:**
- `app/globals.css`

---

## Findings flagged

### Data availability findings
- **Last contact via [method]** ✅ implemented — method and timestamp available via `CommunicationRecord`
- **Contact role on last comm** ⚠️ not implemented — `CommunicationRecord.contactIds` is a raw String array (not joined to Contact). The "to [contact role]" part of the spec was simplified to "via [method]". To implement properly, the `getAgentReminderLogs` query would need to join through `contactIds` to the Contact table — a non-trivial Prisma raw query. Deferred.
- **Chase count** ✅ implemented — `ChaseTask.chaseCount` is stored directly
- **Other active reminders count** ✅ implemented — derived client-side from `nonSnoozedLogs` grouped by transactionId
- **Reminder rule human-readable text** — partially implemented: shows `anchorMilestone.name` + graceDays when no `description` exists. Full human-readable derivation (e.g. "Chase 2 days after MOS sent if not received") would require parsing the rule fields more deeply; flagged for future.

### Out-of-scope items found
- **`?focus=` handler on transaction page** — The deep-link URL param is written, but the `/agent/transactions/[id]` page does not scroll-to or highlight the referenced section. Implementing requires adding section IDs and a `useSearchParams` + smooth-scroll handler to the transaction page. Deferred.
- **Chase button icon-only on mobile** — `ChaseButton` renders its own trigger and must not be modified (chase drawer is working well). At 375px the mixed icon/text button row is tight but functional.
- **Manual chase distinction (auto vs manual)** — The spec requested "Chased 3× already (2 manual, 1 auto)". The `chaseCount` field is a single integer with no method breakdown. Auto-chase increments happen via `createCommunicationRecord` with `type: "outbound"` and a `chaseTaskId`; manual chase also increments the same counter. Distinguishing would require a schema change (e.g. `manualChaseCount` field). Not implemented; simplified to "Chased N× already".

---

## Database changes
None. No Prisma schema changes required.

---

## New dependencies
None. `CheckCircle`, `Clock`, `CaretDown`, `CaretUp` are all from `@phosphor-icons/react`, already installed.

---

## Breaking changes
- **`statusFilter` state** in `AgentRemindersList` was `"due" | "snoozed"` — now `"active" | "snoozed"`. Any code passing a default prop of `"due"` would break, but `AgentRemindersList` has no external props for this — it's internal state only. No breaking change to external callers.
- **`KebabMenu` no longer has `onComplete` prop** — removed since "Milestone confirmed" is now a primary button. Any component calling `KebabMenu` directly would need updating, but `KebabMenu` is a private function inside `ReminderCard.tsx`.

---

## Files touched (full list)
- `app/agent/work-queue/page.tsx`
- `components/reminders/AgentRemindersList.tsx`
- `components/reminders/ReminderCard.tsx`
- `components/reminders/FileAlertsStrip.tsx`
- `app/globals.css`
- `app/actions/transactions.ts` (TypeScript fix: `null` → `undefined` for `assignedUserId`)
- `REMINDERS_REFRESH_REPORT.md` (this file)
