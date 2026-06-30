# Phase 3 · Surface 4 · Transaction List · Audit + Plan

**Companion to:** [BASELINE.md](BASELINE.md).
**Drafted:** 2026-06-30.

This surface is **the cleanest yet.** Most page-level work is already canonical: `EmptyState`, `PageHeader`, `AgentFlagButton` already in use. Only one clean swap + one voice fix. Rest grandfathers.

---

## TL;DR — single PR ("F1")

| Change | File | Lines |
|---|---|---|
| `glass-card` → `<Card>` swap | `components/transactions/PostExchangeStrip.tsx` | 1 |
| Voice swap: "the platform" → "every agency" | `app/agent/transactions/page.tsx` L140 | 1 |
| POLISH_TBD: extend agent-glass-strong entry to include Surface 4 (3 cards) | — | doc |
| POLISH_TBD: extend popover entry to include Surface 4 (6 popovers) | — | doc |
| POLISH_TBD: extend ButtonLink entry to include 2 page-level `<Link className="agent-btn">` | — | doc |

**No new grandfathers.** Surface 4 just extends Surfaces 2 + 3 entries with its own file references.

---

## DoD coverage

| Criterion | Status | Action |
|---|---|---|
| Canonical primitives | **Mostly OK.** Page uses `<EmptyState>`, `<PageHeader>`, `<AgentFlagButton>` already. `<Card>` swap on PostExchangeStrip. | F1 |
| Hover / focus / active | OK | none |
| Voice | **1 violation**: page.tsx:140 "Every file across the platform." → use "every agency" | F1 |
| Modal pattern | none | none |
| Loading state | No `loading.tsx` — async page renders synchronously. Sub-1s on staging | none |
| Empty state | **Already canonical** (`<EmptyState>`) | none |
| Error state | Implicit bubble to error.tsx | flag only |

---

## Per-file remediation

### `components/transactions/PostExchangeStrip.tsx` — 1 glass-card → Card

Line 24:
```tsx
- <div className="glass-card">
+ <Card variant="glass">
```
(Already imports zero, will need `import { Card } from "@/components/ui/Card"`.)

### `app/agent/transactions/page.tsx` — voice swap

Line 140:
```tsx
- isAdminPowers ? "Every file across the platform." :
+ isAdminPowers ? "Every file across every agency." :
```

### Grandfather rows (POLISH_TBD extensions)

**agent-glass-strong chrome (3 instances)**:
- `page.tsx:233` empty-state card
- `TransactionListWithSearch.tsx:682` empty-after-filter card
- `TransactionTable.tsx:116` table header chrome

Extend the existing Surface 2/3 entry to list Surface 4 files. Same chrome decision: grandfather pending `Card variant="agent-glass"` extension.

**createPortal popovers (6 instances)**:
- TransactionListWithSearch.tsx × 4 (search clear, status tabs, sort, filter chips)
- TransactionRowView.tsx × 1 (row menu)
- RiskBadgeWithPopover.tsx × 1 (risk explanation)

Extend Surface 3 popover entry. Same call: defer until canonical `<Popover>` primitive.

**Link-styled `agent-btn` (2 instances on this surface)**:
- page.tsx:150 "New sale" header Link
- page.tsx:266 "New sale" empty-state Link

Extend Surface 2 ButtonLink-pending entry.

### Em-dash placeholder cells

Three sites use `"—"` as a placeholder for missing values (TransactionRowView L408 L415, ForecastStrip L110). These are NOT prose — same exception VOICE.md grants the "Chased — next in {n} days" toast. **No action.**

---

## Risk profile

| Risk | Mitigation |
|---|---|
| `Card variant="glass"` chrome on PostExchangeStrip differs from glass-card it replaces | Card primitive's `glass-card` renders the same class string + adds `overflow-hidden` — verified byte-equivalent on Surface 1 |
| Voice swap reads differently to admins than the cached perception | "Every file across every agency" is parallel structure to director's "Every file across the agency" — voice consistent |

---

## Exit criteria

1. F1 PR shipped: PostExchangeStrip swap + page.tsx voice + POLISH_TBD extensions
2. tsc clean + multi-tenant 26/26
3. E2E sentinel passes (`e2e/surface-agent-transactions.spec.ts`)
4. BUILD_PLAN marked DONE for Surface 4

---

## What I need from you before code lands

Nothing structurally new — the chrome decision (B = grandfather) is already locked from Surfaces 2 + 3. Surface 4 inherits.

Single decision: **OK to proceed shipping F1?** If yes, the PR goes out and Surface 4 closes.

**My recommendation: proceed.** This is the smallest surface PR yet.
