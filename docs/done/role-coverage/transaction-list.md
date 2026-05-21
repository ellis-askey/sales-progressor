# Role-Coverage Inventory: /agent/transactions (list)

**Date:** 2026-05-18  
**Status:** Stage 1 — Pending Ellis review  
**Files:** `app/agent/transactions/page.tsx`, `components/transactions/TransactionListWithSearch.tsx`, `components/transactions/TransactionTable.tsx`, `components/transactions/TransactionRowView.tsx`, `lib/services/transactions.ts`

---

## Section 0: Data layer

**Clean. No Category C work needed.**

`listTransactions` accepts a `scope?: AccessScope` parameter:
- Admin: `scopeTransactionWhere(scope)` → `{}` → all non-draft transactions platform-wide.
- SP: `scopeTransactionWhere(scope)` → `{ assignedUserId }` → only their assigned files.
- Agent callers: unchanged (agencyId/agentId branches).

`countTransactionsByStatus` and `getExchangeForecast` use the same `scope` branching.
`getHubFilteredIds`/`getMonthExchangingIds` use `vis` resolved via `resolveInternalVisibility` — correct for both admin and SP.

`agency.name` is already fetched in the `include` clause of `listTransactions` for all callers (line 34: `agency: { select: { id: true, name: true } }`). The `TransactionRow` type already carries `agency?: { id: string; name: string } | null`. The agency column infrastructure is fully built.

---

## Section 1: Current state per role

### Director — current state

| Section | What renders | Correct? |
|---|---|---|
| Page title | "All Files" | ✓ |
| Subtitle | "Every file across the agency." | ✓ |
| "New sale" button | Shown | ✓ |
| Flag button | Shown | ✓ |
| Search bar | Address search | ✓ |
| Owner chip | Shown when ≥1 unique agent in view (`isDirector` path) | ✓ |
| Risk chip | Always shown | ✓ |
| Activity chip | Always shown | ✓ |
| Managed-by chip | Shown when ≥1 file in view (`isDirector` path) | ✓ |
| Managed-by chip labels | "Managed by you" / "Our team is handling" | ✓ (agent-centric, correct) |
| Status tabs | All / Active / On hold / Completed / Withdrawn | ✓ |
| Forecast strip | Shown (agency-scoped) | ✓ |
| Agency column | **Hidden** | ✓ (inside own agency) |
| Assigned-to column | Shown | ✓ |
| Row: serviceTag | "You" (self-managed) / "Our team" (outsourced) | ✓ |
| Row: Assigned text | SP name / agent name / "Awaiting assignment" | ✓ |
| Empty state | "Create your first sale" + "New sale" CTA | ✓ |

All sections correct for director.

---

### Negotiator — current state

| Section | What renders | Correct? |
|---|---|---|
| Page title | "My Files" | ✓ |
| Subtitle | "Files assigned to you." | ✓ |
| "New sale" button | Shown | ✓ |
| Flag button | Shown | ✓ |
| Owner chip | **Hidden** (uniqueUsers.length = 1 since negotiator only sees own files) | ✓ |
| Managed-by chip | Shown only if both service types present | ✓ (correct for negotiator) |
| Agency column | Hidden | ✓ |
| Assigned-to column | **Hidden** (`showAssignedToColumn = false` for negotiator) | ✓ |
| Empty state | "Create your first sale" + "New sale" CTA | ✓ |

All sections correct for negotiator.

---

### sales_progressor — current state

Data: `scope.kind = "assigned"` → only transactions where `assignedUserId = SP user`. All SP-assigned files are `serviceType = "outsourced"` by definition (the business model).

