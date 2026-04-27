# My Files Page Refresh — Completion Report

## Summary

All 15 sections of the My Files agent-side page refresh have been implemented. The pass adds richer data density to the transaction table (vendor/buyer names, live exchange targets, last activity, risk factor popovers), replaces static columns with interactive sortable ones, introduces a denormalised `lastActivityAt` field backed by a proper write-path hook, and delivers a full card layout for mobile. One item — the director contextual sub-line in the page header — is deferred due to a client/server state boundary; see Findings.

---

## Changes by section

### Section 1 — Page header cleanup
**What changed:**
- Removed agency name eyebrow ("HARTWELL & PARTNERS")
- Kept H1 as "My Files" always
- Removed static user name sub-line (e.g. "Alex Morgan") for all roles

**Why:** Both pieces of information are already visible in the sidebar; repeating them under the H1 added noise without value.

**Files touched:**
- `app/agent/dashboard/page.tsx`

---

### Section 2 — Remove duplicate stat row
**What changed:**
- Removed the "5 Total · 5 Active · 0 On hold · 0 Completed" stat row that sat between the header and filter tabs

**Why:** The filter tabs immediately below show the same counts and are clickable; the stat row was pure duplication.

**Files touched:**
- `app/agent/dashboard/page.tsx`

---

### Section 3 — Filter tabs default to Active
**What changed:**
- Default filter on page load is now `active` (was `all`)
- "Active" tab links to `/agent/dashboard` (no param); other tabs use `?filter=value`
- "View all" empty state link updated to `?filter=all`
- Tab persistence is URL-driven — fresh visits always land on Active; in-session navigation preserves the last-used tab via browser history

**Why:** Daily use is "what am I working on right now" — Active is the right default.

**Files touched:**
- `app/agent/dashboard/page.tsx`

---

### Section 4 — Search + filter chips
**What changed:**
- Added three filter chips below the existing search field: **Owner** (director-only, dropdown of agent users), **Risk** (multi-select: On track / Watch / At risk), **Managed by** (All / Self-progressed / With progressor; hidden if agency has only one type)
- Chips show active state with brand colour and × clear button; "Clear all" link appears when any filter is active
- All filters combine with AND logic
- `showUserFilter` derived from `uniqueUsers.length > 1` — negotiators see only their own files so the chip auto-hides

**Files touched:**
- `components/transactions/TransactionListWithSearch.tsx` (full rewrite)

---

### Section 5 — Column overview
**What changed:** No code — confirmation pass only.

**Column order confirmed:** Property → Assigned To → Exchange Target → Status → Risk → Last active → Owner (director-only)

---

### Section 6 — Property column
**What changed:**
- Management tag ("Self-progressed" / "With progressor") moved inline with address line 1 as a small pill — no longer below
- Tag label renamed from "Self-managed" → "Self-progressed" app-wide
- Third row added: "Vendor: Tom A. · Buyer: Jane S." using first name + last initial; "not set" placeholders if missing; "Names not set" warning if both absent

**Files touched:**
- `components/transactions/TransactionTable.tsx`

---

### Section 7 — Assigned To column
**What changed:**
- "Unassigned" replaced with context-aware text:
  - Outsourced file, no progressor yet → "Awaiting assignment" (amber)
  - Self-progressed file → shows agent user name
  - Progressor assigned → name with blue avatar

**Files touched:**
- `components/transactions/TransactionTable.tsx`

---

### Section 8 — Exchange Target column
**What changed:**
- Replaced static "—" with a new `ExchangeTargetCell` client component
- Date set, future: date + "~Nw away"
- Date set, past: date in red + "Predicted date passed"
- Date not set: "Set target →" CTA + "12-wk: [date]" reference; clicking opens an inline date popover (min = today) that PATCHes `/api/transactions/[id]` and updates inline on success
- `e.preventDefault()` + `e.stopPropagation()` on all interactive elements to prevent row navigation
- PATCH route extended to accept `expectedExchangeDate`

**Files touched:**
- `components/transactions/ExchangeTargetCell.tsx` *(new)*
- `components/transactions/TransactionTable.tsx`
- `app/api/transactions/[id]/route.ts`

---

### Section 9 — Status column verification
**What changed:** No code. StatusBadge already correct and consistent across all states.

