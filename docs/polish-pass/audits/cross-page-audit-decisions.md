# Cross-Page Audit — Phase 3 Decisions
*Decided 2026-05-17*

All decisions recorded verbatim from Ellis. Source of record for Phase 4 implementation.

---

## Confirmed CHANGE — "join" the aligned group

All items below: implement exactly as written in `cross-page-audit-recommendations.md`.

| Item | Title | File |
|---|---|---|
| 1A | SectionAccordion — CaretUp/CaretDown swap → rotating CaretDown | `SectionAccordion.tsx:31-33` |
| 1B | CompletionsGroupList — Tailwind rotate-180 → inline style + token | `CompletionsGroupList.tsx:72` |
| 2A | SideSnoozeMenu — add agent-dropdown-out exit animation | `AgentRemindersList.tsx:86-150` |
| 2B | RowSnoozeMenu — add agent-dropdown-out exit animation | `AgentRemindersList.tsx:152-219` |
| 3A | comms empty-state card — glass-card → agent-glass-strong | `comms/page.tsx:96` |
| 3B | completions empty-state card — glass-card → agent-glass-strong | `completions/page.tsx:116` |
| 5A | AgentTodoList address link — hover:underline → agent-link | `AgentTodoList.tsx:298-305` |
| 6A | comms filter bar — comms-filter-pill → agent-segment-pill | `comms/page.tsx:77-89` |
| 7A | TransactionRowView risk stripe — Tailwind → inline token style | `TransactionRowView.tsx:241` |
| 7B | TransactionRowView ACTIVITY_TONE — hardcoded hex → --agent-*-rgb tokens | `TransactionRowView.tsx:88-92` |
| 7C | CompletionFileRowView GROUP_STYLES dots — Tailwind → inline token style | `CompletionFileRowView.tsx:33-38` |
| 9A | hub/page.tsx — opacity 0.3 → 0.35 (3 locations) | `hub/page.tsx:147,172,204` |
| 10A | CommsActivityFeed — divide-white/15 → borderTop per row | `CommsActivityFeed.tsx:87` |
| 10C | AgentRemindersList — rgba(15,23,42,0.06) → var(--agent-border-subtle) | `AgentRemindersList.tsx:326,360` |
| 11A | agent-system.css — add .agent-acc-hdr:focus-visible rule | `agent-system.css` |
| 11B | AgentTodoList circle toggle — add agent-circle-btn focus class | `AgentTodoList.tsx:348-361` |
| 16A | AgentRemindersList — rgba(15,23,42,0.35) → var(--agent-text-muted) | `AgentRemindersList.tsx:296,313` |
| 16C | AgentRemindersList — rgba(15,23,42,0.28) → var(--agent-text-disabled) | `AgentRemindersList.tsx:426` |
| 16D | TransactionRowView — rgba(180,87,9,0.40) → rgba(var(--agent-warning-rgb), 0.40) | `TransactionRowView.tsx:201` |
| 16EFG | AgentRemindersList GROUP_LEFT_BORDER — hardcoded hex → tokens | `AgentRemindersList.tsx` (escalated/due_today/upcoming) |
| 17A | CompletionsGroupList file cards — hover:shadow-md → agent-hover-row | `CompletionsGroupList.tsx:92` |
| NC2A | TransactionNotes — onMouseEnter/onMouseLeave → CSS hover class (agent-hover-row) | `TransactionNotes.tsx:97-98` |

---

## UNCERTAIN decisions

### U3C — AgentTodoList empty state card surface
**Decision: A — agent-glass-strong** (consistent with other empty states)

```tsx
// IMPLEMENT
<div className="agent-glass-strong" style={{ padding: "48px 24px", textAlign: "center" }}>
```

File: `components/agent/AgentTodoList.tsx:119`

---

### U7D / 16J — GROUP_CONFIG label/badge Tailwind classes
**Decision: B — leave Tailwind** (E1 semantic colour-coding is intentional per existing code comment)

No change to `GROUP_CONFIG` in `AgentRemindersList.tsx`. The E1 comment in the file explicitly flags this as intentional.

---

### U7E / 16H — Seller #ea580c / buyer #3b82f6 colour pair
**Decision: B — map to existing tokens** (`--agent-warning` for seller, `--agent-info` for buyer)

```tsx
// IMPLEMENT
const dotColor   = isSeller ? "var(--agent-warning)" : "var(--agent-info)";
const columnBg   = isSeller ? "rgba(var(--agent-warning-rgb), 0.06)" : "rgba(var(--agent-info-rgb), 0.06)";
const labelColor = isSeller ? "var(--agent-warning)" : "var(--agent-info)";
```

