# Inventory: Comms (Updates)

**Route:** `/agent/comms`
**Date:** 2026-05-17
**Stage 1 status:** Draft — awaiting Ellis approval
**Amendments:** (empty — populated if mid-flight discoveries occur in Stage 2)

---

## CRITICAL FINDING — Entry Type Reality

Before the inventory: the page is named "Updates" and was historically titled "Comms". **The current feed renders exactly one entry type: a completed `MilestoneCompletion` record** (`state: "complete"`), with two visual variants:

1. **Agent-confirmed** (`confirmedByPortal: false`) — emerald icon
2. **Portal-confirmed** (`confirmedByPortal: true`) — violet icon + "Client confirmed" badge

Not present in any form:
- Milestone undone / cascade undo
- Milestone skipped (N/R)
- Status changes (on-hold, withdrawn, completed, reactivated)
- Chase sends (email / SMS / WhatsApp)
- Portal activity beyond the `confirmedByPortal` flag
- Document uploads
- Assignment changes
- `CommunicationRecord` entries (D1 fix writes internal notes to that model — not surfaced here)

This scopes Section 7 down substantially. Adding other entry types is feature scope, not polish scope — see Section 12.

---

## Section 1 — Page Identity

| Field | Value |
|---|---|
| Page name (displayed) | Updates |
| Route | `/agent/comms` |
| File | `app/agent/comms/page.tsx` |
| Shell | `AgentShell` (inherited from `app/agent/layout.tsx`) |
| Render type | Server component (async) |
| Auth gate | `requireSession()` — redirects unauthenticated users |
| Complexity (PAGE_LIST.md) | Medium |
| Mobile complexity | Medium-Large |
| Stage status | Stage 1 — Inventory |
| Position in PAGE_LIST | 7 |

---

## Section 2 — Components Rendered

| Component | File | Stage 4 scope | Notes |
|---|---|---|---|
| `PageHeader` | `components/layout/PageHeader.tsx` | Match polish page | Receives `title`, `subtitle`, filter toggle as `children` |
| Filter toggle | Inline JSX in `app/agent/comms/page.tsx` | Match polish page | Two `<Link>` pills in a segmented-control container; all inline `style={}` — see Section 13 for Stage 2 token-replacement note |
| `CommsActivityFeed` | `components/comms/CommsActivityFeed.tsx` | Match polish page | Client component; purely presentational (collapse toggle state only). Stage 2 imports the real component with static `DayBucket[]` data — no mock. |
| Empty state (all) | Inline JSX in `app/agent/comms/page.tsx` | Match polish page | `glass-card` with icon + heading + body + ghost preview |
| Empty state (portal) | Inline JSX in `app/agent/comms/page.tsx` | Match polish page | Variant copy, same structure |
| Ghost day-bucket preview | Inline JSX in `app/agent/comms/page.tsx` | Match polish page | Hardcoded content; `opacity: 0.3; pointerEvents: none` — see Section 13 for Stage 2 question on portal variant |
| `ChartLine` | `@phosphor-icons/react/dist/ssr` | Out of scope | Icon only |
| `CaretDown` / `CaretUp` | `@phosphor-icons/react` | Out of scope | Icons in day bucket header |
| `Link` (Next.js) | `next/link` | Out of scope | Filter toggle + transaction address |

---

## Section 3 — Data Dependencies

**Server fetches (all in `app/agent/comms/page.tsx`):**

1. `requireSession()` — `lib/session.ts`
   - Returns `session.user.id`, `session.user.agencyId`
   - Redirects if unauthenticated

2. `resolveAgentVisibility(userId, agencyId)` — `lib/services/agent.ts`
   - Prisma: `user.findUnique` by `userId` → reads `role`, `canViewAllFiles`, `firmName`
   - Returns `{ userId, agencyId, seeAll, firmName }`
   - `seeAll = true` for directors or users with `canViewAllFiles`

