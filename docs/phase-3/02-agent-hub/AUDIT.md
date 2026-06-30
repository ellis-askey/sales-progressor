# Phase 3 · Surface 2 · Agent Hub · Audit vs Definition of Done

**Companion to:** [BASELINE.md](BASELINE.md) (what the hub does today) and [PLAN.md](PLAN.md) (proposed remediation).
**Drafted:** 2026-06-30.

This doc maps every gap on the hub surface against [docs/DEFINITION_OF_DONE.md](../../DEFINITION_OF_DONE.md). Source of truth for the PR scope.

---

## TL;DR

The hub is **smaller scope than Surface 1** because:
1. No tabs, no modals owned by this surface, no embedded drawers
2. The embedded widgets (AttentionListView, UnassignedFilesView, NewBuyersToAcknowledgeView, ChainSetupPendingView, ExpiredHoldsCard) are deferred to their own surface remediation per Surface-2 scope lock in BASELINE §11
3. Hub uses `agent-glass*` utilities, NOT `glass-card` — so the Card primitive doesn't fit cleanly

**Headline gap:** the page-level surface chrome (`agent-glass`, `agent-glass-strong`, `agent-glass-light`) is a **different glass treatment** than `glass-card`. Migrating to `<Card variant="glass">` would shift the visual chrome (different blur amount, different background tokens, different border, different shadow). That's a primitive-system decision — covered in PLAN.md §"Three options".

**Realistic remediation scope (depending on chrome decision):**
- ~3 button swaps (`agent-btn` → `<Button>`)
- Skeleton primitive in loading.tsx inner rows (composer stays bespoke)
- ~0–4 inline empty states → `<EmptyState>` where it fits without regression
- Voice sweep (mostly already clean — 1 em-dash in a comment, 0 in user-facing strings)
- 0–8 card-chrome swaps depending on chrome decision

**1 PR if option B (grandfather chrome), 2 PRs if option A (canonicalise chrome).**

---

## Coverage per DoD criterion

| DoD criterion | Status on the hub today | Surface 2 work |
|---|---|---|
| Uses canonical primitives for every UI element | **Partial.** `agent-glass*` cards + `agent-btn` buttons + bespoke inline empty states + bespoke loading skeleton. Buttons + skeleton are clean migrations; chrome and empties are decisions. | depends on chrome decision |
| Hover / focus / active / disabled states | **OK.** `agent-press-cell` provides hover. Disabled handled inline on the buttons. The four pipeline stat cells without `href` are correctly non-interactive (no hover). | no action |
| Voice-passed strings against [VOICE.md](../../reference/VOICE.md) | **Clean.** 0 em-dashes in user-facing strings on the page. No "automatically" / "the system" violations. No banned terms. | no action |
| Modal pattern (if any) | n/a — no modals owned by this surface | no action |
| Design-token compliance | **OK.** Page uses CSS vars throughout (`var(--agent-text-primary)` etc.). | no action |
| Loading state | **OK.** Bespoke composer `loading.tsx` matches the silhouette. Should swap inner rows to `<Skeleton>` (PanelSkeletons precedent from A4). | 1 PR — composer wraps Skeleton primitive |
| Empty state | **Partial.** Welcome state for zero-files is the hub's "first-time" pattern (composed inline). Sub-empties for "no diary", "no exchanges in 30 days", "all files have recent activity", "All files self-managed" are inline text. | judgement call per item — see §"Inline empties" |
| Error state | **Implicit.** No error boundary on the hub page; the 11-fetcher `Promise.all` will bubble if any reject without a `.catch()`. The fetchers themselves are server-side; an error renders Next's error.tsx. | flag — recommend not to add until Surface 3+ for risk control |
| First-time / new-user state | **OK.** The empty-state branch fires when `pipelineStats.activeFiles === 0 && attentionItems.length === 0`. | no action |

---

## Class usage inventory (page-level scope)

### `agent-glass` family

| Where | Count | Notes |
|---|---|---|
| `app/agent/hub/page.tsx` `agent-glass` | 7 | Welcome card, Pipeline health card (full), Momentum card, Exchange forecast card, Service split card, Diary card, plus 2 in empty-state ghosts |
| `app/agent/hub/page.tsx` `agent-glass-strong` | 1 | Empty-state ghost attention |
| `app/agent/hub/page.tsx` `agent-glass-light` | 1 | Activity ribbon (intentionally lighter so it recedes) |
| `app/agent/hub/loading.tsx` `agent-glass` | 5 | mirrors the live cards |
| `app/agent/hub/loading.tsx` `agent-glass-strong` | 1 | mirrors the live attention area |
| **Total page-level** | **15** | |

Migration target for these depends on the chrome decision (see PLAN.md).

### `agent-btn`

