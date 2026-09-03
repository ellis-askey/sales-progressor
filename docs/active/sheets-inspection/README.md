# /dev/sheets — internal UI inspection environment

Rebuilt 2026-09-03. A dev-only QA + design-review surface that mounts every
**real** drawer, modal and in-page notification on the agent/internal side of
the app, with edge-case fixture data, against the **real** app background.

Use it to walk the whole internal UI one overlay/state at a time, polish each,
and mark it verified.

## Where it lives

```
app/dev/sheets/
  layout.tsx              Reproduces the live agent environment: ThemeModeBoot +
                          brandThemeCss + <AppBackground/> (WebGL iridescence /
                          soft aurora) + GlassPicksProvider + AgentToaster.
  page.tsx                Dev-only guard → <SheetsCatalogue/>.
  _components/
    SheetsCatalogue.tsx   Header, counts, search, type/verification filters,
                          progress, grouped sections, cards, theme toggle.
    ComponentCard.tsx     One dense inspection card.
    InspectHost.tsx       Mounts a component in its selected state + a floating
                          inspector bar (live state selector, verified toggle).
    FixtureUI.tsx         Faux page chrome for inline notice previews.
  _lib/
    useVerification.ts    localStorage-backed verified marks (scoped to /sheets).
  _registry/
    types.ts              SheetEntry contract.
    fixtures.ts           Shared edge-case fixtures (long addresses/names/etc).
    drawers.tsx           Drawer entries.
    modals.tsx            Modal / dialog entries.
    notifications.tsx     Notification / banner / callout / empty-state entries.
    index.ts              Assembles the registry.
```

## Adding a new overlay to the harness

Add one `SheetEntry` to the matching `_registry/*.tsx` file. Never touch the
page shell. Give it a **stable, unique `id`** (verification is keyed on it —
changing an id silently resets that component's verified flag). Wire every
action handler (`onConfirm`, `onSend`, `onSave`, `onClose`, …) to `ctx.onClose`
or `noop` so nothing mutates real data, and use `demo-*` ids.

- `preview: "overlay"` — drawers/modals portal themselves; judged over the live
  page background.
- `preview: "inline"` — notices/banners/empty-states dropped into a faux page
  column (`FixturePage`) so they're seen in realistic context.

## Safety

Dev-only (blocked in production via `NODE_ENV`). Handlers are wired to
close/no-op and all ids are `demo-*`, so component actions can't reach a real
record. Some components fetch on mount or fire mount-effect server actions with
no backend — they render their loading/error state, which is a valid thing to
inspect.

## Scope note

Command Centre components (`/command/*`) are intentionally excluded — they use a
distinct dark visual system (Law 9) and would misrender against the agent glass
background. A separate command-dark variant can be added later if wanted.
