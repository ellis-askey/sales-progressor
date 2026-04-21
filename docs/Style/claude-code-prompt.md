# Claude Code prompt — Glass design system rollout

## Phase 1: Property page only

I'm adopting an Apple Control Center-style frosted glass design system.
I've added two files to the repo:

- `src/styles/glass-tokens.css` — the design system (CSS variables + utility classes)
- `src/components/examples/PropertyCard.jsx` — a worked example showing the patterns in use

Please do the following, in order:

1. Import `glass-tokens.css` in the app's root CSS entry point (whatever file
   currently imports Tailwind's base layer). Do not duplicate the import.

2. Refactor the property detail page (the single-property view) to use the
   glass design system. Scope is strictly this page and its direct child
   components — do not touch any other page yet.

3. Rules for the refactor:
   - Use ONLY the utility classes from `glass-tokens.css`
     (`.glass-card`, `.glass-card-strong`, `.glass-subtle`, `.glass-button`, `.glass-nav`, `.glass-page-bg`)
   - Do NOT write new `backdrop-blur`, `bg-white/xx`, or custom shadow classes.
     If a surface doesn't fit the existing utilities, stop and ask me before adding one.
   - Apply `.glass-page-bg` to the page-level wrapper so the glass effect is visible.
   - Text colours: use `text-slate-900/90` for primary text, `/60` for secondary,
     `/40` for tertiary. Do not use grey shades.
   - Preserve all existing functionality, data bindings, props, event handlers,
     and component structure. This is a styling refactor only.
   - Match the patterns in `PropertyCard.jsx` for layered surfaces
     (main card → subtle nested panel → buttons).

4. When done, give me:
   - A short summary of which files you changed
   - Any surfaces where you were unsure which glass utility fit
   - A note on anything you left unchanged that might need attention

Do not proceed to other pages. I'll review the property page first and
then give you a separate instruction to roll out across the app.

## Phase 2 (do not start yet)

Once I approve Phase 1, I'll ask you to apply the same system to the rest
of the app using the property page as the reference implementation.
