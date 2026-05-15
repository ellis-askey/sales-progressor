# Animation Standards — Agent App

All animation in the agent app uses canonical classes defined in `app/agent/styles/agent-system.css`.
No page or component invents its own keyframes. Add a class here first, then use it.

---

## Canonical classes

### Entrance / exit (inline elements)

| Class | Duration | Use when |
|---|---|---|
| `.agent-reveal-in` | 150ms ease-out | Element mounts in response to a user action (form expands, error appears, section unlocks) |
| `.agent-reveal-out` | 150ms ease-in | Element is about to unmount — apply class, wait 150ms, then unmount |
| `.agent-dropdown-in` | 120ms ease-out | Dropdown or popover opens (translateY -4px → 0) |

**Two-step exit pattern** (`agent-reveal-out`):
```tsx
// 1. Apply the class
setCollapsing(true);
// 2. After the animation completes, unmount
setTimeout(() => { setCollapsing(false); setVisible(false); }, 150);
```

---

### Row deletion exit

| Class | Duration | Use when |
|---|---|---|
| `.agent-row-exit` | 150ms ease-in | A list row is being deleted — fades out and collapses height before DOM removal |

**Two-step pattern**:
```tsx
// 1. Mark as exiting — row gets the class, animation plays
setExitingId(id);
// 2. After animation, fire the server action / state removal
setTimeout(() => {
  startTransition(async () => {
    await deleteAction(id);  // revalidates, row disappears from list
    setExitingId(null);
  });
}, 150);
```

`forwards` fill-mode keeps the row at opacity 0 / max-height 0 until React removes it from the DOM.
`pointer-events: none` prevents double-click during the animation.

---

### Confirmation flash

| Class | Duration | Use when |
|---|---|---|
| `.agent-row-flash` | 700ms ease-out | A row action succeeded — brief green wash confirms the change |
| `.ms-unlock-enter` | 900ms ease-out | Milestone row unlocks — longer wash for higher-stakes confirmation |

**Re-trigger pattern** (same element, fire again on second confirm):
```tsx
// Change the element's key to force remount, or toggle state off/on:
setFlashing(true);
setTimeout(() => setFlashing(false), 700);
// Then re-set on next trigger — React re-runs the animation on new mount
```

---

### Milestone node animations

| Class | Duration | Use when |
|---|---|---|
| `.ms-pop` | 360ms cubic-bezier(.16,1,.3,1) | Milestone dot or checkbox bounces on completion (scale 1 → 1.45 → 0.9 → 1) |
| `.ms-appear` | 220ms ease, 120ms delay | Action button slides in after a milestone becomes available |
| `.ms-bar-shimmer` | 1.8s linear infinite | Progress bar shimmer while milestones are loading/pending |

---

### Milestone dot states (static)

```
.ms-dot        — base: 10×10px circle, flex-shrink: 0
.ms-dot-avail  — blue (#3b82f6), border #93c5fd
.ms-dot-done   — green (#10b981), border #6ee7b7
.ms-dot-locked — transparent, border rgba(30,45,74,.2)
.ms-dot-nr     — transparent, dashed border rgba(30,45,74,.3)
```

---

## Reduced-motion

All classes above have `@media (prefers-reduced-motion: reduce)` overrides in `agent-system.css`.
Animations are removed or instant. Do not add `prefers-reduced-motion` guards inline in components.

---

## Rules

1. **Define here before using.** No inline `@keyframes` in components or `<style>` tags.
2. **150ms exit budget.** All exit animations are 150ms. JS timers that gate DOM removal must match exactly.
3. **forwards fill-mode on exits.** Keeps the element in its final state while React queues the unmount.
4. **No animation on stable/idle UI.** Animations respond to user actions, not to page load except where noted.
