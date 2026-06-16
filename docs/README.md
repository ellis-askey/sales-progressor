# Sales Progressor — docs index

Where to find what. If you can't find something here, check git log — older arcs may have been folded into `done/<arc>/`.

---

## Bootstrap

- [`../CLAUDE.md`](../CLAUDE.md) — every session reads this first. Role architecture, multi-tenancy model, hard rules.
- [`../README.md`](../README.md) — GitHub front page.

---

## Canonical specs (top of `docs/`)

Long-life specs that ongoing work refers to. Don't move these — they're referenced by CLAUDE.md and (in some cases) by code.

- [`MILESTONES_SPEC_v1.md`](MILESTONES_SPEC_v1.md) — canonical milestone engine state machine.
- [`MILESTONES_WEIGHTS_v1.md`](MILESTONES_WEIGHTS_v1.md) — weights + blocksExchange gating.
- [`VISUAL_DIRECTION.md`](VISUAL_DIRECTION.md) — agent app aesthetic direction (Apple-like, warm cream + coral, glass).
- [`ANIMATION_STANDARDS.md`](ANIMATION_STANDARDS.md) — small reference; the larger version lives in [`polish-pass/ANIMATION_STANDARDS.md`](polish-pass/ANIMATION_STANDARDS.md) and is code-referenced.
- [`MANUAL_TASKS.md`](MANUAL_TASKS.md) — Supabase RLS / credentials setup. Code-referenced by `lib/prisma-rls.ts`.
- [`POST_LAUNCH_FIXES.md`](POST_LAUNCH_FIXES.md) — bug log. Code-referenced by `app/agent/polish/analytics/page.tsx`.
- [`test-accounts.md`](test-accounts.md) — test account seed data.

---

## `active/` — open plans + ongoing ops

Anything currently being built, or a checklist that gets ticked off over time.

- [`active/ELLIS_MANUAL_TODO.md`](active/ELLIS_MANUAL_TODO.md) — founder ops checklist (env vars, DPAs, decisions, blockers).
- [`active/TODO.md`](active/TODO.md) — technical debt + future-sprint items.
- [`active/portal-document-sharing-spec.md`](active/portal-document-sharing-spec.md) — Documents tab on portal — upload, categorise, notify.
- [`active/package-d/`](active/package-d/) — outsourced workflow build (the "Known gap" in CLAUDE.md).
  - [`scope.md`](active/package-d/scope.md) — pre-build spec.
  - [`outsourced-workflow-audit.md`](active/package-d/outsourced-workflow-audit.md) — current-state audit.
- [`active/drawers-modals/`](active/drawers-modals/) — drawer/modal standardisation audit.
  - [`audit.md`](active/drawers-modals/audit.md) — every drawer + modal in the agent app.
  - Locked design system relocated to [`reference/MODAL_DRAWER_SYSTEM.md`](reference/MODAL_DRAWER_SYSTEM.md) (2026-06-07).

---

## `done/` — shipped work, by feature/arc

Historical record of completed arcs. Each folder holds all docs from that arc together (spec → audit → completion report).

- [`done/claim-polish-arc.md`](done/claim-polish-arc.md) — claim flow polish + bg + chain-add toast (shipped 2026-05-21).
- [`done/milestone-engine-v5-diagnosis.md`](done/milestone-engine-v5-diagnosis.md) — milestone engine v5 audit + 12 fixes.
- [`done/toast-system-build-log.md`](done/toast-system-build-log.md) — `useAgentToast` build log.
- [`done/copy-audit-overlays.md`](done/copy-audit-overlays.md) — overlay voice/phrasing audit (2026-05-19).
- [`done/hub-analytics-audit.md`](done/hub-analytics-audit.md) — Hub + Analytics Phase 0 audit.
- [`done/agent-pages-audit.md`](done/agent-pages-audit.md) — Work Queue / To-Do / Solicitors Phase 0 audit.
- [`done/email-arc/`](done/email-arc/) — chain notification email arc.
- [`done/new-sale-flow-v2/`](done/new-sale-flow-v2/) — new sale creation flow v2 (spec + 2 redesign plans + build plan + completion report).
- [`done/dashboard-rebuild/`](done/dashboard-rebuild/) — internal-staff dashboard rebuild (discovery + walkthrough + arc-completion).
- [`done/role-coverage/`](done/role-coverage/) — role-coverage arc (10 per-page audits + completion report + 3 ROLE_*.md prereq audits).
- [`done/withdrawal-cascade/`](done/withdrawal-cascade/) — withdrawal cascade fixes (stages 1+2).
- [`done/refresh-reports/`](done/refresh-reports/) — page-refresh shipped reports (analytics, completions, reminders, my-files).
- [`done/mobile-stages/`](done/mobile-stages/) — mobile responsive arc (3 stages + audit + screenshots/).
- [`done/retention-emails/`](done/retention-emails/) — retention email system (phase 0 + implementation).

---

## `reference/` — always-live guides

Background docs that inform decisions but aren't themselves changing.

- [`reference/PRODUCT_TRUTH.md`](reference/PRODUCT_TRUTH.md) — what the codebase actually does (grounding for marketing).
- [`reference/MARKETING_BRIEF.md`](reference/MARKETING_BRIEF.md) — marketing site brief.
- [`reference/DATA_PROCESSING_OVERVIEW.md`](reference/DATA_PROCESSING_OVERVIEW.md) — personal-data inventory.
- [`reference/AGENT_SECURITY.md`](reference/AGENT_SECURITY.md) — agency data isolation rules.
- [`reference/OPEN_QUESTIONS.md`](reference/OPEN_QUESTIONS.md) — design decisions log.
- [`reference/DESIGN_REVIEW.md`](reference/DESIGN_REVIEW.md) — Apple HIG audit (historical).
- [`reference/FUTURE_FEATURES.md`](reference/FUTURE_FEATURES.md) — aspirational only; not source of truth.
- [`reference/milestone-list.md`](reference/milestone-list.md) — milestone enumeration.

---

## Topic folders (unchanged — heavy inter-doc cross-references, sometimes code-coupled)

- [`admin/`](admin/) — Command Centre product spec (ADMIN_01–10 + discovery prompt).
- [`audits/`](audits/) — standalone investigation reports (chain-system, overlays, claim-flow proposals).
- [`chain-feature/`](chain-feature/) — 10-part chain reference series (overview → claim-flow → stability guarantees).
- [`chase-generation/`](chase-generation/) — Chase AI corpus (VOICE_CORPUS, MILESTONE_GLOSSARY, CHANGELOG). `MILESTONE_GLOSSARY.md` is parsed at runtime by `lib/chase/milestone-glossary.ts`.
- [`help/`](help/) — help system + raw discovery notes.
- [`milestone-email-matrix/`](milestone-email-matrix/) — milestone × email-template matrix index.
- [`polish-pass/`](polish-pass/) — page-by-page polish workflow + inventory. Several files code-referenced.

---

## `meta/` — housekeeping

Build-time prompts, legacy archive, changelog entries. Low-traffic.

- `meta/cc-prompt-*.md` — retired Claude Code build prompts.
- `meta/product-strategy-notes.md` — historical strategy thinking.
- `meta/cleanup-2026-05-07.md` — earlier cleanup record.
- `meta/pre-launch-checklist.md`, `meta/style-claude-code-prompt.md`, `meta/copy-of-jonos-claude-md.md` — archived references.
