# Inventory: Completions

**Route:** `/agent/completions`
**Stage 1 status:** Draft
**Amendments:** (see bottom of file — added if mid-flight discoveries occur in Stage 2)

---

## 1. Page identity

| Field | Value |
|---|---|
| Route | `/agent/completions` |
| File | `app/agent/completions/page.tsx` |
| Component type | Mixed — server component (page.tsx) + client components (CompletionsGroupList, CompletionFileRowView) |
| Who sees it | Director, Negotiator (all authenticated agents with agencyId) |
| How they reach it | Sidebar nav (position 8) |
| Reachable without a transaction? | Yes — renders empty state if no post-exchange files |

---

## 2. Components rendered

| Component | File | Stage 4 scope | Notes |
|---|---|---|---|
| `AgentShell` | `components/layout/AgentShell.tsx` | No changes — already matches polish | Layout wrapper |
| `PageHeader` | `components/layout/PageHeader.tsx` | No changes — already matches polish | Title, subtitle, StatPill children |
| `StatPill` | `components/layout/StatPill.tsx` | No changes — already matches polish | Anchor-link pills; uses `agent-link` class; background/border are hardcoded palette values (not CSS variables) — night-mode audit in Stage 2 |
| `CompletionsGroupList` | `components/completions/CompletionsGroupList.tsx` | Match polish page | Client component — accordion state (`collapsed`), group headers, file-card wrapper Links. Currently uses NO canonical `agent-acc` system. Stage 2 must decide: upgrade to `agent-acc` or accept as page-specific pattern. |
| `CompletionFileRowView` | `components/completions/CompletionFileRowView.tsx` | Match polish page | Renders desktop and mobile card interior. Hardcoded inline rgba colours throughout. `daysColor` is a serialised hex string computed server-side — not token-aware. |
| `ClockCountdown` | `@phosphor-icons/react/dist/ssr` | No changes | Empty state icon only |

---

## 3. Data dependencies

| Data | Source | Shape | Notes |
|---|---|---|---|
| `session` | `requireSession()` | `{ user: { id, agencyId, role, name } }` | Redirect to login if missing |
| `vis` | `resolveAgentVisibility(id, agencyId)` | `AgentVisibility` scope | Tenant isolation gate |
| `files` | `getAgentCompletions(vis)` | Array of completion file objects (see below) | Returns active transactions where exchange milestone (VM19 or PM26) is complete AND completion milestone (VM20/PM27) is NOT complete. Sorted by completionDate ASC (null last). |

**`getAgentCompletions` return shape (per file):**
- `id`, `propertyAddress`, `completionDate` (Date | null), `purchasePrice` (pence | null), `agentFeeAmount` (pence | null)
- `assignedUserName` (string | null) — from `assignedUser.name`
- `purchasers` (string[]) — contacts filtered to roleType "purchaser"
- `vendors` (string[]) — contacts filtered to roleType "vendor" — **queried but NOT displayed on this page**
- `exchangedAt` (Date | null) — from the exchange milestone completion's `completedAt`
- `vendorSolicitorName` (string | null), `purchaserSolicitorName` (string | null)

**Null / missing data:**
- `files.length === 0` → empty state card + ghost preview
- `purchasePrice` null → price span omitted from card
- `agentFeeAmount` null → fee span omitted from card; `missingFeeCount` increments
- `purchasers.length === 0` → purchaser span omitted
- `assignedUserName` null → progressor span omitted
- `exchangedAt` null → "Exchange date not recorded" fallback string
- `vendorSolicitorName` and `purchaserSolicitorName` both null → "No solicitors set" (amber warning) replaces solicitor line
- `completionDate` null → file lands in `no_date` group; "Set date →" badge renders instead of date + days
- No `error.tsx` in `app/agent/completions/` — falls through to nearest parent error boundary

---

## 4. States

### Standard states

| State | Trigger condition | What the user sees |
|---|---|---|
| **Loading** | Server fetch in progress | `loading.tsx` skeleton — 3 urgency group blocks (overdue, this week, next week) each with a pill-shaped group header skeleton and 2 file-card row skeletons. Pipeline summary skeleton line. StatPill skeletons in header. |
| **Populated** | One or more post-exchange, pre-completion files exist | StatPills in header (one per non-empty urgency group). Pipeline summary line (file count + total fees + total sales). Collapsible urgency group list (all groups start collapsed). |
| **Empty** | `files.length === 0` | `glass-card` centered with `ClockCountdown` icon, "No files awaiting completion" heading, body copy. Ghost preview below (fake file cards at 0.3 opacity). |

