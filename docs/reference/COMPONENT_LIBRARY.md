# Component Library — Sales Progressor

The canonical UI primitives in the agent app. Every entry lists: **the class or component to use**, **required states**, **animation**, **where it lives in code**, and **known outliers grandfathered from the existing app**.

**Read this before:** building any UI element. If a canonical pattern exists, use it. If one doesn't, add it here before building.

**Grandfather rule:** known outliers in the existing app are listed inline. **Do not refactor them as a side effect of new work.** All existing-app cleanup is Phase 2 (commissioned separately).

---

## Buttons

### Canonical: `agent-btn` system

`<button className="agent-btn agent-btn-md agent-btn-primary">…</button>`

- **Base class:** `agent-btn` (lives at [agent-system.css](../../app/agent/styles/agent-system.css))
- **Size classes:** `agent-btn-sm` / `agent-btn-md` / `agent-btn-lg`
- **Colour classes:** `agent-btn-primary`, `agent-btn-secondary`, `agent-btn-ghost`, `agent-btn-danger`, `agent-btn-warning`, `agent-btn-success`, `agent-btn-info`

**Required states:** every interactive button has hover, active, focus, and disabled built into the colour class. Do not add hover handlers in component code — the CSS already does it.

### `agent-btn-primary` vs `agent-btn-color-primary` (locked)

These are not competing colours. They render identically (coral gradient, white text). The difference:

| Class | Use when | Why |
|---|---|---|
| `agent-btn-primary` | **All new primary CTAs.** Default choice. | Plays nicely with the cascade. |
| `agent-btn-color-primary` | **Escape hatch** — only inside contexts where Tailwind utility classes or inline styles would otherwise win over `agent-btn-primary`. Example: modals embedded in Tailwind-styled new-transaction forms (DuplicateAddressModal, SaveProgressModal). | Uses `!important` on every rule (see [agent-system.css L1357–1375](../../app/agent/styles/agent-system.css)). Defeats the cascade. |

Rule: reach for `agent-btn-primary` first. Only use `agent-btn-color-primary` when you can demonstrate (in a comment) that a parent's CSS is winning. The design proposal locked `agent-btn-color-primary` as the fix for SaveProgressModal / DuplicateModal in 2026-05-08 ([MODAL_DRAWER_SYSTEM.md](MODAL_DRAWER_SYSTEM.md) locked-constraints table) — that's the exact pattern the escape hatch exists for.

### Known outliers (grandfathered)

| Outlier | Where | Note |
|---|---|---|
| Raw Tailwind button (`bg-neutral-800 text-neutral-400`) | [`AcknowledgeButton.tsx`](../../components/agent/AcknowledgeButton.tsx) | Not the agent-btn system. Grandfathered — do not refactor. |
| `agent-btn` + inline `style={{ background, border }}` | [`AgentFlagButton.tsx`](../../components/agent/AgentFlagButton.tsx) | Hybrid pattern. Grandfathered. |
| Inline `onMouseEnter` / `onMouseLeave` for hover | [`SurveyNrConfirmModal.tsx:67–68`](../../components/milestones/SurveyNrConfirmModal.tsx) | Hover state should be CSS, not JS. See [HOVER_STATES.md](HOVER_STATES.md). Grandfathered. |

---

## Modals

### Canonical pattern

Use `createPortal` to `document.body` with the `data-theme` attribute, the `agent-backdrop-overlay` backdrop, and `agent-modal-in` animation on the card. Full structure locked in [MODAL_DRAWER_SYSTEM.md](MODAL_DRAWER_SYSTEM.md) §1.2.

```tsx
createPortal(
  <div data-theme={theme} style={{ position: "fixed", inset: 0, zIndex: 50 }}>
    <div className="fixed inset-0 agent-backdrop-overlay" />
    <div style={{
      position: "relative", zIndex: 1,
      background: "var(--agent-surface-elevated)",
      borderRadius: 16,
      borderTop: "2px solid var(--agent-coral-deep)",
    }}>
      {/* header (flex-shrink-0) → body (flex-1 overflow-y-auto) → footer (flex-shrink-0) */}
    </div>
  </div>,
  document.body
)
```

