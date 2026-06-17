# Motion Guide — Sales Progressor

One motion language across the agent app. Every animation comes from a named class defined in [`app/agent/styles/agent-system.css`](../../app/agent/styles/agent-system.css). No page or component invents its own keyframes.

**Read this before:** adding any animation, transition, or motion choreography.

This guide reconciles three previously-scattered sources:
- [docs/ANIMATION_STANDARDS.md](../ANIMATION_STANDARDS.md) — rows, reveals, dropdowns, milestones
- [docs/reference/MODAL_DRAWER_SYSTEM.md](MODAL_DRAWER_SYSTEM.md) §6 — modal + drawer entrance
- agent-system.css keyframes — the as-built reality

---

## The two named choreographies (locked)

### Modal / drawer entrance

| Property | Value |
|---|---|
| **Duration** | **280ms** |
| **Easing** | `cubic-bezier(0.34, 1.56, 0.64, 1)` — spring overshoot |
| **Backdrop** | `agent-backdrop-in` 200ms `ease` (faster, appears first) |
| **Classes** | `agent-modal-in` on modal card, `agent-drawer-in` on drawer panel |

Spring overshoot is intentional. Modals and drawers should land with a confident "settle", not a flat fade-in.

**Known outlier:** [`agent-system.css`](../../app/agent/styles/agent-system.css) currently ships `agent-modal-in` at **240ms `cubic-bezier(0.25,0,0,1)`**. This is the as-built reality; the spec target is 280ms with the spring curve. Phase 2 migration — grandfathered for now.

### Element entrance / exit / dropdown / row events

Calm, fast, no overshoot. Used for everything that's not a modal/drawer.

| Class | Duration | Easing | Use when |
|---|---|---|---|
| `agent-reveal-in` | 150ms | ease-out | element mounts in response to a user action |
| `agent-reveal-out` | 150ms | ease-in | element about to unmount |
| `agent-dropdown-in` | 120ms | ease-out | dropdown / popover opens (translateY -4px → 0) |
| `agent-row-exit` | 150ms | ease-in | list row deletion (fades + collapses height before DOM removal) |
| `agent-row-flash` | 700ms | ease-out | row success wash (green tint) |
| `ms-unlock-enter` | 900ms | ease-out | milestone unlock (higher-stakes confirmation) |
| `ms-pop` | 360ms | `cubic-bezier(.16,1,.3,1)` | milestone dot/checkbox completion bounce |
| `ms-appear` | 220ms | ease | action button slides in after milestone availability |
| `ms-bar-shimmer` | 1.8s linear infinite | — | progress bar shimmer (loading state) |

---

## Two-step exit pattern

For any element whose unmount is animated. Match the JS timer to the CSS duration **exactly**.

```tsx
// 1. Apply the class
setExiting(true);

// 2. After the animation completes, unmount
setTimeout(() => { setExiting(false); setVisible(false); }, 150);
```

`forwards` fill-mode keeps the element at opacity 0 / max-height 0 until React removes it from the DOM. `pointer-events: none` prevents double-click during the exit animation.

For row deletion specifically:

```tsx
setExitingId(id);
setTimeout(() => {
  startTransition(async () => {
    await deleteAction(id);   // server action, revalidates list
    setExitingId(null);
  });
}, 150);
```

---

## Re-trigger pattern (same element, fire again)

To re-run an entrance animation on the same DOM node:

```tsx
setFlashing(true);
setTimeout(() => setFlashing(false), 700);
// Next trigger: setFlashing(true) again — React re-runs animation on new mount
```

Or change the element's `key` prop to force a remount.

---

## Transitions vs keyframes — which to use

| Use a CSS transition for… | Use a keyframe animation for… |
|---|---|
| Hover, focus, border-colour changes | Entrance (modal-in, reveal-in) |
| Background shifts on `:hover` | Exit (modal-out, reveal-out, row-exit) |
| State swaps (active / inactive) | Multi-step bounces (ms-pop) |
| | Looping shimmers (ms-bar-shimmer) |

Transition tokens (from [themes.css](../../app/agent/styles/themes.css)):
- `--agent-transition-fast` — 150ms (hover, focus, border)
- `--agent-transition-base` — 200ms (most state transitions)
- `--agent-transition-slow` — 300ms (layout shifts)
- `--agent-ease` — `cubic-bezier(0.4, 0, 0.2, 1)`

---

## Reduced motion

All canonical classes above have `@media (prefers-reduced-motion: reduce)` overrides in [`agent-system.css`](../../app/agent/styles/agent-system.css) (around lines 1670–1700). Animations are removed or made instant.

**Do not add `prefers-reduced-motion` guards inline in components.** The CSS layer handles it globally. If you find yourself wanting to, the canonical class doesn't exist yet — add it to agent-system.css first.

---

## Rules

1. **Define here before using.** No inline `@keyframes` in components or `<style>` tags.
2. **One motion language.** Modals/drawers always use 280ms spring overshoot (or the 240ms grandfathered variant). Reveals always use 150ms ease. Dropdowns always use 120ms ease-out. List rows always use 150ms / 700ms / 900ms as appropriate.
3. **150ms exit budget.** All exit animations are 150ms. JS timers gating DOM removal must match exactly.
4. **`forwards` fill-mode on exits.** Keeps the element in its final state while React queues the unmount.
5. **No animation on stable/idle UI.** Animations respond to user actions, not to page load (except where noted — `ms-bar-shimmer` is the explicit exception for loading states).
6. **Respect reduced-motion globally, not per-component.**

---

## Adding a new motion

1. Confirm none of the existing classes fit. If `agent-reveal-in` is close but the duration is wrong, **change the duration** in agent-system.css rather than inventing a new class.
2. Add the keyframe block to [`agent-system.css`](../../app/agent/styles/agent-system.css) under "Keyframes" with the `agent-` prefix.
3. Add the class with the canonical duration + easing in the matching section of agent-system.css.
4. Add a row to the table above with `lives at:` pointer.
5. Add `@media (prefers-reduced-motion: reduce)` override.
6. Update [`design/tokens.ts`](../../design/tokens.ts) `motion` object if you added a new canonical duration.

---

## What's intentionally out of scope

Framer Motion variants. Sales Progressor's animation surface is CSS-driven; Framer is not in the stack. (Cadence uses Framer because it's a PWA with native-feeling gestures; SP is a web app with declarative motion.)