### Page-specific states

| State | Trigger condition | What the user sees |
|---|---|---|
| **Group collapsed** (default) | All groups start with `collapsed[key] = true` | Group header button (dot + label + file count + fee summary + caret) — no cards visible |
| **Group expanded** | User clicks group toggle | File cards expand below group header (no animation — conditional render only) |
| **No completion date** (`no_date` group) | File has `completionDate = null` | "Set date →" badge (styled span, NOT a link) replaces date + days block on card |
| **Missing solicitors** | Both `vendorSolicitorName` and `purchaserSolicitorName` null | Amber "No solicitors set" replaces the solicitor line |
| **One solicitor missing** | One of the two solicitor fields null | Solicitor line renders with "not set" (italic) for the missing one |
| **Missing fee note** | `groupFeeTotal > 0 && missingFeeCount > 0 && !isCollapsed` | "(N files with no fee set)" appears below group header when expanded |
| **Group has fees** | `groupFeeTotal > 0` | "[£X,XXX] fees" right-aligned in group header |
| **Group has value, no fees** | `groupFeeTotal === 0 && groupValue > 0` | "[£X,XXX]" right-aligned in group header (muted, no "fees" label) |

---

## 5. Interactive elements

| Element | Location | Action | Disabled when | Disabled behaviour |
|---|---|---|---|---|
| `StatPill` (anchor link) | PageHeader | `<a href="#section-{key}">` — smooth-scrolls to urgency group | Never disabled | — |
| Group toggle `<button>` | Group header | Toggles `collapsed[key]` — shows/hides file cards | Never disabled | — |
| File card `<Link>` | Each file row | Navigates to `/agent/transactions/[id]` | Never disabled | — |
| "Set date →" badge | File card (no_date group only) | Visual affordance only — NOT a link or button | — | Entire card `<Link>` wraps it, so clicking routes to transaction detail |

---

## 6. Conditional renders

```
{files.length === 0 && (
  <> <EmptyStateCard /> <GhostPreview /> </>
)}
{/* Shows: when getAgentCompletions returns [] */}
{/* Hides: when any post-exchange file exists */}

{files.length > 0 && (
  <PipelineSummaryLine />
)}
{/* Shows: when any files exist — "[N] files · [fees] · [sales]" */}
{/* Hides: empty state */}

{filesWithFee > 0 && (
  <>{" · "}<span>{fmtCompact(totalFees)}</span>{" total fees"}</>
)}
{/* Shows: when any file has agentFeeAmount set */}

{filesWithPrice > 0 && (
  <>{" · "}<span>{fmtCompact(totalValue)}</span>{" in sales"}</>
)}
{/* Shows: when any file has purchasePrice set */}

{completionGroups.length > 0 && (
  <CompletionsGroupList groups={completionGroups} />
)}
{/* Shows: when any group has files (always true when files.length > 0) */}

{/* Inside CompletionsGroupList — per group: */}
{groupFeeTotal > 0 ? (
  <p>[fee total] fees</p>
) : groupValue > 0 ? (
  <p>[value]</p>
) : null}
{/* Shows fees if any; else shows value if any; else nothing */}

{groupFeeTotal > 0 && missingFeeCount > 0 && !isCollapsed && (
  <p>(N files with no fee set)</p>
)}
{/* Shows: when expanded, group has fees, and some files are missing fee */}

{!isCollapsed && (
  <div className="space-y-2">{files.map(...)}</div>
)}
{/* Shows: file cards when group is expanded */}
{/* No animation — plain conditional render, NOT agent-acc */}

{/* Inside CompletionFileRowView: */}
{isNoDate ? (
  <span style={SET_DATE_STYLE}>Set date →</span>
) : (
  <div className="text-right">
    <p>{fmtDate(file.completionDateIso)}</p>
    {file.daysLabel && <p style={{ color: file.daysColor }}>{file.daysLabel}</p>}
  </div>
)}
{/* isNoDate = groupKey === "no_date" */}

{hasNeitherSol ? (
  <p style={{ color: "#b45309" }}>No solicitors set</p>
) : (
  <p>Vendor sol: ... · Purchaser sol: ...</p>
)}
{/* hasNeitherSol = !vendorSolicitorName && !purchaserSolicitorName */}

{file.purchasePrice && <span>{fmt(purchasePrice / 100)}</span>}
{file.agentFeeAmount && <span>Fee: {fmt(agentFeeAmount / 100)}</span>}
{file.purchasers.length > 0 && <span>Purchaser: {purchasers.join(", ")}</span>}
{file.assignedUserName && <span>Progressor: {assignedUserName}</span>}
```