**Reference implementations:**
- [`AddBrokerModal.tsx`](../../components/brokers/AddBrokerModal.tsx) — canonical reference (after z-index fix `5a7cfa0`)
- [`RelistFileModal.tsx`](../../components/transaction/RelistFileModal.tsx) — canonical multi-stage form modal (after polish `ed10aec`)

### Required parts

- **Accent line:** 2px top border, `var(--agent-coral-deep)`. Always.
- **Close button:** Phosphor `X` icon, `agent-btn-ghost` styling, `rounded-lg` (8px).
- **Backdrop:** `agent-backdrop-overlay` (defined in agent-system.css — `rgba(0,0,0,0.35)` + 4px blur).
- **Escape handler:** every modal listens for `Esc` and calls `onClose`.
- **Animation:** `agent-modal-in` on the card; `agent-backdrop-in` on the backdrop. Timings in [MOTION_GUIDE.md](MOTION_GUIDE.md).
- **Z-index:** 50 default, 1500 when above page overlays, 2000 when nested in another modal. See [DESIGN_TOKENS.md](DESIGN_TOKENS.md#z-index--modal-escalation-rule-locked).
- **Scroll pattern:** header sticky, body `flex:1 overflow-y-auto`, footer sticky. Locked in chain arc commit `ed10aec`.

### Modal-vs-drawer choice

- **Modal** — centred card. Global actions, simple confirmations, celebrations.
- **Drawer** — right-anchored panel. Transaction-scoped actions (edit sale details, chain, broker).

Full decision tree in [MODAL_DRAWER_INDEX.md](MODAL_DRAWER_INDEX.md).

### Known outliers (grandfathered)

| Outlier | Where | Note |
|---|---|---|
| Inline modal (no portal, no shared chrome) | [`StatusControl.tsx`](../../components/transaction/StatusControl.tsx) | Renders modals inline. Uses `data-night` theming attribute (see below). Grandfathered. |
| `nv2-night` + `data-night={isNight ? "" : undefined}` | StatusControl, [`SwitchServiceTypeModal.tsx`](../../components/transaction/SwitchServiceTypeModal.tsx) | Deprecated theming attribute. `data-theme` is canonical. Grandfathered in these two only. |
| Three z-index tiers (50 / 1500 / 2000) co-existing | various | Documented escalation rule (DESIGN_TOKENS.md). Not an outlier — the rule. |

---

## Drawers

### Canonical pattern

Right-anchored panel, full viewport height. Full structure locked in [MODAL_DRAWER_SYSTEM.md](MODAL_DRAWER_SYSTEM.md) §1.1.

**Reference implementations:**
- [`ChainDrawer.tsx`](../../components/chain/ChainDrawer.tsx)
- [`EditSaleDetailsDrawer.tsx`](../../components/transaction/EditSaleDetailsDrawer.tsx)
- [`ArchivedRoundDrawer.tsx`](../../components/transaction/ArchivedRoundDrawer.tsx)

### Required parts

Same chrome as modals (accent line, close button, header/body/footer split) plus:

- **Panel surface:** `rgba(255,255,255,0.92)` background, `backdrop-filter: blur(32px) saturate(1.8)`.
- **Width prop:** `sm` 440 / `md` 460 / `lg` 480 / `xl` 560.
- **Mobile:** full-width below `sm` breakpoint. No mobile-specific redesign in V1.
- **Stacked drawers:** only the topmost drawer renders the 2–3px coral accent line. The drawer behind drops it (`isTopmost={false}`). Locked in [MODAL_DRAWER_SYSTEM.md](MODAL_DRAWER_SYSTEM.md) §1.1.
- **Unsaved changes:** drawers with per-section saves track per-section dirty state. Closing dirty → three-option centred prompt: *Save all changes* / *Discard changes* / *Keep editing*.

---

## Cards

### Canonical: `glass-card` (locked)

`glass-card` is canonical for new card work. 130 uses across the codebase. Defined in [globals.css](../../app/globals.css) (unlayered at L127–141 + layered at L204–213).

```tsx
<div className="glass-card p-5">…</div>
```

**Variants:**
- `glass-card-strong` — for elevated/raised cards (e.g. WelcomeModal, AddFirmModal, FeedbackModal, MortgageModal)
- `glass-subtle` — minimal blur, dense lists
- `glass-panel-dark` — dark glass over photo backdrop. Use only with `text-label-*-on-dark` utilities.

### Hub card chrome (recurring convention)

For hub-page action cards: coral left border + `agent-coral-bg-tint` background. Replicated across [`NewBuyersToAcknowledgeView.tsx`](../../components/hub/NewBuyersToAcknowledgeView.tsx) and [`ChainSetupPendingView.tsx`](../../components/hub/ChainSetupPendingView.tsx). See [DECISIONS.md](../DECISIONS.md) entry.

### Legacy: `agent-glass*` family

`agent-glass` / `agent-glass-strong` / `agent-glass-subtle` / `agent-glass-light` are **legacy**. Allowed where already used, **not for new work**. They render frosted surfaces with theme-aware tokens (`--agent-glass-bg`, etc.) and predate the consolidation to `glass-card`.

### Portal cards (intentionally separate)

`components/portal/*` use a separate `P.cardBg` token from [`portal-ui.tsx`](../../components/portal/portal-ui.tsx) — solid white, not frosted. Buyer/seller portal is a different surface; the separation is deliberate.

---

## Banners

### Canonical: `<AgentBanner>` (already a wrapper component)

Lives at [`components/ui/AgentBanner.tsx`](../../components/ui/AgentBanner.tsx). Four semantic kinds via tokens:

| Kind | Token group | Use when |
|---|---|---|
| `info` | `--agent-info-*` | informational, neutral |
| `warning` | `--agent-warning-*` | quiet attention, needs review |
| `danger` | `--agent-danger-*` | at-risk, attention required |
| `success` | `--agent-success-*` | confirmation, complete |

**Composition:** icon + title + body + optional action button + optional dismiss. Casing: sentence-case title with terminal period.

### Reference implementations

- [`OnHoldBanner.tsx`](../../components/transaction/OnHoldBanner.tsx) — file-on-hold state
- [`RelistBanner.tsx`](../../components/transaction/RelistBanner.tsx) — fell-through state
- [`ChainSetupFailedBanner.tsx`](../../components/transaction/ChainSetupFailedBanner.tsx)
- [`FileHealthBanner.tsx`](../../components/transaction/FileHealthBanner.tsx)

### Banner tone (locked)

The colder, procedural register on `OnHoldBanner` ("All automation is frozen: no client emails, no agent reminders, no escalations") is **deliberate**. Rule:

- **State-freeze messages** (on-hold, paused, blocked) — factual and procedural. Lists what's not happening.
- **Forward-motion messages** (relist, exchange, complete) — warm and forward-looking. Past tense for events, future tense for next steps.

See [VOICE.md](VOICE.md) for the full rule.

### Known outliers (grandfathered)

| Outlier | Where | Note |
|---|---|---|
| `ReconcileLaterBanner` (inline-styled, predates AgentBanner) | [`components/transaction/ReconcileLaterBanner.tsx`](../../components/transaction/ReconcileLaterBanner.tsx) | Grandfathered. Phase 2 candidate. |
| Inline cascade-explanation `<div>` (banner-like styling, one-off) | [`StatusControl.tsx:331–348`](../../components/transaction/StatusControl.tsx) | Not exported, not an AgentBanner. Grandfathered. |

---

## Inputs

### Canonical: `glass-input` and `agent-input`

- `glass-input` — for glass surfaces (over photo backdrop). Standardised border, focus ring, placeholder colour. Definition: [globals.css L285–310](../../app/globals.css).
- `agent-input` — for agent app interior surfaces (modals, drawers). Same standardisation, theme-tinted.

**Required states:** idle, hover, focus (with `--agent-focus-ring`), disabled. All baked into the CSS class. Do not roll your own border/bg/focus combinations.

**Mobile floor:** 16px font size below `< 768px` (iOS Safari zoom prevention).

### Field wrappers

Where a label + input combo recurs, wrap it. Pattern in use:
- [`components/transaction/EditSaleDetailsDrawer.tsx`](../../components/transaction/EditSaleDetailsDrawer.tsx) — field block with label, required marker, dirty indicator

No standalone `<Field>` primitive exists yet. Phase 2 candidate: extract.

---

## Chips / badges / pills

There is **no canonical badge primitive**. Five rolling-their-own approaches in active use. Phase 2 candidate: consolidate.

| Component | Location | Used for |
|---|---|---|
| `StatusBadge` | [`components/ui/StatusBadge.tsx`](../../components/ui/StatusBadge.tsx) | Generic status (Tailwind-based). Sparse use. |
| `ChainStatusBadge` (inline fn) | inside [`LinkCard.tsx`](../../components/chain/LinkCard.tsx) | Chain link status. Hardcoded colour map. |
| Withdrawal badges (`BADGE_STYLE` const) | inside [`LinkCard.tsx`](../../components/chain/LinkCard.tsx) | REMARKETING / WAITING / BREAK_CHAIN / WITHDRAWN. Distinct from ChainStatusBadge. |
| `RoundChip` | [`components/transaction/RoundChip.tsx`](../../components/transaction/RoundChip.tsx) | Interactive button with 3D flip animation, theme-aware. Not a pure display badge. |
| `DeltaPill` / `StatPill` / `LastContactedPill` | various | Context-specific KPI primitives. |

**For new work:** if you need a status pill, use `StatusBadge` first. If it doesn't fit, add the new variant to `StatusBadge` rather than rolling a sixth approach.

---

## Sections + section labels

### Canonical eyebrow: `glass-section-label`

For section labels between cards. UPPERCASE, letter-spaced, micro-scale. Definition: [globals.css L319+](../../app/globals.css).

### Agent-system section heading classes

`.agent-section-title`, `.agent-section-eyebrow` — for in-modal section breaks. Defined in agent-system.css.

---

## Hub-card chrome (convention)

For hub-page cards that prompt agent action: coral left border (`borderLeft: 3px solid var(--agent-coral-deep)`) + tinted background (`background: var(--agent-coral-bg-tint)`). Used by NewBuyersToAcknowledgeView and ChainSetupPendingView. See [DECISIONS.md](../DECISIONS.md).

---

## How to add a new primitive

1. Write a one-paragraph spec into this file under the appropriate section.
2. Add the CSS to [`agent-system.css`](../../app/agent/styles/agent-system.css) (or [`globals.css`](../../app/globals.css) if it's a glass-system primitive).
3. Update [`design/tokens.ts`](../../design/tokens.ts) if you added a new token.
4. Build the component in `components/ui/` (if it needs a React wrapper).
5. Add a row to the relevant section of this doc with `lives at:` pointer.

See [CONVENTIONS.md](../CONVENTIONS.md) for the full recipe.

---

## Phase 2 consolidation backlog (not in scope for Phase 1)

These would be high-value follow-ups but are explicitly out of scope for the Phase 1 docs-only pass:

- Extract `<Modal>` / `<Drawer>` / `<Button>` / `<Field>` React wrappers around the canonical patterns above.
- Consolidate the five badge/chip approaches into one primitive.
- Migrate `agent-modal-in` from 240ms to the locked 280ms spec.
- Migrate `agent-btn-color-primary` callsites that aren't fighting the cascade back to `agent-btn-primary`.
- Reconcile `--agent-z-modal: 1000` with the operational 50 / 1500 / 2000 escalation rule.
- Migrate `data-night` / `nv2-night` callsites (StatusControl, SwitchServiceTypeModal) to `data-theme`.
- Replace `ReconcileLaterBanner` with `AgentBanner`.
- Sweep inline `onMouseEnter` / `onMouseLeave` handlers (SurveyNrConfirmModal etc.) to CSS hover.
