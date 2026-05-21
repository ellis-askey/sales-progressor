# Drawers & Modals Audit

**Scope:** Agent app only (`/agent/*`). Every overlay component — drawers, modals, inline portals — in the codebase.
**Status:** Audit only. No components modified.
**Date:** 2026-05-08

---

## 0. Decisions applied to framing

The following product decisions are treated as locked and are not re-litigated. They inform how mismatches and gaps are flagged throughout.

- **Drawers** = transaction-specific actions (contextual to a file in view)
- **Modals** = global actions (welcome, settings, simple non-contextual edits)
- **Edit Sale Details** will become a drawer consolidating all editable fields currently scattered as inline "Edit" links across the property file sidebar
- **Progressor fee** is system-derived and must never have an edit affordance
- **Medium theming:** section labels, primary CTAs, focus states, icon tints, and a header accent line theme to the active brand theme; body surfaces, text, borders, and inputs stay neutral
- **Never-theme functional colours:** WhatsApp green, Email coral (in ChaseDrawer), success green, danger red, warning amber, info blue, AI purple, status badges, tone pills

---

## 1. Complete Inventory

| # | Component | File | Trigger | Type | Purpose | Scope | Type correct? |
|---|---|---|---|---|---|---|---|
| 1 | ChainDrawer | `components/chain/ChainDrawer.tsx` | "View chain" button on property file | Drawer | Chain progress viewer, node management | Transaction | ✓ |
| 2 | ChaseDrawer | `components/chase/ChaseDrawer.tsx` | Chase action on a milestone row | Drawer | AI chase composer (email + WhatsApp) | Transaction | ✓ |
| 3 | AddNodeDrawer | `components/chain/AddNodeDrawer.tsx` | "+ Add sale above/below" in chain section or ChainDrawer | Drawer | Form: add or edit chain link | Transaction | ✓ |
| 4 | WelcomeModal | `components/agent/WelcomeModal.tsx` | First login, welcome not yet seen flag | Modal | Onboarding + first-action CTA | Global | ✓ |
| 5 | EditSaleDetailsModal | `components/transaction/EditSaleDetailsModal.tsx` | "Edit" link next to tenure/purchase type in sidebar | **Modal** | Edit purchase type + tenure with reconciliation preview | **Transaction** | **✗ MISMATCH — should be drawer** |
| 6 | AddFirmModal | `components/solicitors/AddFirmModal.tsx` | "Add firm" from solicitor type-ahead (in new transaction form) | Modal | Create new solicitor firm + optional handler | Global (spawned from transaction form) | ✓ |
| 7 | ExchangeCelebration | `components/milestones/ExchangeCelebration.tsx` | Confirming exchange milestone (VM19/PM26) | Modal (full-screen overlay) | Celebration / announcement | Transaction | Special — celebratory overlay, not a workflow step |
| 8 | FeedbackModal | `components/feedback/FeedbackButton.tsx` | Floating "Send feedback" button (fixed bottom-right) | Modal | Bug report / feature idea submission | Global | ✓ |
| 9 | SurveyNrConfirmModal | `components/milestones/MilestoneRow.tsx` (inline portal) | Marking PM9 as not required | Modal | Confirmation with side-effect explanation | Transaction | ✓ (confirmation pattern) |
| 10 | ReconciliationModal | `components/milestones/MilestoneRow.tsx` (inline portal) | Confirming exchange or completion milestone | Modal | Workflow step: date entry + outstanding items | Transaction | ⚠ Borderline — complex enough to consider drawer |
| 11 | UndoMilestoneModal | `components/milestones/MilestoneRow.tsx` (inline portal) | "Undo" on a completed milestone | Modal | Confirmation with progress impact preview, optional cascade | Transaction | ✓ (confirmation pattern) |
| 12 | MortgageModal | `components/milestones/NotRequiredRow.tsx` (inline portal) | "Reinstate" on a not-required PM9 row | Modal | Three-option confirmation with purchase type side-effect | Transaction | ✓ (confirmation pattern) |
| 13 | SaveProgressModal | `components/transactions/NewTransactionForm.tsx` (inline, no portal) | Navigating away from the new transaction form with unsaved data | Modal | Navigation guard / draft prompt | Workflow | ✓ |
| 14 | DuplicateAddressModal | `components/transactions/NewTransactionForm.tsx` (inline, no portal) | Submitting a new transaction whose address already exists | Modal | Conflict resolution | Workflow | ✓ |

**Note on inline portals vs. components:** Items 9–12 are rendered inline in their parent components via `createPortal` rather than as standalone exported components. Items 13–14 are inline without a portal (rendered in place, not teleported to `document.body`). This means they cannot be tested in isolation, cannot be easily imported elsewhere, and are harder to find via file search.

---

## 2. Per-Component Breakdown

### 2.1 ChainDrawer

**File:** `components/chain/ChainDrawer.tsx`
**Width:** 480px max (`sm:max-w-[480px]`), full-width on mobile

| Dimension | Current state |
|---|---|
| Header | Eyebrow "Chain progress" (text-sm font-semibold) + subtitle. No pills, counters, or tags. |
| Close button | Top-right. SVG X inline, `p-1 rounded hover:bg-white/30 text-slate-900/40`. |
| Section labels | None — no sections, just loading/empty/list states. |
| Field types | None — read-only viewer. Action buttons per node. |
| Footer / CTA | Conditional sticky footer only when pending invites exist: count text + "Send invites" button. Otherwise no footer. |
| Validation | None (read-only). |
| Empty states | Loading: "Loading chain…" plain text. No chain: `EmptyState` component with icon, title, desc, CTA "Create chain". Chain with no links: `EmptyState` (same copy as no-chain — copy mismatch). |
| Density | Standard. |
| Inline help | Invite status per node card. |
| Unique interactions | Resend invite per node; delete stub node (native `confirm()`); bulk invite (sequential fetch loop); create chain if none exists; opens AddNodeDrawer for add above/below and edit. |
| Mobile | Full-width on mobile. No explicit mobile override. Works. |

**Issues flagged:**
- Empty chain (chain exists, zero links) shows the same copy as "no chain linked" — these are different states
- No skeleton loading — just plain text "Loading chain…"
- Header is `text-sm font-semibold`, smaller than AddNodeDrawer (`text-base`) — inconsistent between the two drawers that appear together
- Uses native `confirm()` for delete — blocks JS, should be a confirmation modal
- No close-on-Escape handler (AddNodeDrawer has one, ChainDrawer does not — it relies on backdrop click)

---

### 2.2 ChaseDrawer

**File:** `components/chase/ChaseDrawer.tsx`
**Width:** `min(460px, 100vw)`, full-width on mobile

