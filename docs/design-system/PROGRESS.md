# Progress & session handover

**Read this (and [README.md](README.md)) at the start of every design-system
session. Update it at the end with confirmed progress only.**

---

## Current position

- **Phase:** Workshop established. **Login + register batches captured** — 14
  entries (10 login + 4 new from register: step progress, password strength,
  checkbox, radio group; plus ghost-button + arrow-link variants folded into
  existing entries). See [DECISIONS.md](DECISIONS.md), [REGISTRY.md](REGISTRY.md).
  Live in `app/dev/components/_ds/components.tsx`.
- **Auth pages are now fully captured.** Register added only the elements login
  didn't already cover — the rest were confirmed already-canonical.
- **Track A (Foundations) started:** Type scale + Text / Status / Coral colour
  ramps captured from `design/tokens.ts` (Foundations → Typography + Colour).
  Three auth-vs-token **divergences** and two **state gaps** flagged — see
  [DECISIONS.md](DECISIONS.md) 2026-11-19 (awaiting reconciliation decisions).

## Coverage (2026-11-20)
- **Foundations: nearly complete** — colour, typography, spacing, sizing, radii, borders, elevation, iconography, motion, z-index all filled from `design/tokens.ts`. Still empty (need a decision/source): **responsive breakpoints**, **light/dark themes**, **density**.
- **Auth pages: fully catalogued** — incl. the previously-missed inline alert/error banner, close (X), field hints, cookie buttons/toggle (now coral), loading + error states. Minor remainders: the footer note, the cookie reopen button.
- **Most Component categories still empty by design** — tables, tabs, modals, drawers, tooltips, navigation, data displays, etc. don't appear on the auth pages; they live on the hub / file view / settings and fill when we mine those pages.

## Open reconciliation decisions (foundation)
1. Auth H1 weight/colour — align to scale (28/600/warm) or keep as approved exception?
2. Auth body ink — warm token ramp or keep the cool auth ink?
3. Register warning hint — align to token warning #C97D1A?
4. Add missing invalid-email error + fuller loading states (Track B).
- **Workspace:** `/dev/components` — live HQ: real `AppBackground`, light/dark
  switcher, five empty areas awaiting review, extensible entry + "Existing
  Behaviour & Exceptions" architecture, dev-only gate.
- **Records:** this directory (README, REGISTRY, DECISIONS, EXCEPTIONS, PROGRESS).
- **Two systems:** `/dev/components` (canonical, law-in-waiting) + Liquid Glass
  (`/dev/design-system`, migration source, deleted once the app is covered).
- **Preserved:** the uiarc gallery at `/dev/components/gallery` (raw source).

## Last confirmed decision

- **2026-11-19** — Programme approved. Two systems coexist now; `/dev/components`
  is built from scratch as the eventual single source of truth; components
  migrate over from Liquid Glass (retired there as they move) until the whole app
  is covered, then Liquid Glass is deleted. _No component-level decisions yet._

## Next agreed action

- **Choose the first thing to review together** — a foundation (e.g. colour,
  spacing, radii) or a component (e.g. buttons, text inputs). Then run the
  workflow: Discover → Compare → Decide → Document.

## Open threads (not yet decided)

- Which foundation/component to open first.
- Where migrated-from-Liquid-Glass components are staged before canonicalising.

---

### Handover notes
Append dated notes here each session: what was confirmed, what's mid-flight, the
single next action. Keep it short.