3. `getAgentMilestoneActivity(vis, portalOnly)` — `lib/services/agent.ts`
   - Prisma: `milestoneCompletion.findMany`
   - Filter: `state: "complete"` + visibility scope (agencyId / agentUserId / firmName) + `status: { not: DRAFT }`
   - Optional filter: `confirmedByPortal: true` when `portalOnly`
   - Order: `completedAt: desc`
   - Limit: `take: 150`
   - Includes: `transaction.{ id, propertyAddress }`, `milestoneDefinition.{ name, side }`, `completedBy.{ name }`

**URL param:** `searchParams.filter` — value `"portal"` → `portalOnly = true`

**Null/empty handling:**
- `milestones.length === 0` → renders empty state (variant based on `portalOnly`)
- `days.length > 0` → renders `CommsActivityFeed`
- `m.completedBy` null → `completedByName: null` → rendered as `"unknown"` in entry subtitle
- `m.completedAt` null → falls back to `new Date()` (current time — inaccurate; see Section 11)

**No client-side fetching.** `CommsActivityFeed` is purely presentational — all data is server-rendered and passed as props.

---

## Section 4 — States

**1. Loading**
No explicit loading skeleton exists on this page. No `loading.tsx` file in `app/agent/comms/`. Next.js streams the server component; AgentShell chrome renders immediately, content area streams in. No visual placeholder for the content area during load.

**2. Populated — All milestones (default, `filter` absent)**
- Day buckets: "Today", "Yesterday", then `"[Weekday], [D] [Month]"` (e.g. "Monday, 12 May")
- "Today" and "Yesterday" buckets: `defaultOpen: true` → expand on first load
- All other day labels: `defaultOpen: false` → collapse on first load
- Each expanded bucket shows transaction groups; each group shows milestone rows
- Milestone rows show agent-confirmed (emerald) or portal-confirmed (violet) variants

**3. Populated — Portal only (`?filter=portal`)**
- Same structure, feed filtered to `confirmedByPortal: true` rows
- If milestones exist but none are portal-confirmed: `milestones.length === 0` → empty state with portal copy

**4. Empty — All milestones**
- `milestones.length === 0`, `portalOnly: false`
- Renders: `glass-card` with ChartLine icon (opacity 0.45) + heading + body
- Below: ghost day-bucket preview at opacity 0.3, pointer-events none

**5. Empty — Portal only**
- `milestones.length === 0`, `portalOnly: true`
- Same `glass-card` structure; different heading and body copy
- Same ghost preview (not portal-themed — hardcoded content regardless of filter)

**6. Error**
No explicit error boundary on this page or in `CommsActivityFeed`. An unhandled Prisma error surfaces as a Next.js 500.

---

## Section 5 — Interactive Elements

**1. Filter toggle — "All milestones"**
- Element: `<Link href="/agent/comms">`
- Behaviour: navigates to route without filter param; full server-component reload
- Active when: `!portalOnly`

**2. Filter toggle — "Client confirmations"**
- Element: `<Link href="/agent/comms?filter=portal">`
- Behaviour: navigates to route with `filter=portal`; full reload
- Active when: `portalOnly`

**3. Day bucket collapse/expand**
- Element: `<button onClick={() => toggle(label)}>` — full-width, in `CommsActivityFeed`
- Behaviour: toggles `collapsed[label]` in local React state
- Default: "Today" and "Yesterday" start expanded; all other days start collapsed
- Icon: `CaretDown` (collapsed) / `CaretUp` (expanded)
- No animation — hard conditional render (`{!isCollapsed && ...}`)

**4. Transaction address link**
- Element: `<Link href="/agent/transactions/${tx.transactionId}">`
- Behaviour: navigates to property file detail
- Hover: `bg-white/20` transition

---

## Section 6 — Conditional Renders

**In `app/agent/comms/page.tsx`:**