| Dimension | Current state |
|---|---|
| Header | Eyebrow pill ("Chase" / "Chase all · N"), chase number (#N), tone pill. Below: milestone name (single) or list (multi). Close button top-right. Decorative coral bloom gradient. |
| Close button | Top-right. Phosphor `X` icon, `p-1.5 border border-white/20 bg-white/60 rounded-[8px]`. |
| Section labels | "SEND VIA", "TONE" — `fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase"` in inline style. |
| Field types | Channel toggle (2 styled buttons), CC toggle (custom toggle row), WhatsApp contact picker (list when multiple), tone selector (custom dropdown overlay), generate button, textarea 11 rows. |
| Footer / CTA | Single full-width send button. Channel-specific color (coral for email, green for WhatsApp). Recipient summary text below. |
| Validation | Empty message disables send. WhatsApp with no contact selected shows error. Rate-limit error shown inline. |
| Empty states | Generating: spinner in generate button. No initial message — textarea empty with placeholder. No loading of existing state. |
| Density | Compact, information-dense. |
| Inline help | "Auto-selected · override if needed" for tone. Recipient summary below footer CTA. "Drafted for [name]" context when generated. "✏️ Message edited" indicator. |
| Unique interactions | Channel switching (Email ↔ WhatsApp) changes CTA color. Auto-tone from chase count. AI message generation with retry. CC solicitor toggle. Multi-milestone "Chase all" mode. Message edited indicator. |
| Mobile | Full-width on mobile. Send button remains full-width. Works. |

**Issues flagged:**
- Entire component uses hardcoded inline styles with `const coral = "#FF6B4A"` — does not inherit any theme token. The only drawer that is fully outside the CSS-variable system.
- WhatsApp "Open WhatsApp" flow: the communication is logged regardless of whether the user actually sends in WhatsApp — no signal of real send. This is a product decision but could mislead chase counts.
- Message textarea has no character count.
- "✏️ Message edited" uses a bare emoji — not accessible.
- No Escape key handler — only backdrop click closes.
- Tone auto-selection note "Auto-selected · override if needed" uses the same `inkFaint` opacity as purely decorative text — too low contrast for an action hint.

---

### 2.3 AddNodeDrawer

**File:** `components/chain/AddNodeDrawer.tsx`
**Width:** 440px max (`sm:max-w-[440px]`), full-width on mobile

| Dimension | Current state |
|---|---|
| Header | Title ("Add sale above/below" or "Edit sale") + direction pill (↑ Above / ↓ Below, `agent-chain-callout` treatment) + subtitle. Close button top-right. |
| Close button | Top-right. SVG X, `p-1 rounded hover:bg-white/30 text-slate-900/40`. |
| Section labels | `text-[11px] font-semibold text-slate-900/40 uppercase tracking-wider` — all-caps grey. Agent contact section includes inline note "(optional — add email to send invite)". |
| Field types | 5 text inputs (address, agency, agent name, email, phone), 1 textarea (notes, 3 rows). |
| Footer / CTA | Fixed-width Cancel (`w-24`) + `flex-1` Save. Helper text below centred. |
| Validation | Required fields (address ≥ 3 chars, agency ≥ 2 chars) gate Save. Email validated on blur and on save. Server error banner. Required asterisks on labels. |
| Empty states | Always a form — no empty state needed. Saving: "Saving…" + disabled. |
| Density | Standard. |
| Inline help | Footer helper text adapts to form state: required fields missing / no email / email invalid / invite will send. |
| Unique interactions | Title case on blur: address, agency, agent name. Edit mode pre-populates from `editingLink`. Two modes: in-memory (new transaction) vs. existing chain (API). Escape key closes. |
| Mobile | Full-width on mobile. Works. |

**Issues flagged:**
- No phone normalisation on blur (noted in plan as a flagged improvement, not yet implemented)
- No address autocomplete
- Notes field has 1000-char max but no character count indicator
- No preview of what the invite email will look like

---

### 2.4 WelcomeModal

**File:** `components/agent/WelcomeModal.tsx`
**Width:** `calc(100vw - 48px)`, max 460px (welcome) / 540px (tour)

| Dimension | Current state |
|---|---|
| Header | Gradient strip (warm coral/amber): eyebrow "WELCOME" + H2 personalised greeting + subtitle. Gradient uses hardcoded values (not CSS var). |
| Close button | Absolute top-right of card. `28×28px` square-ish, Phosphor `X`, `bg-black/06`. |
| Section labels | None — single card. |
| Field types | None — CTAs only. |
| Footer / CTA | Stacked vertical: primary "Add my first sale" (full-width `agent-btn-primary`), secondary "Explore a quick tour" (bordered button), fine print text. |
| Validation | None. |
| Empty states | Tour state replaces main view with `TourSlides` component. |
| Density | Roomy (padding 24px). |
| Inline help | "You can always add files any time from the dashboard." |
| Unique interactions | Reads active theme from DOM (`document.querySelector("[data-theme]")`). Marks welcome seen on mount. Auto-navigates to `/agent/transactions/new` on primary CTA. Tour is embedded (TourSlides). |
| Mobile | `calc(100vw - 48px)` — 24px margin each side. Good. |

**Issues flagged:**
- Header gradient is hardcoded `rgba(255,138,101,0.18) → rgba(255,183,77,0.12)` — sunset-specific, not themed per active theme. On Coastal (teal) or Slate, the warm orange gradient will look off.
- "Explore a quick tour" secondary button competes visually with the primary CTA — same height/weight as an important secondary
- Tour is not accessible after closing the modal (no "replay tour" route)

---

### 2.5 EditSaleDetailsModal ← **MISMATCH: should become a drawer**

**File:** `components/transaction/EditSaleDetailsModal.tsx`
**Width:** `max-w-md` (~448px), centred modal

| Dimension | Current state |
|---|---|
| Header | Step 1: "Edit sale details" (title-only). Step 2: "Sale details changed" + subtitle describing what changed. Close button in header row. |
| Close button | `w-7 h-7 rounded-full`, SVG X, `text-slate-400 hover:text-slate-600 agent-hover-row`. |
| Section labels | Only in DeltaList (preview step): `text-xs font-semibold text-slate-500 uppercase tracking-wide`. Form step has no section labels. |
| Field types | 2 native `<select>` elements (purchase type, tenure). Preview: read-only delta lists + progress comparison widget. |
| Footer / CTA | Step 1: flex-1 "Preview changes" + flex-1 "Cancel" (side-by-side). Step 2: flex-1 "Update sale details" + flex-1 "Back". |
| Validation | No inline validation. Error text below body (`text-sm text-red-500`). |
| Empty states | Loading: "Checking…" on primary button. No-change: auto-closes. |
| Density | Standard. |
| Inline help | Progress comparison widget (current % → after %). "Remaining workload is unchanged" note when appropriate. |
| Unique interactions | Two-step flow: form → preview. `getSaleDetailsDelta()` called before showing preview. Expandable delta lists (Show N more). Separate Back / Confirm in step 2. |
| Mobile | `max-w-md px-4`. Works. |

**Issues flagged:**
- **MISMATCH**: This is transaction-scoped — should be a drawer per the product decision. See Section 7 for full scope of the replacement drawer.
- Native `<select>` elements use `focus:ring-blue-500` — hardcoded blue, does not theme
- Expand/collapse links use `agent-link-primary` (which itself may use hardcoded coral vs. themed — needs check)
- No Escape key handler
- Currently only edits purchase type + tenure — all other sale details (price, dates, fees) edited via scattered inline affordances in the sidebar, creating a fragmented edit experience

---

### 2.6 AddFirmModal

**File:** `components/solicitors/AddFirmModal.tsx`
**Width:** `max-w-md` (~448px), centred modal

| Dimension | Current state |
|---|---|
| Header | "Add solicitor firm" + close button. `border-b border-white/20`. |
| Close button | Text `×` (not an icon), `text-slate-900/30 hover:text-slate-900/60 text-xl`. Lowest-fidelity close affordance in the codebase. |
| Section labels | "CASE HANDLER" with `(optional — can add later)`: `text-xs font-semibold text-slate-900/40 uppercase tracking-wide`. |
| Field types | Text input (firm name), text input (handler name), tel input (mobile), email input. 2-column grid for mobile/email. |
| Footer / CTA | Paired: `flex-1` "Save firm" (primary) + `px-4` "Cancel" (text-weight secondary). |
| Validation | Required firm name gates submit. Error banner: `bg-red-50 border border-red-100`. |
| Empty states | Saving: "Saving…". |
| Density | Standard. |
| Inline help | Section label note. |
| Unique interactions | Auto-focus + auto-select on firm name input on mount. Escape key closes. |
| Mobile | `max-w-md p-4`. Good. |

**Issues flagged:**
- Close button is `×` text — should be an SVG X icon like every other component
- No duplicate detection (firm may already exist)
- Handler: can only add one, not multiple
- No phone normalisation on blur

---

### 2.7 ExchangeCelebration

**File:** `components/milestones/ExchangeCelebration.tsx`
**Width:** `max-w-sm` (~384px), centred, `z-[200]` (highest z-index in the codebase)

| Dimension | Current state |
|---|---|
| Header | None — card body contains: star icon in gradient circle, H2 "Exchange confirmed", address, congratulatory text. |
| Close button | None — backdrop tap or "Continue" button. |
| Section labels | None. |
| Field types | None — display only. |
| Footer / CTA | Single full-width "Continue" button (`bg-emerald-500 hover:bg-emerald-600`). |
| Validation | None. |
| Empty states | N/A. |
| Density | Roomy (`px-8 py-10`). |
| Inline help | "Contracts are now legally exchanged. Your fee is crystallised." |
| Unique interactions | Canvas confetti (120 pieces, 3s fade). Backdrop click dismisses. Inline `@keyframes exchange-in` animation. `z-[200]` ensures it renders above all other overlays. |
| Mobile | `max-w-sm w-full p-4`. Good. |

**Issues flagged:**
- Confetti colors are decorative/random — not themed, and that's probably fine
- Star icon gradient (amber-400 → orange-400) is hardcoded — not themed. On Coastal/Slate this orange gradient may look odd against a teal/grey canvas. Low priority (celebratory, one-off)
- Continue button uses `bg-emerald-500` (semantic success) — correct, must not theme
- No Escape key handler — only backdrop and button

---

### 2.8 FeedbackModal (within FeedbackButton)

**File:** `components/feedback/FeedbackButton.tsx`
**Width:** `max-w-sm` (~384px), centred modal

| Dimension | Current state |
|---|---|
| Header | "Send feedback" + close button. `border-b border-slate-100`. |
| Close button | `w-6 h-6 rounded-lg`, SVG X, `text-slate-900/30 hover:text-slate-900/60 agent-hover-row`. |
| Section labels | None — 3-cell grid acts as visual type selector. |
| Field types | 3-button type selector (Bug / Idea / General), textarea (4 rows). |
| Footer / CTA | Single full-width "Send feedback". Success state: `bg-emerald-50` checkmark + thank you + auto-close 1.8s. |
| Validation | Message required (disabled when empty). No explicit error display. |
| Empty states | Success state replaces form view. |
| Density | Standard. |
| Inline help | Textarea placeholder: "Tell us what happened or what you'd like to see…" |
| Unique interactions | Type selector — active state uses `agent-badge-brand`. Auto-focus textarea on open (80ms delay). Auto-close on success. Escape key closes. Trigger is floating fixed button (`bottom-6 right-6 z-40`). |
| Mobile | `max-w-sm p-4`. Good. |

**Issues flagged:**
- Container panel uses hardcoded `rgba(255,255,255,0.94)` — not using `--agent-glass-bg-strong` token
- Floating trigger button uses hardcoded `rgba(255,255,255,0.82)` — not using glass tokens
- The inline modal does not use `createPortal` — rendered in the DOM tree (below the floating button). This means it's stacked inside a `z-40` ancestor; the `z-50` on the modal overlay may not be sufficient if other z-stacked elements are present.
- No attachment capability

---

### 2.9 SurveyNrConfirmModal (inline in MilestoneRow)

**Source:** `components/milestones/MilestoneRow.tsx`, `showSurveyNrConfirm` state, line ~472
**Width:** `max-w-sm mx-4`, centred

| Dimension | Current state |
|---|---|
| Header | Title paragraph + explanation text. No header strip, no close button. |
| Close button | None — only Cancel button in body. |
| Section labels | None. |
| Field types | None — 2 action buttons. |
| Footer / CTA | Stacked: full-width primary "Yes, mark as not required" + full-width text "Cancel" (`text-xs text-slate-900/30`). |
| Validation | None. |
| Empty states | None. |
| Density | Compact. |
| Inline help | Explanation of survey + report milestone linkage. |
| Unique interactions | Specific to PM9 (private survey). Confirms N/R for two linked milestones. |
| Mobile | `max-w-sm mx-4`. Good. |

**Issues flagged:**
- No close button/X — user can only Cancel or Confirm. No Escape handler.
- Cancel is `text-xs text-slate-900/30` — very low contrast, easy to miss
- `bg-black/40 backdrop-blur-sm` backdrop — not via token; inconsistent opacity vs. other modals

---

### 2.10 ReconciliationModal (inline in MilestoneRow)

**Source:** `components/milestones/MilestoneRow.tsx`, `showReconciliationModal` state, line ~497
**Width:** `max-w-md px-4`, `max-h-[90vh]`, centred

| Dimension | Current state |
|---|---|
| Header | H3 title only ("Confirm exchange" or "Confirm completion"). No close button, no header strip. |
| Close button | **None.** User must confirm or click Cancel. |
| Section labels | "OUTSTANDING MILESTONES": `text-xs font-semibold text-slate-500 uppercase tracking-wide`. |
| Field types | Date input(s) (1 for completion, 2 for exchange), checkbox list per outstanding milestone, conditional per-item date input when checked. |
| Footer / CTA | Paired: `flex-1` confirm + `flex-1` cancel (side-by-side). |
| Validation | Date fields: left blank = excluded. No hard validation. |
| Empty states | No outstanding milestones: just date section, no list. |
| Density | Complex / information-dense. Potentially very tall. |
| Inline help | Pre-fill note for date. "Tick those that are done…" instruction. "Blank = exclude" guidance per date field. |
| Unique interactions | Checkbox list with expandable "Show N more" (expand link: hardcoded `text-blue-500`). Conditional date inputs per-item. Two flows: exchange (2 dates + list) vs. completion (1 date + list). |
| Mobile | `max-w-md px-4`. The `max-h-[90vh]` scrollable container may be awkward on small screens. |

**Issues flagged:**
- **No close button** — serious UX gap. Once opened, user cannot dismiss without confirming or cancelling.
- Expand link uses hardcoded `text-blue-500 hover:text-blue-600` — does not theme
- `focus:ring-2 focus:ring-blue-500` on date inputs — hardcoded blue, does not theme
- This modal is complex enough (multi-section, scrollable, checklist, nested date inputs) that it would benefit from being a drawer with a proper header, close button, and more horizontal space. Worth reconsidering the type here.
- No bulk-check for outstanding milestones (must tick each individually)
- `bg-black/40 backdrop-blur-sm` — same inconsistency as SurveyNr

---

### 2.11 UndoMilestoneModal (inline in MilestoneRow)

**Source:** `components/milestones/MilestoneRow.tsx`, `showUndoModal` state, line ~625
**Width:** `max-w-md p-4`, `max-h-[88vh]`, centred

| Dimension | Current state |
|---|---|
| Header | "Undo milestone" + conditional subtitle ("X — what would you like to do?" vs. "Are you sure you want to undo X?"). Close button in header. |
| Close button | `w-7 h-7 rounded-full`, SVG X, `text-slate-400 hover:text-slate-600 agent-hover-row`. Same style as EditSaleDetailsModal. |
| Section labels | None. |
| Field types | Radio buttons in cascade path. Progress comparison widget (%). Expandable cascade list. |
| Footer / CTA | Paired: `flex-1` orange "Undo" button + `flex-1` "Cancel". Orange signals destructive action. |
| Validation | None. |
| Empty states | None — impact data is fetched before modal opens. |
| Density | Standard–roomy. |
| Inline help | Impact comparison (current % → after %). Cascade list of affected milestones. |
| Unique interactions | Two paths: no-cascade (simple confirm) vs. cascade (two radio options). Each radio option shows its own progress impact. Expandable cascade list. |
| Mobile | `max-w-md p-4`. OK. |

**Issues flagged:**
- Selected radio state: `border-blue-500 bg-blue-50/50` — hardcoded blue, doesn't theme
- `agent-hover-row` used on radio hover — should be themed radio selection state
- Orange for Undo is correct (warning) but no explicit copy-based destructive warning (e.g., "This cannot be undone" / "Affects N milestones")

---

### 2.12 MortgageModal (inline in NotRequiredRow)

**Source:** `components/milestones/NotRequiredRow.tsx`, `showMortgageModal` state, line ~76
**Width:** `max-w-sm mx-4`, centred

| Dimension | Current state |
|---|---|
| Header | Title paragraph + explanation. No header strip, no close button. |
| Close button | None — Cancel button in body (tertiary). |
| Section labels | None. |
| Field types | None — 3 action buttons. |
| Footer / CTA | Stacked: primary "Yes — mortgage buyer" + secondary "Reinstate without changing purchase method" + tertiary "Cancel". |
| Validation | None. |
| Empty states | None. |
| Density | Standard. |
| Inline help | Explanation of what each option does. |
| Unique interactions | Option 1 changes purchase type to mortgage + reinstates. Option 2 reinstates without changing type. Option 3 cancels. |
| Mobile | `max-w-sm mx-4`. Good. |

**Issues flagged:**
- Uses `glass-card-strong` — good (uses theme tokens)
- `bg-black/30 backdrop-blur-sm` backdrop — no token, same inconsistency
- Three-tier stack is correct here but options have no visual differentiation (no icons, no descriptions below the button text) — the second option's label is very long and could wrap awkwardly on small screens

---

### 2.13 SaveProgressModal (inline in NewTransactionForm)

**Source:** `components/transactions/NewTransactionForm.tsx`, `showNavModal` state, line ~1086
**Width:** `max-w: 380px margin: 0 16px`, centred

| Dimension | Current state |
|---|---|
| Header | No header strip. Document icon (amber/orange gradient square) + H2 "Save your progress?" + explanation text, all inside card. |
| Close button | None — "Stay on this page" tertiary button. |
| Section labels | None. |
| Field types | None — 3 action buttons. |
| Footer / CTA | Stacked vertical: blue "Save as draft" + bordered "Leave without saving" + text "Stay on this page". |
| Validation | None. |
| Empty states | Saving: "Saving…" + `opacity: 0.6`. |
| Density | Roomy (`padding: "32px 28px"`). |
| Inline help | Explanation text. |
| Unique interactions | Triggered by navigation interceptor (captures click events). Document icon animation. |
| Mobile | `max-width: 380px margin: 0 16px`. Good. |

**Issues flagged:**
- **Blue CTA**: `background: "linear-gradient(135deg, #3b82f6, #2563eb)"` — hardcoded blue, contradicts `agent-btn-color-primary` (coral) convention used everywhere else. Intentional brand decision (save = blue)? Needs confirmation.
- Not rendered via `createPortal` — exists in the React tree, not teleported. Relies on parent z-index for stacking.
- Animation is unique: `cardSlideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)` — same spring curve as drawers but different name/approach

---

### 2.14 DuplicateAddressModal (inline in NewTransactionForm)

**Source:** `components/transactions/NewTransactionForm.tsx`, `duplicateModal` state, line ~1115
**Width:** `max-w: 400px margin: 0 16px`, centred

| Dimension | Current state |
|---|---|
| Header | No header strip. Warning icon (amber/orange gradient) + H2 "This address already exists" + address + assigned-user text. |
| Close button | None — backdrop click closes. |
| Section labels | None. |
| Field types | None — 2 action buttons. |
| Footer / CTA | Stacked: blue `<a>` "View existing file" + bordered "Create anyway". |
| Validation | None. |
| Empty states | None. |
| Density | Roomy. |
| Inline help | Address and assignee shown prominently. |
| Unique interactions | "View existing file" is a native anchor (navigates). "Create anyway" bypasses duplicate check. |
| Mobile | `max-width: 400px margin: 0 16px`. Good. |

**Issues flagged:**
- Same blue CTA inconsistency as SaveProgressModal
- No way to preview or contextualise the existing file before deciding to view/override
- Not rendered via `createPortal`

---

## 3. Inconsistency Matrix

### 3a. Header treatment

| Component | Pattern | Header border | Title size | Subtitle? | Pill / tag in header? |
|---|---|---|---|---|---|
| ChainDrawer | Title + subtitle | `border-b border-white/40` | `text-sm font-semibold` | Yes | No |
| ChaseDrawer | Eyebrow pill + # + tone pill + milestone name; property card below | `border-b 0.5px coralBorder` (hardcoded) | 15px font-weight 700 (inline style) | No subtitle | Chase # + tone pill |
| AddNodeDrawer | Title + direction pill + subtitle | `border-b border-white/40` | `text-base font-semibold` | Yes | Direction pill |
| WelcomeModal | Gradient strip: eyebrow + H2 + subtitle | Gradient strip (hardcoded warm) | 24px font-weight 700 | Yes | No |
| EditSaleDetailsModal | Title-only (step 1) or title + subtitle (step 2) | `border-b border-slate-100` | `text-base font-semibold` | Conditional | No |
| AddFirmModal | Title-only | `border-b border-white/20` | `text-base font-semibold` | No | No |
| ExchangeCelebration | None — content starts in body | — | `text-2xl font-bold` (H2 in body) | No | No |
| FeedbackModal | Title-only | `border-b border-slate-100` | `text-sm font-semibold` | No | No |
| SurveyNrConfirmModal | Title para + explanation (no strip) | None | `text-sm font-semibold` (p) | Inline | No |
| ReconciliationModal | H3 title only, no strip | None | `text-base font-semibold` (h3) | No | No |
| UndoMilestoneModal | Title + conditional subtitle | `border-b border-slate-100` | `text-base font-semibold` | Conditional | No |
| MortgageModal | Title para + explanation (no strip) | None | `text-sm font-semibold` (p) | Inline | No |
| SaveProgressModal | No strip — icon + H2 in body | None | `fontSize: 18, fontWeight: 700` (inline) | Yes (inline) | No |
| DuplicateModal | No strip — icon + H2 in body | None | `fontSize: 18, fontWeight: 700` (inline) | Yes (inline) | No |

**Major divergences:**
- Three header strip treatments: full-width gradient strip (WelcomeModal), `border-b border-white/40` (drawers), `border-b border-slate-100` (modals — but not all of them)
- Title sizes range from `text-sm` (ChainDrawer) to `text-2xl` (ExchangeCelebration)
- ChaseDrawer is entirely distinct — its header is effectively a contextual property card, not a conventional header

### 3b. Close button

| Component | Style | Position | Icon |
|---|---|---|---|
| ChainDrawer | Ghost hover, `p-1 rounded` | Top-right, in header | SVG X inline |
| ChaseDrawer | Bordered pill, `p-1.5 border border-white/20 bg-white/60 rounded-[8px]` | Top-right, in header | Phosphor X |
| AddNodeDrawer | Ghost hover, `p-1 rounded` | Top-right, in header | SVG X inline |
| WelcomeModal | Ghost square, `28×28px bg-black/06 rounded-[8px]` | Absolute top-right of card | Phosphor X |
| EditSaleDetailsModal | Ghost circle, `w-7 h-7 rounded-full agent-hover-row` | Top-right, in header | SVG X inline |
| AddFirmModal | Text character `×` | Top-right, in header | None (text) |
| ExchangeCelebration | **None** | — | — |
| FeedbackModal | Ghost square, `w-6 h-6 rounded-lg agent-hover-row` | Top-right, in header | SVG X inline |
| SurveyNrConfirmModal | **None** | — | — |
| ReconciliationModal | **None** | — | — |
| UndoMilestoneModal | Ghost circle, `w-7 h-7 rounded-full agent-hover-row` | Top-right, in header | SVG X inline |
| MortgageModal | **None** | — | — |
| SaveProgressModal | **None** (tertiary button) | — | — |
| DuplicateModal | **None** (backdrop) | — | — |

**Summary:** 5 components have no close affordance whatsoever. ReconciliationModal is the most serious gap given its complexity. Three different close button shapes: rounded (ghost), circular (rounded-full), bordered pill. Two different icon sources: inline SVG vs. Phosphor.

### 3c. Section label styling

| Component | Style | Example |
|---|---|---|
| AddNodeDrawer | `text-[11px] font-semibold text-slate-900/40 uppercase tracking-wider` | "PROPERTY" |
| AddFirmModal | `text-xs font-semibold text-slate-900/40 uppercase tracking-wide` | "CASE HANDLER" |
| ChaseDrawer | `fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: uppercase` (inline) | "SEND VIA" |
| EditSaleDetailsModal (DeltaList) | `text-xs font-semibold text-slate-500 uppercase tracking-wide` | "MILESTONES THAT WILL BE…" |
| ReconciliationModal | `text-xs font-semibold text-slate-500 uppercase tracking-wide` | "OUTSTANDING MILESTONES" |
| All others | No section labels | — |

**Divergences:** Four different implementations of the "all-caps grey label" pattern. Key differences: font size (`text-[11px]` vs. `text-xs` = 12px), tracking (`tracking-wider` vs. `tracking-wide`), text colour (`text-slate-900/40` vs. `text-slate-500`).

### 3d. Footer / CTA layout

| Component | Pattern |
|---|---|
| ChainDrawer | Conditional sticky footer: count text + single right-aligned button |
| ChaseDrawer | Single full-width send button + recipient summary below |
| AddNodeDrawer | Paired: fixed-width Cancel (`w-24`) + flex-1 Save |
| WelcomeModal | Stacked vertical: primary + secondary + fine print |
| EditSaleDetailsModal | Paired: flex-1 primary + flex-1 secondary (changes per step) |
| AddFirmModal | Paired: flex-1 primary + `px-4` text-weight secondary |
| ExchangeCelebration | Single full-width Continue |
| FeedbackModal | Single full-width Send |
| SurveyNrConfirmModal | Stacked: full-width primary + full-width text cancel |
| ReconciliationModal | Paired: flex-1 primary + flex-1 cancel |
| UndoMilestoneModal | Paired: flex-1 orange primary + flex-1 cancel |
| MortgageModal | Stacked: primary + secondary + tertiary |
| SaveProgressModal | Stacked: blue primary + bordered secondary + text tertiary |
| DuplicateModal | Stacked: blue primary + bordered secondary |

**No consistent pattern.** Most modals use either paired side-by-side or stacked. The "which is primary, which is Cancel" placement differs: some put primary left (EditSaleDetailsModal step 1), some put primary as the only button (FeedbackModal), some stack primary first.

### 3e. Spacing / density

| Component | Header padding | Body padding | Footer padding |
|---|---|---|---|
| ChainDrawer | `px-5 py-4` | `px-5 py-4` | `px-5 py-3` |
| ChaseDrawer | `padding: "18px 20px 16px"` | `padding: "14px 20px"` per section | `padding: "14px 20px 18px"` |
| AddNodeDrawer | `px-6 py-5` | `px-6 py-5` | `px-6 py-4` |
| WelcomeModal | (gradient strip: `padding: "28px 24px 24px"`) | — | — |
| EditSaleDetailsModal | `px-6 pt-5 pb-4` | `px-6 py-5` | `px-6 pb-5 pt-3` |
| AddFirmModal | `px-6 pt-6 pb-4` | `px-6 py-5` | (in form) |
| Milestone modals | `px-5 py-4` / `p-6` | `px-5 py-4` / `px-6 py-5` | `px-5 py-4` / flex gap-3 |
| NewTransactionForm modals | `padding: "32px 28px"` (all-in-one) | — | — |

Drawers use `px-5 py-4` or `px-6 py-5` reasonably consistently. Modals vary from `p-6` (ReconciliationModal) to `padding: "32px 28px"` (NewTransactionForm inline). No single standard.

### 3f. Backdrop treatment

| Style | Components |
|---|---|
| `bg-black/40 backdrop-blur-sm` | SurveyNrConfirmModal, ReconciliationModal, UndoMilestoneModal |
| `bg-black/30 backdrop-blur-sm` | AddFirmModal (Tailwind class), MortgageModal, FeedbackModal |
| `rgba(0,0,0,0.35) backdrop-filter blur(2px)` | ChaseDrawer (inline style) |
| `bg-black/30 backdrop-blur-sm agent-backdrop-in` | ChainDrawer, AddNodeDrawer (with animation) |
| `rgba(15,23,42,0.6) backdrop-filter blur(8px)` | SaveProgressModal, DuplicateModal (darkest, most opaque) |
| `agent-backdrop` class | WelcomeModal (CSS class — delegates to stylesheet) |

**5 different implementations** of what is functionally the same pattern. Opacity varies from 30% to 60%. Blur varies from 2px to 8px. Two use animation, most do not.

### 3g. Animation / transition

| Component | Entry animation |
|---|---|
| ChainDrawer, AddNodeDrawer | `agent-modal-in 280ms cubic-bezier(0.34,1.56,0.64,1)` + `agent-backdrop-in 200ms` |
| ChaseDrawer | `agent-modal-in 300ms cubic-bezier(0.34,1.56,0.64,1)` + animated backdrop |
| WelcomeModal | `agent-modal` / `agent-backdrop` CSS classes (defined in stylesheet) |
| ExchangeCelebration | Custom `exchange-in 200ms ease-out` (inline `<style>`) |
| SaveProgressModal, DuplicateModal | `cardSlideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)` + `overlayFadeIn 0.18s` (inline `<style>`) |
| All MilestoneRow inline modals | None — appear instantly |
| AddFirmModal, FeedbackModal | None |

Most inline-portal modals have no entry animation. Drawers are the most polished (spring curve). NewTransactionForm modals have their own animation names (`cardSlideUp`) that match the spring curve used by drawers but are defined separately.

### 3h. Typography summary

| Role | Range across components |
|---|---|
| Modal/drawer title | `text-sm` (ChainDrawer) → `text-base` (most modals) → `text-2xl` (ExchangeCelebration) |
| Subtitle / description | `text-xs` – `text-sm` — fairly consistent |
| Section labels | `text-[11px]` / `text-xs` (10–12px) — reasonably consistent |
| Body text | `text-sm` — consistent |
| Helper / caption | `text-[11px]` / `text-xs` — consistent |
| Button text | `text-xs` – `text-sm` — varies |

---

## 4. Functionality Gaps and Improvement Opportunities

### 4.1 ChainDrawer
- **Missing:** Header counter — "N nodes in chain" or "Your file: position 3 of 5" would let agents orient themselves without scanning the list
- **Missing:** Skeleton loading state — "Loading chain…" text is too sparse
- **Bug:** Empty-chain state ("no links") shows identical copy to "no chain linked" — these are different situations
- **Improvement:** Replace `confirm()` for delete with a proper inline confirmation row or mini-modal
- **Improvement:** Node cards could show a progress indicator per node (if that data is available via chain position)
- **Improvement:** Add Escape key handler (currently only backdrop closes)

### 4.2 ChaseDrawer
- **Missing:** Character count on textarea — agents don't know how much to trim for WhatsApp
- **Missing:** "Message was actually sent" confirmation for WhatsApp (currently logged regardless of whether user sent in the WhatsApp app)
- **Improvement:** Tone hint: "Auto-selected · override if needed" is styled too faintly — looks decorative, should look actionable
- **Improvement:** Multi-milestone header: milestone names are listed as bullet points — could use a collapsed "N milestones" with expand
- **Improvement:** Edited indicator (✏️) should use an accessible icon, not a bare emoji

### 4.3 AddNodeDrawer
- **Missing:** Phone normalisation on blur
- **Missing:** Character count on notes field (1000-char max, no indicator)
- **Missing:** Address lookup / autocomplete
- **Improvement:** Preview of invite email content — "They'll receive an invite to claim their position in the chain at [address]"

### 4.4 WelcomeModal
- **Missing:** "Replay tour" route — no way to return to tour slides after closing
- **Improvement:** Make "Explore a quick tour" a text link rather than a full-weight button so it doesn't compete with the primary CTA
- **Improvement:** Header gradient should pick up the active theme (currently hardcoded warm orange)

### 4.5 EditSaleDetailsModal (becoming a drawer)
- **Fragmented editing** is the core problem: this modal covers only 2 of 6 editable fields, with all others edited inline via scattered "Edit" links. The drawer replacement consolidates everything.
- **Missing:** No undo after confirming a type/tenure change
- **Missing:** Communication impact hint — "You may need to update chasers for newly activated milestones"
- **Improvement:** Native `<select>` elements are low-fidelity; should be styled pill-pickers matching the add-sale form pattern
- **Improvement:** After conversion to drawer: the header accent line should show the property address for context (it's transaction-scoped)

### 4.6 AddFirmModal
- **Missing:** Duplicate detection — "A firm with this name already exists"
- **Missing:** Multiple handlers (can only add one)
- **Improvement:** Phone normalisation
- **Improvement:** Replace `×` text close button with SVG icon

### 4.7 ExchangeCelebration
- **Improvement:** Fee confirmation copy — "Your fee is crystallised at £X" would be more specific and valuable than the generic text (purchase price would need to be passed as a prop)
- **Improvement:** No sharing / copy achievement functionality — low priority

### 4.8 FeedbackModal
- **Missing:** Screenshot / attachment capability
- **Missing:** Past feedback history view
- **Improvement:** Container uses hardcoded glass values — should use glass tokens

### 4.9 SurveyNrConfirmModal
- **Missing:** Close / Escape affordance
- **Improvement:** Cancel should have higher contrast (currently `text-slate-900/30`)
- **Improvement:** Modal copy is PM9-specific — consider a generalised N/R confirmation modal that takes the milestone name and consequence as props

### 4.10 ReconciliationModal
- **Missing:** Close button / Escape handler — user is stuck until they confirm or cancel
- **Missing:** "Select all" checkbox for outstanding milestones
- **Improvement:** Strongly consider converting to a drawer given complexity and scrollability
- **Improvement:** Expand link should use themed link colour (not hardcoded blue)
- **Improvement:** Focus rings on date inputs should use theme token

### 4.11 UndoMilestoneModal
- **Improvement:** Radio selection state should use themed colours (not hardcoded blue)
- **Improvement:** Add explicit text-based destructive warning ("This will affect N milestones") — don't rely on orange colour alone
- **Improvement:** "Last confirmed by [name] on [date]" attribution would help when undoing in a team context

### 4.12 MortgageModal
- **Improvement:** Icons on the three options would improve scannability — e.g., mortgage house icon, reinstate arrow, cancel X
- **Improvement:** The second option ("Reinstate without changing purchase method") is very long for a button label — consider truncating with a subtitle

### 4.13 SaveProgressModal
- **Question:** Is the blue CTA intentional (blue = save, coral = transact)? If yes, document this as a two-colour primary system. If not, change to `agent-btn-color-primary`.
- **Improvement:** "Stay on this page" tertiary button is very low contrast (`color: "rgba(15,23,42,0.3)"`) — easy to miss

### 4.14 DuplicateAddressModal
- **Missing:** Preview of the existing file — show status + assigned agent without requiring full navigation
- **Same blue CTA question** as SaveProgressModal

---

## 5. Theme Integration Audit

Rule: section labels, primary CTAs, focus states, icon tints, and a header accent line should theme. Body surfaces, text, borders, inputs stay neutral. Functional/semantic/brand colours never theme.

| Component | Correctly themed | Needs fixing | Must never theme |
|---|---|---|---|
| ChainDrawer | `agent-btn-color-primary` for CTA | No themed header accent line; border uses `border-white/40` (acceptable but could use token) | — |
| ChaseDrawer | WhatsApp green (semantic) ✓; tone pills (functional) ✓ | Everything else: CTA, channel buttons, CC toggle, section labels, focus, border — all hardcoded `#FF6B4A`. Complete re-wire needed. | WhatsApp green `#22c55e`, tone pill colours (green/blue/amber/orange/red) |
| AddNodeDrawer | `agent-chain-callout` for direction pill + agent contact section (uses `--agent-coral-rgb`) ✓; `agent-btn-color-primary` ✓; `glass-input` ✓ | No header accent line | — |
| WelcomeModal | `var(--agent-coral-deep)` eyebrow ✓; `agent-btn-primary` ✓; `var(--agent-border-default)` secondary button ✓ | Header gradient strip hardcoded warm orange | — |
| EditSaleDetailsModal | `agent-btn-color-primary` ✓; semantic red/green in DeltaList ✓; progress comparison orange uses semantic warning ✓ | `focus:ring-blue-500` on selects; `agent-link-primary` expand — need to verify token; no themed accent | Red/green delta list colours (semantic) |
| AddFirmModal | `agent-btn-color-primary` ✓; `glass-card-strong` ✓; `glass-input` ✓ | No themed accent; close `×` has no themed hover | — |
| ExchangeCelebration | `bg-emerald-500` Continue (semantic success) ✓ | Star icon gradient (amber/orange, hardcoded) — low priority (decorative); confetti is decorative | `bg-emerald-500` button |
| FeedbackModal | `agent-badge-brand` for selected type ✓; `agent-btn-color-primary` ✓; `glass-input` ✓ | Container `rgba(255,255,255,0.94)` hardcoded; floating trigger hardcoded glass | — |
| SurveyNrConfirmModal | `agent-btn-color-primary` ✓ | No themed accent; `bg-black/40` backdrop not from token | — |
| ReconciliationModal | `agent-btn-color-primary` ✓ | `focus:ring-blue-500` on date inputs; `text-blue-500` expand link; `bg-black/40` backdrop | — |
| UndoMilestoneModal | Orange Undo button (semantic warning/destructive) ✓; `agent-hover-row` ✓ | `border-blue-500 bg-blue-50/50` radio selected state — should use `--agent-border-focus` + `--agent-coral-bg-tint` | Orange Undo button |
| MortgageModal | `agent-btn-color-primary` ✓; `glass-card-strong` ✓ | `bg-black/30` backdrop not from token | — |
| SaveProgressModal | Document icon gradient (decorative) ✓ | Blue gradient CTA `#3b82f6 → #2563eb` — should be `agent-btn-color-primary` unless blue is a deliberate choice | — |
| DuplicateModal | Warning icon gradient (decorative) ✓ | Same blue CTA issue | — |

**Biggest theming debt in priority order:**
1. **ChaseDrawer** — 100% hardcoded, zero token usage, entire coral system bypassed
2. **SaveProgressModal + DuplicateModal** — blue CTA may be intentional but is undocumented and inconsistent
3. **ReconciliationModal** — focus rings and expand links hardcoded blue
4. **UndoMilestoneModal** — radio selected state hardcoded blue
5. **WelcomeModal** — header gradient hardcoded warm orange

---

## 6. Theme Palette Readiness

### 6.1 Token structure — what each theme defines

All 6 themes (`sunset`, `coastal`, `heritage`, `slate`, `emerald`, `claret`) are defined in `app/agent/styles/themes.css`. Each theme block is ~150 lines and defines **100 tokens** (per the file's own inventory).

For medium theming, the relevant brand-colour tokens each theme exposes:

| Token | Role | Sunset example | Note |
|---|---|---|---|
| `--agent-coral` | Base brand colour | `#FF8A65` | Warm orange |
| `--agent-coral-deep` | Deep brand (CTAs, borders) | `#FF6B4A` | |
| `--agent-coral-darker` | Pressed / deeper state | `#E55B3D` | |
| `--agent-coral-light` | Lighter brand | `#FFB18F` | |
| `--agent-coral-pale` | Very light brand | `#FFD4C2` | |
| `--agent-coral-bg-tint` | Subtle tinted bg | `rgba(255,138,101,0.08)` | For section callouts |
| `--agent-coral-bg-tint-hover` | Hover on tinted bg | `rgba(255,138,101,0.14)` | |
| `--agent-border-focus` | Focus border colour | `rgba(255,138,101,0.45)` | |
| `--agent-focus-ring` | Full focus ring (box-shadow) | `0 0 0 3px rgba(255,138,101,0.22)` | |
| `--agent-focus-ring-tight` | Tight focus ring | `0 0 0 2px rgba(255,138,101,0.32)` | |
| `--agent-coral-rgb` | RGB channels (for rgba composition) | `255, 107, 74` | coral-deep value |
| `--agent-coral-base-rgb` | Base RGB channels | `255, 138, 101` | |
| `--agent-hover-tint` | Hover background tint | `rgba(255,138,101,0.10)` | |
| `--agent-hover-tint-strong` | Stronger hover tint | `rgba(255,138,101,0.18)` | |

**Verdict: medium theming is well-supported.** This is not just a single primary hex — it's a full tonal range with light variants, tints, focus rings, and RGB channels. All the palette tokens required for medium theming already exist.

### 6.2 Per-theme verification

All 6 themes define their brand token block with different underlying values:

| Theme | Brand colour family | Base colour |
|---|---|---|
| Sunset | Warm coral/orange | `#FF8A65` |
| Coastal | Teal (tokens still named "coral") | `#2D7A8F` |
| Heritage | (not read — assumed consistent) | Muted warm |
| Slate | (not read — assumed consistent) | Cool blue-grey |
| Emerald | (not read — assumed consistent) | Green |
| Claret | (not read — assumed consistent) | Deep red |

All 6 blocks exist as `[data-theme="..."]` selectors at lines 98, 252, 406, 560, 714, 868 of `themes.css`.

### 6.3 Focus ring implementation gap

The theme system defines `--agent-focus-ring` as a `box-shadow` value: `0 0 0 3px rgba(...)`. To use this, components must write `box-shadow: var(--agent-focus-ring)` on focus — or use a CSS class that wraps it.

The current codebase uses Tailwind `focus:ring-2 focus:ring-blue-500` in multiple modal components. These bypass the token system entirely. A themed focus ring CSS utility class (`.agent-focus-ring { &:focus { box-shadow: var(--agent-focus-ring); outline: none; } }`) does not appear to exist in `agent-system.css`. This would need to be added before focus state theming can be applied consistently.

### 6.4 Header accent line — gap

The "header accent line" (per the medium theming spec) is not yet implemented anywhere. There is no CSS token or utility class for it. This would be: a short coloured horizontal rule or a top-border on the drawer panel using `var(--agent-coral-deep)`. Token exists; class does not.

### 6.5 Token location and inheritance

Tokens are defined in `app/agent/styles/themes.css`, scoped to `[data-theme="..."]` on the layout wrapper in `app/agent/layout.tsx`. All components within `AgentShell` automatically inherit them. No Tailwind config changes needed. No provider or context required.

**ChaseDrawer exception:** ChaseDrawer uses `const coral = "#FF6B4A"` in JS, not CSS variables. It renders inside `AgentShell` and inherits the CSS custom properties — they're just not referenced. The fix is to swap hardcoded values for CSS variable references, not a structural change.

---

## 7. Edit Sale Details Drawer Scope

### 7.1 Every field with an "Edit" affordance on the property file

All edit affordances live in `components/transaction/TransactionSidebar.tsx`:

| Field | Current edit pattern | Trigger | Server action | Special behaviour |
|---|---|---|---|---|
| Purchase price | Inline (PriceInput + Save/Cancel links) | "Edit" link | `savePriceAction` | None |
| Purchase type | Modal (EditSaleDetailsModal) | "Edit" link next to type badges | `confirmSaleDetailsAction` | **Fix 8 reconciliation — must show preview step** |
| Tenure | Modal (EditSaleDetailsModal) | Same "Edit" link | `confirmSaleDetailsAction` | **Fix 8 reconciliation — must show preview step** |
| Predicted exchange date (override) | Inline (date input + Save/Cancel links) | "Edit" link | `saveOverrideDateAction` | Blank = revert to algorithm. Shows "(overridden)" badge. |
| Completion date | Inline (date input + Save/Cancel links) | "Edit" link (only shown after exchange confirmed) | `saveCompletionDateAction` | Conditional: only editable post-exchange. |
| Agent fee | Inline (type toggle + PriceInput or % input + VAT select) | "Edit"/"Set" link | `saveAgentFeeAction` | Two modes (fixed £ vs. %). VAT inclusive/exclusive toggle. |
| Referral fee | Inline (firm select + PriceInput) | "Edit"/"Set" link (only if `recommendedFirms` is non-empty) | `saveReferralAction` | Pre-fills from firm default. Requires firm selection first. |

**Count:** 7 editable field groups across 4 separate inline edit patterns + 1 modal. All 7 would consolidate into a single drawer.

### 7.2 Progressor fee status

Confirmed **not editable**. Rendered read-only:

```tsx
{showOurFee && (
  <div className="pt-2 border-t border-white/20">
    <p className="text-xs text-slate-900/40 mb-0.5">Progressor fee</p>
    <p className="text-sm font-bold text-slate-900/90">{formatFee(ourFee.fee)}</p>
    <p className="text-xs text-slate-900/40">{ourFee.label}</p>
  </div>
)}
```

No "Edit" link. Calculated via `calculateOurFee(assignedUser.clientType, assignedUser.legacyFee, purchasePrice)` — system-derived. **Does not appear in the drawer.**

### 7.3 Proposed section grouping for the drawer

| Section | Fields | Notes |
|---|---|---|
| **Property** | Purchase type (pill picker), Tenure (pill picker) | Contains Fix 8 reconciliation. Cannot save silently — must show preview step when either field changes. |
| **Price & Fees** | Purchase price, Agent fee (fixed £ / %), Referral fee | Currently 3 separate inline edit patterns. |
| **Timeline** | Predicted exchange date (override), Completion date | Completion date only editable post-exchange — show as read-only with note if not yet exchanged. |

Fields explicitly excluded: Progressor fee (system-derived).

### 7.4 Fix 8 reconciliation — how it must integrate

The reconciliation logic is well-factored into server actions:
- `getSaleDetailsDelta({ transactionId, newPurchaseType, newTenure })` → returns `{ noChange, becomingNr, becomingRequired, currentPercent, projectedPercent, currentRemaining, projectedRemaining }`
- `confirmSaleDetailsAction({ transactionId, newPurchaseType, newTenure })` → applies changes

The two-step pattern (form → preview → confirm) must be preserved in the drawer. The proposed flow:

1. User edits any fields in the drawer
2. If purchase type or tenure changed: "Preview changes" button calls `getSaleDetailsDelta()` and renders the preview inline within the drawer (not a separate step-change of the entire panel — the drawer body switches to show the delta)
3. If only price/fees/dates changed: no preview step needed — "Save" commits directly
4. If purchase type/tenure changed and preview acknowledged: "Confirm & save" calls both `confirmSaleDetailsAction` + any other field save actions

**Open question:** Do all fields save together on a single "Save", or do each save independently? Independent saves are the current model (separate server actions) — safe, atomic per-field. A single save requires a combined server action. This needs a decision before designing the footer.

### 7.5 Fields with special edit behaviour

| Field | Special behaviour | Impact on drawer design |
|---|---|---|
| Purchase type | Triggers reconciliation preview when changed | Drawer must support a "preview state" in the Property section |
| Tenure | Same | Same |
| Predicted exchange date (override) | Clearing the field reverts to algorithm. Shows "(overridden)" badge in sidebar. | Drawer should show current algorithm date for reference, and a "Clear override" affordance |
| Completion date | Only editable after exchange confirmed | Show as read-only in Timeline section with "Set once exchange is confirmed" text when locked |
| Agent fee | Two sub-modes (fixed £ / percent). VAT toggle. | UI requires type switcher (pill pair) + conditional input type + VAT select |
| Referral fee | Requires firm selection first. Auto-fills from firm default. | Select + price input with default-fill behaviour |

---

## 8. Open Questions for Design Proposal Phase

The following need decisions before drawer/modal designs can be proposed. Ordered roughly by dependency (earlier answers unblock later ones).

**Q1 — Single save vs. per-field save in Edit Sale Details drawer**
The current model saves each field independently via separate server actions. In the consolidated drawer, should all fields commit together on a single "Save", or should fields save individually (matching today's behaviour)? Single save is more ergonomic but adds complexity (one combined server action). Per-field saves are safer but mean the drawer needs Save/Cancel affordances per section, or the user must know edits are not persisted until they close.

**Q2 — Blue CTA in SaveProgressModal / DuplicateModal: intentional or accident?**
These are the only two places in the agent app where the primary CTA is blue (`#3b82f6`) rather than the coral `agent-btn-color-primary`. Is blue intended to signal "save / non-destructive action" as a secondary accent? If so, document it. If not, change to `agent-btn-color-primary`.

**Q3 — ReconciliationModal: drawer or modal?**
The Reconciliation flow (confirm exchange/completion) is complex: multi-section, scrollable, checklist, nested date inputs, up to 90vh tall. It's transaction-scoped (normally a drawer), but it's also an interrupting workflow step (normally a modal). It currently has no close button, no Escape handler, and no way to dismiss without completing or cancelling. Should it become a drawer with a proper header and close affordance, or stay a modal with a close button added?

**Q4 — ChainDrawer native `confirm()` replacements**
Three native `confirm()` dialogs exist in `ChainDrawer.tsx` (one for delete, one for bulk invite prompt isn't there but close). What should replace them — a mini confirmation row inline on the card, a small centred modal, or a toast with an undo action?

**Q5 — Header accent line: top border or left border for drawers?**
The medium theming spec mentions a header accent line. For modals this is clearly a coloured top border or strip. For right-panel drawers, should the accent be: (a) a coloured top border on the panel itself, (b) a coloured left border on the header section only, or (c) a coloured dot/pill element inside the header?

**Q6 — ChaseDrawer CoralWhatsApp send confirmation**
WhatsApp sends are logged immediately without waiting for the user to actually send in WhatsApp. Is this acceptable, or should the flow wait for a "I sent it" confirmation tap before logging? This is a product decision not a design one, but it affects the footer of the chase drawer.

**Q7 — How should the AddFirmModal close button be standardised?**
The `×` text character is a known inconsistency. Should all modal close buttons move to Phosphor `X` (as WelcomeModal and ChaseDrawer use), or stay with the inline SVG pattern (as ChainDrawer, AddNodeDrawer, EditSaleDetailsModal, UndoMilestoneModal use)?

**Q8 — Focus ring theming: new utility class or inline box-shadow?**
Theme-aware focus rings require `box-shadow: var(--agent-focus-ring)` rather than Tailwind's `focus:ring-blue-500`. Should a `.agent-focus` utility class be added to `agent-system.css`, or should focus theming be applied per-component inline?

**Q9 — WelcomeModal tour: add a replay route?**
Currently there's no way to access the tour after closing the modal. Should there be a `/agent/tour` route, a settings page option, or a help article link? Low priority but affects the WelcomeModal design (whether to add a persistent tour link).

**Q10 — Exchange/completion flow post-redesign**
ExchangeCelebration fires after a milestone confirm. With a potential ReconciliationModal → drawer conversion, what is the intended sequence? Reconciliation drawer closed → celebration modal fires? Or celebration fires as part of the drawer closing animation?
