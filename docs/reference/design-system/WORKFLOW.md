# Liquid Glass — workflow & governance

How we add components and migrate pages without the library going messy, and
without touching production behaviour.

## Definition of Done for Liquid Glass (every new/approved component)

A component is not done until it meets all of these:
- **Material:** where glass is used it's the **slab lens** (`LiquidLens`), applied
  **selectively** (controls, nav, overlays, hero surfaces) — never over dense text,
  which stays solid and readable.
- **Motion:** physics-driven via `spring.ts` (press / drag / overshoot / settle) —
  no CSS-easing stand-ins pretending to be springs.
- **States + a11y:** default / hover / focus-visible / pressed / selected / disabled /
  loading / error as applicable; keyboard operable (Radix where it fits); AA contrast;
  honours `prefers-reduced-motion`.
- **Both themes:** deliberate light + dark.
- **Accent:** TSP coral (`--lg-accent`); glass material neutral.
- **Fallback:** capable browsers get the lens; others get a **polished** fallback that
  keeps the same shape and behaviour.
- **Anti-generic gate:** passes the reject list — no identical glass cards everywhere,
  no loud coloured status pills, no uppercase-for-hierarchy, no decorative hover
  spotlight, no generic-SaaS layout.

**Approved is the starting point, not the ceiling.** If a page needs a better
interaction or a component we don't have, research + prototype + propose it (that's how
the Updates floating-action idea happened). Do not fall back to generic AI-SaaS patterns
or older Apple-inspired styling to fill a gap.

**Impeccable is advisory.** Use it for craft critique/refinement, but it must not
override the Liquid Glass direction, impose generic styling, or auto-rewrite a design.
Coral + glass are intentional decisions; Impeccable findings against them are surfaced,
not acted on.

## Reuse → adapt → create (the default order)

Whenever you need a UI component:

1. **Reuse** an **Approved** component from `components/liquid/` ([INVENTORY.md](INVENTORY.md)).
2. **Adapt** an existing component cleanly if close.
3. **Research** Glassy UI ([glassyui.com/components](https://glassyui.com/components))
   and other modern Apple-inspired patterns; reimplement in-house (no Glassy UI
   install — React 19 / Tailwind 4 incompatible).
4. **Create** a new reusable component only for a genuine gap.

Rules: never use an inferior component just because it exists; never reinvent an
approved one; **no new dependency** without explaining the consequences and getting
approval; any genuinely reusable new component is added to the showroom + inventory.
Do not create competing versions of the same component, and do not make global
styling changes that could affect approved/production pages.

## Adding a new pattern

1. Identify the gap. 2. Look for an existing component/variation. 3. Research
Glassy UI / Apple patterns. 4. Recommend the best approach. 5. Build an **isolated**
example in the laboratory (`/dev/design-system`). 6. Verify appearance + interaction
(screenshots, both themes). 7. Add to the showroom + inventory as **Experimental**.
8. Mark **Approved** only after founder review.

## Page-by-page migration (A–G)

- **A · Understand.** Inspect the production page and every related modal, drawer,
  popover and interactive state. Record functionality, information, workflows,
  permissions. (Use an Explore agent for the functional map.)
- **B · Design.** Build a complete redesign in an isolated dev route
  (`/dev/<page>-glass`). Preserve functionality + general page structure; substantial
  visual freedom. Mock or safely read-only data; **all mutations simulated** (no
  writes, emails, chases, notifications).
- **C · Review.** Show light + dark, every important state and interaction, via real
  rendered screenshots. Identify anything incomplete/inconsistent.
- **D · Refine.** Apply feedback. A page isn't done because the main screen looks
  good — check every state.
- **E · Approve.** Wait for explicit founder approval.
- **F · Migrate.** Only after approval: wire the new UI to the **existing** logic,
  preserving every action, permission, workflow and outcome. Verify the production
  page still works (drive it; screenshots). One page = one reviewable PR (Law 16).
- **G · Record.** Update this folder + INVENTORY with newly approved patterns.

Do not repeat the whole design exercise per page — reuse the system.

## Behaviour is protected (hard rule)

Visual freedom never authorises removing information, actions, fields, statuses or
capabilities, or changing logic, permissions, data handling or outcomes. If a design
would change the steps a user takes or remove information, **explain it and get
approval before implementing.** An audit/investigation is not permission to change
behaviour.

## Isolation & safety

Experimental work stays in `/dev/*` and `components/liquid/**` (+ the dev-only
`app/styles/liquid-glass.css`). No production route, global style, business logic,
permission, DB, API, automation, notification or workflow changes during design-system
work. The showroom triggers no real external actions.

## Visual QC checklist (run before calling anything done)

Hierarchy · typography · spacing · alignment · colour consistency · glass material
quality · light **and** dark · contrast · hover/focus/pressed/selected/disabled ·
animation consistency · responsive (desktop + mobile) · keyboard access ·
reduced-motion · modal/drawer completeness · loading + empty + error states ·
content overflow · sticky controls not obscuring content · no generic-AI patterns ·
no unnecessary text · no unnecessary uppercase.

**Verify on the rendered page, not just the source.** Use Playwright screenshots
(see the harness used for `/dev/updates-glass`) in both themes and at mobile width.
Avoid large automatic styling passes across production pages.