1. `{milestones.length === 0 && (<><div className="glass-card"...></>, <div style={{ opacity: 0.3 }}...></>)}` — entire empty state block (glass card + ghost preview)
2. `{portalOnly ? "No client confirmations yet" : "No milestone activity yet"}` — empty state heading
3. `{portalOnly ? "Client confirmations will appear here..." : "Completed milestones across your files..."}` — empty state body
4. `{days.length > 0 && <CommsActivityFeed days={days} />}` — feed rendered only when populated

**In `components/comms/CommsActivityFeed.tsx`:**

5. `{!isCollapsed && <div className="space-y-3">...</div>}` — day bucket content, per bucket
6. `{isCollapsed ? <CaretDown .../> : <CaretUp .../>}` — caret direction on day header
7. `{isPortal && <span className="...bg-violet-50 text-violet-600 border border-violet-200">Client confirmed</span>}` — portal badge on milestone entry

---

## Section 7 — Copy Inventory

**Page header:**

| String | Type | Voice flags |
|---|---|---|
| "Updates" | Static — page title | ← FLAG for voice pass. Title says "Updates"; subtitle says "Milestone activity". Check consistency with AgentShell nav label for this route. |
| "Milestone activity across all your files." | Static — page subtitle | ← FLAG for voice pass. "Milestone activity" is system language. Consider "What's happening on your files." or similar. |

**Filter toggle:**

| String | Type | Voice flags |
|---|---|---|
| "All milestones" | Static | Fine |
| "Client confirmations" | Static | Fine |

**Day bucket header:**

| String | Type | Voice flags |
|---|---|---|
| "Today" | Dynamic — computed | Fine |
| "Yesterday" | Dynamic — computed | Fine |
| "[Weekday], [D] [Month]" e.g. "Monday, 12 May" | Dynamic — `date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })` | Fine |
| "[N]" (count badge) | Dynamic — integer milestone count for the day | Fine |

**Transaction group header:**

| String | Type | Voice flags |
|---|---|---|
| "[property address]" e.g. "14 Maple Close, Birmingham" | Dynamic — `tx.transactionAddress` | Fine |

**Milestone row — agent-confirmed variant (`confirmedByPortal: false`):**

| String | Type | Voice flags |
|---|---|---|
| "[milestone name]" e.g. "Mortgage offer received" | Dynamic — `m.milestoneName` (from `milestoneDefinition.name`) | Review in Stage 3 milestone-name pass; not comms-specific |
| "Vendor" | Dynamic — when `m.side === "vendor"` | Fine |
| "Purchaser" | Dynamic — when `m.side !== "vendor"` | Fine |
| "[agent name]" e.g. "Sarah Jones" | Dynamic — `m.completedByName` when not null | Fine |
| "unknown" | Static — fallback when `completedByName` is null and `confirmedByPortal: false` | ← FLAG for voice pass. System language. Consider "—" or omit actor line when null. |

**Milestone row — portal-confirmed variant (`confirmedByPortal: true`):**

| String | Type | Voice flags |
|---|---|---|
| "[milestone name]" | Dynamic — same as above | Same as above |
| "Vendor" / "Purchaser" | Dynamic — same | Same |
| "Client confirmed" | Static — portal badge | ← FLAG for voice pass. Fine as a badge label. Verify "confirmed" is the right past tense for all portal-confirmation scenarios. |
| "Client" | Static — actor line when `isPortal: true` | ← FLAG for voice pass. Vague. Name not available for portal confirmations. Consider "Via client portal" or omit the actor line. |

**Timestamp (relativeDate function):**

| String | Type | Voice flags |
|---|---|---|
| "just now" | Static — diff < 1 min | Fine |
| "[N]m ago" e.g. "3m ago" | Dynamic — 1–59 minutes | Fine |
| "[N]h ago" e.g. "2h ago" | Dynamic — 1–23 hours | Fine |
| "yesterday" | Static — 1 day | Fine |
| "[N]d ago" e.g. "4d ago" | Dynamic — 2–6 days | Fine |
| "[D] [Mon]" e.g. "12 Nov" | Dynamic — 7+ days, `{ day: "numeric", month: "short" }` | Fine |

