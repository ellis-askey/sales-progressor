# Modal & Drawer System — Sales Progressor

**Status:** Approved, locked. Body below is the 2026-05-08 design proposal verbatim — moved from `docs/active/drawers-modals/design-proposal.md` to `docs/reference/MODAL_DRAWER_SYSTEM.md` on 2026-06-07 to match its authority (1,224 lines of locked decisions, not a work-in-progress).

**Audit source:** [`docs/DRAWERS_MODALS_AUDIT.md`](../DRAWERS_MODALS_AUDIT.md)
**Date:** 2026-05-08 | **Refinements applied:** 2026-05-08 | **Relocated:** 2026-06-07

---

## TL;DR — read this before any modal or drawer work

**What this doc is.** The single source of truth for modal and drawer design in the agent app. Eight shared primitives. Locked decisions on chrome, animation, theming, scroll, stacking.

**The eight primitives** (§1): Drawer, Modal, Header (three variants), Body, Footer (four CTA patterns), Backdrop, Accent line, Close button. Every modal and drawer in the app is some combination of these.

**Three locked rules every new modal or drawer must follow:**
- **Backdrop:** `agent-backdrop-overlay` class — `rgba(0,0,0,0.35)` + 4px blur + 200ms ease entrance (§5).
- **Animation:** `agent-modal-in` / `agent-drawer-in` at **280ms `cubic-bezier(0.34, 1.56, 0.64, 1)`** spring overshoot (§6). Known outlier: `agent-system.css` currently ships 240ms — Phase 2 migration target.
- **Theming:** `data-theme={theme}` attribute drives the surface tokens (§7). `data-night` / `nv2-night` (StatusControl, SwitchServiceTypeModal) is deprecated, grandfathered in those two only.