---

## 7. Copy inventory

**Verbatim rule applied.** Every string as it renders in the UI.

```
# Page header
"Completions"                                          [page title]
"Files that have exchanged and are heading to         [subtitle] ← FLAG: passive; "have exchanged" is UK property
 completion."                                          jargon (acceptable), but "are heading to completion" is
                                                       wordy — voice pass candidate

# StatPills (header — only rendered for non-empty groups)
"[N] overdue"                                          [danger pill]
"[N] this week"                                        [warning pill]
"[N] next week"                                        [muted pill]
"[N] later"                                            [muted pill]
"[N] no date"                                          [muted pill]

# Pipeline summary (populated state, when files.length > 0)
"[N] files · £X,XXX total fees · £X,XXX in sales"     [dynamic — all three segments]
"[N] file · £X,XXX total fees · £X,XXX in sales"      [singular file variant]
"[N] files · £X,XXX total fees"                        [variant: no prices set]
"[N] files · £X,XXX in sales"                          [variant: no fees set]
"[N] files"                                            [variant: neither fees nor prices set]

# Group headers (per urgency group)
"Overdue ([N])"                                        [label + count]
"Completing this week ([N])"
"Completing next week ([N])"
"Later ([N])"
"No completion date set ([N])"
"£X,XXX fees"                                          [right-aligned fee total — when groupFeeTotal > 0]
"£X,XXX"                                               [right-aligned value — when no fees but has value]
"([N] files with no fee set)"                          [below group header when expanded + fee + missing]
"([N] file with no fee set)"                           [singular variant]

# File card — address and meta
"[property address]"                                   [dynamic — bold, 15px]
"£X,XXX"                                               [purchase price — optional]
"Fee: £X,XXX"                                          [agent fee — optional]
"Purchaser: [name], [name]"                            [purchaser contacts — optional]
"Progressor: [name]"                                   [assigned user — optional; only relevant for outsourced files] ← FLAG: "Progressor" is internal-staff terminology visible to agency users
"Exchanged [date] · [N] days ago"                      [e.g. "Exchanged 12 May · 14 days ago"]
"Exchanged today"                                      [exchangedAt variant]
"Exchanged yesterday"                                  [exchangedAt variant]
"Exchange date not recorded"                           [exchangedAt null fallback] ← FLAG: system-language; voice pass candidate
"Vendor sol: [firm name]"                              [desktop layout — single line]
"Vendor sol: not set"                                  [italic — missing vendor sol, desktop]
"Purchaser sol: [firm name]"                           [desktop layout — single line]
"Purchaser sol: not set"                               [italic — missing purchaser sol, desktop]
"No solicitors set"                                    [amber — both solicitors missing] ← FLAG: "solicitors" is jargon; acceptable in UK context but "No solicitor firms set" might be clearer; also note this is hardcoded #b45309, not tokenised
"Vendor sol: [firm name]"                              [mobile layout — separate line]
"Purchaser sol: [firm name]"                           [mobile layout — separate line]
"[date string]"                                        [completion date — e.g. "Mon, 12 May 2025"]
"[N] days overdue"                                     [daysLabel — overdue variant]
"today"                                                [daysLabel — completion date is today]
"tomorrow"                                             [daysLabel — completion date is tomorrow]
"in [N] days"                                          [daysLabel — future]
"Set date →"                                           [no_date group — styled badge, NOT a link] ← FLAG: misleading affordance — arrow implies action but click routes to tx detail, not a date-picker

# Empty state
"No files awaiting completion"                         [empty heading] ← FLAG: "awaiting completion" is passive; voice pass candidate
"Once a file exchanges, it'll appear here as it        [empty body]
 heads toward completion."

# Ghost (empty state only — fake content at 0.3 opacity, pointerEvents none)
"Overdue"                                              [ghost group label]
"Completing this week"                                 [ghost group label]
"14 Maple Close, Birmingham"                           [fake address] ← FLAG: real-looking fake content — matches pre-polish comms pattern; Stage 2 should align with comms precedent (abstract skeleton bars)
"8 The Crescent, Bristol"                              [fake address] ← same
"22 Victoria Road, Manchester"                         [fake address] ← same
"Smith & Smith Solicitors"                             [fake solicitor — appears for all ghost files]
"3 days overdue"                                       [fake days label]
"1 day overdue"                                        [fake days label]
"in 4 days"                                            [fake days label]
```

