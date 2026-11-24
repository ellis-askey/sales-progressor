# Liquid Glass — design philosophy

The principles behind the direction, distilled from the `/dev/updates-glass`
reference. Follow the **principles**, not a copied layout. Two pages should feel
designed by the same person without having identical headers, cards or action bars.

## What we're going for

Modern and Apple-inspired. Sophisticated and understated. Clean and spacious
without feeling empty. Rich in interaction, restrained in decoration. Consistent
in quality, free in layout. Equally beautiful in light and dark. Appropriate for a
professional property-transaction platform — calm, trustworthy, quietly premium.

## The ten principles

1. **Material hierarchy, not glass everywhere.** Three roles: *solid/opaque* for
   dense reading, *glass* for chrome (bars, rails, docks, overlays), *glass-on-
   interaction* for rows that light up on hover. Refraction is reserved for hero
   surfaces; small chrome gets lighter frost. If everything is glass, nothing is.

2. **Real refraction, real backgrounds.** Glass sits on the actual TSP backdrop
   (`AppBackground` + the elevra ambients) and bends it at the edges. Never a flat
   grey "frosted card" pretending to be Liquid Glass.

3. **Typography carries hierarchy.** Weight, size, colour and spacing — not
   uppercase, not a bright pill on every row. One clear level per element. Sentence
   case. The content's most important fact is the most readable thing.

4. **Status is quiet.** A coloured dot + label, or a hairline, beats a saturated
   status pill. Progress is *integrated* into its object (e.g. a hairline on the
   card), never a detached dashboard widget.

5. **Restraint and contrast.** Some surfaces solid, some transparent, some glassy
   only on interaction. The *relationship* between materials, motion and hierarchy
   is the design — not the number of effects.

6. **Motion communicates, never decorates.** Spring for selection and entry; ease
   for surfaces. Every animation signals interaction, hierarchy or a state change.
   Nothing moves "for delight" if it slows the user down. Honour reduced-motion.

7. **One identity across avatars, icons and colour.** Real person avatars (photo →
   branded side-tinted art). Consistent icon weight/size. A single restrained
   accent; semantic colour only where it means something.

8. **Light and dark are twins, not an inversion.** Each is designed: readable text,
   believable glass (never an opaque black panel in dark, never washed-out in
   light), controlled accents, subtle borders and shadows.

9. **Present functionality better — don't change it.** The floating New note / New
   email bar was a *better presentation* of existing actions we hadn't specified.
   That thinking is encouraged: rethink grouping, access and placement freely.
   Changing what a control *does* is not design freedom — that needs approval.

10. **Approved is the default, not the ceiling.** Reach for an approved component
    first; but if you can design something genuinely better, build it in the
    laboratory, verify it, and propose it. The system is meant to improve.

## The anti-patterns we reject (generic AI-SaaS)

Every section in an identical glass card · excessive gradients · glass applied
indiscriminately · random floating pills · huge empty space · everything
over-rounded · inconsistent shadows · decorative effects with no purpose · tiny
low-contrast text · a dashboard with a glass filter slapped on · old frosted
glass masquerading as Liquid Glass · bold heading + grey line + bright pill on
every row · uppercase used purely for hierarchy.

## Modern Liquid Glass standards (2026-11-02, founder-approved)

The target is the **latest, most polished generation of Apple's Liquid Glass** —
not generic "Apple-inspired" UI, dated iOS styling, or basic frosted glass.

1. **Optics are the material.** A real lens has a **crisp, near-neutral centre**
   and bends/magnifies the backdrop in a **thin rim band** (edge-concentrated
   curvature, inward pull). Avoid linear "tilt" displacement, uniform blur, and
   heavy multi-pass chromatic aberration that splits bright content into streaks.
   Reach for geometry (a slab/convex height field), not brute displacement.
2. **Research then adapt.** Before building a material or control, study current,
   actively-maintained open implementations (e.g. Glassy UI's `refraction-map` /
   `slab-optics`, MIT). **Prefer adapting proven source** — with licence and
   attribution preserved — over recreating an appearance from memory.
3. **Physics-driven motion.** Spring physics drive the visible element (press,
   drag, overshoot, settle). No CSS-easing stand-ins pretending to be springs.
4. **Progressive enhancement.** Capable browsers (Chromium/Edge) get the full
   `backdrop-filter: url()` optical lens; Safari/Firefox get a **polished,
   accessible fallback** that keeps the same shape and behaviour (not a downgrade
   to flat frost). Respect `prefers-reduced-motion`; maintain usable contrast.
5. **Selective glass.** Material on controls, navigation, overlays and chosen
   interactive surfaces — **not** on dense content, which stays clear and readable.
6. **TSP coral** (`--lg-accent`, the existing coralDeep token) is the primary
   accent everywhere; the glass material itself stays neutral and theme-aware.
7. **Don't hand-recreate everything.** A material or physics upgrade belongs in the
   shared engine so it lifts the whole kit at once; components reuse it.

## The quality bar

The `/dev/updates-glass` prototype is the **starting reference, not the ceiling**.
Future pages may introduce better components and smarter layouts; when approved,
they raise the bar and update this system.