Files: `AgentRemindersList.tsx:250-252`, `AgentRemindersList.tsx:402-404`, `AgentRemindersList.tsx:310-313`

---

### U7F / 16L — CommsActivityFeed badge system
**Decision: B — map to existing tokens where semantically close**

```tsx
// IMPLEMENT — use existing tokens where available, closest match:
// Portal-confirmed:  --agent-info (violet has no token; use info as nearest)
// Agent-confirmed:   --agent-success
// Vendor side:       --agent-info
// Purchaser side:    --agent-success or --agent-purchaser-accent
// Client-confirmed tag: --agent-info with border using rgba(var(--agent-info-rgb), 0.3)
```

Note: verify `--agent-purchaser-accent` and `--agent-vendor-accent` token values in themes.css before implementing — they may be a better fit than `--agent-success`/`--agent-info` for the vendor/purchaser badges.

File: `components/comms/CommsActivityFeed.tsx`

---

### U13B — "Show"/"Hide" toggles — add CaretDown?
**Decision: A — add rotating CaretDown**

```tsx
// IMPLEMENT
<button
  onClick={() => toggleCollapse(groupKey)}
  className="agent-link agent-link-muted"
  style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
>
  {isCollapsed ? "Show" : "Hide"}
  <CaretDown
    size={10}
    style={{ transition: "transform 200ms", transform: isCollapsed ? "rotate(0deg)" : "rotate(180deg)" }}
  />
</button>
```

Files: `AgentRemindersList.tsx:751-756`, `FileAlertsStrip.tsx`

---

### U16I — GROUP_LEFT_BORDER.snoozed purple
**Decision: B — leave hardcoded** (`rgba(168,85,247,0.5)` stays as-is)

No change. Snoozed is visually distinctive, value is contained in one constant.

---

### U16K — CompletionFileRowView later/no_date dot colours
**Decision: A — leave as Tailwind** (`bg-slate-400`, `bg-slate-300`)

No token exists for these neutral states; Tailwind is acceptable here.

Implementation note for CHANGE 7C: when implementing the dot → inline style conversion, convert `later`/`no_date` to raw hex values (`#94a3b8`, `#cbd5e1`) so all dot entries use inline style consistently.

---

### U17B — AgentTodoList task rows hover
**Decision: B — leave no hover** on task rows

No change. Task rows have inline interactive elements (toggle button, due-date label); full-row hover background would mislead users into thinking the row itself is clickable.

---

## Remaining items — decided by Claude (same pattern as confirmed siblings)

| Item | Title | Decision | Rationale |
|---|---|---|---|
| 9B | comms/page.tsx — opacity 0.4 → 0.35 | join | Same target as 9A/9C; aligns all ghost previews to 0.35 |
| 9C | work-queue/page.tsx — opacity 0.5 → 0.35 | join | Same target as 9A/9B; aligns all ghost previews to 0.35 |
| 10B | comms/page.tsx — border-b border-white/20 → style borderBottom | join | Same pattern as 10C/10D; border token already used adjacent |
| 10D | AddManualTaskForm — border-t border-white/20 → style borderTop | join | Same pattern as 10B/10C; noted as missed in Stage 4 |

---

## Phase 4 implementation order

Based on decisions above. Derived from Phase 4 sweep order in recommendations doc.

1. **CSS infra** — CHANGE 11A (`agent-acc-hdr:focus-visible`), CHANGE 11B (`agent-circle-btn`), CHANGE NC2A CSS class (`agent-note-item` or use `agent-hover-row`)
2. **Ghost opacity** — CHANGE 9A (hub ×3). Plus 9B/9C once decided.
3. **Border token sweep** — CHANGE 10A, 10C (10B/10D once decided)
4. **Hardcoded colour sweep** — CHANGE 16A, 16C, 16D, 16EFG, U7E (seller/buyer), U7F (comms badges)
5. **Caret rotation** — CHANGE 1A, 1B; plus U13B (Show/Hide toggles)
6. **Dropdown exit** — CHANGE 2A, 2B
7. **Card surface** — CHANGE 3A, 3B; plus U3C (AgentTodoList empty state)
8. **Status token sweep** — CHANGE 7A, 7B, 7C (with U16K raw-hex for later/no_date)
9. **Link / pill / hover** — CHANGE 5A, 6A, 17A; CHANGE NC2A component side