**Empty state — all milestones:**

| String | Type | Voice flags |
|---|---|---|
| "No milestone activity yet" | Static — heading | ← FLAG for voice pass. "Milestone activity" is system language. "Nothing here yet" or "No completed milestones yet" is more human. |
| "Completed milestones across your files will appear here." | Static — body | ← FLAG for voice pass. Passive, system-centric. "When your team confirms milestones, they'll show up here." is more active. |

**Empty state — portal only:**

| String | Type | Voice flags |
|---|---|---|
| "No client confirmations yet" | Static — heading | Fine |
| "Client confirmations will appear here when clients confirm their milestones via the portal." | Static — body | ← FLAG for voice pass. "via the portal" is internal jargon. "milestones" is system language in a client-facing context. Consider "When clients confirm steps directly, they'll appear here." |

**Ghost preview (hardcoded, opacity 0.3 — all filters):**

| String | Type | Voice flags |
|---|---|---|
| "Today" | Static — hardcoded | Fine |
| "14 Maple Close, Birmingham" | Static — hardcoded demo address | Fine |
| "Mortgage offer received" | Static — hardcoded milestone name | Fine |
| "Search results obtained" | Static — hardcoded milestone name | Fine |
| "9:41 am" | Static — hardcoded time | Fine |
| "8:15 am" | Static — hardcoded time | Fine |

---

## Section 8 — Desktop View

Layout inside `AgentShell` left sidebar + main content area:

1. **PageHeader** — full-width top bar: title + subtitle left-aligned; filter toggle pill pair right-aligned via `agent-page-header-actions`
2. **Content area wrapper** — `px-8 py-4` at desktop, `space-y-6` between day buckets
3. **Day buckets** — one per calendar day:
   - Header button: full-width flex row — day label (uppercase, tracked, `text-slate-900/40`) + count pill + caret
   - When expanded: `space-y-3` column of transaction cards
4. **Transaction card** (`glass-card overflow-hidden`):
   - Address row: full-width link, `px-4 py-2.5`, `border-b border-white/20`; address `text-xs font-semibold text-slate-900/70 truncate`
   - Milestone rows: `divide-y divide-white/15`; icon circle (left) + name/badges/actor (centre) + timestamp (right)
5. Older day buckets collapsed by default; click header to expand

---

## Section 9 — Mobile View

**Content padding:** `px-4 py-2` mobile vs `px-8 py-4` desktop.

**Filter toggle placement — open question per PAGE_LIST.md:** Filter toggle renders as `children` of `PageHeader` in `agent-page-header-actions`. At 375px, if `agent-page-header` is `flex-wrap: nowrap`, the toggle and title compete for horizontal space and the toggle may overflow or clip. **Must be verified in Stage 2 at 375px.** If overflow occurs, toggle needs to move below the header or become full-width.

**Day bucket headers:** Full-width buttons — fine at 375px.

**Transaction cards:** Full-width — fine.

**Milestone rows at 375px:**
- Name + side badge + portal badge row is `flex-wrap` — badges wrap to second line on narrow screens; intentional
- Milestone name wraps (not truncated) — correct
- Timestamp stays `flex-shrink-0` at right — may feel crowded with long names but functionally fine

**Address row:** `truncate` on address text — overflow handled.

**Ghost preview:** Same widths as live cards — fine at 375px.

---

## Section 10 — Existing Animations

**In `app/agent/comms/page.tsx` (filter toggle):**
- `transition: "background 150ms"` (inline style on both pill links) — hover background transition

**In `components/comms/CommsActivityFeed.tsx` (transaction address link):**
- `transition-colors` (Tailwind) — hover color transition

**No entrance animations.** No `agent-reveal`, `agent-row-flash`, `agent-confirm-flash`, or height transitions anywhere on this page. Day bucket expand/collapse is a hard conditional render — no animation.

