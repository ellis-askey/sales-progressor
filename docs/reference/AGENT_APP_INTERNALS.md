# Agent App Internals — how the recurring machinery actually works

**Read this before working on the agent app (`/agent/*`).** It captures the
non-obvious, cross-file patterns that otherwise cost a code-search to re-derive
every time: the Design-Lab glass system, the portal theme gotcha, z-index
layers, the empty-state hero/card system, and the popup primitives.

**Keep it current — it only pays off if it compounds.** When you build or
discover a reusable pattern in the agent app, append it here in the *same*
change (Law 1 / "propose CLAUDE.md-adjacent updates in the same PR"). Keep
entries short and concrete, with file references. A stale entry is worse than
none — if something here contradicts the code, trust the code and fix the entry.

Last updated: 2026-09-01.

---

## 1. Design Lab — the glass picker

Ellis can retint any "glass" card live from the flask icon in the top bar. The
machinery:

- **`<GlassCard glassId label defaultVariant>`** ([components/glass/GlassCard.tsx](../../components/glass/GlassCard.tsx))
  renders a `<div>` with `data-glass-id / -label / -variant` and the variant
  class `glass-vNN`. That's all it takes to make a surface pickable.
- **The drawer** ([components/glass/DesignLabDrawer.tsx](../../components/glass/DesignLabDrawer.tsx))
  auto-discovers every `[data-glass-id]` on the page — no registration needed.
- **Which variant renders** (`usePickForCard` in [lib/glass/context.tsx](../../lib/glass/context.tsx)):
  `user's own DB pick → DEFAULT_PICKS[glassId] → the component's defaultVariant → v00`.