**Required chrome on every modal and drawer:**
- 2px coral accent line on the top edge (`var(--agent-coral-deep)`)
- Phosphor `X` close button, `rounded-lg` ghost (8px radius)
- Esc handler that calls `onClose`
- Header sticky (`flex-shrink-0`), body scrollable (`flex-1 overflow-y-auto`), footer sticky (`flex-shrink-0`)
- Z-index per the escalation rule in [DESIGN_TOKENS.md](DESIGN_TOKENS.md#z-index--modal-escalation-rule-locked) (50 default, 1500 above page overlays, 2000 stacked modal)

**For the index of who-uses-what**, see [MODAL_DRAWER_INDEX.md](MODAL_DRAWER_INDEX.md). Reference implementations: [`AddBrokerModal`](../../components/brokers/AddBrokerModal.tsx) (canonical modal), [`RelistFileModal`](../../components/transaction/RelistFileModal.tsx) (multi-stage form), [`ChainDrawer`](../../components/chain/ChainDrawer.tsx) (canonical drawer).

---

## Locked constraints (from open question answers)

| Q | Decision |
|---|---|
| Edit Sale Details save model | Per-section saves. Each section has its own Save/Cancel. Closing with unsaved edits triggers a three-option prompt. Fix 8 reconciliation stays inside the Property section's save flow. |
| Blue CTAs in SaveProgressModal / DuplicateModal | Not intentional. Change both to `agent-btn-color-primary`. |
| ReconciliationModal type | Convert to drawer. |
| ChainDrawer `confirm()` replacements | Inline ConfirmRow on the card. Tap delete → card content swaps to "Delete this node? [Delete] [Cancel]". |
| Header accent line | 2–3px top border, full-width, `var(--agent-coral-deep)`. Applied to both drawers and modals. |
| ChaseDrawer WhatsApp label | Keep log-on-tap. Relabel: "Send via WhatsApp" with subtext "We'll log this and open WhatsApp". |
| Close button standard | Phosphor `X`, `rounded-lg` (8px), ghost background with hover state. All drawers and modals. |
| Focus rings | Add `.agent-focus` utility class wrapping `var(--agent-focus-ring)`. Apply across all interactive inputs. |
| WelcomeModal tour replay | Add `/agent/tour` route. No replay button on modal itself. |
| Exchange/completion sequence | ReconciliationDrawer commits → drawer closes → ~200ms gap → ExchangeCelebration fires. Celebration stays a modal. |
| Unsaved changes handling (additional) | Drawer tracks per-section unsaved state. Unsaved section shows a dot on its header. Closing with unsaved edits shows a three-option centred prompt: "Save all changes" / "Discard changes" / "Keep editing". |

---

## 1. Shared Primitives

The design system consists of eight primitive building blocks. All 14 components map to some combination of these. The intent is to make the visual system derivable from the primitives — not to create a heavy abstraction layer, but to give designers and developers a shared vocabulary.

### 1.1 Drawer

A right-anchored panel that fills the viewport height. Used for all transaction-scoped actions.

```
Drawer
├── Backdrop           — full-screen dim + blur, dismisses on click
└── Panel              — right-edge, full height
    ├── Accent Line    — 2px top border, var(--agent-coral-deep)
    ├── Header         — flex-shrink-0, one of three variants (§2)
    ├── Body           — flex-1, overflow-y-auto
    └── Footer         — flex-shrink-0, one of four CTA patterns (§3)
```

**Props / variants:**

| Prop | Options | Default |
|---|---|---|
| `size` | `sm` 440px / `md` 460px / `lg` 480px / `xl` 560px | `md` |
| `onClose` | `() => void` | required |
| `ariaLabel` | string | required |
| `hasUnsavedSections` | boolean | `false` — triggers close prompt |

**Panel surface:** `rgba(255,255,255,0.92)`, `backdropFilter: blur(32px) saturate(1.8)`, `borderLeft: 1px solid rgba(255,255,255,0.5)`, `boxShadow: -8px 0 40px rgba(0,0,0,0.20)`.

**Mobile behaviour:** Full-width below `sm` breakpoint. No explicit mobile redesign in this phase; flagged for future mobile pass.

**Stacked drawers — accent line rule:**
When two drawers are open simultaneously (e.g. AddNodeDrawer opened from ChainDrawer), only the **topmost** (frontmost, highest z-index) drawer renders the 2–3px `var(--agent-coral-deep)` top accent line. The drawer behind drops it (`border-top: none`). This prevents a visual collision where two accent lines stack against each other and the background drawer's line bleeds through. Implementation: the drawer behind remains open but adds a `data-drawer-behind` attribute (or equivalent z-index comparison) that a parent container or the drawer itself can use to suppress the border-top. Simplest implementation: pass a `isTopmost` prop (default `true`); the stacking container sets `isTopmost={false}` on the lower drawer.

---

### 1.2 Modal

A centred card overlay. Used for global actions, simple confirmations, and celebration states.

```
Modal
├── Backdrop           — full-screen dim + blur, optionally dismisses on click
└── Card               — centred, max-width constrained, max-h-[88vh]
    ├── Accent Line    — 2px top border, var(--agent-coral-deep)
    ├── Header         — flex-shrink-0, one of three variants (§2)
    ├── Body           — flex-1, overflow-y-auto where content may scroll
    └── Footer         — flex-shrink-0, one of four CTA patterns (§3)
```

**Props / variants:**

| Prop | Options | Default |
|---|---|---|
| `size` | `sm` max-w-sm (~384px) / `md` max-w-md (~448px) / `lg` max-w-lg (~512px) | `md` |
| `onClose` | `(() => void) \| undefined` | — (if omitted, no close button rendered) |
| `dismissOnBackdrop` | boolean | `true` |
| `ariaLabel` | string | required |

**Card surface:** `bg-white` for workflow/confirmation modals (solid white); `glass-card-strong` for in-context agent shell modals (WelcomeModal, AddFirmModal, FeedbackModal, MortgageModal). The distinction is: modals opened from within the property file or shell use glass; workflow modals from the new-transaction form use solid white because they appear over an already-complex background.

**ExchangeCelebration exception:** Full-screen overlay with `z-[200]`. Not a Modal primitive — it's a one-off. Retains its own container but gains the accent line treatment.

---

### 1.3 Header

Three variants. Shared across Drawer and Modal. Always `flex-shrink-0`. Contains accent line as its top edge (the `border-top` sits on the panel/card itself, not inside the Header component — the Header sits below it).

**Shared structure:**
```
Header
├── Left: Title block (variant-specific)
└── Right: Close button (Phosphor X, rounded-lg, ghost)
```

**Padding (all variants):** `px-6 py-5`
**Bottom border:** `border-b border-white/30` for drawers; `border-b border-slate-100` for solid-white modals; `border-b border-white/20` for glass modals.
**Background:** `bg-white/20` for drawers; none (card background shows through) for modals.

See §2 for full header variant specs.

---

### 1.4 Body

The scrollable content region.

**Padding (standard):** `px-6 py-5`
**Scroll:** `flex-1 overflow-y-auto`
**Section spacing:** `space-y-5` between Section blocks within the Body
**Exceptions:**
- ExchangeCelebration: `px-8 py-10` (roomy — intentional for celebration)
- WelcomeModal: `p-6` equivalent (onboarding needs breathing room)
- These two are documented deviations, not inconsistencies.

---

### 1.5 Footer

The non-scrolling CTA area at the bottom.

**Padding (all):** `px-6 py-4`
**Top border:** `border-t border-white/30` for drawers; `border-t border-slate-100` for solid modals; `border-t border-white/20` for glass modals.
**Background:** `bg-white/20` for drawers; none for modals.

See §3 for CTA pattern variants.

---

### 1.6 Section

A grouped block inside Body. Used in form drawers. Not used in confirmation modals (which have no section grouping).

```
Section
├── Section Header: label + optional note + unsaved dot
└── Section Container: rounded card wrapping fields
```

**Section header:**
```
[● unsaved dot, if applicable]  SECTION LABEL  (optional note)
```
- Label: `.agent-section-label` — `text-[11px] font-semibold uppercase tracking-[0.06em]` + `color: rgba(var(--agent-coral-rgb), 0.65)` ← themed
- Note: inline after label, `font-normal normal-case opacity-60`
- Unsaved dot: `w-1.5 h-1.5 rounded-full bg-amber-400` — amber, semantic warning, must not theme

**Section container variants:**

| Variant | Use | Surface |
|---|---|---|
| `neutral` | Standard fields (Property address, Price, Timeline) | `rounded-xl bg-white/40 border border-white/50 px-4 py-3 space-y-3` |
| `callout` | Themed accent sections (agent contact, chain callout) | `rounded-xl agent-chain-callout px-4 py-3 space-y-3` |

**Per-section Save/Cancel (in Edit Sale Details drawer only):**
Appears below the section container when the section has unsaved edits.
```
[Save]   Cancel   ← "Save" is small primary, "Cancel" is text link
```
- Save: `px-4 py-2 text-xs font-semibold rounded-xl agent-btn-color-primary`
- Cancel: `text-xs text-slate-900/40 hover:text-slate-900/70 ml-3`
- Rendered inline below the section container, not in the drawer footer

---

### 1.7 Field

A labelled input wrapper. Used within Section containers.

```
Field
├── Label row: label text + required asterisk (if applicable)
├── Input: glass-input + .agent-focus
└── Error: text-xs text-red-500 (when present)
```

**Label:** `text-xs font-semibold text-slate-900/65`
**Required marker:** `text-red-400 ml-0.5` — semantic danger, must not theme
**Error text:** `text-xs text-red-500` — semantic danger, must not theme
**Input:** `glass-input` (existing utility class) + `.agent-focus` (new utility class, see §7)
**Textarea:** `glass-input resize-none` + `.agent-focus`

---

### 1.8 ButtonGroup

The CTA container inside Footer. See §3 for full patterns.

```
ButtonGroup
├── Primary button
├── Secondary button (if applicable)
├── Tertiary button (if applicable)
└── Helper text (optional, centred below buttons)
```

**Helper text:** `text-[11px] text-slate-900/45 text-center mt-2`

---

### 1.9 ConfirmRow

An inline confirmation row that replaces native `confirm()` dialogs inside list items. Used in ChainDrawer for delete confirmation.

```
ConfirmRow
├── Message text
├── Confirm button (danger-tinted)
└── Cancel button (text)
```

**Anatomy:** Replaces the content of a card/list-item inline. Does not create a new overlay layer.

**Variants:**

| Variant | Confirm button colour | Use case |
|---|---|---|
| `danger` | `text-red-500 hover:text-red-700` | Deleting a node |
| `neutral` | `agent-btn-color-primary` | Non-destructive confirmation |

**Structure:**
```
<div: flex items-center justify-between px-4 py-3>
  <p: text-sm text-slate-900/70 font-medium>Message?</p>
  <div: flex gap-3>
    <button: danger variant>  Confirm label  </button>
    <button: text-xs text-slate-900/40 hover:text-slate-900/70>  Cancel  </button>
  </div>
</div>
```

---

## 2. Header Treatments

### Variant A — Simple title

**Use:** Most modals and ChainDrawer. No additional context needed beyond the title.

```
┌─────────────────────────────────────────┐  ← 2px var(--agent-coral-deep) top border
│ Title                              [✕]  │
│ Subtitle (optional)                     │  ← text-xs text-slate-900/50
└─────────────────────────────────────────┘
│ border-b                                │
```

- Title: `text-base font-semibold text-slate-900/85`
- Close button: top-right, `p-1.5 rounded-lg hover:bg-white/30 text-slate-900/40`, Phosphor `X size={14} weight="bold"`
- Applies to: ChainDrawer, WelcomeModal (inner), AddFirmModal, FeedbackModal, SurveyNrConfirmModal (retrofitted), ReconciliationDrawer, UndoMilestoneModal, MortgageModal (retrofitted), ExchangeCelebration (inner card)

---

### Variant B — Title + tag/pill

**Use:** Drawers where directional or contextual metadata belongs in the header. The tag is a small themed pill adjacent to the title.

```
┌─────────────────────────────────────────┐  ← 2px accent line
│ Title  [↑ Above]                  [✕]  │
│ Subtitle                                │
└─────────────────────────────────────────┘
```

- Title: same as Variant A
- Tag pill: `text-[10px] font-semibold px-2 py-0.5 rounded-full` + `agent-chain-callout` surface treatment — themed border + tinted background
- Tag rendered only when applicable (AddNodeDrawer: direction; EditSaleDetailsDrawer: truncated property address)
- Applies to: AddNodeDrawer (direction ↑↓), EditSaleDetailsDrawer (property address chip)

**Property address tag in EditSaleDetailsDrawer:**
- Content: first line of address only (before first comma)
- Style: same pill, slightly longer — `text-[10px] font-medium px-2.5 py-0.5 rounded-full agent-chain-callout`
- Purpose: confirms which file is being edited (drawers can stack — this prevents editing the wrong file)

---

### Variant C — Contextual (ChaseDrawer only)

ChaseDrawer's header is purposefully unique — it is a communication tool, not a generic form. The header doubles as the composition context (who, what, which chase number). This variant is not generalised.

```
┌─────────────────────────────────────────┐  ← 2px accent line
│ [CHASE]  #3  [Professional ●]    [✕]  │  ← eyebrow row
│ Milestone name                          │  ← or list of milestone names
└─────────────────────────────────────────┘  ← border-b
│ Property card (separate section below)  │
```

**Changes from current:** All hardcoded hex values (`coral = "#FF6B4A"` etc.) replaced with CSS variable references. Visual structure unchanged. Full mapping in §8.2.

---

### Close button standard (all variants)

| Property | Value |
|---|---|
| Icon | Phosphor `X`, `size={14}`, `weight="bold"` |
| Shape | `rounded-lg` (8px) |
| Size | `p-1.5` (padding), resulting in ~28×28px touch target |
| Default state | `text-slate-900/40` (neutral — does not theme) |
| Hover state | `bg-white/30 text-slate-900/60` (neutral glass hover) |
| Position | Absolute top-right or flex end in header row, aligned to title baseline |
| Aria | `aria-label="Close"` |

The close button is **neutral** — it does not theme. It is a system affordance, not a brand element.

---

## 3. Footer / CTA Standards

### 3.1 Pattern selection rules

| Pattern | When to use |
|---|---|
| **Single full-width** | One possible action; dismissal is by backdrop, Escape, or the action itself completing. |
| **Paired side-by-side** | Exactly two options, neither is clearly dominant over the other. Use for two-step confirmations (Back / Confirm) or equivalent-weight choices. |
| **Paired drawer** | Form drawer Save/Cancel. Cancel has fixed narrow width (`w-24`); Save takes remaining space (`flex-1`). Visually signals Save is the destination. |
| **Stacked primary + secondary** | Primary is the clear intended action; secondary is a retreat or alternative path. Celebratory states, onboarding flows. |
| **Three-tier** | Three genuinely distinct outcomes, none reducible to the other. MortgageModal pattern. Use sparingly. |

### 3.2 Patterns in detail

**Single full-width:**
```
[     Primary action     ]
Helper text (optional)
```
- Button: `w-full py-2.5 text-sm font-semibold rounded-xl agent-btn-color-primary`
- Exception: ExchangeCelebration uses `bg-emerald-500` (semantic success — must not theme)

**Paired side-by-side (modal confirmation):**
```
[    Primary action    ]  [    Secondary / Back    ]
```
- Both `flex-1 py-2.5 text-sm rounded-xl`
- Primary: `font-semibold agent-btn-color-primary`
- Secondary: `font-medium border border-slate-200 text-slate-600 agent-hover-row` (neutral)
- Primary is always on the **left** in paired modal layout

**Paired drawer (form Save/Cancel):**
```
[Cancel]  [      Save / Submit       ]
```
- Cancel: `w-24 py-2.5 text-xs font-medium rounded-xl text-slate-900/60 border border-white/50 bg-white/30 hover:bg-white/60`
- Save: `flex-1 py-2.5 text-sm font-semibold rounded-xl agent-btn-color-primary disabled:opacity-40`
- Cancel is always on the **left**
- Helper text below (when relevant): `text-[11px] text-slate-900/45 text-center mt-2`

**Stacked primary + secondary:**
```
[          Primary action          ]
[        Secondary / retreat       ]
Fine print or reassurance text
```
- Primary: `w-full py-2.5 text-sm font-semibold rounded-xl agent-btn-color-primary`
- Secondary: `w-full py-2.5 text-sm font-medium rounded-xl border border-white/50 bg-white/30 hover:bg-white/60`
- Fine print: `text-center text-xs text-slate-900/40 mt-1`

**Three-tier:**
```
[          Primary action          ]
[          Secondary action        ]
Cancel (text-only tertiary)
```
- Primary: `w-full py-2.5 text-sm font-semibold rounded-xl agent-btn-color-primary`
- Secondary: `w-full py-2.5 text-sm text-slate-900/60 rounded-xl hover:bg-white/20`
- Tertiary: `w-full py-1.5 text-xs text-slate-900/30 hover:text-slate-900/60`
- `space-y-2` between all three

### 3.3 Destructive action rules

- Destructive primary buttons (Undo, Delete) use `bg-amber-500 hover:bg-amber-600 text-white` — semantic warning, **never theme**
- Dangerous-variant ConfirmRow confirm button uses `text-red-500 hover:text-red-700` — semantic danger, **never theme**
- Destructive actions must always be paired with a Cancel — never single full-width

### 3.4 Conditional footer

ChainDrawer's footer only appears when there are pending invites. This conditional pattern is unique to ChainDrawer. All other components have footers that are always present once the component mounts.

---

## 4. Spacing / Density Tokens

**Proposal:** One padding standard for each zone. Current state has 7+ variants; all components migrate to these values.

| Zone | Value | Tailwind equivalent |
|---|---|---|
| Drawer header padding | `px-6 py-5` | `px-6 py-5` |
| Drawer body padding | `px-6 py-5` | `px-6 py-5` |
| Drawer footer padding | `px-6 py-4` | `px-6 py-4` |
| Modal header padding | `px-6 pt-5 pb-4` | `px-6 pt-5 pb-4` |
| Modal body padding | `px-6 py-5` | `px-6 py-5` |
| Modal footer padding | `px-6 pb-5 pt-4` | `px-6 pb-5 pt-4` |
| Section-to-section gap (in Body) | `space-y-5` | `space-y-5` |
| Within-section container | `px-4 py-3 space-y-3` | `px-4 py-3 space-y-3` |
| Field-to-field gap (outside containers) | `space-y-4` | `space-y-4` |

**Documented deviations (intentional, not inconsistencies):**
- ExchangeCelebration body: `px-8 py-10` — celebratory, must feel spacious
- WelcomeModal body: `p-6` — onboarding, generous spacing is intentional

---

## 5. Backdrop Standard

**One standard backdrop across all drawers and modals.**

| Property | Value | Rationale |
|---|---|---|
| Background | `rgba(0, 0, 0, 0.35)` | Dims without crushing. Current range is 0.30–0.65; 0.35 is the most common and visually balanced. |
| Blur | `backdrop-filter: blur(4px)` | Subtle context preservation. Current range is 2px–8px; 4px is the midpoint. |
| Animation | `agent-backdrop-in 200ms ease both` | Already defined in `agent-system.css`. |
| Dismiss on click | Yes (all drawers, most modals) | Exception: ExchangeCelebration — backdrop click dismisses (correct). |
| Token name | `--agent-backdrop-bg: rgba(0, 0, 0, 0.35)` | Define in `agent-system.css` for single-source updates. |

**ExchangeCelebration exception:** `bg-black/65` — intentionally dark to make confetti visible. This is a deliberate design decision, not a legacy inconsistency. Retain.

**Implementation:** Replace all hardcoded backdrop implementations (`bg-black/40`, `rgba(0,0,0,0.35)` inline styles, `rgba(15,23,42,0.6)` etc.) with a standard CSS class:

```css
.agent-backdrop-overlay {
  position: fixed;
  inset: 0;
  background: var(--agent-backdrop-bg, rgba(0, 0, 0, 0.35));
  backdrop-filter: blur(4px);
  animation: agent-backdrop-in 200ms ease both;
}
```

---

## 6. Animation Standard

**One entry curve for all drawers and modals.**

| Property | Value |
|---|---|
| Duration | `280ms` |
| Easing | `cubic-bezier(0.34, 1.56, 0.64, 1)` — slight spring overshoot |
| Backdrop duration | `200ms ease` — faster, appears first |

**Two keyframes required:**

**For centred modals** — already exists in `agent-system.css`:
```css
@keyframes agent-modal-in {
  from { opacity: 0; transform: scale(0.95) translateY(8px); }
  to   { opacity: 1; transform: scale(1.00) translateY(0);   }
}
```

**For right-panel drawers** — new keyframe to add:
```css
@keyframes agent-drawer-in {
  from { opacity: 0; transform: translateX(24px); }
  to   { opacity: 1; transform: translateX(0);    }
}
```

Currently, drawers use `agent-modal-in` — which produces a scale+lift effect on a right-panel. That should become `agent-drawer-in` (slide from right). The existing `agent-modal-in` is then purely for centred overlays.

**Apply to:** All 14 components. The 6 components that currently have no animation (MilestoneRow inline modals, AddFirmModal, FeedbackModal, inline NewTransactionForm modals) gain `agent-modal-in 280ms cubic-bezier(0.34, 1.56, 0.64, 1) both` on the card element and `agent-backdrop-in 200ms ease both` on the backdrop.

---

## 7. Theme Integration

The medium theming rule: **section labels, primary CTAs, focus states, icon tints, and the header accent line theme to the active brand theme. Body surfaces, text, borders, and inputs stay neutral. Functional/semantic/brand colours never theme.**

### 7.1 New utility class: `.agent-focus`

Add to `agent-system.css`:
```css
.agent-focus:focus {
  outline: none;
  box-shadow: var(--agent-focus-ring);
  border-color: var(--agent-border-focus);
}
```

Apply this class to: all `<input>`, `<select>`, `<textarea>` elements within drawers and modals. Replace all instances of `focus:ring-blue-500 focus:ring-2` with `agent-focus`.

### 7.2 New utility class: `.agent-section-label`

Add to `agent-system.css` (or extend existing `glass-section-label`):
```css
.agent-section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(var(--agent-coral-rgb), 0.65);
}
```

This replaces the four divergent implementations of the all-caps grey label pattern. Note: `0.65` opacity on the coral channel produces a muted, readable brand-tinted label — not a bold accent.

### 7.3 Surface-to-token mapping table

| Surface | Token | Themes? | Notes |
|---|---|---|---|
| Panel top accent line | `var(--agent-coral-deep)`, 2–3px solid | ✓ YES | On the outermost drawer panel or modal card |
| Section label text | `rgba(var(--agent-coral-rgb), 0.65)` | ✓ YES | Via `.agent-section-label` |
| Primary CTA background | `agent-btn-color-primary` (already themed) | ✓ YES | Already correct everywhere except SaveProgress/Duplicate |
| Primary CTA text | `var(--agent-text-on-coral)` | ✓ YES | Part of existing `agent-btn-color-primary` |
| Focus ring | `var(--agent-focus-ring)` box-shadow | ✓ YES | Via `.agent-focus` |
| Focus border | `var(--agent-border-focus)` | ✓ YES | Via `.agent-focus` |
| Selection state (radio, active option btn) | `border: 1.5px solid var(--agent-coral-deep)` + `background: var(--agent-coral-bg-tint)` | ✓ YES | Replaces hardcoded `border-blue-500 bg-blue-50` |
| Tagged pill / callout border | `rgba(var(--agent-coral-rgb), 0.22)` | ✓ YES | Via existing `agent-chain-callout` |
| Tagged pill / callout background | `rgba(var(--agent-coral-rgb), 0.08)` | ✓ YES | Via existing `agent-chain-callout` |
| Icon tints (in themed areas) | `var(--agent-coral)` or `rgba(var(--agent-coral-rgb), ...)` | ✓ YES | Only for decorative/contextual icons, not semantic |
| Drawer body background | `rgba(255,255,255,0.92)` | NO | Neutral glass — stays consistent across themes |
| Modal card background | `bg-white` or `glass-card-strong` | NO | Neutral — content surface stays white/glass |
| Header background strip | `bg-white/20` | NO | Neutral transparency |
| Body text (primary) | `text-slate-900/85` | NO | Neutral |
| Body text (secondary/muted) | `text-slate-900/50` | NO | Neutral |
| Input backgrounds | `glass-input` | NO | Neutral |
| Non-accent borders | `border-white/30` / `border-slate-100` | NO | Neutral |
| WhatsApp green (ChaseDrawer) | `#22c55e` / `rgba(34,197,94,...)` | NEVER | Semantic channel colour |
| Tone pills (ChaseDrawer) | Functional palette (green/blue/amber/orange/red/deep-red) | NEVER | Functional scale |
| Success states | `--agent-success`, `bg-emerald-*` | NEVER | Semantic |
| Warning/destructive | `--agent-warning`, `bg-amber-*` | NEVER | Semantic (incl. Undo button) |
| Danger | `--agent-danger`, `text-red-*` | NEVER | Semantic |
| Exchange celebration button | `bg-emerald-500` | NEVER | Semantic success |
| Delta list colours (red/green rows) | `border-red-100`, `border-green-100` etc. | NEVER | Semantic |
| Unsaved dot | `bg-amber-400` | NEVER | Semantic warning indicator |

### 7.4 ChaseDrawer token substitution map

ChaseDrawer currently uses hardcoded JS constants. Each constant maps to a CSS variable:

| Current constant | Replace with | Notes |
|---|---|---|
| `coral = "#FF6B4A"` | `var(--agent-coral-deep)` | Used for email CTA, eyebrow label, borders |
| `coralLight = "rgba(255,107,74,0.10)"` | `rgba(var(--agent-coral-rgb), 0.10)` | Bloom gradient, card shadow |
| `coralBorder = "rgba(255,107,74,0.18)"` | `rgba(var(--agent-coral-rgb), 0.18)` | Panel border, property card border |
| Email active border | `1.5px solid var(--agent-coral-deep)` | Channel tab active state |
| Email active background | `linear-gradient(135deg, var(--agent-coral-deep), var(--agent-coral-light))` | Channel tab fill |
| Email active shadow | `0 4px 16px rgba(var(--agent-coral-rgb), 0.28)` | Tab glow |
| CC toggle active | `var(--agent-coral-deep)` | Toggle track fill |
| Generate button | `linear-gradient(135deg, var(--agent-coral-deep), var(--agent-coral-light))` | Full-width generate CTA |
| Send button (email) | `linear-gradient(135deg, var(--agent-coral-deep), var(--agent-coral-light))` | Footer send CTA |
| Textarea focus | `.agent-focus` class | Replace inline onFocus/onBlur handlers |
| `inkFaint = "rgba(26,10,0,0.20)"` | `var(--agent-border-subtle)` | Subtle borders |
| `inkMid = "rgba(26,10,0,0.45)"` | `var(--agent-text-muted)` | Secondary text |
| `ink = "rgba(26,10,0,0.88)"` | `var(--agent-text-primary)` | Primary text |
| WhatsApp green `#22c55e` | Keep as-is | Semantic channel colour — never theme |
| WhatsApp shadow | Keep as-is | Semantic |
| Tone pill colours | Keep as-is | Functional scale — never theme |
| Panel background | `rgba(255,250,247,0.98)` | Near-white — acceptable neutral. Could be `var(--agent-bg-paper)` but this would theme the drawer background which is against the rule. Keep neutral. |

### 7.5 Portal theming

React portals render into `document.body` — a sibling of the agent layout's `[data-theme]` wrapper, not a descendant. CSS custom properties don't cascade sideways, so portal-rendered components receive none of the theme tokens.

**Fix:** use `usePortalTheme()` from `lib/agent/use-portal-theme.ts` and apply the returned value as `data-theme` on the portal's outermost element.

```tsx
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

const theme = usePortalTheme();
return createPortal(
  <div data-theme={theme} style={{ position: "fixed", inset: 0, zIndex: 1000 }}>
    {/* modal / drawer content — all CSS vars resolve correctly */}
  </div>,
  document.body
);
```

The hook reads the active theme on mount. Theme changes mid-session are not tracked (themes don't change during a session in practice); add a MutationObserver listener if that requirement ever arrives.

---

## 8. Per-Component Application

### 8.1 ChainDrawer

**Primitive:** Drawer/lg
**Header:** Variant A (simple title). Upgrade title from `text-sm` to `text-base font-semibold`. Add subtitle (already present).
**Changes:**
- Add 2px `var(--agent-coral-deep)` accent line to panel top
- Standardise close button to Phosphor X rounded-lg ghost
- Add Escape key handler (currently missing)
- Fix empty-chain state copy: "Chain created — add the first node above or below" (vs. the current misleading "No chain linked to this sale")
- Replace 3 native `confirm()` calls with ConfirmRow (inline confirmation on the node card)
- Migrate header padding to `px-6 py-5` (from `px-5 py-4`)
- Migrate body padding to `px-6 py-5` (from `px-5 py-4`)
- Add skeleton loading state (3 placeholder cards) replacing plain "Loading chain…" text
- Footer: already conditional sticky — standardise padding to `px-6 py-4`
- Backdrop: standardise to `agent-backdrop-overlay` class

**No section label changes** — ChainDrawer has no form sections.

---

### 8.2 ChaseDrawer

**Primitive:** Drawer/md (custom header — Variant C)
**Priority:** Migration #1 (see §10)
**Changes:**
- Add 2px `var(--agent-coral-deep)` accent line to panel top
- Standardise close button to Phosphor X rounded-lg ghost (currently a Phosphor X in a bordered pill — close, but shape and padding differ)
- **Full token substitution** per the map in §7.4 — every hardcoded hex value replaced with CSS variable reference
- Section labels ("SEND VIA", "TONE"): convert from inline style to `.agent-section-label` class
- Textarea: add `.agent-focus` class (replacing inline `onFocus`/`onBlur` border-colour handlers)
- Footer button "Open WhatsApp" → "Send via WhatsApp". Add subtext beneath footer button: `text-[11px] text-slate-900/40 text-center mt-1 → "We'll log this and open WhatsApp"`
- Backdrop: standardise to `agent-backdrop-overlay` class
- Add animation: `agent-drawer-in 280ms cubic-bezier(0.34, 1.56, 0.64, 1) both` on panel (replacing `agent-modal-in`)

**Keep unchanged (must not theme):** WhatsApp green, tone pills, all functional/semantic colours.

---

### 8.3 AddNodeDrawer

**Primitive:** Drawer/sm
**Header:** Variant B (title + direction pill). Already largely correct.
**Changes:**
- Add 2px `var(--agent-coral-deep)` accent line to panel top
- Standardise close button to Phosphor X rounded-lg ghost (currently SVG X in `p-1 rounded` — minor shape update)
- Section labels: replace current Tailwind string with `.agent-section-label` class
- All `<input>` and `<textarea>`: add `.agent-focus` class
- Animation: swap `agent-modal-in` on panel to `agent-drawer-in`
- Body/footer padding already at standard — no change

**Keep unchanged:** `agent-chain-callout` treatment on agent contact section (already correct). `agent-btn-color-primary` on Save (already correct).

---

### 8.4 WelcomeModal

**Primitive:** Modal/md (glass-card-strong surface)
**Header:** Gradient strip (kept, not Variant A — the gradient strip is intentional onboarding design)
**Changes:**
- Add 2px `var(--agent-coral-deep)` accent line to card top edge
- Gradient strip: replace hardcoded `rgba(255,138,101,0.18) → rgba(255,183,77,0.12)` with `rgba(var(--agent-coral-rgb), 0.18) → rgba(var(--agent-bloom-gold-rgb), 0.12)` — now themes to active brand colour
- Eyebrow text: already `var(--agent-coral-deep)` — correct
- Close button: already Phosphor X — verify shape is `rounded-lg` (currently appears to be `rounded-[8px]` which is equivalent)
- Body/footer padding: already acceptable
- Backdrop: add `agent-backdrop-in` animation (currently uses `agent-backdrop` CSS class — verify it has equivalent animation)

---

### 8.5 EditSaleDetailsModal → EditSaleDetailsDrawer

**Primitive:** Drawer/md
**Header:** Variant B (title + property address tag)
**Full specification:** See §9.

---

### 8.6 AddFirmModal

**Primitive:** Modal/md (glass-card-strong surface)
**Header:** Variant A (simple title)
**Changes:**
- Add 2px `var(--agent-coral-deep)` accent line to card top
- Close button: replace `×` text with Phosphor X, `p-1.5 rounded-lg ghost`
- Section label "CASE HANDLER": replace with `.agent-section-label`
- Field label ("Firm name *"): update to standard Field label style (`text-xs font-semibold text-slate-900/65`)
- All `<input>`: add `.agent-focus` class
- Animation: add `agent-modal-in 280ms cubic-bezier(0.34, 1.56, 0.64, 1) both` to card
- Backdrop: standardise to `agent-backdrop-overlay`
- Footer CTA: `flex-1 py-2.5 text-sm font-semibold` for primary (currently `py-2.5 font-medium text-sm` rounded-lg — minor: bump font-weight to semibold, `rounded-xl` not `rounded-lg`)

---

### 8.7 ExchangeCelebration

**Primitive:** Special — full-screen overlay, not Drawer or Modal primitive
**Changes:**
- Add 2px `var(--agent-coral-deep)` accent line to the white card top
- Add Escape key handler (currently missing)
- Continue button: `bg-emerald-500` — keep (semantic success — must not theme)
- Star icon gradient: low priority — leave hardcoded amber/orange for now (decorative, not worth the pass)
- Animation `exchange-in`: keep (unique, one-off celebration feel)
- Backdrop: keep `bg-black/65` intentional dark (confetti visibility)

---

### 8.8 FeedbackModal (within FeedbackButton)

**Primitive:** Modal/sm (glass surface)
**Header:** Variant A (simple title)
**Changes:**
- Add 2px `var(--agent-coral-deep)` accent line to card top
- Card container: replace hardcoded `rgba(255,255,255,0.94)` with `glass-card-strong` token
- Floating trigger button: replace hardcoded `rgba(255,255,255,0.82) border rgba(255,255,255,0.6)` with `glass-card` token equivalent
- Section type selector: active state `agent-badge-brand` — verify it uses theme tokens (likely does, flag if not)
- Textarea: add `.agent-focus`
- Animation: add `agent-modal-in 280ms cubic-bezier(0.34, 1.56, 0.64, 1) both` to card
- Backdrop: standardise to `agent-backdrop-overlay`
- Note: this modal does not use `createPortal` — add portal to ensure it renders above all z-stacked elements

---

### 8.9 SurveyNrConfirmModal

**Primitive:** Modal/sm (solid white surface)
**Header:** Variant A (simple title — currently rendered as `<p>` elements; convert to proper header strip)
**Source:** Extract from `MilestoneRow.tsx` into `components/milestones/SurveyNrConfirmModal.tsx`
**Changes:**
- Extract to standalone file — enables isolated testing and usage tracking
- Add proper Header structure (Variant A) with close button (currently none)
- Add Escape key handler
- Add 2px accent line
- Footer: stacked pattern. Increase Cancel contrast: `text-sm text-slate-900/50 hover:text-slate-900/70` (from `text-xs text-slate-900/30`)
- Animation: add `agent-modal-in` to card
- Backdrop: standardise to `agent-backdrop-overlay`

---

### 8.10 ReconciliationModal → ReconciliationDrawer

**Primitive:** Drawer/md
**Header:** Variant A (simple title — "Confirm exchange" or "Confirm completion")
**Source:** Extract from `MilestoneRow.tsx` into `components/milestones/ReconciliationDrawer.tsx`
**Changes:**
- Convert from centred modal to right-panel Drawer
- Extract to standalone file
- Add Header with close button (currently none — the biggest UX gap in the codebase)
- Add Escape key handler
- Add 2px accent line
- Section label "OUTSTANDING MILESTONES": replace with `.agent-section-label`
- All `<input type="date">`: add `.agent-focus` (replacing `focus:ring-blue-500`)
- Expand/collapse link: replace `text-blue-500 hover:text-blue-600` with `agent-link-primary` or themed equivalent
- Animation: `agent-drawer-in` on panel
- Backdrop: standardise to `agent-backdrop-overlay`
- Body padding: `px-6 py-5` (from `p-6`)
- Footer CTA: paired drawer pattern — Cancel (`w-24`) + Confirm (`flex-1`) ← confirm moves to right as primary

**Sequence note (locked constraint):** When this drawer's Confirm action triggers the exchange milestone, the drawer closes cleanly, then ~200ms later `ExchangeCelebration` fires.

---

### 8.11 UndoMilestoneModal

**Primitive:** Modal/md (solid white surface)
**Header:** Variant A (already has correct header structure + close button)
**Source:** Extract from `MilestoneRow.tsx` into `components/milestones/UndoMilestoneModal.tsx`
**Changes:**
- Extract to standalone file
- Add 2px accent line
- Radio selected state: replace `border-blue-500 bg-blue-50/50` with `border: 1.5px solid var(--agent-coral-deep)` + `background: var(--agent-coral-bg-tint)` — themed selection state
- Expand/collapse link (if present): replace hardcoded blue with themed link
- Animation: add `agent-modal-in` to card
- Backdrop: standardise to `agent-backdrop-overlay`
- Destructive Undo button: keep orange — semantic warning, must not theme

---

### 8.12 MortgageModal

**Primitive:** Modal/sm (glass-card-strong surface)
**Header:** Variant A (currently rendered as `<p>` elements; convert to proper header strip)
**Source:** Extract from `NotRequiredRow.tsx` into `components/milestones/MortgageModal.tsx`
**Changes:**
- Extract to standalone file
- Add proper Header structure (Variant A) with close button (currently none)
- Add Escape key handler
- Add 2px accent line
- Footer: three-tier stacked pattern (already correct structure)
- Animation: add `agent-modal-in` to card
- Backdrop: standardise to `agent-backdrop-overlay` (currently `bg-black/30`)

---

### 8.13 SaveProgressModal

**Primitive:** Modal/sm (solid white surface — appears over new-transaction form, not in agent shell)
**Header:** No conventional header — icon + title in body (keep this pattern, it's appropriate for a navigation-guard interrupt)
**Changes:**
- Fix CTA: replace `linear-gradient(135deg, #3b82f6, #2563eb)` with `agent-btn-color-primary`
- Add 2px `var(--agent-coral-deep)` accent line to card top
- Add `createPortal` — currently rendered inline in the React tree
- Animation: add `agent-modal-in` to card (currently uses unique `cardSlideUp` with equivalent curve — standardise name)
- Backdrop: standardise to `agent-backdrop-overlay` (currently `rgba(15,23,42,0.6) blur(8px)` — too dark/blurry)
- Tertiary "Stay on this page": increase contrast to `text-slate-900/40` (from `/30`)

---

### 8.14 DuplicateAddressModal

**Primitive:** Modal/sm (solid white surface)
**Header:** No conventional header — icon + title in body (keep pattern, same rationale as SaveProgressModal)
**Changes:**
- Fix CTA: replace `linear-gradient(135deg, #3b82f6, #2563eb)` on "View existing file" anchor with `agent-btn-color-primary` (as a styled button or anchor styled as button)
- Add 2px `var(--agent-coral-deep)` accent line to card top
- Add `createPortal`
- Animation: add `agent-modal-in` to card
- Backdrop: standardise to `agent-backdrop-overlay`

---

## 9. Edit Sale Details Drawer — Full Specification

### 9.1 Container and header

**Primitive:** Drawer/md (460px)
**Header:** Variant B — title + property address tag

```
┌─────────────────────────────────────────────────┐  ← 2px var(--agent-coral-deep)
│ Edit sale details  [14 Hartwell Ave…]      [✕]  │
│ Changes save per section                         │
└─────────────────────────────────────────────────┘
```

- Title: "Edit sale details" — `text-base font-semibold text-slate-900/85`
- Tag: First line of property address (before first comma), truncated to ~24 chars with ellipsis — `agent-chain-callout` pill treatment
- Subtitle: "Changes save per section" — `text-xs text-slate-900/50 mt-0.5`
- Close button: Phosphor X, `p-1.5 rounded-lg ghost` — triggers unsaved-changes prompt if any section has pending edits

### 9.2 Unsaved changes tracking

Each section independently tracks whether its current field values differ from the last-saved values.

**Per-section indicator:**
When a section has unsaved edits, a small amber dot appears on the section label:
```
●  PROPERTY
```
- Dot: `inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 mb-0.5 align-middle`
- Amber is semantic (warning/pending) — must not theme

**Out-of-view unsaved section chip:**
When a section has unsaved changes AND has been scrolled out of the visible drawer body, a small sticky chip appears near the top of the drawer body (inside the body scroll container, `position: sticky top-3`):

```
● Price & Fees has unsaved changes
```

- Container: `sticky top-3 z-10 mx-auto w-fit px-3 py-1.5 rounded-full bg-white/90 border border-amber-200 shadow-sm text-xs font-medium text-amber-700`
- Dot: `inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 align-middle`
- Tapping/clicking scrolls to the section header (`scrollIntoView({ behavior: 'smooth', block: 'start' })`)
- Disappears when the section scrolls back into view (use `IntersectionObserver` on the section header)
- Disappears when section changes are saved (unsaved dot clears → chip clears)
- One chip per unsaved out-of-view section (if two sections are simultaneously out of view, stack two chips)
- This sits alongside the per-section dot on the section label — the chip is a navigation aid, not a replacement for the dot

**Unsaved changes prompt (on drawer close):**
Triggered when `onClose` is called and at least one section has unsaved state.

Appearance: small centred Modal/sm over the drawer (z-index above drawer).

```
┌──────────────────────────────────────┐  ← 2px accent line
│ Unsaved changes                 [✕]  │
│──────────────────────────────────────│
│ You have unsaved changes in:         │
│   · Price & Fees                     │
│   · Timeline                         │
│──────────────────────────────────────│
│  [  Save all changes  ]              │
│  [   Discard changes  ]              │
│  Keep editing                        │
└──────────────────────────────────────┘
```

- Lists only the sections with unsaved edits (one bullet per section)
- "Save all changes": calls all pending section save actions in sequence, then closes drawer
- "Discard changes": closes drawer without saving — resets all in-progress edits
- "Keep editing": closes this prompt, returns to drawer
- Three-tier footer pattern
- This prompt is a Modal/sm with a `data-unsaved-prompt` marker; it must not block interaction with other browser elements if the user needs to navigate away

### 9.3 Body — three sections

---

**Section 1: Property (Sale Type)**

Label: "PROPERTY" — `.agent-section-label`
Container: `neutral` variant (white/40 glass)
Fields: Purchase type + Tenure

**Purchase type** — styled pill picker (3 options):
```
[   Mortgage   ]   [  Cash buyer  ]  [ Cash from Proceeds ]
```
- Active: `border-[1.5px] border-[var(--agent-coral-deep)] bg-[var(--agent-coral-bg-tint)] text-slate-900/85 font-semibold`
- Inactive: `agent-option-btn text-slate-900/50` (existing class)
- No `<select>` — pill pickers match the add-sale form pattern

**Tenure** — styled pill picker (2 options):
```
[   Leasehold   ]   [   Freehold   ]
```
- Same active/inactive treatment as purchase type

**Unsaved dot:** shown when either value differs from the committed database value.

**Section Save flow — Fix 8 reconciliation integration:**

The Property section Save button adapts based on whether purchase type or tenure has changed:

*If no changes from saved values:*
```
[Save]  ← disabled (grey), no cancel shown
```

*If either field has changed from saved value — but preview not yet fetched:*
```
[Preview & save]  Cancel
```
Clicking "Preview & save" triggers `getSaleDetailsDelta()`. The button becomes "Checking…" with spinner while loading.

*If preview is available — delta is shown inline, expanding below the pill pickers:*

```
┌──────────────────────────────────────────────────┐
│ [Mortgage]  [Cash buyer]  [Cash from Proceeds]    │  ← pill pickers (locked during review)
│ [Leasehold] [Freehold]                            │
│                                                   │
│ ── Impact preview ─────────────────────────────── │
│ Milestones marked not required (3)                │  ← DeltaList red
│ · Mortgage offer received · Buyer  was complete   │
│ · Mortgage valuation · Buyer                      │
│   Show 1 more                                     │
│                                                   │
│ Milestones re-activated (2)                       │  ← DeltaList green
│ · Cash payment verified · Buyer                   │
│ · Solicitor funds confirmed · Buyer               │
│                                                   │
│ Progress: 68% → 54%  (14 left → 16 left)          │
│                                                   │
│ [Confirm changes]  Back                           │  ← confirm replaces preview
└──────────────────────────────────────────────────┘
```

- "Confirm changes": calls `confirmSaleDetailsAction()`, collapses preview, unsaved dot clears
- "Back": clears preview, re-enables pill pickers, returns to "Preview & save" state
- Pill pickers are visually locked (non-interactive) while preview is shown — the user must Back to change values
- If `noChange` returned from delta API: no preview shown, auto-commits silently, dot clears
- Error: inline below the impact preview, `text-sm text-red-500`

**Locked-pill visual treatment (while reconciliation preview is visible):**
```css
/* Applied to the pill picker rows when preview is open */
opacity: 0.5;
pointer-events: none;
```
A small caption appears directly beneath the pill row (not in the preview block):
```
Tap Back to change
```
- Caption: `text-[11px] text-slate-900/40 mt-1`
- This is rendered unconditionally when `previewState === 'shown'` — do not invent any other treatment at implementation time
- The caption disappears when "Back" is clicked and `previewState` returns to `'idle'`

---

**Section 2: Price & Fees**

Label: "PRICE & FEES" — `.agent-section-label`
Container: `neutral` variant
Three sub-sections within one section container, separated by subtle dividers (`border-t border-white/20`):

**2a. Purchase price:**
- Always shown as an editable PriceInput (not behind an "Edit" tap)
- Saves on "Save" click (which saves all Price & Fees changes)
- Shows current saved value on load
- `PriceInput` component + `.agent-focus`

**2b. Agent fee:**
- Toggle: `[Fixed £]  [%]` — pill pair (same active/inactive pattern as tenure pickers)
- Fixed: PriceInput
- Percent: text input + `%` unit + VAT select (`[+ VAT]  [Inc VAT]`)
- All inputs: `.agent-focus`
- Shows current saved value on load; formatted display reverts to editable input on tap (inline — no separate "Edit" mode)

**2c. Referral fee** (only rendered if `recommendedFirms` is non-empty):
- Firm select: `<select>` with `.agent-focus` + `agent-section-label` style options — `— select firm —` default
- Price input: PriceInput
- Auto-fill behaviour: selecting a firm populates PriceInput from `firm.defaultReferralFeePence` (existing behaviour preserved)
- Shows current saved firm name + fee as pre-selected values on load

**Section Save/Cancel:** One Save button saves all three sub-sections in sequence:
1. If purchase price changed: `savePriceAction`
2. If agent fee changed: `saveAgentFeeAction`
3. If referral fee changed: `saveReferralAction`

These are called sequentially (not in parallel) to preserve current error-handling patterns. Each failure surfaces an error below the section.

**Unsaved dot:** illuminates if any of the three sub-sections differs from last saved.

**Sequential save failure handling:**
If one of the three actions fails mid-chain:

1. **Halt on first failure.** Do not proceed to subsequent actions.
2. **Surface error inline** — below the Price & Fees section container, replace any previous error with the specific error message returned from the failed action: `text-sm text-red-500 mt-2`.
3. **Keep the unsaved dot** on the Price & Fees section label — the section is not saved.
4. **Mark already-committed fields as committed.** Fields whose actions completed before the failure are now equal to their saved values — treat them as clean (they will not be retried on the next Save click).
5. **Leave the failed field still editable** in its input — the user sees their intended value, not a reverted value.
6. **Retry behaviour:** When the user clicks Save again, skip any sub-section whose current value equals the last-committed value (i.e. it was already saved successfully), and retry only the failed sub-section.

State shape implication: each sub-section (purchase price, agent fee, referral fee) needs its own `lastCommittedValue` tracked separately from the overall `lastSavedValues`. After a partial success, `lastCommittedValue` for the succeeded sub-sections updates even though the overall section dot remains lit.

**Implementation note:** A combined server action for all three would be cleaner. This is flagged as a future refactor opportunity but is not required for launch — sequential calls are functionally equivalent.

---

**Section 3: Timeline**

Label: "TIMELINE" — `.agent-section-label`
Container: `neutral` variant
Two fields:

**3a. Predicted exchange date (override):**

Always shown. Two sub-states:

*No override set:*
```
Algorithm predicts: 14 August 2026   [Set override]
```
- "Set override" is a text link that reveals a date input below

*Override set:*
```
├ Overriding to: [  2026-09-01  ]   ← date input, editable
│                                   ← reference: "(algorithm: 14 Aug)"
│ [Clear override]                  ← text link, clears and reverts
```
- Date input: `glass-input .agent-focus`
- "Clear override": `text-xs text-slate-900/40 hover:text-red-500` — tapping clears the override value and returns to the "no override" state (does not save until section Save is clicked)

**3b. Completion date:**

Two states based on exchange status:

*Exchange not yet confirmed:*
```
Completion date
Set once exchange is confirmed    ← read-only grey italic text
```
No input, no edit affordance. Non-interactive.

*Exchange confirmed:*
```
Completion date
[  2026-10-01  ]    ← date input, .agent-focus
```
Standard editable date input.

**Section Save/Cancel:**
- Saves predicted-exchange override via `saveOverrideDateAction` (if changed)
- Saves completion date via `saveCompletionDateAction` (if changed and exchange confirmed)
- If only "clear override" was clicked, calling Save sends `null` to `saveOverrideDateAction`

**Unsaved dot:** illuminates when either date field differs from saved value, or when override has been cleared but not yet committed.

---

### 9.4 Drawer footer

The drawer footer contains **no primary CTA**. All saving happens per-section. The footer shows only:

```
┌──────────────────────────────────────────────┐
│ border-t border-white/30                     │
│ [Close]     (dot indicator if unsaved)       │
└──────────────────────────────────────────────┘
```

- Close button: `w-full py-2.5 text-sm font-medium rounded-xl border border-white/50 bg-white/30 hover:bg-white/60` (secondary style, full-width)
- If any unsaved sections: small inline `● 2 unsaved sections` text left of the Close button with `text-xs text-amber-600 font-medium`
- Clicking Close with unsaved sections triggers the unsaved-changes prompt

Rationale: A single full-width "Save all" in the footer would conflict with the per-section save model. The footer Close + per-section Save/Cancel keeps responsibility clear. The unsaved-changes prompt on Close is the safety net.

### 9.5 Scroll behaviour

Body is `flex-1 overflow-y-auto`. With three sections, the drawer body will be ~600–700px tall on content — likely taller than the viewport on laptop screens. The three sections scroll naturally within the panel. Each section's Save/Cancel scrolls into view with the section (not sticky).

If the unsaved-changes prompt blocks interaction, the user can still close the drawer via "Keep editing" and scroll to find the unsaved section.

### 9.6 Mobile behaviour (acknowledged, not implemented in this phase)

On mobile:
- The drawer becomes **full-screen** (100vw × 100dvh, no left edge glass panel effect)
- The unsaved-changes prompt (triggered on close) appears as a **bottom sheet** rather than a centred modal — slides up from the bottom with a drag handle, covering approximately 40% of the screen height

Neither of these is implemented in this phase. They are documented here so they are not reinvented or decided inconsistently when the mobile pass begins. The mobile pass will cover all 14 drawers/modals.

---

## 10. Migration Order

Priority criteria: (a) daily-use impact, (b) current brokenness / theming failure, (c) effort per risk, (d) prerequisite dependencies.

### Phase 1 — Immediate fixes (no structural change)

**1a. ChaseDrawer token substitution** — highest daily use, zero token coverage, will look wrong on every theme other than Sunset. Self-contained file change. Risk: low (swap hex for CSS var). Effort: medium (many inline style replacements).

**1b. SaveProgressModal + DuplicateAddressModal CTA colour** — two-line fix each. Unblock with `agent-btn-color-primary`. Risk: near-zero. Effort: trivial.

### Phase 2 — Extract inline portals to standalone files

Extracting items 9–12 from their parent components enables isolated testing, standardised structure, and unblocks the following phases.

**2a. SurveyNrConfirmModal** — extract from `MilestoneRow.tsx`. Simple confirmation, small scope. Add close button, Escape handler, accent line, animation, backdrop.

**2b. UndoMilestoneModal** — extract from `MilestoneRow.tsx`. Slightly more complex (two paths). Fix radio selected-state theming. Add animation, backdrop, accent line.

**2c. MortgageModal** — extract from `NotRequiredRow.tsx`. Simple three-tier. Add close button, Escape, animation, backdrop, accent line.

Doing 2a–2c before ReconciliationDrawer conversion means `MilestoneRow.tsx` loses three portals before we touch the fourth. Cleaner git history and easier review.

### Phase 3 — ReconciliationModal → ReconciliationDrawer

Type conversion: centred modal → right-panel drawer. The most complex single migration in the audit due to the form complexity. Now that `agent-drawer-in` keyframe exists (added in Phase 1 prep), and the backdrop utility class is standardised, this is a structural move rather than a design overhaul. Add close button, Escape, themed section labels, `.agent-focus` on date inputs, expand-link theming.

**Prerequisite:** The ~200ms gap before ExchangeCelebration fires needs to be implemented in the milestone-confirmation call site (wherever `handleReconciliationConfirm` is called). This is a small timing change but must be coordinated.

### Phase 4 — AddNodeDrawer polish

Already close to the standard. Small changes: accent line, `agent-drawer-in` animation swap, `.agent-focus` on inputs, Phosphor X close button standardisation. Lowest risk PR in the sequence.

### Phase 5 — EditSaleDetailsDrawer (new component — four PRs)

The largest feature in the sequence. Split into four reviewable PRs to reduce risk and enable incremental review. All four PRs are the same feature; the split is delivery risk management, not scope expansion.

**5a — Empty drawer shell:**
- Create `EditSaleDetailsDrawer.tsx` with the full three-section layout displaying current saved values (read-only)
- New "Edit details" button on the `TransactionSidebar.tsx` sidebar card header opens the drawer
- All three sections render their current saved values correctly (Property, Price & Fees, Timeline)
- No save actions wired — sections are display-only in this PR
- Inline edit affordances on `TransactionSidebar.tsx` remain fully functional in parallel — no regression risk
- `EditSaleDetailsModal.tsx` remains untouched

**5b — Per-section save flows (one section at a time within one PR):**
- Property section first (most complex — includes Fix 8 reconciliation preview via `getSaleDetailsDelta()` and `confirmSaleDetailsAction()`, pill pickers, locked-pill treatment from Refinement 2)
- Price & Fees section (three sequential server actions, failure handling from Refinement 3)
- Timeline section (override date, completion date, clear-override logic)
- Each section's Save/Cancel wired to its server action(s) before the next section is started

**5c — Unsaved changes tracking:**
- Per-section unsaved dot indicators
- Out-of-view sticky chip (per Refinement 1 — `IntersectionObserver` on section headers)
- Unsaved-changes prompt on drawer close (three-option centred Modal/sm)
- Footer `● N unsaved sections` indicator

**5d — Cutover:**
- Remove inline edit affordances from `TransactionSidebar.tsx` (the "Edit" links for purchase type/tenure, predicted exchange date override, completion date, agent fee, referral fee)
- Delete `EditSaleDetailsModal.tsx`
- Verify no remaining imports of the deleted modal

### Phase 6 — ChainDrawer, AddFirmModal, FeedbackModal polish

Small independent PRs:
- **ChainDrawer:** accent line, close button standardisation, empty-chain copy fix, ConfirmRow for delete, skeleton loading, Escape handler, `agent-drawer-in` animation
- **AddFirmModal:** accent line, close button (× → Phosphor X), `.agent-focus` on inputs, animation, backdrop
- **FeedbackModal:** accent line, glass token replacement for container, `.agent-focus`, animation, backdrop, `createPortal` addition

### Phase 7 — WelcomeModal + ExchangeCelebration

Lowest priority — rarely seen (WelcomeModal is first-login only; ExchangeCelebration is a milestone). Both need accent lines and minor token fixes. WelcomeModal gradient themeing requires care (test against all 6 themes). ExchangeCelebration gets Escape handler and accent line. Neither is on a critical user path.

### Migration summary table

| Phase | Components | Priority driver | Key deliverable |
|---|---|---|---|
| 1a | ChaseDrawer | Daily use, zero theming | Full token substitution, WhatsApp label update |
| 1b | SaveProgressModal, DuplicateModal | Quick win, brand consistency | CTA colour fix |
| 2 | SurveyNr, Undo, Mortgage | Prerequisite for Phase 3, enables isolation | Standalone files, close buttons, animation |
| 3 | ReconciliationDrawer | Type correction, UX gap (no close button) | Drawer conversion, close affordance |
| 4 | AddNodeDrawer | Incremental polish | Accent line, animation standardisation |
| 5a | EditSaleDetailsDrawer shell | New component foundation | Read-only shell, "Edit details" entry point |
| 5b | EditSaleDetailsDrawer save flows | Core feature (per-section saves) | Property + Price & Fees + Timeline wired |
| 5c | EditSaleDetailsDrawer unsaved tracking | State safety | Dots, out-of-view chip, close prompt |
| 5d | Cutover | Remove legacy code | Delete modal, remove inline edit affordances |
| 6 | ChainDrawer, AddFirmModal, FeedbackModal | Polish, ConfirmRow pattern | Accent line, skeleton, inline confirmation |
| 7 | WelcomeModal, ExchangeCelebration | Completeness | Accent line, theme-aware gradient |

---

## Appendix A — New CSS additions required (summary)

All of these additions go into `app/agent/styles/agent-system.css` or `app/globals.css` as noted.

| Addition | Location | Notes |
|---|---|---|
| `@keyframes agent-drawer-in` | `agent-system.css` | Slide from right: `translateX(24px)→0` |
| `.agent-backdrop-overlay` | `agent-system.css` | Standard backdrop class with `rgba(0,0,0,0.35)` + blur(4px) + animation |
| `--agent-backdrop-bg` CSS custom property | `themes.css` or `agent-system.css` | `rgba(0, 0, 0, 0.35)` — allows future per-theme backdrop tuning |
| `.agent-focus` | `agent-system.css` | Focus ring via `var(--agent-focus-ring)` + border-color via `var(--agent-border-focus)` |
| `.agent-section-label` | `agent-system.css` | Themed section label: `rgba(var(--agent-coral-rgb), 0.65)` + 11px/600/uppercase/tracking |

No changes to `themes.css` required — all required brand tokens already exist across all 6 themes.

---

## Appendix B — Components requiring `createPortal` addition

| Component | Current portal status | Needed? |
|---|---|---|
| SaveProgressModal | Inline render (no portal) | Yes — add `createPortal` to `document.body` |
| DuplicateAddressModal | Inline render (no portal) | Yes — add `createPortal` to `document.body` |
| FeedbackModal | Rendered inside `FeedbackButton` tree | Yes — add `createPortal` |
| SurveyNrConfirmModal | Has `createPortal` (stays in MilestoneRow for now) | Moves to standalone with portal on extract |
| UndoMilestoneModal | Has `createPortal` | Moves to standalone with portal on extract |
| MortgageModal | Has `createPortal` | Moves to standalone with portal on extract |

---

## Appendix C — Design decisions deferred to chain feature pass

The following were noted in the audit but are deliberately out of scope for this pass:

- ChainDrawer node card layout and chain position visualisation
- Multi-property chain progress display
- Invited/pending/claimed state badges on node cards
- ChainDrawer deep-link to invite management

These will be addressed in the upcoming chain feature pass. The Phase 6 ChainDrawer work above covers only: accent line, ConfirmRow, close button, skeleton loading, empty-chain copy, Escape handler, and animation.