---

## 8. Desktop view

| Field | Value |
|---|---|
| Breakpoint | Desktop ≥ 768px (`md:` prefix throughout — `hidden md:flex` in CompletionFileRowView) |
| Layout | Single column (no aside panel). PageHeader full-width, then body content. |
| Navigation | `AgentShell` sidebar visible permanently |
| Page-specific desktop elements | StatPills in header. Pipeline summary line. Group toggle buttons (full-width). File cards with 2-column interior (info left, date right). |
| Desktop-only elements | File card uses `hidden md:flex` for desktop layout; `flex md:hidden` for mobile layout |

```
Desktop layout (≥768px):
┌─ AgentShell sidebar (fixed) ─┬─ main content (fluid) ────────────────────────────────────┐
│  logo                        │  "Completions"                                             │
│  navigation links            │  "Files that have exchanged and are heading to completion."│
│  user strip                  │  [StatPills: 1 overdue] [2 this week] [1 no date]          │
│                              ├────────────────────────────────────────────────────────────┤
│                              │  [3 files · £24,000 total fees · £1.2M in sales]           │
│                              │                                                            │
│                              │  ● OVERDUE (1)                  £8,000 fees  ▼             │
│                              │  ● COMPLETING THIS WEEK (2)    £16,000 fees  ▼             │
│                              │  ● LATER (0 — hidden if empty)                             │
│                              │  ● NO COMPLETION DATE SET (1)               ▼             │
│                              │                                                            │
│                              │  [expanded group: file cards stacked]                     │
│                              │  ┌──────────────────────────────── glass-card ───────────┐│
│                              │  │ 14 High St, Maidstone          Mon, 12 May 2025       ││
│                              │  │ £350,000 · Fee: £3,500                    in 4 days   ││
│                              │  │ Purchaser: John Smith                                 ││
│                              │  │ Exchanged 1 May · 11 days ago                        ││
│                              │  │ Vendor sol: Smith & Co · Purchaser sol: Jones LLP    ││
│                              │  └──────────────────────────────────────────────────────┘│
└──────────────────────────────┴────────────────────────────────────────────────────────────┘
```

---

## 9. Mobile view

| Field | Value |
|---|---|
| Breakpoint | Mobile < 768px |
| Layout | Single column. AgentShell sidebar collapses to top hamburger menu / drawer |
| Navigation | Hamburger trigger in topbar |
| Elements that reorder | None — no aside panel to reorder |
| Elements that become drawers/sheets | None specific to this page |
| Elements that collapse | All urgency groups start collapsed (same as desktop) |
| Mobile-specific elements | File card interior switches to `flex md:hidden` stacked layout; solicitor names become two separate lines |
| Hidden on mobile | Desktop file card interior (`hidden md:flex`) |

```
Mobile layout (375px):
┌─────────────────────────────┐
│ [☰] Completions         [·] │  ← topbar (AgentShell)
├─────────────────────────────┤
│ "Completions"               │
│ "Files that have…"          │
│ [1 overdue] [2 this week]   │  ← StatPills wrap to new line
├─────────────────────────────┤
│ 3 files · £24,000 total…    │  ← pipeline summary
│                             │
│ ● OVERDUE (1) £8,000 fees ▼ │  ← group toggle button (full width)
│                             │
│ ● COMPLETING THIS WEEK  ▼   │
│                             │
│ [expanded group:]           │
│ ┌──────── glass-card ──────┐│
│ │ 14 High St, Maidstone   ││
│ │ £350,000 · Fee: £3,500  ││
│ │ Purchaser: John Smith   ││
│ │ Exchanged 1 May · 11d   ││
│ │ Vendor sol: Smith & Co  ││
│ │ Purchaser sol: Jones    ││
│ │                 Mon 12 May 2025 ││  ← date right-aligned at bottom
│ │                    in 4 days    ││
│ └─────────────────────────┘│
└─────────────────────────────┘
```

