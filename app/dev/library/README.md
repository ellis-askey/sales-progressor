# TSP component library (isolated · `/dev/library`)

The reusable components that will power the app, built **source-first** and shown in a live showroom at `/dev/library`. **Nothing here is Approved** until founder visual + functional review. This README is local to the route — it is **not** a global instruction and does not make the library mandatory.

## Principles

- **Material doctrine (settled):** the slab lens (`components/liquid/LiquidLens`, the `/dev/glass-optics` reference) for in-flow content / hero / larger chrome; a **frosted** non-displacement surface for small **portalled** overlays (menus, selects, calendars) where a displacement lens smears. Coral (`--lg-accent`) is the only accent; one tinted primary per surface. Light + dark both first-class.
- **Motion:** `components/liquid/lib/spring.ts`.
- **Atmosphere:** the Updates `AppBackground` + a coral/cool wash.
- **Accessibility:** installed Radix primitives supply behaviour (switch, slider, radio-group, dialog, focus-scope, dismissable-layer, roving-focus, portal); everything else is keyboard-accessible by hand.

## Sourcing rule (how each component was built)

A → reuse a proven TSP implementation · B → adapt a real source component (theatom liquid-glass / motion-primitives / animate-ui / cult-ui), preserving its interaction · C → custom, with a documented reason. Each component's source + licence + adaptations live in `registry.ts` and are shown in the showroom.

## Compatibility notes

- Stack: Next 16.2.4 · React 18 · Tailwind 3.4.19.
- **theatom `@zakisheriff/liquid-glass`** (MIT, no framer/Tailwind) — used as the **interaction** reference; rendered on our lens, not theatom's material (avoids a competing optical system).
- **motion-primitives / animate-ui** need **`framer-motion`** (not installed) + target Tailwind v4 — required for dock / carousel / accordion / morphing-popover / animated-tabs. **Awaiting approval to add `framer-motion` (MIT).**
- **cult-ui** needs `@base-ui/react` + shadcn — highest integration risk; ideas cherry-picked, not dropped in.
- Not installed: framer-motion, clsx/tailwind-merge/cva, cmdk, radix tooltip/popover/dropdown/tabs/toast/select/checkbox, Base UI.

## Phase 0 — foundations (reference interactions)

Three shared primitives + a test environment, all isolated here, **nothing Approved**:

- **`foundation.tsx` → `Surface`** — the deliberate material system: `solid` (static controls / dense content), `frost` (small portalled overlays, chrome over content), `lens` (floating + moving controls, genuine displacement). Under **reduced transparency** `frost`/`lens` collapse to `solid`.
- **`foundation.tsx` → `TravellingSelection`** — one continuous frosted-glass pill that **slides AND resizes** between options on `spring.ts` (left+width on one spring → reads as a single physical object). Powers **Segmented**, **Tabs**, and the **FloatingDock** active state — one selection language. Roving arrow-key / Home / End; reduced-motion jumps; reduced-transparency → opaque; increased-contrast → stronger edge.
- **`foundation.tsx` → `SliderThumb`** — genuine **solid → refractive → solid** material transition: the displacement `scale` (built once from `refraction-map.ts`) ramps 0→full on the drag spring while a solid cap recedes; velocity stretches the capsule. Not a crossfade of two static looks.
- **`bench.tsx` → `MaterialBench`** — the test environment: switchable backdrops (text / grid / photo / colour bands / gradient), light/dark (page theme), **real** reduced-motion / reduced-transparency / increased-contrast toggles (they feed `EnvCtx`), density, and a frame-rate meter. The place to judge refraction, legibility and performance.

**FloatingDock** also gained macOS-dock craft: spring hover-magnify with neighbour falloff, press scale-down, keyboard roving focus, and the travelling active pill.

## Categories — all five built

1. **Controls** — `controls.tsx`: Button/IconButton, Switch, Checkbox, RadioGroup, Slider (slab-lens capsule thumb), Segmented, Input/Textarea/Search/Field, Select, DatePicker, Stepper, Toggle.
2. **Navigation** — `navigation.tsx`: Tabs, NavRail, Sidebar, Toolbar, FloatingDock (slab lens), Breadcrumb, Pagination, CommandPalette (⌘K).
3. **Overlays** — `overlays.tsx`: DropdownMenu, ContextMenu, Popover, Tooltip, Dialog, ConfirmDialog, Drawer, Sheet, Toast (+ `useToast`), Notification. Frosted portalled surfaces.
4. **Data & content** — `data.tsx`: List, Table (sortable + expandable), Filters, Carousel, Charts (Sparkline/BarMini/ProgressRing), Progress (bar/steps/ring), Timeline, Skeleton, EmptyState.
5. **TSP patterns** — `tsp.tsx`: PropertyRow, PropertySummary, Milestones, TransactionProgress, ChainView, EnquiryItem, Reminder, DiaryEvent, ActivityUpdate, PersonDisplay, ContextualActions.

**Material applied by function/size:** the **slab lens** on floating/moving controls (Slider thumb, FloatingDock); the **frosted** surface on small portalled overlays (menus, select, calendar, dialogs); **token fills** on static in-flow controls. Not every surface refracts — static form fields don't.

## For future page builders (guidance — not yet binding)

When building a page, **select from the registry by function and context** rather than inventing a control or copying a familiar layout. Each registry entry records *when to use it*. The import paths (`app/dev/library/controls.tsx → …`) are the reusable source; on approval these promote to a shared location and this guidance becomes a project rule.