---

### Section 10 — Risk column
**What changed:**
- `RISK_CONFIG` labels updated: "Low risk" → "On track", "Medium risk" → "Watch", "High risk" → "At risk"
- Risk filter chip labels updated to match
- Created `RiskBadgeWithPopover` client component: coloured pill with dot; hover (desktop) or tap (mobile) reveals a popover showing score/100, each factor with ✓/✗, and "No flags. All checks healthy." when score is 0
- Click on pill uses `e.preventDefault()` + `e.stopPropagation()` — does not navigate
- `RiskScoreWidget` on the transaction detail page automatically gets updated labels via `RISK_CONFIG`

**Decision:** Spec proposed 4 bands (0–24 / 25–49 / 50–74 / 75–100). Existing system uses 3 bands (0–19 / 20–54 / 55–100). Ellis chose **Option A** — keep existing 3 bands and thresholds, rename labels only.

**Files touched:**
- `lib/services/risk.ts`
- `components/transactions/RiskBadgeWithPopover.tsx` *(new)*
- `components/transactions/TransactionTable.tsx`
- `components/transactions/TransactionListWithSearch.tsx`

---

### Section 11 — Last activity column
**What changed:**
- Added `lastActivityAt DateTime?` to `PropertyTransaction` schema (denormalised field)
- `touchLastActivity(transactionId)` helper added to `lib/services/activity.ts`; also called from `logActivity` so all internal notes count
- Wired into every relevant write path: `createCommunicationRecord`, `completeMilestone`, `bulkCompleteMilestones`, `createManualTask`, `updateManualTask`, `recordManualChaseAction`, status route PATCH, transaction PATCH
- `listTransactions` now reads `lastActivityAt` from the model (removed `communications` include, kept `milestoneCompletions` for `daysStuckOnMilestone`)
- Display: "Today, HH:MM" / "Yesterday" / "N days ago" (amber 7–13d, red 14–29d, red + Stale chip 30d+) / "Just added" + creation date (null)
- `agentUser` select extended to include `role`

**Database change — see below.**

**Files touched:**
- `prisma/schema.prisma`
- `lib/services/activity.ts`
- `lib/services/comms.ts`
- `lib/services/milestones.ts`
- `lib/services/manual-tasks.ts`
- `app/actions/tasks.ts`
- `app/api/transactions/status/route.ts`
- `app/api/transactions/[id]/route.ts`
- `lib/services/transactions.ts`
- `components/transactions/TransactionTable.tsx`

---

### Section 12 — Owner column
**What changed:**
- New column added as the rightmost column, director-only
- Visible when: logged-in user is a director AND no per-user filter is active (computed as `isDirector && selectedUserId === null` in `TransactionListWithSearch`)
- Shows agent user name + muted role sub-text ("Negotiator" / "Director" / "Progressor")
- `agentUser` select in `listTransactions` extended to include `role`
- `TransactionRow` type updated: `agentUser` now includes `role?: UserRole`

**Files touched:**
- `lib/services/transactions.ts`
- `components/transactions/TransactionTable.tsx`
- `components/transactions/TransactionListWithSearch.tsx`
- `app/agent/dashboard/page.tsx`

---

### Section 13 — Sort behaviour
**What changed:**
- `TransactionTable` converted to a client component (`"use client"`)
- Default sort: Exchange Target ascending; null-date rows always sink to bottom, sub-sorted alphabetically
- Sortable columns with click-to-sort + flip on second click: Property, Exchange Target, Status, Risk, Last active
- Non-sortable: Assigned To, Owner
- `SortChevron` component: invisible until header hovered; active column shows filled arrows indicating direction

**Files touched:**
- `components/transactions/TransactionTable.tsx`

---

### Section 14 — Click behaviour
**What changed:**
- Verified: entire row is a `<Link>` — fully clickable ✓
- Verified: Risk pill has `e.preventDefault()` + `e.stopPropagation()` ✓
- Verified: Set target CTA and popover have `e.stopPropagation()` ✓
- Added `active:bg-white/30` for mobile tap feedback (CSS `:active` fires on touch)

**Files touched:**
- `components/transactions/TransactionTable.tsx`

---

