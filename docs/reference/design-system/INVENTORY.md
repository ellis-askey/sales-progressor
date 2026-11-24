# Liquid Glass — component inventory

The catalogue for the forward system (per the approved Law 14 amendment, this —
not the production `COMPONENT_LIBRARY_CATALOG.md` — governs `components/liquid/**`).

**Statuses:** **Approved** (reviewed + accepted; the default to reach for) ·
**Reference** (in the approved `/dev/updates-glass` prototype, awaiting formal
sign-off in the showroom) · **Experimental** (in the laboratory, for evaluation) ·
**Missing** (a known gap, not built) · **Deprecated**.

Nothing is auto-stamped **Approved** — the founder promotes items after reviewing
them in `/dev/design-system`.

## Protected foundations (Approved 2026-11-02 — do not replace, simplify, restyle or regress without founder sign-off)

| Foundation | Status | Where | Note |
|---|---|---|---|
| **Updates prototype** | Approved reference | `/dev/updates-glass` | Our visual + layout-quality benchmark and design-intelligence benchmark (the floating note/email idea). |
| **Slab-lens optical material** | Approved (preferred forward material) | `components/liquid/LiquidLens.tsx` + `lib/refraction-map.ts` | Clean magnification, crisp centre, natural edge refraction. Our optical benchmark. Default glass material, used **selectively** on in-flow **content / nav / hero** surfaces — **not** over dense text, and **not** on small portalled overlays (it smears content behind them; use the frosted overlay surface — see Reconciliation below). (The "experimental" badge still shown on `/dev/glass-optics` is a stale route label, not a status.) |
| **Spring physics** | Approved (motion foundation) | `components/liquid/lib/spring.ts` | All physics-driven motion (press, drag, overshoot, settle). |
| **TSP coral tokens** | Approved (primary accent) | `--lg-accent` (= coralDeep `#FF6B4A`) | Primary accent everywhere; the glass material itself stays neutral. Not Apple blue. |
| **Legacy glass engine** | Kept until retired | `components/liquid/LiquidGlass.tsx` | The original linear-map engine. Retained as the non-lens fallback option; superseded by the slab lens for new work. |

All four are MIT-adapted or in-house; attribution for the Glassy UI adaptations
(slab optics + spring) is preserved in their source files.

**Promotion (2026-11-02):** foundation checks passed — the slab lens costs **no more
than the legacy frosted engine** (the dominant perf factor is the *animated background
× number of glass surfaces*, not the lens), and the Safari/Firefox fallback is a
polished convex dome. The kit surfaces (`GlassCard`, `GlassPanel`, `GlassMenu`,
`GlassDialog`, `GlassDock`, `GlassToast`, `NavRail`) now **default to the lens**.
`GlassCard`/`GlassPanel` take a `material` prop — **`lens`** (default, hero/card/chrome),
**`frost`** (lighter legacy blur), **`solid`** (no glass). **Use `solid`/`frost` for
dense lists** — never put a lens on every row. Legacy `LiquidGlass` stays exported.

## Foundations
| Item | Status | Where |
|---|---|---|
| Colour / semantic tokens, ink scale | Reference | `liquid-glass.css` |
| Typography scale | Reference | SYSTEM.md |
| Radii, spacing | Reference | `liquid-glass.css` |
| Glass material (`LiquidGlass`) | Reference | `components/liquid/LiquidGlass.tsx` |
| Motion / easing tokens | Reference | `liquid-glass.css` |

## Actions
| Item | Status |
|---|---|
| Button (primary / secondary / subtle / ghost / danger; sm/md/lg; icon; loading; disabled) | Reference |
| Floating dock + dock button | Reference |
| Spinner | Reference |
| Split button | Experimental (CSS present, no React wrapper yet) |
| Contextual action menu (via Menu) | Reference |

## Selection & inputs
| Item | Status |
|---|---|
| Input, Textarea, Field (label/error) | Reference |
| Switch, Segmented control, Chip | Reference |
| Slider, Checkbox, Radio group | Reference |
| Search field (Input + leading icon) | Reference |
| Select / Combobox | **Missing** |
| Date picker | **Missing** |

## Navigation
| Item | Status |
|---|---|
| Tabs (animated indicator) | Reference |
| Nav rail + item | Reference |
| Dock | Reference |
| Menu / dropdown / context menu | Reference |
| Command menu (⌘K) | Experimental |
| Breadcrumb, Pagination | **Missing** |

