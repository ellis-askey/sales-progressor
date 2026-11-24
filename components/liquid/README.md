# `components/liquid/` — TSP Liquid Glass kit

The shared implementation of **TSP Liquid Glass**, our forward visual design
language. This is the real library the component showroom renders and that future
**approved** page redesigns import.

> **Status: EXPERIMENTAL / forward-only.** Per the approved Law 14 amendment, this
> directory is **outside the closed production catalogue** (`docs/reference/COMPONENT_LIBRARY_CATALOG.md`)
> and is catalogued instead in [`docs/reference/design-system/INVENTORY.md`](../../docs/reference/design-system/INVENTORY.md).
> **Do not import these into a production route or the root layout until that page
> has been approved for migration.** Today only `/dev/*` routes consume them, so
> nothing that ships changes.

## What's here

| File | What |
|---|---|
| `LiquidGlass.tsx` | The refraction engine (canvas edge-displacement map + 3-pass chromatic aberration on `backdrop-filter`). The glass "material". |
| `components.tsx` | Prop-driven components: buttons, inputs, switch, segmented, chip, slider, checkbox/radio, badge/status, progress, skeleton, tabs, menu, toast, dock, dialog, nav rail. |
| `index.ts` | Public barrel (also re-exports the real `UserAvatar`/`ActorAvatar`). |

Styling tokens + base classes live in **`app/styles/liquid-glass.css`** (scoped to
`.lg-ds`, imported only by dev routes). A consuming page wraps content in
`<div className="lg-ds" data-theme={"dark"|"light"}>` and mounts the real
`AppBackground`.

## Design authority

- **Principles:** [`docs/reference/design-system/PHILOSOPHY.md`](../../docs/reference/design-system/PHILOSOPHY.md)
- **Spec (tokens, motion, a11y, responsive):** [`docs/reference/design-system/SYSTEM.md`](../../docs/reference/design-system/SYSTEM.md)
- **Inventory (approved / experimental / missing):** [`docs/reference/design-system/INVENTORY.md`](../../docs/reference/design-system/INVENTORY.md)
- **Showroom:** `/dev/design-system`

## Rules

1. **Reuse → adapt → create.** Check the approved library first; adapt an existing
   piece next; research Glassy UI / Apple patterns; only then create. New reusable
   pieces go in the **laboratory** first and are promoted on founder review.
2. **Behaviour-preserving.** These components are presentational. Never change an
   existing feature's logic, permissions, workflow or data when restyling a page.
3. **No new dependencies** without explicit approval (Glassy UI is NOT installed —
   it needs React 19 + Tailwind 4; we reimplement its patterns in-house).
4. **Browser support:** full refraction is Chromium/Edge; Safari/Firefox fall back
   to a frosted blur (`.lgx-surface` base) — still correct, just no bend.