### Section 15 — Mobile card layout
**What changed:**
- Each transaction now renders two layouts: mobile card (`flex md:hidden`) and desktop grid row (`hidden md:grid`)
- Table header hidden on mobile (`hidden md:grid`)
- Mobile card layout: address + service tag → location → vendor/buyer → status + risk pill + last active inline → exchange target → assigned text → owner (director)
- Touch targets ≥44px via `py-4` padding
- Status filter tabs changed to `overflow-x-auto` on mobile (scrollable row)
- Filter chips already wrap via `flex-wrap` — no change needed

**Files touched:**
- `components/transactions/TransactionTable.tsx`
- `app/agent/dashboard/page.tsx`

---

## Findings flagged

### Director contextual sub-line (Section 1.d / Section 14)
Spec called for the page header to show "Viewing Alex Morgan's files · Clear filter" when a director has filtered to a specific agent. Not implemented. The filter state (`selectedUserId`) lives in `TransactionListWithSearch` (client component) and cannot be read by the server-rendered page header in `app/agent/dashboard/page.tsx` without either: (a) lifting the filter to URL params (`?owner=userId`), or (b) making the header a client component. The equivalent action — "Clear all" — is already available in the filter chip row. Recommended fix if wanted: move the "Assigned to" filter to a URL param so the server page can read it.

### Risk band thresholds (Section 10)
Spec proposed 4 bands (0–24 / 25–49 / 50–74 / 75–100). Existing system uses 3 bands. Ellis confirmed Option A: keep 3 bands, rename labels only. Scoring thresholds unchanged.

### `prisma generate` pending
The `lastActivityAt` field has been added to `schema.prisma` and all write paths. A `typeof tx & { lastActivityAt: Date | null }` cast is in place in `lib/services/transactions.ts` to satisfy TypeScript before the client is regenerated. After running the migration SQL and `npx prisma generate`, the cast can be removed.

---

## Database changes

**Must be applied manually via Supabase SQL Editor. Do NOT run `prisma migrate deploy`.**

**Step 1 — Migration (run first):**
```sql
ALTER TABLE "PropertyTransaction" ADD COLUMN "lastActivityAt" TIMESTAMP(3);
```

**Step 2 — Backfill (run after migration):**
```sql
UPDATE "PropertyTransaction" pt
SET "lastActivityAt" = GREATEST(
  (SELECT MAX("createdAt") FROM "CommunicationRecord" WHERE "transactionId" = pt.id),
  (SELECT MAX("completedAt") FROM "MilestoneCompletion" WHERE "transactionId" = pt.id AND "isActive" = true),
  (SELECT MAX("updatedAt") FROM "ManualTask" WHERE "transactionId" = pt.id AND "transactionId" IS NOT NULL)
);
```

**Step 3 — After both SQL steps:**
```bash
npx prisma generate
```

---

## New dependencies

None.

---

## Breaking changes

- `TransactionTable` is now a client component. Any server component that was importing it and relying on server-only behaviour should be reviewed — in practice none do; all consumers are already client components or leaf nodes.
- `RISK_CONFIG` labels changed from "Low/Medium/High risk" to "On track/Watch/At risk". Anywhere else in the app that renders `cfg.label` directly will show the new labels. Confirmed affected: `RiskScoreWidget` on the transaction detail page — updated labels are correct and intentional there.
- `listTransactions` no longer includes `communications` in the query — any consumer that was accessing `communications` on the returned rows will break. Current consumers only access the `health` object and spread `...rest`; the `communications` key was explicitly destructured out before the spread, so no consumer ever received it.

---

## Files touched (full list)

**Modified:**
- `app/actions/tasks.ts`
- `app/agent/dashboard/page.tsx`
- `app/api/transactions/[id]/route.ts`
- `app/api/transactions/status/route.ts`
- `components/transactions/TransactionListWithSearch.tsx`
- `components/transactions/TransactionTable.tsx`
- `lib/services/activity.ts`
- `lib/services/comms.ts`
- `lib/services/manual-tasks.ts`
- `lib/services/milestones.ts`
- `lib/services/risk.ts`
- `lib/services/transactions.ts`
- `prisma/schema.prisma`

**New:**
- `components/transactions/ExchangeTargetCell.tsx`
- `components/transactions/RiskBadgeWithPopover.tsx`
- `MY_FILES_REFRESH_REPORT.md` (this file)
