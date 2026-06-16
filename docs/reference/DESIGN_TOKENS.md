# Design Tokens — Sales Progressor

The full inventory of every visual token in use across the agent app. Every value lives at a CSS source-of-truth file; this doc is the human-readable index, and [`design/tokens.ts`](../../design/tokens.ts) is the machine-readable mirror.

**Read this before:** any visual decision, any new component, any modal/drawer, any time you need a colour / spacing / radius / shadow / motion / z-index value.

---

## Where tokens live (canonical sources)

| Token group | Lives at |
|---|---|
| Glass surfaces (cards, panels, sidebar) | [app/globals.css](../../app/globals.css) `:root` |
| Agent app theme tokens (`--agent-*`) | [app/agent/styles/themes.css](../../app/agent/styles/themes.css) per `[data-theme="…"]` |
| Keyframes + canonical utility classes | [app/agent/styles/agent-system.css](../../app/agent/styles/agent-system.css) |
| Read-only mirror (TypeScript) | [design/tokens.ts](../../design/tokens.ts) |
| Modal/drawer-specific tokens | [docs/reference/MODAL_DRAWER_SYSTEM.md](MODAL_DRAWER_SYSTEM.md) §7 |

Components reference CSS variables (`var(--agent-coral-deep)`), **never** import `design/tokens.ts`. Tokens.ts exists for discovery and to keep the agent app's token shape grep-equivalent to Cadence's. See [DEFINITION_OF_DONE.md](../DEFINITION_OF_DONE.md) for the lockstep rule.

---

## Colour

### Backgrounds (sunset theme, default)

| Token | Value | Lives at |
|---|---|---|
| `--agent-bg-base` | `#FFF5EC` | themes.css L109 |
| `--agent-bg-mid` | `#FFE8D4` | themes.css L110 |
| `--agent-bg-warm` | `#FFDABD` | themes.css L111 |
| `--agent-bg-deep` | `#FFCBA4` | themes.css L112 |
| `--agent-bg-paper` | `#FFFBF5` | themes.css L113 |
| `--agent-surface-elevated` | `#FFFFFF` | themes.css L248 |

### Brand (coral family)

| Token | Value | Use |
|---|---|---|
| `--agent-coral` | `#FF8A65` | base — bloom decorations, eyebrow accents |
| `--agent-coral-deep` | `#FF6B4A` | primary CTA gradient stop, accent line (modal/drawer top border) |
| `--agent-coral-darker` | `#E55B3D` | hover variant, deep emphasis |
| `--agent-coral-light` | `#FFB18F` | secondary CTA gradient stop |
| `--agent-coral-pale` | `#FFD4C2` | pill backgrounds, soft fills |
| `--agent-coral-bg-tint` | `rgba(255, 138, 101, 0.08)` | hub card background tint |
| `--agent-coral-bg-tint-hover` | `rgba(255, 138, 101, 0.14)` | hub card hover tint |

### Text

| Token | Value | Use |
|---|---|---|
| `--agent-text-primary` | `#2D1810` | body, headlines |
| `--agent-text-secondary` | `#5A3A28` | supporting copy |
| `--agent-text-tertiary` | `#7A4A2E` | metadata, captions |
| `--agent-text-muted` | `rgba(45, 24, 16, 0.55)` | placeholders, hint copy |
| `--agent-text-disabled` | `rgba(45, 24, 16, 0.35)` | disabled |
| `--agent-text-on-coral` | `#FFFFFF` | text over coral buttons |
| `--agent-text-on-dark` | `#FFFBF5` | text over dark glass panels |

### Semantic (status)

| Status | `--agent-*` | `--agent-*-bg` | `--agent-*-border` |
|---|---|---|---|
| success | `#1F8A4A` | `rgba(31,138,74,0.14)` | `rgba(31,138,74,0.38)` |
| warning | `#C97D1A` | `rgba(201,125,26,0.14)` | `rgba(201,125,26,0.38)` |
| danger | `#C73E3E` | `rgba(199,62,62,0.12)` | `rgba(199,62,62,0.38)` |
| info | `#3D7AB8` | `rgba(61,122,184,0.08)` | `rgba(61,122,184,0.30)` |
| snoozed | `#7E22CE` | `rgba(126,34,206,0.08)` | `rgba(126,34,206,0.30)` |

### Side accents (categorical, theme-locked)

