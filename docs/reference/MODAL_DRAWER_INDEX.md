# Modal & Drawer Index — Sales Progressor

A pointer doc. The locked design system lives in [MODAL_DRAWER_SYSTEM.md](MODAL_DRAWER_SYSTEM.md) (1,224 lines). This index tells you when to consult it, where the key sections are, and which existing components map to which pattern.

**Read this before:** building any modal or drawer. Then dive into the system doc for the section you need.

---

## When to consult [MODAL_DRAWER_SYSTEM.md](MODAL_DRAWER_SYSTEM.md)

- Building a new modal or drawer (always)
- Editing chrome (header, body, footer, accent line) on an existing one
- Deciding between modal vs drawer
- Adding a stacked modal or stacked drawer
- Touching backdrop, theming, or animation

If you're not sure, read the TL;DR at the top of the system doc.

---

## Modal vs drawer — quick decision

| Choose modal when… | Choose drawer when… |
|---|---|
| Action is global (not tied to a specific transaction) | Action is scoped to one transaction file |
| Confirmation or celebration | Edit/edit-many of file data (sale details, chain, broker) |
| Single-step or short multi-step | Per-section saves, can leave dirty without losing work |
| Sits over an already-busy background | Sits over a calmer surface |

Examples:
- **Modal:** WelcomeModal, AddBrokerModal, ExchangeCelebration, RelistFileModal, SurveyNrConfirmModal
- **Drawer:** ChainDrawer, EditSaleDetailsDrawer, ArchivedRoundDrawer, ChaseDrawer, AddNodeDrawer

---

## Where the locked decisions live

| Topic | Section | What's locked |
|---|---|---|
| Primitives (8 building blocks) | §1.1–1.8 | Drawer, Modal, Header (3 variants), Body, Footer (4 patterns), Backdrop, Accent line, Close button |
| Backdrop | §5 | `agent-backdrop-overlay`, rgba(0,0,0,0.35) + 4px blur, 200ms ease entrance |
| Animation | §6 | 280ms `cubic-bezier(0.34, 1.56, 0.64, 1)` spring overshoot. Both modals + drawers. |
| Theming | §7 | `data-theme` attribute, surface tokens (§7.3) |
| Per-component migration order | Phase 1–7 (lines ~1100+) | Which components migrate first, what each one needs |

---

## Reference implementations

Pick the nearest reference to what you're building. Copy its chrome.

| Pattern | Reference |
|---|---|
| Canonical modal (post z-index escalation fix) | [`AddBrokerModal.tsx`](../../components/brokers/AddBrokerModal.tsx) |
| Canonical multi-stage form modal (sticky header + footer, scrollable body) | [`RelistFileModal.tsx`](../../components/transaction/RelistFileModal.tsx) |
| Variant A simple confirmation modal | [`SurveyNrConfirmModal.tsx`](../../components/milestones/SurveyNrConfirmModal.tsx) |
| Canonical drawer with per-section saves | [`EditSaleDetailsDrawer.tsx`](../../components/transaction/EditSaleDetailsDrawer.tsx) |
| Canonical drawer with inline ConfirmRow | [`ChainDrawer.tsx`](../../components/chain/ChainDrawer.tsx) |

---

## Required parts (don't skip any)

Every modal and drawer ships with all of:

- [ ] **2px coral accent line** at the top edge (`var(--agent-coral-deep)`)
- [ ] **Phosphor `X` close button** (`rounded-lg`, `agent-icon-btn` chrome) — see [HOVER_STATES.md](HOVER_STATES.md#5-icon-button-close-dismiss-expand--background-tint)
- [ ] **Backdrop**: `agent-backdrop-overlay` class (defined in `agent-system.css`)
- [ ] **`agent-modal-in`** (modal) or **`agent-drawer-in`** (drawer) animation on the surface
- [ ] **`agent-backdrop-in`** on the backdrop (200ms ease)
- [ ] **Escape handler** that calls `onClose`
- [ ] **`data-theme={theme}`** attribute (NOT `data-night` — that's deprecated, see outliers below)
- [ ] **Z-index** chosen per [DESIGN_TOKENS.md](DESIGN_TOKENS.md#z-index--modal-escalation-rule-locked) escalation rule
- [ ] **Voice-passed** body copy and CTAs ([VOICE.md](VOICE.md))

---

## Animation timing (locked, with known divergence)

**Locked:** 280ms `cubic-bezier(0.34, 1.56, 0.64, 1)` spring overshoot, for both modals **and** drawers. See [MODAL_DRAWER_SYSTEM.md §6](MODAL_DRAWER_SYSTEM.md).

**Known outlier:** [`agent-system.css`](../../app/agent/styles/agent-system.css) currently ships `agent-modal-in` at **240ms `cubic-bezier(0.25, 0, 0, 1)`**. This is the as-built reality the spec aims to close. Phase 2 migration target.

**For new work:** use whatever `agent-modal-in` / `agent-drawer-in` currently is in the CSS — don't fight the outlier. When Phase 2 migrates the timing, all callsites benefit at once.

---

## Z-index escalation

Default **50**. Escalate only when stacking demands. See [DESIGN_TOKENS.md](DESIGN_TOKENS.md#z-index--modal-escalation-rule-locked).

| Tier | When |
|---|---|
| 50 | Default. Most modals. |
| 1500 | Modal sits above a page-level overlay (drawer backdrop, sticky bar). |
| 2000 | Modal opens on top of another modal. |

Don't invent a fourth tier. If you're considering one, the UX is the problem.

---

## Known outliers (grandfathered, do not refactor)

| Outlier | Where | Note |
|---|---|---|
| `data-night={isNight ? "" : undefined}` instead of `data-theme={theme}` | [`StatusControl.tsx`](../../components/transaction/StatusControl.tsx), [`SwitchServiceTypeModal.tsx`](../../components/transaction/SwitchServiceTypeModal.tsx) | Deprecated theming attribute. `data-theme` is canonical. Grandfathered in these two. |
| Inline modals (no portal, no shared chrome) | [`StatusControl.tsx`](../../components/transaction/StatusControl.tsx) | Renders modals inline. Grandfathered. Phase 2 candidate: extract. |
| `ArchivedRoundDrawer` missing accent line | [`ArchivedRoundDrawer.tsx`](../../components/transaction/ArchivedRoundDrawer.tsx) | Pre-system. Phase 2 candidate: add accent line. |
| `agent-modal-in` 240ms `cubic-bezier(0.25, 0, 0, 1)` (vs spec 280ms spring) | [`agent-system.css`](../../app/agent/styles/agent-system.css) keyframe | Phase 2 migration. |
| `--agent-z-modal: 1000` token unused | [`themes.css`](../../app/agent/styles/themes.css) | Operational escalation rule uses 50 / 1500 / 2000. |
| `ExchangeCelebration` `z-[200]` (not a Modal primitive) | [`ExchangeCelebration.tsx`](../../components/transaction/ExchangeCelebration.tsx) | One-off full-screen overlay. Intentional. |

---

## Adding a stacked drawer

If a new drawer can be opened while another drawer is already open (e.g. `AddNodeDrawer` from `ChainDrawer`):

1. The new (topmost) drawer renders the accent line as normal.
2. The drawer behind passes `isTopmost={false}` and drops `border-top: none`.
3. Stack via z-index, not via overlay (each drawer has its own backdrop).

Locked in [MODAL_DRAWER_SYSTEM.md §1.1](MODAL_DRAWER_SYSTEM.md).

---

## Adding a stacked modal

If a new modal opens on top of another (e.g. AddBrokerModal from a drawer that has a modal in front of it):

1. New modal sits at z-index **2000** (the "deep" tier).
2. Backdrop still renders — modal stacks above its own backdrop above the existing modal.
3. Pass focus management explicitly: when the deep modal closes, focus returns to the modal behind, not to the drawer underneath.

Precedent: AddBrokerModal at z-index 2000 after commit `5a7cfa0`.
