# Liquid Glass — system spec

Tokens, materials, motion, accessibility and responsive rules. Source of truth in
code: [`app/styles/liquid-glass.css`](../../../app/styles/liquid-glass.css) (tokens,
scoped to `.lg-ds`) and [`components/liquid/`](../../../components/liquid/).

## Setup

A Liquid Glass surface wraps content in `<div className="lg-ds" data-theme={"dark"|"light"}>`,
mounts the real `AppBackground`, and sets the page base to `var(--lg-base)`. Tokens
are scoped under `.lg-ds` — they never touch `:root`, so nothing global changes.

## Tokens (names, not hard-codes — always use the var)

**Colour** — `--lg-accent` (#ff6b4a — TSP coral / coralDeep, **not** Apple blue; matches
the code in `liquid-glass.css` and the protected-foundation mandate in [INVENTORY.md](INVENTORY.md)) /
`--lg-accent-ink` (theme-adjusted for text) /
`--lg-accent-soft`; semantics `--lg-ok` `--lg-warn` `--lg-info` `--lg-danger`.
**Ink** — `--lg-ink` / `--lg-ink-2` (64%) / `--lg-ink-3` (40%).
**Lines & fills** — `--lg-line` / `--lg-line-2` / `--lg-fill` / `--lg-field` / `--lg-hover`.
**Base** — `--lg-base` (#0a0e17 dark / #f6f8fc light — the real elevra `--c-bg`).
**Glass tints** (pass to `<LiquidGlass tint>`): `--lg-glass-card` / `--lg-glass-panel` /
`--lg-glass-raised`. These are theme-aware, so one prop works in both modes.

**Radii** `--lg-r-xs…xl` = 8 / 12 / 16 / 20 / 26, plus `--lg-r-pill`. Default roles:
cards 18, controls/inputs 12, chips/buttons-sm 8, avatars/switch full.
**Spacing** `--lg-s1…s8` on a 4px base (4/8/12/16/20/24/32). Comfortable, not cramped.
**Icons** 15–18px inside controls/rows; 18 for nav; weight matches Phosphor regular/fill
used consistently per context.

## The glass material (`<LiquidGlass>`)

> **Material doctrine (reconciliation 2026-11-02; see [INVENTORY.md](INVENTORY.md)).**
> The **slab lens** (`LiquidLens`) is the approved default for in-flow content, hero and
> nav surfaces. The `<LiquidGlass>` engine documented below is the retained **legacy /
> fallback** engine (kept for the non-lens path; see INVENTORY). Small **portalled
> overlays** (menu, popover, tooltip, toast) should use a **frosted, non-displacement**
> surface — a displacement lens smears content behind small floating overlays. That
> frosted overlay surface is **awaiting showroom/founder sign-off — not yet Approved.**

Props: `radius`, `thickness` (rim band px), `displace` (bend strength), `aberration`
(chromatic spread px, 0 = off), `blur`, `tint`. Guidance:

| Surface | radius | thickness | displace | aberration |
|---|---|---|---|---|
| Card (reading) | 18 | 14 | 28–32 | 1 |
| Panel / rail | 18 | 12 | 24–30 | 1–2 |
| Dock / toast / raised | 13–22 | 9–16 | 30–50 | 3–4 |
| Hero / lens / playful | 26+ | 18+ | 60–120 | 6–12 |

Keep `aberration` low on large light-mode surfaces (fringe is more visible there).
Fallback: browsers without `url()` backdrop filters (Safari/Firefox) get a frosted
blur via `.lgx-surface` — still correct.

## Motion

`--lg-spring` (selection, entry, knobs, chips) · `--lg-ease` (surfaces, hover lift).
Durations `--lg-fast` 0.2s / `--lg-mid` 0.35s / `--lg-slow` 0.5s. Entry animations
never block input. All transitions/animations are disabled under
`@media (prefers-reduced-motion: reduce)` (already in the stylesheet).

## Interaction states (every control needs them)

Default · hover (subtle lighten + optional 2px lift) · focus-visible (2px accent
outline, offset) · pressed (scale 0.96) · selected · disabled (0.45 opacity, no
pointer) · loading (spinner) · error (danger border + message). The kit components
implement these — reuse them rather than re-rolling states.

## Accessibility

Keyboard: real `<button>`/inputs, `focus-visible` rings, `role`/`aria-checked` on
switch/checkbox/radio/segmented. Contrast: body text ≥ `--lg-ink-2` on glass; never
rely on `--lg-ink-3` for essential text. Status is dot **plus** label (not colour
alone). Respect reduced-motion. Overlays trap focus and close on backdrop/escape.

## Responsive

Mobile-first; container/media switch at ~900px for rail↔inline, ~620px to drop
secondary metadata. Sheets are centred dialogs on desktop, bottom sheets on mobile.
Sticky/floating controls (dock) must not obscure content — pad the scroll area.
Wide content (tables, code) scrolls inside its own container; the page never scrolls
horizontally.

## Light / dark

Drive `data-theme` on the `.lg-ds` root and sync `<html data-theme>` so the real
`AppBackground` picks the matching backdrop. Glass tints are theme-aware already.
Verify both modes on every change (see WORKFLOW QC checklist).