| Line | What | Variant |
|---|---|---|
| [page.tsx:131](../../../app/agent/hub/page.tsx#L131) | Empty-state PageHeader "New sale" | `agent-btn-primary agent-btn-sm` |
| [page.tsx:167](../../../app/agent/hub/page.tsx#L167) | Empty-state "Add a sale" | `agent-btn-primary agent-btn-md` |
| [page.tsx:268](../../../app/agent/hub/page.tsx#L268) | Full-hub PageHeader "New sale" | `agent-btn-primary agent-btn-sm` |

All three are `<Link>` styled as buttons. Button primitive renders `<button>`. Per the Button.tsx contract:

> Link-shaped buttons that today use `<Link className="agent-btn">` stay grandfathered until a separate `ButtonLink` primitive ships

→ **All three buttons grandfather as ButtonLink-pending.** Surface 2 doesn't touch them. Flagged for follow-up in POLISH_TBD.

### `agent-skeleton`

`app/agent/hub/loading.tsx` uses raw `agent-skeleton` divs for every pulse row (~22 instances). Same situation as `PanelSkeletons.tsx` from Surface 1 Wave A4: the composer stays bespoke (encodes hub-grid layout) but the inner Bars wrap the `<Skeleton>` primitive.

→ **Migration: 1 small change — extract a `Bar` helper that calls `<Skeleton variant="block">`, mirror the A4 pattern.**

### Inline empty states

Four of them. Each needs a judgement call (EmptyState compact is heavier than the dense 12px italic line, as we learned in Wave A2):

| Where | Current copy | Verdict |
|---|---|---|
| [page.tsx:533-541](../../../app/agent/hub/page.tsx#L533-L541) "All files have recent activity" | 13px text-muted | **Grandfather** — single line within a card row, no icon affordance fits |
| [page.tsx:635-637](../../../app/agent/hub/page.tsx#L635-L637) "No exchange dates in the next 30 days. Add expected exchange dates to your files to see them here." | 13px text-muted, 2 lines | **Migrate-candidate** — has a "Add..." hint that reads as a call to action. `<EmptyState compact>` with no icon could fit. Decision in PLAN. |
| [page.tsx:780-782](../../../app/agent/hub/page.tsx#L780-L782) "All files are self-managed." | 12px text-muted, 1 line | **Grandfather** — single-line status line, EmptyState would be visually heavy |
| Welcome state (whole empty-state branch) | composer with CTA | **Grandfather** — already an `<EmptyState>`-shaped composition inline, but with hub-specific ghosts. Could be extracted to a separate `<HubEmptyState>` widget; out of Surface 2 scope. |

### `agent-card-hdr` / `agent-card-title-emphasis` / `agent-card-hdr-internal` / `agent-eyebrow` / `agent-card-subtitle` / `agent-press-cell`

These are agent-system utility classes used as a CSS grouping pattern (not "primitives" in the Component-Library catalog sense). They wrap text labels; no JSX structure to canonicalise. Per Law 14 they qualify as theme tokens, not extractable primitives. **No migration.**

---

## Voice sweep status

Grep over user-facing strings on the hub:
- Em-dashes in prose strings: **0**
- "automatically" / "the system" / "the platform": **0**
- "round" as user-facing noun: **0**
- Hedging language: **0**

Hub copy is already voice-clean. No Wave C needed for this surface.

The one "round" appears in a comment ([page.tsx:285-287](../../../app/agent/hub/page.tsx#L285-L287)), not a user-facing string.

---

## Per-PR remediation priority

Two paths, depending on chrome decision in PLAN:

**Path A — full canonicalisation (2 PRs)**
1. Page-level cards + loading-skeleton chrome → Card primitive variant="glass" (visual shift accepted)
2. Loading-skeleton inner Bars → Skeleton primitive

**Path B — chrome grandfather (1 PR)**
1. Loading-skeleton inner Bars → Skeleton primitive (only)

Either path: button swaps deferred to ButtonLink primitive arrival.

---

## Risk profile

| Risk | Mitigation |
|---|---|
| Card primitive's `glass-card` chrome looks materially different from `agent-glass*` after swap | Path B grandfathers chrome; PLAN surfaces the decision before any code change |
| Empty-state regression on the "No exchange dates" line if we adopt `<EmptyState compact>` | Visual check side-by-side before merging; revert via `padding="none"` + className override is trivial |
| Skeleton inner-Bar swap mistakes — wrong widths/heights | Skeleton primitive accepts width + height; mirror PanelSkeletons.tsx semantics from A4 |
| Hub is the daily landing for every director — regressions are highly visible | Ship-and-watch (Surface 1 precedent), single-commit revert if anything looks off |

---

## What's NOT in scope (re-stated from BASELINE §11)

- AttentionListView, UnassignedFilesView, NewBuyersToAcknowledgeView, ChainSetupPendingView, ExpiredHoldsCard internals
- HubCharts internals (ExchangeForecastChart, ServiceSplitDonut, MomentumRing)
- PaymentBlockBanner, PaymentMethodNudge
- AgentFlagButton modal
- `lib/services/hub.ts` server services
- AnimatedSection (already a primitive wrapper)
- Welcome-empty-state extraction to a new component

These get their own surface remediation when their owning route comes up in the Phase 3 queue.