---

## Section 10.5 — Canonical Class Inheritance

| Class | Applicable? | Notes |
|---|---|---|
| `agent-acc` | **Candidate** — day bucket expand/collapse | Currently bare `{!isCollapsed && ...}` conditional render. Could receive `agent-acc` in Stage 4 for animated height transition. Worthwhile — buckets hold significant content and a jarring jump on collapse is noticeable. |
| `agent-segment-pill` | **Not applicable** — visual mismatch | Production filter uses a segmented-control pattern (container background + floating white active chip). `agent-segment-pill` uses individually-bordered chips with coral active state — a different visual. Use token-based replacement per Section 13. |
| `agent-row-flash` | No | Feed is read-only and server-rendered. No in-place row updates. |
| `agent-confirm-flash` | No | No confirmation actions on this page. |
| `agent-reveal` | No | No drawers or panels. |

---

## Section 11 — Edge Cases

1. **No real-time updates.** Server component — data fetched at request time. Milestones confirmed while the page is open do not appear until navigation or manual refresh. No polling, no WebSocket, no streaming.

2. **`completedAt` null fallback is inaccurate.** `m.completedAt ?? new Date()` — a completion with no `completedAt` displays as "just now". Rare but possible for programmatically-created completions.

3. **`completedByName` null renders "unknown".** When agent-confirmed but `completedBy` is null (e.g. user was deleted), actor line shows "unknown". Voice violation — see Section 7.

4. **Portal-confirmed entries discard any available name.** `isPortal ? "Client" : (m.completedByName ?? "unknown")` — if a portal entry somehow has `completedByName` set, it is ignored in favour of "Client".

5. **150-record hard cap.** `take: 150` — high-volume agencies hit this cap silently. No pagination, no "load more", no truncation indicator.

6. **Filter: portal with zero portal results.** Handled — shows empty state with portal copy. Correct.

7. **Long milestone names.** Names wrap on both viewports — correct, not truncated.

---

## Section 12 — Out of Scope for Polish Pass

- `getAgentMilestoneActivity` query changes
- Adding new entry types to the feed (chase sends, status changes, document uploads, internal notes from `CommunicationRecord`, assignment changes) — feature scope
- Real-time or polling updates
- Pagination of the 150-record feed
- `resolveAgentVisibility` logic
- `requireSession` or auth flow
- Any API routes (none exist for this page)
- DB schema changes
- `relativeDate` timestamp function logic
- `dayLabel` grouping logic

---

## Section 13 — Stage 4 Visual Contract

This is a Stage 2 build. The polish page must implement the following structure verbatim for Stage 4 to execute against it.

---

### Filter strip

**Stage 2 constraint — no inline rgba.** The production filter strip uses inline `rgba()` for all colour values (container background, active pill background, box-shadow). `.agent-segment-pill` does not match visually (coral active state vs white chip active state — different pattern). Stage 2 must implement the segmented-control appearance using `--agent-*` CSS variables for every colour value. Inline `rgba()` literals must not appear in the polish page.

Proposed token mapping (Stage 2 to verify these tokens resolve correctly):
- Container background: `var(--agent-surface-tint)` (replaces `rgba(0,0,0,0.05)`)
- Active pill background: `var(--agent-surface-card)` (replaces `rgba(255,255,255,0.9)`)
- Active pill shadow: `var(--agent-card-shadow-sm)` (replaces `0 1px 3px rgba(0,0,0,0.08)`)
- Active pill text: `var(--agent-text-primary)` (already a token — keep)
- Inactive pill text: `var(--agent-text-secondary)` (already a token — keep)
- Inactive pill background: transparent (no change needed)

If any proposed token does not exist, Stage 2 should define it in `agent-system.css` with light-mode and `[data-night]` values — not use a fallback rgba literal.