| Section | What renders | Correct? |
|---|---|---|
| Page title | "My Files" | Marginal — "Assigned Files" would be precise; "My Files" is defensible |
| Subtitle | "Files assigned to you." | ✓ |
| "New sale" button | **Hidden** | ✓ |
| Flag button | **Hidden** | ✓ |
| Owner chip | Shows if multiple agents across assigned files (non-isDirector path: `uniqueUsers > 1`) | Mostly correct — SP can be assigned to files from multiple agents |
| Managed-by chip | **Hidden** (all SP files are `outsourced` → `transactions.some(t => t.serviceType === "self_managed")` is always false) | ✓ (correct result, wrong path) |
| Agency column | **Shown** (`showAgencyColumn = isInternalStaff = true`) | ✓ |
| Assigned-to column | **Hidden** (`showAssignedToColumn = false` for SP) | ✓ |
| Row: serviceTag | **"Our team"** on every row — SP's own files all say "Our team" | **WRONG** — SP is the team; tag is noise |
| Row: mobile "Assigned" | SP's own name — "Assigned: [SP name]" on every row | Redundant — SP is always the assignee |
| Row: mobile agency | **Not shown** (mobile card doesn't render the agency column) | **GAP** — SP needs agency context on mobile too |
| Empty state | "Create your first sale" + "New sale" CTA | **WRONG** — SP can't create sales; wrong empty state entirely |

**Three problems:** serviceTag noise, wrong empty state, mobile agency gap (logged as follow-up, not fixed inline).

---

### admin — current state

Data: `scope.kind = "all"` → `{}` → all non-draft transactions platform-wide.

| Section | What renders | Correct? |
|---|---|---|
| Page title | "All Files" | ✓ |
| Subtitle | "Every file across the platform." | ✓ |
| "New sale" button | Shown | ✓ (admin can create sales) |
| Flag button | **Hidden** | ✓ |
| Owner chip | Shown when `uniqueUsers > 1` (non-isDirector path) — in practice always shown platform-wide | Functionally correct; wrong path (see note below) |
| Managed-by chip | Shown when both types present (non-isDirector path) — in practice always shown platform-wide | Functionally correct; wrong path |
| Managed-by chip labels | "Managed by you" / "Our team is handling" | **WRONG** — "you" = admin, who doesn't manage files |
| Agency column | **Shown** | ✓ |
| Assigned-to column | **Shown** | ✓ (shows SP name for outsourced, agent name for self-managed) |
| Row: serviceTag | "You" (self-managed) / "Our team" (outsourced) | **WRONG** — "You" on a self-managed file is meaningless for admin |
| Row: mobile agency | Not shown (mobile card doesn't render the agency column) | **GAP** — admin needs agency context on mobile too |
| Empty state | "Create your first sale" + "New sale" CTA | Acceptable (admin can create; platform will never be truly empty post-launch) |

**Note on isDirector path:** `showManagedByFilter` and `showUserFilter` both branch on `isDirector`. Admin is not a director, so uses the `> 1 files` / `both types exist` guard. In practice the platform always has both, so the chips render. This is a semantic mismatch, not a visible bug. Low priority.

**Two visible problems:** Managed-by chip labels, serviceTag copy.

---

## Section 2: /not-our-files fold audit

`app/not-our-files/page.tsx` contains:
```ts
import { redirect } from "next/navigation";
export default function NotOurFilesPage() {
  redirect("/agent/transactions");
}
```

**The fold is already complete.** The route is a redirect with no UI, no data, no features. There is no feature gap to analyse. No WS4 task required — it was done when the route was replaced with a redirect.

---

## Section 3: Target state per role

### Director / Negotiator — no change

Zero adaptation required.

### sales_progressor — target

| Problem | Current | Target |
|---|---|---|
| serviceTag | "Our team" on every row | **Hidden** — all SP files are outsourced; tag is redundant noise |
| Empty state | "Create your first sale" + "New sale" CTA | "No files assigned yet." / "Files assigned to you will appear here." — no CTA |

### admin — target

| Problem | Current | Target |
|---|---|---|
| Managed-by chip labels | "Managed by you" / "Our team is handling" | "Self-managed" / "Outsourced to us" |
| serviceTag | "You" / "Our team" | "Self-managed" / "Outsourced" (relabelled, not hidden) |

---

## Section 4: Adaptation plan

| # | Item | Category | Role(s) | File |
|---|---|---|---|---|
| 1 | Hide serviceTag for SP | A — Hide/show | SP | `TransactionRowView.tsx` |
| 2 | Relabel serviceTag for admin | B — Copy | Admin | `TransactionRowView.tsx` |
| 3 | Relabel ManagedByChip for admin | B — Copy | Admin | `TransactionListWithSearch.tsx` |
| 4 | SP empty state — new copy, hide "New sale" CTA | A+B — Both | SP | `app/agent/transactions/page.tsx` |

**Total: 4 items. No Category C items.**

---

## Section 5: Open questions for Ellis

**OQ-1 — serviceTag relabel for admin (item 2)**

Current tag says "You" (self-managed) or "Our team" (outsourced). For admin, options:

- **Option A:** Relabel to "Self-managed" / "Outsourced" — neutral platform language.
- **Option B:** Hide entirely for admin — admin has the Agency column and the Managed-by chip; the per-row tag adds noise.
- **Option C:** Leave as-is — admin understands the context.

Recommend **Option A** (relabel). The tag is a quick visual signal; "Self-managed"/"Outsourced" is accurate and scannable.

**OQ-2 — SP serviceTag (item 1)**

All SP-assigned files are outsourced. Every row shows "Our team". Does Ellis want the tag hidden for SP (my recommendation — it's noise), or relabelled (e.g. "Assigned to you")?

**OQ-3 — SP mobile agency**

Mobile card doesn't show the agency column. SP on mobile sees no agency context. Options:
- Add agency name as a sub-line below the address in the mobile card (for `showAgencyColumn` callers).
- Accept the gap — SP on mobile is not a primary use case.

This is a separate concern from the 4-item pass. Log as follow-up or fix?

---

## Section 6: Bugs found during walk (to follow-ups, not fixed inline)

**FU-15 — Mobile card has no agency row for SP/admin**

`TransactionRowView` mobile card renders address, verb chip, status/risk badges, exchange date, and assigned text. No agency name. SP and admin on mobile lose agency context. The agency column is desktop-only. Low severity (mobile is secondary for internal staff) but a real gap. Fix: add a small agency name row to the mobile card when `showAgencyColumn = true`.

**FU-16 — `showManagedByFilter`/`showUserFilter` use negotiator path for admin**

`isDirector = false` for admin → chips use the `> 1` guard rather than the `> 0` guard. In practice the platform always has files from multiple agents and both service types, so the chips always appear for admin. Only fails on a near-empty platform. Fix: treat admin the same as director in these guards (pass `isAdminRole` or replace `isDirector` with `showFiltersWhenAnyExist` flag).

---

## Section 7: Implementation order

One pass, one atomic commit:

1. `components/transactions/TransactionRowView.tsx`:
   - Add `isInternalVariant?: boolean` prop (passed when `showAgencyColumn = true`)
   - serviceTag: hide entirely for SP → add `isProgressor?: boolean` prop, or derive from `showAgencyColumn && !showAssignedToColumn` (proxy: SP is the only role with both agency shown AND assigned-to hidden)
   - serviceTag relabel for admin: "You" → "Self-managed", "Our team" → "Outsourced"

   Actual cleanest approach: `serviceType` + two booleans. Pass `showServiceTag` and `serviceTagVariant: "agent" | "admin" | "sp"` from `TransactionTable` → `TransactionRowView`. Or simpler: pass `showServiceTag: boolean` + `serviceTagLabels: { selfManaged: string; outsourced: string } | null`.

   Simpler still: already have `showAgencyColumn` and `showAssignedToColumn` in both `TransactionTable` and `TransactionRowView`. Derive:
   - SP: `showAgencyColumn && !showAssignedToColumn` → hide tag entirely
   - Admin: `showAgencyColumn && showAssignedToColumn` → relabel to "Self-managed"/"Outsourced"
   - Agent: `!showAgencyColumn` → keep current labels
   
   No new prop needed — reuse the two existing booleans.

2. `components/transactions/TransactionListWithSearch.tsx`:
   - `ManagedByChip`: add `variant?: "agent" | "admin"` prop
   - Admin path: labels `{ value: "self_managed", label: "Self-managed" }`, `{ value: "outsourced", label: "Outsourced to us" }`, chip label "Managed by" unchanged (or "Service type")
   - Pass `managedByVariant={showAgencyColumn && showAssignedToColumn ? "admin" : "agent"}` at call site

3. `app/agent/transactions/page.tsx`:
   - Derive `const isProgressor = session.user.role === "sales_progressor"`
   - SP empty state: separate branch inside the `allTransactions.length === 0` block — role-conditional title/description, no "New sale" link

4. `tsc --noEmit`, commit: `feat(role-coverage): /agent/transactions list — SP + admin views`

---

## Section 8: Open questions resolved inline (inventory-time decisions)

- **Agency column**: Already implemented. `showAgencyColumn = isInternalStaff` already in page.tsx; column already in `TransactionTable` + `TransactionRowView` grid. Zero work.
- **Service type filter chip for admin**: `ManagedByChip` already exists and already shows for admin in practice (both service types exist on platform). Only issue is labels — Category B only.
- **`/not-our-files` fold**: Already done (redirect). No WS4 task needed.
