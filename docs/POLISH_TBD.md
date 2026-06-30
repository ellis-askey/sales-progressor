# Polish Backlog

The single ledger for deferred polish items. Referenced by [Law 5 (one concern per PR)](../CLAUDE.md#law-5--one-concern-per-pr) and [Law 19 (grandfather generously)](../CLAUDE.md#law-19--grandfather-generously). Adjacent docs keep their existing roles:

| Doc | Keeps | What POLISH_TBD does instead |
|---|---|---|
| [active/TODO.md](active/TODO.md) | Technical roadmap. Planned work. Phase arcs. | — |
| [POST_LAUNCH_FIXES.md](POST_LAUNCH_FIXES.md) | Bug log. Issues found and fixed. | — |
| [active/ELLIS_MANUAL_TODO.md](active/ELLIS_MANUAL_TODO.md) | Manual ops requiring founder action. | — |
| **POLISH_TBD.md** | — | **Deferred polish items with tracked decisions** |

---

## What goes in here

A polish item is something noticed but not yet fixed, where:

- It's not a bug (the system works, but the polish is missing)
- It's not a planned feature (it's a quality gap, not a roadmap item)
- It's not blocked on founder action (that's ELLIS_MANUAL_TODO)
- It has an explicit **decision**: migrate / grandfather / defer (with date)

Every entry gets a tracked decision. No silent drops. This is the doc that stops "we'll come back to that" from becoming "we never came back to that."

Examples:
- "Modal X doesn't use the canonical Modal primitive"
- "Empty state on screen Y is plain text instead of using `EmptyState`"
- "Banner Z has em-dashes in copy"
- "Sidebar field A says 'Awaiting exchange' but should match the verb tense of the surrounding fields"
- "Hover state on the round-chip is missing on mobile"

What does NOT go in here:
- Bugs (those go to POST_LAUNCH_FIXES.md)
- Roadmap items (those go to TODO.md)
- Manual ops (those go to ELLIS_MANUAL_TODO.md)
- Items that are about to be fixed in the current PR (just fix them)

---

## Format

Each entry is a row in the table below. Five fields per row:

| Field | What it captures |
|---|---|
| **Surface** | The route or component the polish item lives on |
| **Opportunity** | One-line description of what's missing or wrong |
| **Decision** | `migrate` / `grandfather` / `defer-Qx` / `tbd` |
| **Filed** | YYYY-MM-DD the item was added |
| **Notes** | Free-text. Link to PR / commit / discussion if relevant |

The `Decision` field must be set when the item is added. `tbd` is acceptable for a brief window (next quarterly review) — beyond that, the item gets a real decision or it gets removed.

---

## Decision vocabulary

- **`migrate`** — actively planned for remediation. Linked to a BUILD_PLAN phase or a near-term PR.
- **`grandfather`** — known wrong, not safe to change without behavioural risk. Sits here as a permanent record; reviewed quarterly.
- **`defer-Qx`** — defer until the named quarter (e.g. `defer-Q3-2026`). Re-evaluated at that quarter's start.
- **`tbd`** — decision not yet made. Allowed for at most one quarter.
- **`closed`** — item is now resolved (PR landed, component migrated, copy fixed). Move to the bottom "Closed" section with the resolution PR link.

---

## Backlog

### Visual / component-canonicalisation polish

