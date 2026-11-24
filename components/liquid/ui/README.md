# `components/liquid/ui` — the forward TSP Liquid-Glass UI system

The **canonical, opt-in** production component area for the forward design language. One implementation per component. Productionised from the `/dev/library` prototype, which remains a **lab** (never imported by production — enforced by the `no-restricted-imports` ESLint rule).

## How to use it

```tsx
import { Button, Field, Input, Drawer, Surface, TravellingSelection, GLASS_CSS } from "@/components/liquid/ui";
```

A page composes these. Inject `GLASS_CSS` once at a themed root and wrap content in `.lg-ds[data-theme]`:

```tsx
<div className="lg-ds" data-theme={theme}>
  <style dangerouslySetInnerHTML={{ __html: GLASS_CSS }} />
  …compose components here…
</div>
```

First consumer: [`app/agent/to-do-next`](../../../app/agent/to-do-next).

## The contract

1. **Reconcile, don't reinvent.** Each component uses its `components/ui/*` counterpart as the **functional + accessibility reference** (behaviour, keyboard, ARIA, capabilities) and the Liquid-Glass foundations (`LiquidLens`, `spring`, the `--lg` tokens, `Surface`, `TravellingSelection`) as the **visual/interaction direction**.
2. **One canonical implementation.** Add the component the To-Do page (or the next page) actually needs — not every experimental variant. No disconnected variants.
3. **Materials by purpose** (`Surface`): `solid` for dense/static content, `frost` for small portalled overlays, `lens` for floating/moving hero controls. Not glass-by-default.
4. **Self-contained portals.** Overlays re-establish the `.lg-ds` scope on their own portal root (`Portal`) so they're themed correctly even though they escape any ancestor scope.
5. **Never import from `/dev`.** Depend only on `components/liquid/*`, `lib/*`, and the `--lg` tokens.

## Theming existing production components: `GlassScope`

`<GlassScope>` remaps the agent app's `--agent-*` tokens to Liquid-Glass values **within its subtree**, so a well-tokenised production component inherits the new palette with zero code change. **Caveat:** it does **not** reach React-portalled content (portals escape the subtree). Portalled production modals (e.g. Compose Email, Add Note) need a shared-file change to theme their portal roots — identified separately for approval, not done here.

## Inventory (current)

- **Primitives:** `ThemeCtx`, `EnvCtx`, `useEnv`, `useReducedMotion`, `useSpringTo`, `useEnter`, `Portal`, `useAnchored`, `Lens`, `Frost`, `Atmosphere`, `Surface`, `TravellingSelection`, `cn`.
- **Controls:** `Button`, `IconButton`, `Field`, `Input`, `Textarea`, `Search`, `Select`, `DatePicker`, `Checkbox`, `Segmented`.
- **Overlays:** `Dialog`, `ConfirmDialog`, `Drawer`, `ToastProvider` + `useToast`.
- **Display:** `EmptyState`, `Pill`, `Disclosure`, `PropertyThumb`.
- **Scope:** `GlassScope`.
- **CSS:** `GLASS_CSS`.

Grow this list only by reconciling the next real need, and record it here.