Mobile-specific notes:
- Solicitor names split onto two separate `<p>` tags (not one combined line)
- Date block is `<div className="flex justify-end mt-1">` — bottom-right on mobile
- No swipe gestures
- No sticky footer bar

---

## 10. Animations / transitions already in place

| Element | Animation | Source |
|---|---|---|
| File card hover | `hover:shadow-md transition-shadow` (Tailwind) | `CompletionsGroupList.tsx:75` — on the `<Link>` wrapper |
| StatPill hover | `filter 150ms ease, background 150ms ease` inline | `StatPill.tsx:21` |
| Group toggle caret swap | Instant — no transition on the caret icon itself | `CompletionsGroupList.tsx:58–60` |
| Group expand/collapse | **None** — plain conditional render `{!isCollapsed && <div>}` | `CompletionsGroupList.tsx:69` |

**No canonical animations currently wired on this page.** The collapsible groups use a raw boolean conditional, not the `agent-acc` system. This is the primary animation gap.

---

## 10.5. Global animation and interaction inheritance

**Animation classes (§1–5):**

| Class | Applies to this page? | Where it fires | Status |
|---|---|---|---|
| `.agent-acc` / `.agent-acc-in` | Yes | Urgency group expand/collapse | Applied in Stage 2 — canonical pattern per ANIMATION_STANDARDS.md §1. NOT currently present in production; Stage 4 wires it. Group headers also get `agent-acc-hdr` (see below). |
| `.agent-reveal-in` / `.agent-reveal-out` | No | No inline edit forms or validation errors | Not applicable |
| `.agent-dropdown-in` | No | No dropdowns | Not applicable |
| `.agent-row-flash` | No | No milestone confirm rows | Not applicable |
| `.agent-row-exit` | No | No delete-able list rows | Not applicable |
| `.agent-btn` (press-down + hover) | Decision required | Group toggle `<button>` currently uses no canonical button class | Audit in Stage 2 — group toggle is a full-width `<button>` with `text-left`; if upgraded to `agent-acc-hdr` pattern, `agent-btn` is not needed separately |

**Interactive-state classes (§6–10):**

| Class | Applies to this page? | Where it fires | Status |
|---|---|---|---|
| `.agent-segment-pill` | No | No multi-option toggle selectors | Not applicable |
| `.agent-link` / `.agent-link-muted` | Yes — StatPill | `StatPill.tsx:16` uses `className="agent-link"` on the `<a>` element | Already present |
| `.agent-btn-ghost-bordered` | No | No bordered ghost CTAs | Not applicable |
| `.agent-acc-hdr` | Yes | Group toggle buttons | Applied in Stage 2 — canonical pattern per ANIMATION_STANDARDS.md §1. NOT currently present in production; Stage 4 wires it. |
| `.agent-icon-btn` | No | CaretDown/CaretUp icons are inside the group toggle button, not standalone circular icon buttons | Not applicable |

---

## 11. Known edge cases

- **"Set date →" is NOT a link.** The badge is a styled `<span>` inside a `<Link>` card. Clicking anywhere on the card routes to transaction detail. There is no direct date-setting action from this page. Could confuse users who expect the badge to open a date picker.
- **`vendors` queried but not displayed.** `getAgentCompletions` fetches vendor contacts by roleType, but the file card only shows `purchasers`. No vendor contact name appears on this page. Not a bug — just worth noting so Stage 4 doesn't inadvertently surface them.
- **`assignedUserName` / "Progressor" label.** Only appears for outsourced files where a sales progressor is assigned. Self-managed files will never show this. Visible to agency users but names an internal-staff role.
- **`missingFeeCount` note.** Renders only when: group is expanded AND group has a fee total AND some files in the group are missing their fee. Three conditions must all be true simultaneously — easy to miss in testing.
- **All groups start collapsed.** `CompletionsGroupList` initialises `collapsed` with all keys set to `true`. StatPill anchor links scroll to `#section-{key}` but the group is still collapsed at scroll target — the user may not realise they need to click to expand. Potential UX issue; flag for Stage 2.
- **`loading.tsx` structural mismatch.** The skeleton shows pill-wrapped group headers (`display: inline-flex; padding: 6px 14px; borderRadius: 99`). The real group header is a full-width `<button className="w-full flex items-center gap-2.5 mb-2 text-left">` — no pill background. Stage 4 must reconcile these or accept the mismatch as intentional.
- **Ghost content uses real-looking addresses.** Unlike the post-polish comms ghost (abstract skeleton bars), the completions ghost uses "14 Maple Close, Birmingham", "Smith & Smith Solicitors" etc. Stage 2 must decide whether to align with comms precedent.

