# Phase 3 · Surface 6 · Agent Completions · Baseline + Audit + Plan

**Route:** [`/agent/completions`](../../../app/agent/completions/page.tsx)
**Drafted:** 2026-06-30.

---

## Baseline

### Route + auth
- `app/agent/completions/page.tsx` (218 lines) — async server component
- All agent + internal staff roles allowed
- Uses canonical `<PageHeader>` + `<StatPill>` (already DoD-compliant)

### Data
Single fetcher `getAgentCompletions(vis)` returning exchanged files with completion dates. Grouped client-side into 5 urgency buckets (overdue / this_week / next_week / later / no_date).

### Render branches
1. **Empty** (`files.length === 0`): `agent-glass-strong` card + ghost preview (2 groups with `agent-glass` + agent-acc + glass-card row + agent-skeleton bars)
2. **Has files**: Pipeline summary line + `<CompletionsGroupList>` with 5 collapsible urgency groups

### Components in scope
1. `app/agent/completions/page.tsx` (218) — page + empty state + ghost
2. `components/completions/CompletionsGroupList.tsx` (155) — group list + per-row date picker

### Mutations
- `saveCompletionDateAction(fileId, dateStr)` via per-row date picker (`agent-btn` button)

### Role variations
| Role | Subtitle |
|---|---|
| admin | "All exchanged files across the platform." ⚠️ voice violation |
| sales_progressor | "Your assigned outsourced files, tracking to completion." |
| director / negotiator / viewer | "Exchanged files, tracking to completion." |

---

## Audit vs DoD

| Criterion | Status | Action |
|---|---|---|
| Canonical primitives | Partial — 1 page-level `glass-card` clean swap + 1 `agent-btn` clean swap; 3 `agent-glass*` cards grandfather (chrome); 1 `<Link className="glass-card">` grandfathers (CardLink-pending) | H1 |
| Voice | 1 violation: "the platform" on admin subtitle (L116) | H1 |
| Hover / focus / active | OK | none |
| Modal pattern | none | none |
| Loading state | No `loading.tsx` | none |
| Empty state | `agent-glass-strong` card + ghost | grandfather |

### Class usage inventory

**Cards:**
- `agent-glass-strong` × 1: page.tsx:132 empty state (chrome grandfather)
- `agent-glass` × 3: page.tsx:154, page.tsx:183 ghost group cards + CompletionsGroupList.tsx:48 active group cards (chrome grandfather)
- `glass-card` (clean Card swap) × 1: page.tsx:167 ghost row card
- `glass-card` on `<Link>` × 1: CompletionsGroupList.tsx:99 — Link styled as glass card. Card primitive doesn't have `as` polymorphism. **Grandfather: CardLink-pending** (similar to ButtonLink-pending pattern)

**Accordions:**
- `agent-acc` × 3: page.tsx ghost (L162) + page.tsx ghost (no body, L191) + CompletionsGroupList.tsx:85 main groups
- The CompletionsGroupList accordion uses `agent-acc-hdr` as the clickable header (real Accordion.Header API match) BUT with custom urgency-colour CSS handling on child elements + a custom summary span. Migrating cleanly would require `Accordion.Header` slot support. Grandfather.

**Buttons:**
- `agent-btn` × 1: CompletionsGroupList.tsx:122 (date picker save). **Clean Button swap.**

**Skeletons:**
- ~10 `agent-skeleton` divs in the page.tsx ghost preview. Clean Skeleton sweep.

**Voice:**
- L116 "All exchanged files across the platform." → "All exchanged files across every agency." (matches Surface 4 fix)
- All em-dashes in comments only.

---

## Plan — PR H1

Single PR. Same compressed model.

Changes:
1. **Voice swap** — page.tsx L116
2. **1 `glass-card` → `<Card>`** — page.tsx L167 ghost row
3. **1 `agent-btn` → `<Button>`** — CompletionsGroupList L122 date-picker save
4. **Skeleton primitive sweep** — page.tsx ghost (~10 instances) via local Bar helper
5. **POLISH_TBD extensions**:
   - Extend Surface 2-5 chrome entry to Surface 6 (now **5th consumer** of `agent-glass*`)
   - New grandfather: `<Link className="glass-card">` pattern in CompletionsGroupList — CardLink-pending
   - Extend accordion-header grandfather to cover CompletionsGroupList's urgency-coloured group accordion

Chrome decision: inherited from Surfaces 2-5 (Option B).

Verification:
- `tsc --noEmit` clean
- multi-tenant 26/26
- E2E sentinel at `e2e/surface-agent-completions.spec.ts`

Exit:
- H1 PR shipped
- POLISH_TBD updated
- BUILD_PLAN closed for Surface 6
