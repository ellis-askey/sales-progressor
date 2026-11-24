# TSP Liquid Glass — design system

**This is the forward visual source of truth for The Sales Progressor.** Any new
UI, and any page redesign you approve, follows this system. It **progressively
supersedes** the older visual docs (`DESIGN_TOKENS.md`, `COMPONENT_LIBRARY_CATALOG.md`,
the "nearest shipping pattern" rule) as pages migrate — those remain authoritative
only for **un-migrated production pages**, which must not change until individually
approved.

Reference prototype: **`/dev/updates-glass`** (approved direction). Showroom: **`/dev/design-system`**.

| Read this when | Doc |
|---|---|
| Setting the visual direction / "what makes it good" | [PHILOSOPHY.md](PHILOSOPHY.md) |
| Building UI — tokens, materials, motion, a11y, responsive | [SYSTEM.md](SYSTEM.md) |
| Choosing or proposing a component | [INVENTORY.md](INVENTORY.md) |
| Redesigning a page / adding a pattern / QC | [WORKFLOW.md](WORKFLOW.md) |
| Writing any user-facing string | [WRITING.md](WRITING.md) + [../VOICE.md](../VOICE.md) |

## The non-negotiable boundary

**Functionality is protected. Visuals are open.** You may completely rethink how
functionality is presented, grouped, accessed and styled. You may **not** remove
information, actions, fields, statuses or capabilities, or change any business
logic, permission, workflow, data handling or outcome. If a visual improvement
would change the steps a user takes or remove information, **stop and ask first.**

## How this applies automatically

CLAUDE.md lists this folder as the first design reference in its source-of-truth
table, and Law 1 ("read the source-of-truth doc first") routes every session here
before UI work. You don't need to be reminded in-conversation.

## Implementation

- Kit: [`components/liquid/`](../../../components/liquid/) (engine + components), tokens in
  [`app/styles/liquid-glass.css`](../../../app/styles/liquid-glass.css) (scoped to `.lg-ds`, dev-only).
- **No new dependencies.** Glassy UI is a reference, not an install (it needs
  React 19 + Tailwind 4; we're on 18 / 3.4). We reimplement its patterns in-house.