---

## 12. Out of scope for redesign

- **`getAgentCompletions` query** — no data changes, no new fields
- **`urgencyFor()` bucketing logic** — date math is not touched
- **`fmtCompact()` helper** — formatting only, not touched
- **`resolveAgentVisibility()` / `requireSession()`** — auth is not touched
- **Prisma schema** — no migrations in this pass
- **`StatPill` component logic** — the component itself is not redesigned; only its theming is audited

---

## 13. Per-section visual specification

**Baseline:** Transaction-detail Stage 4 sign-off (2026-05-12) is the quality bar for animation, hover, spacing, type scale, and theme treatment.

| Section | Current production structure | Production component(s) | Current state vs target | Stage 4 changes required |
|---|---|---|---|---|
| **PageHeader** | `<PageHeader title="Completions" subtitle="…">` with `<StatPill>` children | `PageHeader`, `StatPill` | Matches canonical pattern — PageHeader is already correct | Verify subtitle voice (Stage 3 may amend); no structural change |
| **StatPill row** | `<StatPill href="#section-{key}" label="…" color="…" />` — uses `agent-link` class, inline styles for bg/border/color | `components/layout/StatPill.tsx` | Background/border use hardcoded palette values (`#fef2f2`, `#fffbeb`, `#f8fafc`, `#fecaca`, `#fde68a`, `#e2e8f0`) not CSS variables. Night-mode impact unknown. | Stage 2 audit: verify StatPill renders acceptably in all 6 themes + night mode. If hardcoded values break night-mode, tokenise. |
| **Pipeline summary line** | `<p style={{ fontSize: 13, color: "rgba(15,23,42,0.40)" }}>` with inline fontWeight spans | `page.tsx:181–191` | All colours via inline rgba. Bold numbers and muted labels are visually correct but not tokenised. | Replace `rgba(15,23,42,0.40)` with `var(--agent-text-muted)` or Tailwind `text-slate-900/40`. Replace bold spans' colour with `var(--agent-text-primary)`. |
| **Urgency group headers** | `<button className="w-full flex items-center gap-2.5 mb-2 text-left">` — contains dot (`bg-red-500` etc.), label (`text-xs font-bold uppercase tracking-[0.07em]`), fee/value text, caret icon | `CompletionsGroupList.tsx:43–62` | Plain button — no `agent-acc-hdr` or `agent-glass` wrapper. No canonical hover/focus style. | Apply `agent-glass` (overflow hidden) + `agent-acc-hdr` (role="button" tabIndex={0} onKeyDown) per comms day-group pattern: `agent-acc-title` for label, `agent-acc-summary` slot for count + fee, caret last. Urgency colour coding (dot, label text-colour, card border) must survive: preserve `s.dot`, `s.label`, `s.border` Tailwind classes inside the header. If `agent-acc-hdr` suppresses urgency colour, escalate before applying — reference RemindersSection E1 exception in ANIMATION_STANDARDS.md. |
| **Group expand/collapse** | `{!isCollapsed && <div className="space-y-2">}` — no animation | `CompletionsGroupList.tsx:69–82` | No animation at all — instant show/hide. | Replace conditional render with `agent-acc` / `agent-acc-in` / `agent-acc-body` per ANIMATION_STANDARDS.md §1, matching comms day-group. State note: comms uses `openDays` (truthy=open); completions uses `collapsed` (truthy=closed) — align to `open` semantics or verify class-append logic matches. |
| **File cards (wrapper)** | `<Link className="glass-card block px-5 py-4 border {s.border} hover:shadow-md transition-shadow">` | `CompletionsGroupList.tsx:73–79` | `glass-card` present. `hover:shadow-md transition-shadow` — basic Tailwind hover, not canonical. Border uses per-group Tailwind colour classes. | Verify hover state matches transaction-detail quality bar. Consider whether `hover:shadow-md` should be a canonical interactive glass-card pattern. |
| **File card interior — desktop** | `<div className="hidden md:flex items-start justify-between gap-4">` — info left (flex-1), date right (flex-shrink-0) | `CompletionFileRowView.tsx:73–96` | Inline rgba colours throughout. `daysColor` is a serialised hex string — not token-safe. `SET_DATE_STYLE` has `color: "rgba(15,23,42,0.45)"` inline. `#b45309` hardcoded for "No solicitors set". | Token-pass: replace all inline rgba with `var(--agent-*)` equivalents. `daysColor` for overdue/today must use `var(--agent-danger)` / `var(--agent-warning)`. `#b45309` → `var(--agent-warning)` or `text-amber-700`. |
| **File card interior — mobile** | `<div className="flex md:hidden flex-col gap-1">` — stacked, date block `<div className="flex justify-end mt-1">` | `CompletionFileRowView.tsx:99–119` | Same colour issues as desktop. Solicitor names split to two `<p>` elements. | Same token-pass as desktop. Verify solicitor lines render cleanly at 375px. |
| **Empty state card** | `<div className="glass-card" style={{ padding: "48px 24px", textAlign: "center" }}>` — icon + heading + body | `page.tsx:131–139` | `glass-card` present. All colours via inline styles (`var(--agent-text-muted)`, `var(--agent-text-primary)` — these ARE tokens). Padding inline. | Inline-style padding → Tailwind `px-6 py-12`. Verify icon opacity (0.45) matches comms and work-queue empty state pattern. Apply Stage 3 voice changes to heading/body copy. |
| **Ghost preview** | `<div style={{ opacity: 0.3, pointerEvents: "none", ... }}>` — fake file cards with hardcoded addresses and fake solicitor name | `page.tsx:142–175` | Fake real-looking content ("14 Maple Close, Birmingham", "Smith & Smith Solicitors") with hardcoded hex and rgba colors. Structurally mirrors real file cards but uses inline styles throughout. | Replace with abstract `agent-skeleton` bars per comms precedent (polish-pass standard for empty-state ghosts). Structure: `agent-glass` + `agent-acc-hdr` skeleton (group label bar + count bar) + 1–2 file-row skeletons. No fake addresses, no fake copy, no hardcoded hex. Opacity 0.3–0.4, `pointerEvents: "none"`. |
| **`loading.tsx`** | `<PageHeader>` + 3 group skeletons with pill-shaped group headers + 2 file-card-row skeletons per group + pipeline summary skeleton | `app/agent/completions/loading.tsx` | Pre-existing. Group header pill (`display: inline-flex; padding: 6px 14px; borderRadius: 99; background: rgba(0,0,0,0.04)`) does NOT match real group header structure (full-width button, no pill background). Hardcoded hex colors for group dot colors. | Token-pass: `rgba(0,0,0,0.04)` → `var(--agent-surface-overlay)`. `rgba(255,255,255,0.55)` → `var(--agent-surface-glass)` or equivalent. Decide whether to reconcile skeleton structure with real group header shape. |