| Token | Value | Use |
|---|---|---|
| `--agent-vendor-accent` | `#4F46E5` | vendor-side milestone labels, party indicator |
| `--agent-purchaser-accent` | `#BE185D` | purchaser-side milestone labels, party indicator |

### Dark-surface labels (over photo backdrop)

From [app/globals.css](../../app/globals.css) `:root` lines 49–52. Use **only** on `glass-panel-dark` surfaces; never on light glass-card surfaces.

| Token | Value |
|---|---|
| `--color-label-primary-on-dark` | `rgba(255, 255, 255, 0.92)` |
| `--color-label-secondary-on-dark` | `rgba(255, 255, 255, 0.60)` |
| `--color-label-tertiary-on-dark` | `rgba(255, 255, 255, 0.38)` |
| `--color-label-quaternary-on-dark` | `rgba(255, 255, 255, 0.22)` |

---

## Glass surfaces

From [app/globals.css](../../app/globals.css) `:root` lines 16–39. Used by `.glass-card`, `.glass-panel`, `.glass-sidebar`, `.glass-card-strong`, `.glass-subtle`.

| Token | Value |
|---|---|
| `--glass-fill` | `linear-gradient(180deg, rgb(255 255 255 / 0.56) 0%, rgb(255 255 255 / 0.44) 100%)` |
| `--glass-fill-strong` | `linear-gradient(180deg, rgb(255 255 255 / 0.68) 0%, rgb(255 255 255 / 0.56) 100%)` |
| `--glass-border` | `rgb(255 255 255 / 0.35)` |
| `--glass-border-strong` | `rgb(255 255 255 / 0.50)` |
| `--glass-border-gradient` | `linear-gradient(135deg, rgba(255,255,255,0.50) 0%, rgba(255,255,255,0.15) 50%, rgba(200,220,255,0.30) 100%)` |
| `--glass-highlight` | `inset 2px 2px 12px rgba(255,255,255,0.35), inset -1px -1px 3px rgba(0,0,0,0.04)` |
| `--glass-shadow-sm` | `0 1px 2px rgb(0 0 0 / 0.04), 0 4px 12px rgb(0 0 0 / 0.06)` |
| `--glass-shadow-md` | `0 2px 4px rgb(0 0 0 / 0.04), 0 8px 24px rgb(0 0 0 / 0.08), 0 16px 48px rgb(0 0 0 / 0.06)` |
| `--glass-shadow-lg` | `0 4px 8px rgb(0 0 0 / 0.04), 0 16px 40px rgb(0 0 0 / 0.10), 0 32px 80px rgb(0 0 0 / 0.08)` |
| `--glass-blur` | `40px` |
| `--glass-blur-strong` | `40px` |
| `--glass-saturate` | `200%` |
| `--glass-radius-sm` | `12px` |
| `--glass-radius-md` | `16px` |
| `--glass-radius-lg` | `20px` |
| `--glass-radius-xl` | `28px` |

### Card-system canonicalisation (locked)

