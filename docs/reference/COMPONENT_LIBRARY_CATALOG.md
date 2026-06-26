# Component Library — Catalog

The closed catalog of every UI primitive in this codebase. Referenced by [Law 14 (every UI element is a library component)](../../CLAUDE.md#law-14--every-ui-element-is-a-library-component) and [Law 19 (grandfather generously)](../../CLAUDE.md#law-19--grandfather-generously) in CLAUDE.md.

**Sibling doc:** [COMPONENT_LIBRARY.md](COMPONENT_LIBRARY.md) — the developer reference for how to use the canonical patterns (CSS classes, props, examples). This catalog is the **what** (closed list); the sibling is the **how** (usage).

---

## What this catalog is

A **closed** list of every UI primitive the codebase will use. "Closed" means:

- If a pattern is canonical, it lives in `components/ui/` and has an entry below.
- If a pattern is duplicated and should be extracted, it's listed under "To extract" with the current bespoke files marked for migration.
- If a pattern is genuinely one-of-a-kind and stays in a domain folder, it's listed as "Domain-specific" with a one-line reason.
- If a pattern is known wrong but not safe to migrate yet, it's listed as "Outlier (grandfathered)" with a quarterly review date.

**Nothing in this codebase is canonical without an entry here.** A new primitive added to `components/ui/` without a catalog entry violates [Law 14](../../CLAUDE.md#law-14--every-ui-element-is-a-library-component).

The catalog is the contract between the assistant and the founder: when the assistant proposes a new component, the answer is always "where does it sit in COMPONENT_LIBRARY?" If the answer is "it's a new line in 'To extract'", the assistant proposes the entry **before** writing the component.

---

## The numbers (current state, 2026-06-26)

| Metric | Count |
|---|---|
| Canonical primitives in `components/ui/` | 9 |
| Bespoke components in domain folders | 273 |
| Ratio bespoke : canonical | 30 : 1 |
| Files using the `glass-card` utility class | 56 |
| Files using the `agent-btn` utility class | 54 |
| Files using `agent-acc-*` accordion classes | 15 |
| Bespoke Modal components | 18 |
| Bespoke Banner components | 12 |
| Bespoke Card components | 15 |
| Bespoke Drawer components | 6 |

A healthy ratio is closer to 1 : 1 or 1 : 2. We're at 1 : 30. That's the gap.

---

## 1. Canonical primitives (in `components/ui/`)

The 9 components that already exist as primitives. Each gets the same row in this catalog: **purpose · props sketch · states · used by · status**.

### 1.1 `AgentBanner` ✓ canonical

- **Purpose:** standing notice at the top of a surface. Warning / info / success variants.
- **Used by:** ChainDeclineBanner, DirectorJoinedBanner, ExchangeBanner, OnHoldBanner, RelistBanner (the 5 known consumers).
- **Status:** **canonical, under-adopted.** The 12 bespoke banners listed below in §2.3 should migrate to wrap this primitive.

### 1.2 `Avatar` ✓ canonical

- **Purpose:** initials-in-a-circle avatar with optional photo. Sized variants.
- **Used by:** hub, transaction sidebar, contact rows.
- **Status:** canonical. Verify all `<div className="rounded-full ...">` patterns in domain folders aren't duplicating this — likely a sweep needed.

### 1.3 `EmptyState` ✓ canonical

- **Purpose:** empty-pool surface (illustration + heading + description + optional CTA).
- **Used by:** lists, hub cards.
- **Status:** **canonical, badly under-adopted.** 4+ surfaces ship inline empty states without using this primitive. Sweep needed during Phase 3.

### 1.4 `PageHeader` ✓ canonical

- **Purpose:** title + subtitle + optional actions slot at the top of a route.
- **Used by:** all `/agent/*` route pages.
- **Status:** canonical. Strong adoption.

### 1.5 `PriceInput` ✓ canonical

- **Purpose:** £ input with formatting, locale, currency unit.
- **Used by:** new-sale form, edit-sale drawer, fee fields.
- **Status:** canonical. Form-context only.

### 1.6 `RoleIcon` ✓ canonical

- **Purpose:** small role-typed glyph (vendor / purchaser / solicitor / broker).
- **Used by:** contact lists, comm rows, reminder rows.
- **Status:** canonical. Strong adoption.

### 1.7 `SavingPulse` ✓ canonical

- **Purpose:** "saving…" micro-indicator, debounced.
- **Used by:** inline forms.
- **Status:** canonical.

### 1.8 `StatusBadge` ✓ canonical

- **Purpose:** small pill: status text + colour variant (active / on_hold / completed / withdrawn).
- **Used by:** file headers, list rows.
- **Status:** canonical. The 4 bespoke pill/chip components in §2.5 should consider migrating or stay as semantically-distinct primitives.

### 1.9 `TimelineIcon` ✓ canonical

- **Purpose:** small glyph for activity / timeline rows.
- **Used by:** activity feed, recent updates.
- **Status:** canonical.

---

## 2. To extract — canonical primitives needed

Patterns that are duplicated multiple times across domain folders and should become primitives. Listed in **extraction priority** (most duplicated first). Phase 2 of [BUILD_PLAN.md](../BUILD_PLAN.md) walks this list.

### 2.1 `Card` ✓ shipped 2026-06-26 (Phase 2 Week 4)

- **Status:** canonical. Lives at [components/ui/Card.tsx](../../components/ui/Card.tsx).
- **API:**
  ```tsx
  <Card
    variant="glass" | "solid"        // glass = backdrop-filter + gradient (default); solid = white surface
    padding="none" | "sm" | "md" | "lg"
    interactive                       // cursor + hover shadow + focus-within ring
    loading                           // skeleton overlay, content stays visible underneath
    className                         // passthrough for additional utilities
  >
    {children}
  </Card>
  ```
- **States rendered in gallery:** default, hover, focus-within, loading, all padding sizes, both variants, mobile 375px.
- **Gallery:** [/dev/gallery/card](../../app/dev/gallery/card/page.tsx). Blocked in production.
- **Visual regression:** [e2e/gallery-card.spec.ts](../../e2e/gallery-card.spec.ts). Captures every state.
- **Compound parts (`Card.Header`, `Card.Body`, `Card.Footer`):** intentionally NOT shipped in Phase 2 Week 4. Sub-parts emerge from the first real surface remediation that needs them (Law 14 — never roll a primitive without writing down what it is first; sub-parts will get their own catalog entries when designed from a real consumer).
- **Migration footprint:** 56 files using `glass-card` utility class directly + 15 bespoke `*Card.tsx` files. Each migration is hand-rolled per consumer (Law 16). Order:
  1. ✓ Gallery (proof consumer, 2026-06-26)
  2. Hub cards (ExpiredHoldsCard, HubEmptyWelcomeCard) — single-route, low blast radius
  3. Transaction sidebar cards
  4. Portal cards (PortalNextActionCard, ExplainEmailCard) — customer-facing, do last with most care
- **Estimate:** 1 week to build + gallery; 2 weeks to migrate consumers (interleaved with other Phase 3 work).

### 2.2 `Modal` — HIGH priority

- **Current state:** 18 bespoke modal components. The existing [docs/reference/MODAL_DRAWER_SYSTEM.md](../reference/MODAL_DRAWER_SYSTEM.md) documents the pattern but no extracted primitive enforces it.
- **Why it matters:** modal z-index, backdrop, escape-key behaviour, focus trap, scroll lock — all replicated bespoke per file. The 2026-06-05 z-index escalation incident (see [DECISIONS.md](../DECISIONS.md)) was caused by this.
- **API sketch:**
  ```tsx
  <Modal open={open} onClose={onClose} size="sm" | "md" | "lg" zLayer="default" | "escalated" | "deep">
    <Modal.Header title="..." onClose />
    <Modal.Body>...</Modal.Body>
    <Modal.Footer>...</Modal.Footer>
  </Modal>
  ```
- **States:** closed, opening (animation), open, closing, error (form submission failure), loading (action in flight).
- **Existing 18 bespoke modals to migrate:** WelcomeModal, BillingNegotiatorModal, TrialBannerWithModal, TrialExpiredModal, AddBrokerModal, EmailPreviewModal, MortgageModal, ReconciliationModal, SurveyNrConfirmModal, UndoMilestoneModal, AddFirmModal, AutomationStopModal, ClaimWelcomeModal, RelistFileModal, SwitchServiceTypeModal, DuplicateAddressModal, ChangeFileModal, NavAwayModal.
- **Migration order:** lowest-stakes first (EmailPreviewModal, AddBrokerModal, AddFirmModal). Highest-stakes last (RelistFileModal, ReconciliationModal). Some may be **grandfathered** if their behaviour can't be safely matched.
- **Estimate:** 1 week to build + gallery; 4 weeks to migrate (1 modal per day-ish, with verification).

### 2.3 `Banner` — HIGH priority (`AgentBanner` exists, under-adopted)

- **Current state:** `AgentBanner` exists in `components/ui/`. 12 bespoke banner files exist in domain folders that don't use it.
- **Why it matters:** voice consistency, icon consistency, action button styling, dismissibility. The "This sale fell through" banner versus "Trial expired" banner currently have different shapes.
- **Action:** migrate the 12 bespoke banners to wrap `AgentBanner`. Some may need new variant props (e.g. dismissible, with action, with secondary action) — extend the primitive rather than fork.
- **Bespoke banners to migrate:** ChainDeclineBanner, DirectorJoinedBanner, CookieConsentBanner, PaymentBlockBanner, TrialBannerWithModal, ExchangeBanner, ChainSetupFailedBanner, FileHealthBanner, OnHoldBanner, ReconcileLaterBanner, RelistBanner, OutsourcedBanner.
- **Estimate:** 0 weeks to build (exists). 1 week to extend props + migrate 12 consumers.

### 2.4 `Drawer` / `Sheet` — HIGH priority

- **Current state:** 6 bespoke drawer components. Documented pattern in [docs/reference/MODAL_DRAWER_SYSTEM.md](../reference/MODAL_DRAWER_SYSTEM.md), no extracted primitive.
- **Why it matters:** same as Modal — z-index, backdrop, escape, focus, scroll lock. Mobile drawer-from-bottom variant especially needs canonical motion.
- **API sketch:**
  ```tsx
  <Drawer open onClose side="right" | "bottom" size="sm" | "md" | "lg">
    <Drawer.Header />
    <Drawer.Body />
    <Drawer.Footer />
  </Drawer>
  ```
- **Bespoke drawers to migrate:** AddNodeDrawer, ChainDrawer, ChaseDrawer, ReconciliationDrawer, ArchivedRoundDrawer, EditSaleDetailsDrawer.
- **Estimate:** 1 week to build + gallery; 2 weeks to migrate.

### 2.5 `Button` — HIGH priority (CSS class only, no primitive)

- **Current state:** 54 files use the `agent-btn` utility class directly. No `Button` primitive.
- **Why it matters:** spinner-on-loading, disabled appearance, danger variant, hover/focus/active states all replicated in CSS class combinations.
- **API sketch:**
  ```tsx
  <Button variant="primary" | "secondary" | "ghost" | "danger" size="sm" | "md" | "lg" loading disabled>
    Click me
  </Button>
  ```
- **States:** default, hover, focus, active, disabled, loading.
- **Estimate:** 0.5 week to build; 2 weeks to migrate consumers (mostly mechanical class → component swap).

### 2.6 `Accordion` (section disclosure) — MEDIUM priority

- **Current state:** 15 files use the `agent-acc-*` CSS classes (`.agent-acc-hdr`, `.agent-acc`, `.agent-acc-in`). No primitive.
- **Why it matters:** open/close animation, click handler, keyboard support (Enter/Space toggle), aria-expanded, focus ring — replicated 15 ways.
- **API sketch:**
  ```tsx
  <Accordion defaultOpen>
    <Accordion.Header>Pending now</Accordion.Header>
    <Accordion.Body>...</Accordion.Body>
  </Accordion>
  ```
- **Used by:** RemindersSection, AutomatedEmailsCard, hub accordions, file detail sections.
- **Estimate:** 0.5 week to build; 1 week to migrate.

### 2.7 `Pill` — MEDIUM priority

- **Current state:** `StatusBadge` exists. 4 bespoke pill/chip components: DeltaPill, LastContactedPill, StatPill, RoundChip.
- **Decision (locked 2026-06-26):** one `Pill` primitive with variants. `StatusBadge` is absorbed and re-exported as a `Pill variant="status"` alias for backwards compatibility during migration.
- **API sketch:**
  ```tsx
  <Pill variant="status" | "delta" | "stat" | "info" | "round" tone="default" | "warning" | "danger" | "success">
    Active
  </Pill>
  ```
- **Migration order:** extract `Pill` first; alias `StatusBadge` → `Pill variant="status"`; migrate 4 bespoke pills next.
- **Estimate:** 0.5 week.

### 2.8 `Toast` — MEDIUM priority

- **Current state:** `AgentToaster` exists as the toast renderer. 2 bespoke toast components (ClaimedToast, NewTransactionToast) use bespoke styling.
- **Action:** extract a `Toast` primitive that the `AgentToaster` renders. Migrate the 2 bespoke ones.
- **Estimate:** 0.5 week.

### 2.9 `Section` — MEDIUM priority

- **Current state:** 20+ files have a "Section" in their name. Inconsistent shape: some are accordion-wrapped, some are plain. Often a flat heading + body.
- **Action:** if it's a card-shaped section → use `Card`. If it's an accordion → use `Accordion`. The standalone `Section` primitive is probably **not needed** — it's a layout composition, not a distinct primitive. **Recommend: do not extract.**
- **Estimate:** 0 weeks (no extraction, just enforcement via Law 14).

### 2.10 Form fields — MEDIUM priority

- **Current state:** 3 `*Field*.tsx` files, 13 `*Form*.tsx`. No `Input` / `Select` / `TextArea` / `Field` primitives. Forms use raw HTML elements with bespoke styling.
- **Why it matters:** label position, error state, required indicator, focus ring, helper text — all replicated.
- **API sketch:**
  ```tsx
  <Field label="..." error="..." required helperText="...">
    <Input value onChange placeholder />
  </Field>
  ```
- **Decide later:** form work is below-the-line for Phase 2. Estimate after Phase 3 starts — many of the bespoke forms are about to be remediated as part of surface remediation, so the canonical form primitives can emerge from that work rather than being designed in vacuum.
- **Estimate:** TBD.

### 2.11 `Skeleton` / `LoadingState` — LOW priority

- **Current state:** 4 files use `animate-pulse` for skeletons. SpLoadingShell + PanelSkeletons exist as bespoke. No primitive.
- **Action:** extract a `Skeleton` primitive with variants (line, block, circle, card). Migrate 4 inline pulse usages.
- **Estimate:** 0.5 week.

### 2.12 `Tabs` — LOW priority

- **Current state:** 1 `*Tabs*.tsx` file. Tabs appear inline in 5-10 places (Overview / Steps / Reminders / To-Do / Activity on file detail).
- **Action:** extract a `Tabs` primitive. Low priority — the inline tabs work and there's only one prominent consumer (file detail).
- **Estimate:** 0.5 week, defer to Phase 3 of file detail remediation.

---

## 3. Domain-specific (stays where it is)

Patterns that genuinely belong to one domain. Listed for completeness — these don't move to `components/ui/` and don't get migrated.

- **`AgentToaster`** — top-level toast renderer mount, not a primitive instance.
- **`NavAwayModal`** — form-flow-specific; its "you have unsaved changes" semantics aren't a general modal pattern.
- **`MemoStatusBar`** — claim-wizard-specific status indicator.
- **`HeroCard`** — claim-wizard hero card with specific layout.
- **`PropertyIntelCard`** — Land Registry / EPC data card with specific data shape.
- **`RoundChip`** — sale-history chip with hover-reveal "View previous sale". Possibly a candidate for `Pill` variant; defer the call.
- **`StatusControl`** — status dropdown with confirmation modal. File-detail-specific.
- **`AutomationStopModal`** — confirm-then-cancel-flow, file-detail-specific.

Each gets a one-line "why" in the eventual catalog. If a domain folder has 5+ components, that folder needs a `README.md` listing them per [Law 14](../../CLAUDE.md#law-14--every-ui-element-is-a-library-component).

---

## 4. Outlier (grandfathered)

Patterns known to be wrong but not safe to migrate without behavioural risk. Per [Law 19](../../CLAUDE.md#law-19--grandfather-generously), they stay until either (a) their surface comes up for remediation, or (b) the quarterly review reclassifies them.

**Initial entries (founder confirm):**

- **`transactions/` vs `transactions-v2/`** — two parallel implementations of the new-sale form. v2 is the active one; v1 is being phased out. Grandfathered until v1 is fully decommissioned.
- **`transaction/PanelSkeletons`** — bespoke skeletons for file-detail panels. Inline rendering matches the panel grid exactly. Migrate during file-detail Phase 3 remediation, not before.
- **All `*Banner.tsx` files in domain folders** — listed in §2.3 for migration during Banner extraction. Until then, grandfathered.
- **Inline glass-card class usage in 56 files** — migrate during Card extraction. Until then, grandfathered.

Quarterly review date: **2026-09-26** (next quarter). Each grandfathered entry gets a decision: migrate / stay grandfathered / promote to canonical.

---

## 5. The gallery contract

Every canonical primitive renders in `/dev/gallery` in every state. The gallery is gated to dev / preview environments via a feature flag (no prod build).

For each primitive, the gallery story shows:

1. Default state (props at their defaults)
2. Every variant
3. Every size
4. Hover, focus, active, disabled (where interactive)
5. Loading
6. Empty / error (where the component owns state)
7. Mobile 375px AND desktop 1280px

The gallery is the **Phase 2 acceptance gate** per [BUILD_PLAN.md](../BUILD_PLAN.md). The founder walks `/dev/gallery` on desktop and on a real phone, ticks every primitive, and only then does Phase 3 (surface remediation) begin.

Visual regression in CI ([Law 18](../../CLAUDE.md#law-18--visual--behavioural-regression-in-ci)) captures `toHaveScreenshot()` of every gallery state. Any unexplained pixel diff blocks the PR.

---

## 6. Naming conventions

- **PascalCase** for component names: `Card`, `Modal`, `Button`.
- **kebab-case** for file names: `card.tsx`, `modal.tsx`. (Existing primitives use PascalCase filenames — keep existing, use kebab-case for new ones.)
- **No prefix** on canonical primitives: `Card`, not `AgentCard` or `UiCard`. Domain-specific keeps the domain prefix: `HubCard`, `PortalCard`.
- **Compound primitives use dot notation**: `Card.Header`, `Modal.Footer`. The export is a single name; sub-parts hang off it.
- **`*Provider`** for context providers: `ToastProvider`. Mounted near app root.

---

## 7. Migration order (proposed Phase 2 sequence)

This becomes the canonical order in [BUILD_PLAN.md](../BUILD_PLAN.md). 8 primitives across 4-6 weeks.

| Week | Primitive | Why this order |
|---|---|---|
| 1 | `Card` | Most-duplicated. Unlocks every surface remediation. |
| 2 | `Button` | High-frequency, mechanical migration. Builds momentum. |
| 2-3 | `Banner` (extend AgentBanner) | Exists, just extend + migrate 12 consumers. |
| 3 | `Pill` | Light-touch. Low risk. Unlocks `StatusBadge` consolidation. |
| 3-4 | `Modal` | Higher complexity — z-index, focus, scroll. Worth own slot. |
| 4-5 | `Drawer` | Same complexity class as Modal. Builds on shared primitives. |
| 5 | `Accordion` | Mechanical. 15 consumers. |
| 5-6 | `Skeleton` | Light. Bundled with `Toast` if time. |
| 6 | Gallery polish + acceptance gate | Founder review before Phase 3 starts. |

---

## 8. What gets enforced

Once this catalog is approved:

- **Law 14** (mechanically enforced by pre-commit hook): new files in `components/<domain>/` that match a pattern listed in §2 "to extract" are blocked. Override via `LAWS-OVERRIDE: 14 <reason>` if there's a genuine reason.
- **Catalog updates require a PR** with founder review. The catalog is the source of truth; the code follows the catalog, not the other way around.
- **Domain folders with 5+ components need a `README.md`** listing each component and a one-line "why this is domain-specific."
- **Quarterly review** of grandfathered entries.

---

## 9. Decisions locked at Phase 0 sign-off (2026-06-26)

- **§2.7 Pill consolidation:** **one** `Pill` primitive with variants (`status`, `delta`, `stat`, `info`, `round`). `StatusBadge` aliases for compatibility.
- **§2.10 Form fields:** **defer** form-field extraction to Phase 3 surface remediation. Primitives emerge from real consumers, not designed in vacuum.
- **§3 RoundChip:** **domain-specific** until the `Pill` primitive's variant set proves it can support the hover-reveal flip motion. Re-evaluated at the quarterly review.

---

## 10. Footnotes

- This document is binding. Re-read at the start of any non-trivial UI task.
- Companion docs: [CLAUDE.md Laws](../../CLAUDE.md#laws), [POLISH_TBD.md](../POLISH_TBD.md), [BUILD_PLAN.md](../BUILD_PLAN.md).
- Last updated: 2026-06-26 (Phase 0 sign-off; locked decisions baked in).