- **App-wide defaults** live in [lib/glass/default-picks.ts](../../lib/glass/default-picks.ts)
  (Ellis's exported picks, baked in for everyone). **Per-user picks** persist to
  `User.agentPreferences.glassPicks` and are handed to `GlassPicksProvider` in
  [app/agent/layout.tsx](../../app/agent/layout.tsx) as `initialPicks`.
- **Variants** are catalogued in [lib/glass/variants.ts](../../lib/glass/variants.ts);
  the CSS is [app/styles/glass.css](../../app/styles/glass.css). `v00` reproduces
  the plain `--agent-surface-elevated` card (the baseline every card starts at).

**To make a card Lab-pickable:** give its root a stable `glassId`
(`kebab-case`) + human `label`, drop any inline `background`/`border` (the
variant class owns the surface), and — if it should look a certain way for
everyone — add a `DEFAULT_PICKS` entry. To tag a *reused* card component (e.g.
`SetupCard`, `PartnerCard`), add optional `glassId`/`label` props and render
`GlassCard` when present, else the plain `.agent-glass` div.

---

## 2. Portal theme gotcha (why body-portalled popups render transparent)

The `--agent-*` colour tokens are scoped to **`.agent-shell-root`** and to
**`[data-theme="sunset|coastal|…"]`** (see [app/agent/styles/themes.css](../../app/agent/styles/themes.css)).
Anything `createPortal`-ed to `document.body` sits **outside** that scope, so
`var(--agent-surface-elevated)` etc. resolve to nothing → transparent panels,
black text, unstyled inputs.

**Fix (the canonical pattern):** read the shell theme with
`usePortalTheme()` ([lib/agent/use-portal-theme.ts](../../lib/agent/use-portal-theme.ts))
and stamp `data-theme={theme}` on the portalled panel, so the tokens resolve for
its subtree. App modals also use a **solid white surface** (not a token) —
that's why the app's popups are white in both light and dark. Precedent:
[components/brokers/AddBrokerModal.tsx](../../components/brokers/AddBrokerModal.tsx),
[components/agent/partners/PartnerPopup.tsx](../../components/agent/partners/PartnerPopup.tsx).

Also note: `--agent-coral-rgb` / `--agent-coral-deep` are the **agency's theme
accent** and change per theme (coral → teal → blue → emerald…). Blue (`59,130,246`)
and green (`16,185,129`) used on cards are **fixed categorical** colours.

---

## 3. Z-index layers (agent app)

- Top bar: **200**, sidebar: **100** (inline in [components/layout/AgentShell.tsx](../../components/layout/AgentShell.tsx)).
- Modal/Drawer primitives use z-layers: `default 50`, `escalated 1500`, `deep 2000`
  ([DESIGN_TOKENS.md](DESIGN_TOKENS.md) "modal escalation rule"). A *default*
  modal (50) sits **below** the nav — real modals open at `escalated`/`deep`, or
  a bespoke portal must clear 200 itself (PartnerPopup uses **1000**).
- The shared dim/blur backdrop is the class **`agent-backdrop-overlay`**.

---

## 4. Empty-state heroes + cards (the onboarding surfaces)

Every `/agent/*` empty state (Hub, Completions, To-Do, Updates, All Files,
Analytics, Partners) follows one system:

- **Hero:** a coral-gradient `<div>` (`linear-gradient(100deg, rgba(var(--agent-coral-rgb),0.14) …)`)
  + border, with **`<HeroArt light dark maxWidth maskStart>`** ([components/agent/HeroArt.tsx](../../components/agent/HeroArt.tsx))
  for the right-side illustration. HeroArt renders both light+dark images
  (CSS theme-swap via `.agent-hero-art-*` in [app/globals.css](../../app/globals.css))
  **and** a shared generic full-cover backdrop that replaces the illustration
  **below 1000px** (`hero-generic.png` / `-dark`). Images live in `/public` as
  `{name}-hero.png` / `{name}-hero-dark.png`.
- **Eyebrow pill:** `<Pill tone="brand" size="sm" glass>` (uppercase). The `glass`
  prop is the current pill style (sheen + tinted shadow) — not flat.
- **Cards:** `<SetupCard>` ([components/agent/SetupCard.tsx](../../components/agent/SetupCard.tsx))
  — icon-in-circle + title + desc + optional CTA button. `SETUP_TINTS` = coral
  (theme), blue (`#2f74e0`), green (`#0f9d6b`). Pass `glassId`/`label` to make it
  a Lab surface.
- **Lab defaults for empty states:** glassId scheme `empty-{page}-{slug}`;
  info cards default `{ dark: "v04" }` (light stays v00); the wide
  "finished-example / no-sales" footer card uses `{ light: "v25", dark: "v21" }`.
- **The gate is server-side** in each page (e.g. brand-new director on Partners =
  `directoryEmpty`); the empty-state component is a client component mounted when
  the gate is true.

---

## 5. Popup primitives — which to reach for

- **`Modal`** ([components/ui/Modal.tsx](../../components/ui/Modal.tsx)) — centred
  card, portal + backdrop + coral accent + focus/escape/scroll-lock. Animates
  **in only**. Use for global, short actions (the [MODAL_DRAWER rule](MODAL_DRAWER_INDEX.md):
  global short = modal; file-scoped edit = drawer).
- **`Drawer`** ([components/ui/Drawer.tsx](../../components/ui/Drawer.tsx)) —
  right-anchored panel. **No bottom-sheet variant** (its docs defer that to "a
  real consumer").
- **`PartnerPopup`** ([components/agent/partners/PartnerPopup.tsx](../../components/agent/partners/PartnerPopup.tsx))
  — the responsive one: centred card on desktop, **bottom sheet ≤640px**,
  animates **in and out** (keeps mounted through a `data-closing` frame). Built
  because neither primitive does a mobile sheet or an exit animation. Reuse /
  promote this if a second consumer needs the same.

Animation values (keyframes for the popup, chooser arrow slide, etc.) belong in
[MOTION_GUIDE.md](MOTION_GUIDE.md); the popup's own keyframes are the
`partner-*` rules in `app/globals.css`.

## Responsive patterns (programme of 2026-09-16 — reuse these, don't reinvent)

Shell tiers + the container-query rule are documented in
[DESIGN_TOKENS.md](DESIGN_TOKENS.md) § Responsive breakpoints. Reusable
mechanics introduced by the programme:

- **Container-driven layout switch** — make the wrapper a container
  (`container-type: inline-size`) and switch nested grids/flex with
  `@container (max-width: …)`. Live examples: `.files-table` /
  `.files-switch-N` (card↔grid per column set, bucket picked in
  `TransactionTable` via `filesGridMinWidth`), `.pipe-container` (6/4/3/2
  columns), `.hub-content-pad`, `.people-rows`, `.chain-stack`.
- **Tab-bar overflow affordance** — `data-fade` edge masks +
  `.agent-tab-scroll-btn` chevrons, driven by scroll/Resize observation in
  `PropertyFileTabs`. Adopt for any other `.agent-tab-bar` that can overflow.
- **Slide-over gutter classes** — inline `min(<w>px, calc(100vw - 48px))`
  width plus `.resp-drawer` (full-screen ≤560) or `.resp-drawer-wide`
  (full-screen ≤899) for bespoke drawers not on the `Drawer` primitive.
- **Overlay footers** — `Modal.Footer` / `Drawer.Footer` carry
  `.agent-overlay-footer` (wraps; stacks full-width ≤420). Don't add
  per-consumer `flex-1` workarounds for fit any more; keep `flex-1` only
  where equal-width buttons are the intended look.
- **Touch tier** — the `@media (pointer: coarse)` block at the end of
  `agent-system.css` (persistent affordances + tap-target floor). Extend it
  rather than sprinkling one-off touch rules.
- **Action-cluster wrap** — text column `flex: 1 1 <basis>px` + cluster
  `margin-left: auto` inside a `flex-wrap` row (`.rem-row`,
  `.people-row-actions` with `flex-basis: 100%`) so buttons drop to their
  own line instead of crushing the label.

## Navigation: prefetch + instant shells (2026-09-18)

The agent app's navigation model after the instant-clicks/instant-shell slice:

- **Rail links** (`AgentNavRail`) carry `prefetch={true}` — the full route +
  data is prefetched whenever the rail is on screen, so a rail click lands
  already loaded. **Property-row links** (file lists, hub rows, recently
  viewed) carry `unstable_dynamicOnHover` instead — full prefetch starts on
  pointer intent, so long lists never flood the server. Use one of these two
  props on any new agent-surface link whose destination an agent will
  plausibly click; never hand-roll a prefetch effect for links.
- **Every rail destination has a `loading.tsx`** built on
  `components/loading/PageSkeletons.tsx` (`RailPageSkeleton` /
  `SectionSkeleton`): navigation commits instantly to a page-shaped
  silhouette. No dots, no spinners, no `LoadingCard` on agent surfaces —
  new sections use `SectionSkeleton` as their Suspense fallback.
- **Reuse window:** agent pages export `unstable_dynamicStaleTime = 300`
  (per-page, NEVER a global `staleTimes` — the buyer/seller portal must keep
  default always-fresh navigation). Mutations purge it via `revalidatePath`.
- **Arrival motion:** `PageFadeIn` plays a 180ms fade/6px rise per
  navigation. It never blocks input; do not add additional per-page
  entrance wrappers on top of it.
