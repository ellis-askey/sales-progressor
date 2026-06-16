# Hover States — Sales Progressor

The single rule: **every interactive element has hover + focus + active + disabled states, defined in CSS, not JS.**

**Read this before:** building any button, link, row, card, icon, or interactive element.

The agent app's CSS already defines 69+ canonical hover/focus/active rules across [`agent-system.css`](../../app/agent/styles/agent-system.css) lines 276–2092. New components pick a pattern from below, never invent.

---

## The five canonical patterns

### 1. Primary button — brightness shift + lift

```css
.agent-btn-primary:hover:not(:disabled) {
  filter: brightness(1.06);
  box-shadow: 0 6px 20px rgba(var(--agent-coral-rgb), 0.38);
  transform: translateY(-1px);
}
.agent-btn-primary:active:not(:disabled) {
  transform: scale(0.98);
}
```

[`agent-system.css:296–313`](../../app/agent/styles/agent-system.css). Apply to any solid-fill primary CTA.

### 2. Row hover — tint wash

```css
.agent-hover-row { transition: background-color 150ms ease; }
.agent-hover-row:hover { background-color: var(--agent-hover-tint); }
```

[`agent-system.css:1299–1300`](../../app/agent/styles/agent-system.css). Apply to list rows, table rows, hub action cards. For warning-coded rows: `.agent-hover-row-warning` ([L1316–1317](../../app/agent/styles/agent-system.css)).

### 3. Link — underline + colour shift

```css
.agent-link {
  color: var(--agent-coral-deep);
  text-decoration: underline;
  text-decoration-color: transparent;
  transition: text-decoration-color 150ms ease, color 150ms ease;
}
.agent-link:hover:not(:disabled) {
  text-decoration-color: currentColor;
}
.agent-link:focus-visible {
  outline: none;
  box-shadow: var(--agent-focus-ring-tight);
}
```

[`agent-system.css:524–561`](../../app/agent/styles/agent-system.css). Apply to inline text links. Variants: `.agent-link-muted`, `.agent-link-primary`.

### 4. Glass card — lifted shadow on hover

```css
.glass-card:hover {
  /* uses --agent-glass-shadow-lifted */
  box-shadow: var(--agent-glass-shadow-lifted);
}
```

For cards that act as buttons (clickable hub cards, navigable list cards), add `.agent-hover-row` for the tint wash on top of the lifted shadow.

### 5. Icon button (close, dismiss, expand) — background tint

```css
.agent-icon-btn:hover:not(:disabled) {
  background: var(--agent-hover-tint);
  color: var(--agent-text-secondary);
}
.agent-icon-btn:focus-visible {
  outline: none;
  box-shadow: var(--agent-focus-ring);
}
.agent-icon-btn:active:not(:disabled) {
  transform: scale(0.88);
  background: var(--agent-hover-tint-strong);
}
.agent-icon-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
```

[`agent-system.css:1473–1506`](../../app/agent/styles/agent-system.css). Apply to modal close buttons, dismiss icons, expand/collapse chevrons. Sizes: `.agent-icon-btn-sm` (22px), `.agent-icon-btn-md` (28px).

---

## Rules

1. **Every interactive element has all four states.** Hover, focus, active, disabled. If your component is missing one, it isn't done — see [DEFINITION_OF_DONE.md](../DEFINITION_OF_DONE.md).
2. **Hover state in CSS, never in JS.** No `onMouseEnter` / `onMouseLeave` handlers for visual hover. Use the canonical class.
3. **Focus is keyboard-accessible.** Use `:focus-visible` so mouse clicks don't trigger the focus ring, but Tab key does.
4. **Disabled is the same shape, not removed.** Use `opacity: 0.35` or `:disabled` rules, never `display: none`. Users need to see the element exists but is unavailable.
5. **Reduced motion stripped globally.** [`agent-system.css:1670–1700`](../../app/agent/styles/agent-system.css) removes `transform` and shadow transitions under `prefers-reduced-motion: reduce`. Don't add per-component overrides.
6. **Tokens, not values.** Hover colour comes from `--agent-hover-tint` / `--agent-hover-tint-strong` / `--agent-hover-tint-warning`. Never inline-tint with a hex code.

---

## Banned

- **Inline `onMouseEnter` / `onMouseLeave` for hover styling.** Used in [`SurveyNrConfirmModal.tsx:67–68`](../../components/milestones/SurveyNrConfirmModal.tsx) (grandfathered — do not refactor). New work must use a CSS class.
- **`onFocus` / `onBlur` for visual focus ring.** Use `:focus-visible` + `--agent-focus-ring`.
- **`hover:bg-...`-style Tailwind utilities** when a canonical class exists. The agent system's coral tints don't sit in Tailwind's palette; rolling your own breaks theme adaptivity.

---

## Choosing a pattern

| Element type | Pattern |
|---|---|
| Primary CTA (solid fill) | 1. Primary button brightness + lift |
| Secondary CTA, ghost button | 5. Icon button (or `agent-btn-secondary` which extends the same shape) |
| List row, table row, hub action card | 2. Row hover (tint) |
| Inline text link | 3. Link underline + colour shift |
| Hub card / navigable card | 4. Glass card lifted shadow + 2. Row hover combo |
| Close / dismiss icon | 5. Icon button background tint |

If none fits, add the new pattern to [`agent-system.css`](../../app/agent/styles/agent-system.css) and append a row to this doc.

---

## Known outliers (grandfathered)

| Outlier | Where | Note |
|---|---|---|
| Inline `onMouseEnter` / `onMouseLeave` | [`SurveyNrConfirmModal.tsx:67–68`](../../components/milestones/SurveyNrConfirmModal.tsx) | Grandfathered. Phase 2 candidate: replace with `.agent-hover-row`. |
| Raw `hover:bg-neutral-700` Tailwind utility | [`AcknowledgeButton.tsx`](../../components/agent/AcknowledgeButton.tsx) | Not the `agent-btn` system. Grandfathered. |
| Inline `style={{ background, border }}` mixed with `agent-btn` | [`AgentFlagButton.tsx`](../../components/agent/AgentFlagButton.tsx) | Hybrid. Grandfathered. |