## Content & feedback
| Item | Status |
|---|---|
| Card / Panel surfaces | Reference |
| Badge, Status dot, Progress | Reference |
| Skeleton | Reference |
| Avatars (real `UserAvatar`/`ActorAvatar`, re-exported) | Approved (reused unchanged) |
| Toast | Reference |
| Property header, Update row | Reference |
| Tooltip | Experimental (CSS present) |
| Alert, Table, Error state | **Missing** |

## Overlays
| Item | Status |
|---|---|
| Dialog / Sheet (centred desktop, bottom-sheet mobile) | Reference |
| Popover / Menu | Reference |
| Multi-step form | Experimental |
| Drawer | **Missing** |

## TSP-specific
| Item | Status |
|---|---|
| Sale-progress ring | Experimental |
| Chain status | Experimental |
| Milestone stepper | Experimental |
| Vendor / purchaser indicator | Experimental |
| Update-feed item | Reference |
| Reminder controls, File status, Document actions, Transaction actions | **Missing** |

## Known duplication to reconcile
`app/dev/updates-glass` currently carries its own inline copy of several of these
components (it predates the shared kit). When that page is approved for migration it
should be refactored onto `components/liquid/`. Tracked here so we don't ship two
copies long-term.

## Reconciliation (2026-11-02)

Audit of the dev routes + kit + docs. Our best material, interactions, content
treatments and overlay mechanics were scattered; this records the correct foundation.
**Nothing here is newly Approved** — promotions happen on founder visual sign-off (now
via the Hub rebuild, not a separate showroom).

**Material doctrine.** Slab lens = in-flow **content / hero / nav**. Small **portalled
overlays** (menu, popover, tooltip, toast) = a **frosted, non-displacement** surface; a
displacement lens smears content behind small floating overlays. The kit overlays
(`GlassMenu`, `GlassToast`, `GlassDialog`, `GlassDock`) currently default to the lens —
they should move to the frosted surface. **Status: Experimental, pending sign-off** (the
frosted `.v3-glass` surface proven in `/dev/hub-glass-v3`). `.lg-solid` stays for dense
reads. Ambient backdrop (so glass has something to refract) is a foundation to formalise.

**Best-of currently un-kitted (extraction targets — Reference/Experimental, NOT Approved):**
- *Content treatments* in `/dev/updates-glass`: file + hairline progress-line, update/message
  **row engine** (`Leading`/`UpdateLine`), ambient backdrop, floating action bar, search,
  day-disclosure, bottom-sheet composer, skeleton + empty. (These are the missing content layer.)
- *Overlay mechanics* in `/dev/hub-glass-v3`: `Portal`+`ThemeCtx` (re-scopes `.lg-ds` tokens
  into a body portal), `useAnchored` positioning, `Pop`/`HoverPop`/`Menu`, `ActionDrawer`
  (focus-trapped), `ConfirmDateModal`, and the frosted `.v3-glass` overlay surface.
- *Control interactions* in `/dev/glass-lab`: Radix + spring slider / switch / segmented / dock —
  re-skin to coral (lab switch is green) and move onto the correct material.

**Status corrections.**
- **Spring physics** — Approved, but under-adopted (wired only into `/dev/glass-optics` and
  `/dev/glass-lab`; the kit + content treatments use CSS easing). Adopt for overlays, selection and drag going forward.
- **Legacy forked engine** `app/dev/liquid-glass/LiquidGlass.tsx` — **Deprecated duplicate** of the
  kit `LiquidGlass`, with older defaults + inlined `.lgx` CSS. `/dev/updates-glass` still imports it;
  do not build new work on it.
- **Not defaults for new content work** (legacy patterns): status badge **pills**, filter **chips**,
  coloured-icon-square category avatars, all-caps eyebrows. Use hierarchy, spacing and typography instead.

**Docs reconciled this pass (docs-only):** `SYSTEM.md` accent corrected #0a84ff → coral `#ff6b4a`
and a material-doctrine note added; `VISUAL_DIRECTION.md` given an un-migrated-only scope banner;
`CLAUDE.md` source-of-truth row + Law 14 base + UI-preservation base qualified so new-UI sessions are
routed to the forward system, not the production primitives.