---

## 14. Amendments

_(Empty until Stage 2 begins. Mid-flight discoveries are appended here with timestamp and brief description.)_

| Date | Discovery | Added to which section |
|---|---|---|
| 2026-05-17 | Stage 3 voice pass: exchange-date line on file card to be omitted when `timeSinceExchange` returns null. Replaces previous "Exchange date not recorded" fallback string. Structural change at Stage 4 — conditional render. Mirrors comms A4 (actor-line conditional). | Section 7, Section 13 (file card spec) |
| 2026-05-17 | Stage 3 voice pass approved. Five revisions applied: subtitle tightened, "Progressor" → "Handled by", "No solicitors set" → "No solicitors on file", "Set date →" → "Set date" (arrow dropped), empty-state heading → "No completions". | Section 7 |

---

## 15. Canonical contributions

**Expected at Stage 1:** This is page 8 of the polish pass. The library should be mature. New entries here need explicit justification.

**Known candidates — decision deferred to Stage 2:**

If Stage 2 upgrades the group accordion to use `agent-acc` + `agent-acc-hdr`, no new canonical classes are needed — those already exist. If Stage 2 accepts a page-specific pattern, a new scoped class may be needed (analogous to `comms-filter-bar` / `comms-filter-pill` on comms).

| Class name | file:line in `agent-system.css` | Doc entry in `ANIMATION_STANDARDS.md` | Reason |
|---|---|---|---|
| _TBD at Stage 2_ | — | — | Depends on accordion upgrade decision |

**New canonical tokens added:** None expected. If `daysColor` is tokenised, it uses existing `--agent-danger` and `--agent-warning` tokens — no new tokens needed.
