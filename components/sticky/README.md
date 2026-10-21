# components/sticky

Freeform draggable "post-it" notes on a property file. **Internal-only** scratchpad (anyone who can open the file); never client-facing.

- **StickyNote.tsx** — one note: drag by the top strip, resize from the corner, recolour via the dot, collapse, and remove. Presentational + interactive; reports every change up via `onChange`. Shared by the real feature and the `/dev/sticky-notes` sandbox.
- **StickyLayer.tsx** — the floating layer on the file. Loads the notes, does optimistic + debounced (coalesced) auto-save, delete-with-undo, and spawns a note when the hero button dispatches a `sticky-add` event for the file. Rendered `position: absolute` inside the file's relative content host so notes scroll with the file and stay in the content column.
- **StickyAddButton.tsx** — the hero trigger (a post-it icon beside the Settings pill); dispatches the `sticky-add` event.
- **sticky.css** — shared note / layer / button styles.

Why this is domain-specific and not a `components/ui` primitive: it's a bespoke, stateful board bound to the file and the `StickyNote` DB model, not a reusable UI atom.