```
Container: style={{ display: "flex", gap: 4, background: "var(--agent-surface-tint)",
                    borderRadius: 10, padding: 3 }}

Active pill:
  style={{ fontSize: 12, fontWeight: 500, padding: "6px 12px", borderRadius: 7,
           textDecoration: "none", transition: "background 150ms",
           background: "var(--agent-surface-card)",
           color: "var(--agent-text-primary)",
           boxShadow: "var(--agent-card-shadow-sm)" }}

Inactive pill:
  style={{ fontSize: 12, fontWeight: 500, padding: "6px 12px", borderRadius: 7,
           textDecoration: "none", transition: "background 150ms",
           background: "transparent",
           color: "var(--agent-text-secondary)" }}
```

---

### Content wrapper

```
<div className="px-4 md:px-8 py-2 md:py-4 space-y-6">
```

---

### Day group header

```
<button className="w-full flex items-center gap-2 mb-3 text-left">
  <p className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide flex-1">
    {label}
  </p>
  <span className="text-xs font-medium text-slate-900/40 bg-slate-100/60 px-2 py-0.5 rounded-full">
    {count}
  </span>
  {isCollapsed
    ? <CaretDown className="w-3.5 h-3.5 text-slate-900/30 flex-shrink-0" />
    : <CaretUp   className="w-3.5 h-3.5 text-slate-900/30 flex-shrink-0" />}
</button>
```

---

### Day bucket content (expanded)

```
<div className="space-y-3">
  {/* transaction cards */}
</div>
```

---

### Transaction card

```
<div className="glass-card overflow-hidden">
  <Link
    className="block px-4 py-2.5 border-b border-white/20 hover:bg-white/20 transition-colors"
    style={{ textDecoration: "none" }}
  >
    <p className="text-xs font-semibold text-slate-900/70 truncate">{address}</p>
  </Link>
  <div className="divide-y divide-white/15">
    {/* milestone rows */}
  </div>
</div>
```

---

### Milestone row — agent-confirmed (`confirmedByPortal: false`)

```
<div className="flex items-start gap-3 px-4 py-3">
  <div className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 bg-emerald-100">
    <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  </div>
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-medium text-slate-900/80">{milestoneName}</span>
      {/* Vendor: */}
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
        Vendor
      </span>
      {/* Purchaser: */}
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
        Purchaser
      </span>
    </div>
    <p className="text-xs text-slate-900/40 mt-0.5">{completedByName ?? "unknown"}</p>
  </div>
  <span className="text-[11px] text-slate-900/35 flex-shrink-0 mt-0.5">{relativeTime}</span>
</div>
```

---

### Milestone row — portal-confirmed (`confirmedByPortal: true`)

Same structure with:
- Icon circle: `bg-violet-100` / `text-violet-600`
- Extra badge after side badge:
  ```
  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                   bg-violet-50 text-violet-600 border border-violet-200">
    Client confirmed
  </span>
  ```
- Actor line: `"Client"` (static string)

---

### Empty state

```
<div className="glass-card" style={{ padding: "48px 24px", textAlign: "center" }}>
  <ChartLine
    weight="regular"
    style={{ width: 32, height: 32, color: "var(--agent-text-muted)",
             margin: "0 auto 16px", display: "block", opacity: 0.45 }}
  />
  <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600,
              color: "var(--agent-text-primary)" }}>
    {heading}
  </p>
  <p style={{ margin: "0 auto", fontSize: 13, color: "var(--agent-text-muted)",
              maxWidth: 340, lineHeight: 1.5 }}>
    {body}
  </p>
</div>
```

---

### Ghost preview (empty state only)

```
<div style={{ opacity: 0.3, pointerEvents: "none" }}>
  <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 600,
              color: "var(--agent-text-muted)", textTransform: "uppercase",
              letterSpacing: "0.08em" }}>
    Today
  </p>
  <div className="agent-glass-strong" style={{ borderRadius: 16, overflow: "hidden" }}>
    {/* address row — same structure as live transaction card address row */}
    {/* 2× milestone rows — same structure as live rows, hardcoded content */}
  </div>
</div>
```

