# TSP Design System — programme

**The canonical design system for The Sales Progressor, built from the app that already exists.**

This is the durable source of truth for the programme. A fresh Claude session —
or a human — should read this file (and [PROGRESS.md](PROGRESS.md)) **before**
recommending or changing anything. Conversation history is not a reliable record;
this directory is.

Workspace (the HQ): **`/dev/components`**.

---

## 1. Mission

Reach a state where every shared UI element has a clear canonical implementation;
spacing, type, sizing, colour, borders, radii, shadows and motion follow an
intentional system; existing proportions are preserved unless deliberately
changed; components carry appropriate sizes, variants and states; deliberate
context-specific behaviour survives; light and dark are peers; mobile/tablet/
desktop feel like one product; new features are built from approved components;
and production pages can migrate without functional regressions.

**The objective is consistency without unnecessary uniformity.** A property card,
a task row and an analytics card may legitimately differ — their shared
foundations should be consistent, their individual purposes respected. We are
refining an existing product, not applying a generic UI kit.

**We are not redesigning TSP. We are canonicalising what already exists.**

## 2. Two systems, one destination

| | **This library** (`/dev/components`) | **Liquid Glass** (`/dev/design-system`, `docs/reference/design-system/`, `components/liquid/`) |
|---|---|---|
| What | Canonical system of what the app **is** today | The **forward** visual language for new / redesigned UI |
| Role | The **law-in-waiting** | The **migration source** |
| Status | Being built from scratch, one review at a time | Established; many components already sorted |

**The plan:** as each component is reviewed and canonicalised here, it is retired
(hidden/removed) from Liquid Glass. When the whole app has been worked through,
`/dev/components` **becomes law** and Liquid Glass is deleted. Until then both
coexist, clearly labelled, cross-linked from the workspace. The previous uiarc
component gallery is preserved as a raw source at `/dev/components/gallery`.

## 3. The non-negotiable boundary

**Presentation is in scope. Content, data and business behaviour are not.**
Changing an input's radius/height/padding/type must not remove its input-cleaning
logic. Changing a button's appearance must not change its label, handler or
permissions. Changing a card's spacing must not alter its data. Every canonical
component distinguishes:

- **A. Shared foundations** — the visual/interaction rules that stay consistent.
- **B. Approved variants** — intentional differences in size, appearance, density, purpose.
- **C. Protected exceptions** — deliberate behaviour / context-specific refinements that must survive shared updates (recorded in [EXCEPTIONS.md](EXCEPTIONS.md) and the entry's "Existing Behaviour & Exceptions" section).

## 4. Governance (permanent rules)

1. **Existing TSP design comes first** — no generic SaaS substitution.
2. **No independent canonical decisions** — I recommend; Ellis approves.
3. **No unnecessary redesigns** — preserve what works.
4. **No forced uniformity** — different sizes/structures/behaviours are allowed where justified.
5. **Preserve functionality** — logic, permissions, validation, workflows are out of scope unless explicitly discussed.
6. **Preserve protected exceptions** — document and retain them.
7. **Shared changes are assessed across all states**, not only the visible default example.
8. **Compare before resolving conflicts** — show the alternatives side by side.
9. **Production changes require authorisation** — no migration/refactor of live components without explicit approval.
10. **Reuse before creating.**
11. **Accessibility is foundational** — WCAG 2.2 AA target.
12. **Document decisions continuously** — this directory is the reliable record.
13. **Work incrementally** — don't resolve many unapproved decisions in one session.
14. **Never assume silence means approval** — where a decision is required, ask.

Existing sizing/proportions are the **baseline**; nothing resizes without explicit approval.

## 5. Decision statuses

`Not reviewed` → `Proposed` → `Under review` → `Approved` → `Implemented` → `Deprecated`.

A discussed idea is not approved. An approved component is not implemented. An
implemented canonical component is not migrated across the app. Keep these
distinct. (Mirrored in code: `DecisionStatus` in `app/dev/components/_ds/registry.ts`.)

## 6. Review workflow

1. **Discover** existing implementations across the app · 2. **Compare** variants/sizes/states/behaviour · 3. **Discuss** inconsistencies vs deliberate differences · 4. **Decide** (Ellis approves) · 5. **Document** here · 6. **Prepare** the canonical component · 7. **Validate** states/responsive/a11y/function · 8. **Migrate** production (explicit approval only) · 9. **Verify**.

## 6a. Comparisons — decisions are judged as pixels

Any decision that would change a **shipped treatment** (a reconciliation, a
restyle, an alignment) gets a **`/dev` before/after comparison page** showing the
**whole card** — current on one side, proposed on the other — so Ellis approves
from the render, not from hex values in chat. These live under
`app/dev/components/compare/<slug>/` (e.g. `/dev/components/compare/auth-type`).
Don't ask for a styling decision in prose when a comparison would show it.

## 7. Where things live

| Record | File |
|---|---|
| Mission, boundary, rules, statuses, workflow | this README |
| Component registry (discovered → deprecated) | [REGISTRY.md](REGISTRY.md) |
| Approved / rejected decisions + reasoning | [DECISIONS.md](DECISIONS.md) |
| Protected behaviours & exceptions | [EXCEPTIONS.md](EXCEPTIONS.md) |
| Progress + session handover (resume here) | [PROGRESS.md](PROGRESS.md) |

Code: workspace at `app/dev/components/`, IA + entry architecture in
`app/dev/components/_ds/`. Real background reused from
`components/decor/AppBackground.tsx`; theme via `<html data-theme>`.

## 8. Continuity contract

- **Start of a design-system session:** read this README + PROGRESS.md before acting.
- **End of a session:** update PROGRESS.md (and the relevant record) with confirmed progress only.
- Do not rewrite prior decisions without explicit approval. Do not treat an
  unapproved suggestion as an established rule. If instructions conflict with a
  recorded decision, highlight the conflict and ask.

The goal: a completely fresh session can understand the mission and resume from
the correct point without relying on memory of previous conversations.