| Surface | Opportunity | Decision | Filed | Notes |
|---|---|---|---|---|
| 56 files using `glass-card` utility class | Migrate to canonical `Card` primitive (per [COMPONENT_LIBRARY_CATALOG §2.1](reference/COMPONENT_LIBRARY_CATALOG.md#21-card--highest-priority)) | migrate | 2026-06-26 | Phase 2 of BUILD_PLAN, Week 1 |
| 54 files using `agent-btn` class | Migrate to canonical `Button` primitive | migrate | 2026-06-26 | Phase 2, Week 2 |
| 18 bespoke `*Modal.tsx` files | Migrate to canonical `Modal` primitive | migrate | 2026-06-26 | Phase 2, Week 3-4 |
| 12 bespoke `*Banner.tsx` files | Migrate to `AgentBanner` (extending props as needed) | migrate | 2026-06-26 | Phase 2, Week 2-3 |
| 6 bespoke `*Drawer.tsx` files | Migrate to canonical `Drawer` primitive | migrate | 2026-06-26 | Phase 2, Week 4-5 |
| 15 files using `agent-acc-*` classes | Migrate to canonical `Accordion` primitive | migrate | 2026-06-26 | Phase 2, Week 5 |
| `transactions/` vs `transactions-v2/` parallel implementations | Decommission v1 once v2 is fully promoted | grandfather | 2026-06-26 | Existing arc; track separately in TODO.md |
| `PanelSkeletons.tsx` inline pulse implementation | Migrate to canonical `Skeleton` primitive | defer-Q3-2026 | 2026-06-26 | Bundle with file-detail Phase 3 remediation |
| Form fields use raw HTML elements with bespoke styling | Extract `Field` / `Input` / `Select` / `TextArea` primitives | defer-Q3-2026 | 2026-06-26 | Designed from real consumer (Phase 3) rather than in vacuum |
| Inline empty states across 4+ surfaces | Migrate to canonical `EmptyState` (already exists) | migrate | 2026-06-26 | Phase 2 sweep |

### Voice / copy polish

| Surface | Opportunity | Decision | Filed | Notes |
|---|---|---|---|---|
| Codebase-wide em-dash sweep in prose strings | Replace em-dashes in `.tsx` / `.ts` strings outside comments with commas / colons / full stops | migrate | 2026-06-26 | Mechanical sweep + voice-pass per surface during Phase 3 |
| `RemindersSection.tsx:731` "Chased — next in {n} days" toast | Em-dash separator in a toast. Known outlier per VOICE.md | grandfather | 2026-06-26 | Listed in VOICE.md as grandfathered. Quarterly review |
| Multiple comm composition strings reference "the system" | Replace with "we'll" / passive voice per VOICE.md | migrate | 2026-06-26 | Sweep alongside em-dash pass |
| Several email subject lines mix em-dash and colon as separators | Standardise on em-dash per VOICE.md (subject lines exempt from ban) | migrate | 2026-06-26 | Voice-pass during chain-email arc continuation |
| Some milestone copy uses "round" as a user-facing noun | Replace with "sale" per 2026-06-04 terminology sweep | defer-Q3-2026 | 2026-06-26 | Audit which strings still reference "round" |
| Several admin-only modal CTAs use "Delete" instead of "Remove" | Replace per VOICE.md | migrate | 2026-06-26 | Sweep during admin surface remediation |

### State coverage polish

| Surface | Opportunity | Decision | Filed | Notes |
|---|---|---|---|---|
| Hub diary | Loading state is generic skeleton; could match the final-shape diary rows for less layout shift | defer-Q3-2026 | 2026-06-26 | Bundle with Hub Phase 3 |
| Portal "Helpful to know" tip cards | First-time state (zero tips would just hide; could show "We'll share tips here as your sale progresses") | defer-Q3-2026 | 2026-06-26 | Bundle with portal Phase 3 |
| File detail Activity tab | Error state when timeline fetch fails is generic | defer-Q3-2026 | 2026-06-26 | Bundle with file-detail Phase 3 |
| AutomatedEmailsCard "paused" state | Has a clear paused state but the visual treatment is fine-as-is; consider whether a stronger "paused" affordance helps agents recognise at a glance | tbd | 2026-06-26 | Discuss before Phase 3 |
| Several surfaces show "—" or "Not set" for null fields | Mixed convention (some surfaces use "—", others "Not set", others italicised "Awaiting exchange") | migrate | 2026-06-26 | Unify during VOICE pass |

### Hover / focus / active polish

| Surface | Opportunity | Decision | Filed | Notes |
|---|---|---|---|---|
| Card hover states inconsistent across consumers | Canonical `Card` primitive will solve this | migrate | 2026-06-26 | Phase 2 |
| `agent-btn` focus ring inconsistent on mobile (touch focus differs from keyboard focus) | Canonical `Button` will normalise | migrate | 2026-06-26 | Phase 2 |
| Several inline `<button>` tags in tables have no hover treatment | Sweep during table-row remediation | defer-Q3-2026 | 2026-06-26 | Bundle with surface Phase 3 |
| Hover-reveal `RoundChip` 3D flip works on desktop, not on touch | Add tap variant for touch devices | defer-Q3-2026 | 2026-06-26 | Bundle with file-detail Phase 3 |

### Mobile (375px) polish

| Surface | Opportunity | Decision | Filed | Notes |
|---|---|---|---|---|
| Hub diary at 375px | Two-column layout breaks. Stacks but the "1 event today" badge falls below the title | defer-Q3-2026 | 2026-06-26 | Bundle with Hub Phase 3 |
| File detail tabs | Horizontal scroll on narrow viewports; tab labels truncate | defer-Q3-2026 | 2026-06-26 | Bundle with file-detail Phase 3 |
| `EditSaleDetailsDrawer` at 375px | Form fields overflow; date pickers don't shrink | defer-Q3-2026 | 2026-06-26 | Bundle with Drawer canonicalisation |

### Open follow-ups (pulled from POST_LAUNCH_FIXES.md)

| Surface | Opportunity | Decision | Filed | Notes |
|---|---|---|---|---|
| `/agent/polish/*` and `/agent/audit/*` reachable in production | Gate behind feature flag or middleware deny-list | migrate | filed 2026-06-05 | Existing entry; tracked from POST_LAUNCH_FIXES.md |
| `/agent/settings` redirect | Confirm nothing in email templates or retention copy still references the bare path | migrate | filed 2026-06-05 | Existing entry |
| Predicted exchange date doesn't recalibrate in first week | Edge case from `B5 (partial)` in POST_LAUNCH_FIXES.md. Behavioural improvement, not a bug | defer-Q3-2026 | filed 2026-04-? | Existing entry |

### Multi-tenant scope review (Phase 1)

| Surface | Opportunity | Decision | Filed | Notes |
|---|---|---|---|---|
| `app/api/notifications/portal/route.ts` | Counts ALL portal-originated internal notes platform-wide for the SP bell. Allowlisted in `__tests__/multi-tenant/access-scope-coverage.test.ts`. Review whether the count should be scoped per agency for non-superadmin SPs | tbd | 2026-06-26 | Surfaced by Phase 1 multi-tenant test |

### From this session's audits (June 2026)

| Surface | Opportunity | Decision | Filed | Notes |
|---|---|---|---|---|
| RoundChip "Sale N with X · fell through" | Date suffix dropped because no `tx.withdrawnAt` exists. Add the field + show date | defer-Q3-2026 | 2026-06-17 | Mentioned in RoundChip fix commit message |
| `expectedExchangeDate` semantically conflates "12-week target placeholder" and "user-set forecast" | Consider splitting into two fields, or always treating the default as an unset signal | defer-Q3-2026 | 2026-06-25 | Surfaced during Hub diary fix |
| `tx.completionDate` shown as "Awaiting exchange" pre-exchange — verb tense matches "Awaiting" but neighbour fields are noun-tense | Unify with rest of sidebar's voice (e.g. "Not set until exchange") | tbd | 2026-06-19 | Voice-pass during file-detail Phase 3 |
| Portal tip cards desktop / mobile layout uses `flex gap-3 overflow-x-auto` (horizontal scroll) | Reconsider whether horizontal scroll is the right gesture or vertical-stack is more discoverable | tbd | 2026-06-19 | Bundle with portal Phase 3 |

### Phase 3 Surface 1 grandfathers (file-detail remediation)

| Surface | Opportunity | Decision | Filed | Notes |
|---|---|---|---|---|
| [components/transaction/RelistFileModal.tsx](../components/transaction/RelistFileModal.tsx) | Migrate to canonical `Modal` primitive | grandfather | 2026-06-29 | Multi-stage form with branching paths for chain vs no-chain, onward sale options, and stub-link creation. Migration during Phase 3 Surface 1 carries unacceptable behavioural-diff risk. Per [PLAN.md §"What I'm proposing to grandfather"](phase-3/01-agent-file-detail/PLAN.md). Re-evaluated next quarterly review (2026-09-26) |
| [components/milestones/ReconciliationDrawer.tsx](../components/milestones/ReconciliationDrawer.tsx) | Migrate to canonical `Drawer` primitive | grandfather | 2026-06-29 | Reconciliation flow has unique business logic (per-milestone reconcile checkbox, commit-all rollback path, post-commit ExchangeCelebration handoff). Behavioural-diff risk too high to bundle into Phase 3 Surface 1. Re-evaluated 2026-09-26 |
| [components/transaction/EditSaleDetailsDrawer.tsx](../components/transaction/EditSaleDetailsDrawer.tsx) | Migrate to canonical `Drawer` primitive | grandfather | 2026-06-29 | Per-section unsaved-state with three-option close prompt (Save all / Discard / Keep editing). Composer pattern doesn't fit `<Drawer>` cleanly without prompt logic spilling into the primitive. Re-evaluated 2026-09-26 |
| [components/transaction/RecentActivityWidget.tsx](../components/transaction/RecentActivityWidget.tsx) "No activity yet" inline empty | Migrate to `EmptyState compact` | grandfather | 2026-06-30 | EmptyState compact mode (icon + py-6 + sm font) is visually heavier than the existing 12px italic muted text. Adopting it would regress the dense list affordance. Surfaced during Wave A2. Re-evaluated 2026-09-26 |
| [components/milestones/MilestonePanel.tsx](../components/milestones/MilestonePanel.tsx) section + Skipped accordion headers | Migrate to canonical `Accordion.Header` | grandfather | 2026-06-30 | Existing headers are two-zone (left: dot + label, right: badge + chevron). `Accordion.Header` wraps children in a single flex container + appends its own CaretDown chevron — would break the two-zone layout. Primitive API gap. Surfaced during Wave A3. Re-evaluated 2026-09-26 once `Accordion.Header` supports `leading` / `trailing` slots or a `noWrap` opt-out |
| [components/todos/ManualTaskList.tsx](../components/todos/ManualTaskList.tsx) "Done" inline accordion body | Migrate to canonical `Accordion.Body` | grandfather | 2026-06-30 | The toggle is an external "Show N done / Hide done" link sibling, not a clickable header on the body. `Accordion` compound API assumes Header + Body coupled. Primitive API gap (headless body). Surfaced during Wave A3. Re-evaluated 2026-09-26 |
| [components/todos/AddManualTaskForm.tsx](../components/todos/AddManualTaskForm.tsx) "+ Add task" button | Migrate to canonical `Button` | grandfather | 2026-06-30 | Uses `agent-btn-ghost-bordered` — variant not exposed by `Button` primitive (variants today: primary/secondary/ghost/danger). Adding `ghost-bordered` to the variant union is straightforward but it's a primitive-surface change not in this remediation's scope. Surfaced during Wave A3. Re-evaluated 2026-09-26 |

### Architectural / process polish

| Surface | Opportunity | Decision | Filed | Notes |
|---|---|---|---|---|
| `scripts/` dir at 155 files | Cull to ~15, promote diagnostics to admin pages, kill one-offs | migrate | 2026-06-26 | Phase 4 of BUILD_PLAN |
| No `/dev/gallery` route | Build during Phase 2 as the primitive acceptance harness | migrate | 2026-06-26 | Phase 2 deliverable |
| No pre-commit hook for Laws 13/14/15/20/21 | Wire up in Phase 5 (warn-only for 2 weeks first) | migrate | 2026-06-26 | Phase 5 deliverable |
| Visual + behavioural regression in CI | Build harness in Phase 1 | migrate | 2026-06-26 | Law 18; precondition for safe migration |

---

## Closed

(Empty at draft time. Resolved entries move here with a PR link and resolution date.)

---

## Quarterly review

Every quarter (Q1 = Jan-Mar, Q2 = Apr-Jun, etc.), the founder + assistant walk this doc:

- **`tbd` items** must get a real decision or be removed.
- **`defer-Qx` items** whose quarter has arrived get re-evaluated. Either move to `migrate` (planned for the new quarter) or `defer-Q<next>` with reason.
- **`grandfather` items** are spot-checked. Have they become safer to migrate? Have new patterns emerged that change the calculus?
- **`migrate` items not yet closed** — flag risk that they're not making progress.

Next review: **2026-09-26** (Q3 review).

---

## Maintenance rules

1. Every closed `migrate` item gets a row in the "Closed" section with PR link + date. Don't delete.
2. When the assistant declines to fix something noticed during other work (because Law 5 — one concern per PR), the temptation goes here as a row.
3. Decisions are durable. If a `grandfather` becomes a `migrate`, append a "decision-change: <date>" note to the Notes column. Don't rewrite history.
4. The doc never falls below 80% non-empty `Decision` fields. If `tbd` count creeps up, the quarterly review pulls it back.
5. New entries from CC sessions get an annotation: "filed by CC during <task>". So decisions made in passing can be traced back.

---

## Decisions locked at Phase 0 sign-off (2026-06-26)

- **Decision vocabulary:** five values (`migrate` / `grandfather` / `defer-Qx` / `tbd` / `closed`). Locked.
- **Review cadence:** quarterly. Next review **2026-09-26**.
- **`tbd` window:** one quarter maximum. Any `tbd` item older than one quarter at the review either gets a real decision or is removed.

---

## Footnotes

- Companion docs: [CLAUDE.md Laws](../CLAUDE.md#laws), [reference/COMPONENT_LIBRARY_CATALOG.md](reference/COMPONENT_LIBRARY_CATALOG.md), [BUILD_PLAN.md](BUILD_PLAN.md).
- Last updated: 2026-06-26 (Phase 0 sign-off).