**Stage 2 question — ghost preview portal variant:** The current ghost uses agent-style hardcoded content ("Mortgage offer received", "Search results obtained") regardless of filter. In the portal-only empty state, this depicts the wrong imagined-future state — a portal-confirmed entry would render with a violet icon and "Client confirmed" badge. Stage 2 decides: implement two ghost variants (one for each filter), or use a single neutral/abstract ghost that avoids entry-type specificity. Either is acceptable; do not leave the current agent-style ghost unchanged under the portal empty state.

---

### Loading skeleton

No loading skeleton exists on this page. Stage 2 should add one for the content area: day bucket header placeholder + 2–3 card-row placeholders. Required for visual loading state on slow connections.

---

## Section 14 — Amendments

**A1 — 2026-05-17 (Stage 2) — Filter strip token: `--agent-surface-overlay` defined**

`--agent-surface-overlay` added to `app/agent/styles/agent-system.css`:
- Light mode (`.agent-shell-root`): `rgba(0, 0, 0, 0.05)` — matches production exactly
- Night mode (`@media (max-width: 1024px) { .agent-shell-root[data-night] }`): `rgba(255, 255, 255, 0.05)`

Extends `--agent-surface-*` family per Ellis's Stage 2 orientation note. Avoids creating parallel naming family.

**A2 — 2026-05-17 (Stage 2) — Ghost preview split into two variants**

Production ghost shows a single coral-icon entry regardless of filter. Stage 2 decision: two variants.
- All-milestones empty state: emerald icon ghost (matches agent-confirmed entry visual)
- Portal empty state: violet icon + "Client confirmed" badge ghost (matches portal-confirmed entry visual)

Implemented in [app/agent/polish/comms/page.tsx](app/agent/polish/comms/page.tsx). Stage 4 transplants both variants to [app/agent/comms/page.tsx](app/agent/comms/page.tsx).

**A3 — 2026-05-17 (Stage 2) — agent-acc deferred to Stage 4**

Day bucket expand/collapse animation (`agent-acc`) deferred to Stage 4. `CommsActivityFeed` imported as real component in the test page — the component's internal hard conditional render is unchanged. Stage 4 adds `agent-acc` to `components/comms/CommsActivityFeed.tsx`. Polish Gate item 8.

**A4 — 2026-05-17 (Stage 3) — Actor line on milestone row: conditional render**

Stage 3 voice pass decision: the actor `<p>` line on milestone rows is omitted when (a) `confirmedByPortal: true` or (b) `completedByName` is null. Replaces the previous `"Client"` and `"unknown"` fallback strings (both removed).

Stage 4 structural change required: wrap the actor `<p>` in `components/comms/CommsActivityFeed.tsx` with `{!m.confirmedByPortal && m.completedByName && ...}`. The `<p>` renders only when a real agent name is available for a non-portal entry. Affects Section 7 (copy inventory) and Section 13 (milestone row spec).

**A5 — 2026-05-17 (Stage 4) — A2 closed: single filter-neutral ghost**

A2 left the ghost-variant question open ("Stage 2 decides: two ghost variants vs single neutral ghost"). Stage 2 resolved it as a single filter-neutral `CommsGhost` with abstract `agent-skeleton` bars — no fake content, no entry-type icon colouring. Decision made during Stage 2 build; this amendment records the closed decision retrospectively. Affects Section 13 (ghost preview spec).

**A6 — 2026-05-17 (Stage 4) — Section 4 correction: loading.tsx existed**

Phase 1 audit correction: Section 4 stated "No loading.tsx file in app/agent/comms/". A `loading.tsx` file does exist at `app/agent/comms/loading.tsx` but its structure diverged from the polish page's `CommsSkeleton` (used `agent-glass-strong` + free-floating label instead of `agent-glass` + `agent-acc-hdr`). Stage 4 rewrites the file rather than creates it. Outcome unchanged. Affects Section 4, Section 13.