`glass-card` is canonical for new card work. `agent-glass` / `agent-glass-strong` / `agent-glass-subtle` / `agent-glass-light` are legacy: allowed where already used, **not for new work**. See [COMPONENT_LIBRARY.md](COMPONENT_LIBRARY.md#cards) for the inventory.

---

## Borders & focus

From [themes.css](../../app/agent/styles/themes.css) lines 181–188.

| Token | Value | Use |
|---|---|---|
| `--agent-border-subtle` | `rgba(45, 24, 16, 0.06)` | inactive separators |
| `--agent-border-default` | `rgba(45, 24, 16, 0.10)` | card borders, list dividers |
| `--agent-border-strong` | `rgba(45, 24, 16, 0.18)` | input idle borders |
| `--agent-border-focus` | `rgba(255, 138, 101, 0.45)` | input focus borders |
| `--agent-focus-ring` | `0 0 0 1.5px rgba(255,138,101,0.50), 0 0 12px 2px rgba(255,138,101,0.18)` | keyboard focus on buttons / interactive |
| `--agent-focus-ring-tight` | `0 0 0 1px rgba(255,138,101,0.60), 0 0 8px 1px rgba(255,138,101,0.22)` | dense controls (icon buttons, segment pills) |

---

## Radius

| Token | Value | Use |
|---|---|---|
| `--agent-radius-sm` | `6px` | chips, micro elements |
| `--agent-radius-md` | `8px` | buttons, inputs, close button |
| `--agent-radius-lg` | `12px` | cards, banners |
| `--agent-radius-xl` | `16px` | modal/drawer surfaces |
| `--agent-radius-pill` | `999px` | pills, status badges |

Glass-system radii (separate, larger family): `--glass-radius-sm` 12px → `--glass-radius-xl` 28px. Used by glass-card and glass-panel.

---

## Spacing (4pt base)

From [themes.css](../../app/agent/styles/themes.css) lines 197–206. Theme-agnostic.

| Token | Value |
|---|---|
| `--agent-space-1` | `4px` |
| `--agent-space-2` | `8px` |
| `--agent-space-3` | `12px` |
| `--agent-space-4` | `16px` |
| `--agent-space-5` | `20px` |
| `--agent-space-6` | `24px` |
| `--agent-space-8` | `32px` |
| `--agent-space-10` | `40px` |
| `--agent-space-12` | `48px` |

Component-specific spacing (e.g. modal `px-6 py-5`) is documented in [MODAL_DRAWER_SYSTEM.md](MODAL_DRAWER_SYSTEM.md) §1.3–1.5, not here.

---

## Shadow

| Token | Use |
|---|---|
| `--agent-glass-shadow` | resting glass card |
| `--agent-glass-shadow-lifted` | hovered / raised glass card |
| `--shadow-sidebar` | AppShell + AgentShell sidebar (declared in globals.css `:root`) |

Glass card shadows compose via `--glass-shadow-sm/md/lg` (see table above) inside the `@layer components` block in `globals.css`.

---

## Motion (durations + easings)

From [themes.css](../../app/agent/styles/themes.css) lines 208–212 and [agent-system.css](../../app/agent/styles/agent-system.css) keyframes.

| Token / class | Duration | Easing | Use |
|---|---|---|---|
| `--agent-transition-fast` | 150ms | `--agent-ease` | hover, focus, border changes |
| `--agent-transition-base` | 200ms | `--agent-ease` | most state transitions |
| `--agent-transition-slow` | 300ms | `--agent-ease` | content layout shifts |
| `--agent-ease` | — | `cubic-bezier(0.4, 0, 0.2, 1)` | default easing |
| `agent-modal-in` (locked) | **280ms** | `cubic-bezier(0.34, 1.56, 0.64, 1)` | modal entrance — spring overshoot |
| `agent-drawer-in` (locked) | **280ms** | `cubic-bezier(0.34, 1.56, 0.64, 1)` | drawer entrance — spring overshoot |
| `agent-backdrop-in` | 200ms | `ease` | modal/drawer backdrop fade |
| `agent-reveal-in` | 150ms | `ease-out` | content reveal / exit |
| `agent-dropdown-in` | 120ms | `ease-out` | dropdowns / popovers |
| `agent-row-flash` | 700ms | `ease-out` | row success wash |
| `ms-unlock-enter` | 900ms | `ease-out` | milestone unlock wash |

**Modal timing canonical:** 280ms cubic-bezier(0.34, 1.56, 0.64, 1), per the locked spec in [MODAL_DRAWER_SYSTEM.md](MODAL_DRAWER_SYSTEM.md) §6.

**Known outlier:** [agent-system.css](../../app/agent/styles/agent-system.css) currently ships `agent-modal-in` at 240ms `cubic-bezier(0.25,0,0,1)`. This is the as-built reality the spec aims to close. Listed for Phase 2 migration — grandfathered for now, do not refactor as a side effect.

For the full motion catalogue (named choreographies, two-step exit pattern, reduced-motion fallback), see [MOTION_GUIDE.md](MOTION_GUIDE.md).

---

## Z-index — modal escalation rule (locked)

Precedent: commit `5a7cfa0` (2026-06-05), which raised AddBrokerModal from 50 to 2000 so it could sit above the relist modal.

| Tier | Value | Use when… |
|---|---|---|
| Default | **50** | A modal opens over the standard page surface. Most modals (SurveyNrConfirmModal, MortgageModal, UndoMilestoneModal, WelcomeModal). |
| Raised | **1500** | A modal must sit above a page-level overlay (drawer backdrop, sticky bottom bar). Examples: SwitchServiceTypeModal, StatusControl inline modals. |
| Deep | **2000** | A modal opens **on top of another modal** (precedent: AddBrokerModal / AddFirmModal opened from a drawer that already has a modal in front of it). |

Never invent a fourth tier. If a stack needs more than two modals deep, that's a UX problem, not a z-index problem.

### Z-index tokens vs operational values

[themes.css](../../app/agent/styles/themes.css) lines 239–245 separately declares theme-agnostic tokens:

- `--agent-z-base: 0`
- `--agent-z-elevated: 10`
- `--agent-z-overlay: 100`
- `--agent-z-modal: 1000`
- `--agent-z-dropdown: 1500`
- `--agent-z-toast: 2000`

These tokens are not currently consumed by modal code (modals use the literal 50 / 1500 / 2000 above). The escalation rule above is operational; `--agent-z-modal: 1000` is unused. Phase 2 may align the tokens to the rule — flagged for review, not for this session.

One-off: ExchangeCelebration uses `z-[200]` (full-screen overlay, distinct from the modal stack).

---

## Type scale

From [themes.css](../../app/agent/styles/themes.css) lines 214–237. Theme-agnostic.

| Token | Value | Use |
|---|---|---|
| `--agent-text-display` | 32px | hero numbers, greeting |
| `--agent-text-h1` | 28px | screen titles |
| `--agent-text-h2` | 22px | section headers |
| `--agent-text-h3` | 17px | card titles, modal titles |
| `--agent-text-h4` | 15px | sub-card titles |
| `--agent-text-body` | 14px | body copy (desktop) |
| `--agent-text-body-sm` | 13px | secondary copy |
| `--agent-text-caption` | 12px | metadata |
| `--agent-text-micro` | 11px | dense labels |
| `--agent-text-eyebrow` | 10px | UPPERCASE letter-spaced eyebrows |

| Weight | Value |
|---|---|
| `--agent-weight-regular` | 400 |
| `--agent-weight-medium` | 500 |
| `--agent-weight-semibold` | 600 |

| Tracking | Value | Use |
|---|---|---|
| `--agent-tracking-tight` | `-0.01em` | display, h1 |
| `--agent-tracking-normal` | `0em` | body |
| `--agent-tracking-wide` | `0.02em` | small caps, microcopy |
| `--agent-tracking-eyebrow` | `0.05em` | UPPERCASE eyebrows |

Mobile floor: inputs sit at 16px on `< 768px` (iOS Safari zoom prevention — see [globals.css](../../app/globals.css) lines 184–196).

---

## Hover / interactive tints

From [themes.css](../../app/agent/styles/themes.css) lines 262–264.

| Token | Value | Use |
|---|---|---|
| `--agent-hover-tint` | `rgba(255, 138, 101, 0.10)` | standard row / list hover wash |
| `--agent-hover-tint-strong` | `rgba(255, 138, 101, 0.18)` | dense / selected row hover |
| `--agent-hover-tint-warning` | `rgba(254, 215, 170, 0.55)` | warning-coded row hover |

Full hover/focus/active patterns documented in [HOVER_STATES.md](HOVER_STATES.md).

---

## RGB channel tokens

For `rgba(var(--x), alpha)` composition. From [themes.css](../../app/agent/styles/themes.css) lines 250–259.

`--agent-coral-rgb` `255,107,74`, `--agent-coral-base-rgb` `255,138,101`, `--agent-success-rgb` `31,138,74`, `--agent-danger-rgb` `199,62,62`, `--agent-warning-rgb` `201,125,26`, `--agent-info-rgb` `61,122,184`, `--agent-bg-base-rgb` `255,245,236`, `--agent-bloom-gold-rgb` `255,220,100`, `--agent-shadow-rgb` `45,24,16`.

---

## Known outliers (grandfathered)

| Outlier | Where | Why grandfathered |
|---|---|---|
| `agent-modal-in` shipped 240ms `cubic-bezier(0.25,0,0,1)` | [agent-system.css](../../app/agent/styles/agent-system.css) | Spec target is 280ms `cubic-bezier(0.34,1.56,0.64,1)`. Phase 2 migration. |
| `--agent-z-modal: 1000` token unused by modal code | [themes.css](../../app/agent/styles/themes.css) L243 | Operational escalation rule uses literal 50 / 1500 / 2000. |
| `nv2-night` + `data-night` theming attribute | StatusControl, SwitchServiceTypeModal | Deprecated in favour of `data-theme`. Grandfathered in those two components. See [MODAL_DRAWER_SYSTEM.md](MODAL_DRAWER_SYSTEM.md) §7. |

**Do not refactor outliers as a side effect of new work.** All existing-code clean-up is deferred to Phase 2 (commissioned separately).
