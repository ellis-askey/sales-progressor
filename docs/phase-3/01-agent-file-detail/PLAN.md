# Phase 3 · Surface 1 · Agent File Detail · Remediation Plan

**Companion to:** [BASELINE.md](BASELINE.md) (what the surface looks like today) and [AUDIT.md](AUDIT.md) (every gap mapped against DoD).
**Status:** **APPROVED 2026-06-30.** Founder signed off on all five questions as-is. Gate is open. Wave A1 ships next session.
**Drafted:** 2026-06-29. **Approved:** 2026-06-30.

## Sign-off record

| Decision | Founder answer |
|---|---|
| PR sequence (Wave A bundled, Wave B individual, Wave C voice) | **Approved as-is** — 14 PRs total |
| Three grandfathered files (RelistFileModal, ReconciliationDrawer, EditSaleDetailsDrawer) | **Approved all three** — filed in [POLISH_TBD.md "Phase 3 Surface 1 grandfathers"](../../POLISH_TBD.md#phase-3-surface-1-grandfathers-file-detail-remediation) |
| Feature flag `CANONICAL_FILE_DETAIL_V2` | **Dual-render + per-agency rollout** (Akeman first, 48h, then global) |
| Rollout pace (per-agency staged) | **Approved** — Akeman 48h monitor before global |
| Cadence (8 sessions / ~2 weeks) | **Approved** — default plan |

This plan is the **hard gate** before any code touches the surface. Once you approve, we ship the migration PRs in order. Anything that varies from this plan during implementation comes back to you for re-approval.

---

## TL;DR

We're going to migrate the file-detail surface to use the 8 canonical primitives that just shipped in Phase 2. The work is mostly mechanical (class swaps) — but the 5 highest-risk pieces (RelistFileModal, ReconciliationDrawer, EditSaleDetailsDrawer, plus the big panel rewrites) I'd rather grandfather than force, per Law 19.

**No customer-facing behaviour changes. No regressions.** The surface will look ~identical at the end; the difference is that every UI element will be a documented canonical primitive instead of inline classes.

**Estimated:** 8 sessions across ~2 weeks. **12-13 PRs**, each behind the same feature flag for staged rollout.

---

## What's actually changing

In plain English:

- **The cards** (sidebar panels, recent activity, contacts list, etc.) — each gets swapped from `<div class="glass-card ...">` to `<Card>`. Visual: identical. Behaviour: identical. Code: cleaner.

- **The buttons** (Cancel / Save / Confirm in modals, action buttons in panels, status pills in StatusControl) — each swapped from `<button class="agent-btn ...">` to `<Button variant="...">`. Same logic.

- **The accordions** (Reminders sections like Pending / Sent today / Upcoming, To-Do sections, AutomatedEmailsCard expand/collapse) — swapped from raw `agent-acc-*` classes + manual `useState` to `<Accordion>` with full ARIA support.

- **The modals and drawers** (8 of them: UndoMilestone, AddBroker, AddFirm, AutomationStop, ClaimWelcome, SwitchServiceType, Mortgage, SurveyNrConfirm, ArchivedRoundDrawer) — swapped from bespoke `createPortal` + manual escape/focus/scroll-lock to `<Modal>` or `<Drawer>`. Same UX.

- **The skeletons** (loading states for the sidebar and tab panels) — kept as bespoke composers but the individual pulsing rows inside swap to `<Skeleton>` primitive.

- **The strings** — one bundled voice-pass at the end against [VOICE.md](../../reference/VOICE.md). Remove em-dashes from prose, replace "the system" with "we'll", drop any banned hedging.

## What I'm proposing to grandfather (locked Law 19 calls)

Three pieces I do NOT want to migrate during this surface remediation. They each carry behavioural risk that outweighs the consistency gain:

| File | Why grandfather |
|---|---|
| [components/transaction/RelistFileModal.tsx](../../../components/transaction/RelistFileModal.tsx) | Multi-stage form with branching paths for chain vs no-chain, onward sale options, and stub-link creation. Migrating to `<Modal>` while preserving every form state branch is fiddly. Defer to a dedicated future PR with its own baseline + plan. |
| [components/milestones/ReconciliationDrawer.tsx](../../../components/milestones/ReconciliationDrawer.tsx) | Reconciliation flow has unique business logic (per-milestone reconcile checkbox, commit-all rollback path, post-commit ExchangeCelebration handoff). Behavioural diff risk is high. |
| [components/transaction/EditSaleDetailsDrawer.tsx](../../../components/transaction/EditSaleDetailsDrawer.tsx) | Per-section unsaved-state with three-option close prompt (Save all / Discard / Keep editing). Complex composer that doesn't fit `<Drawer>` cleanly without the prompt logic spilling into the primitive. |

These three keep their bespoke implementations. Each gets:
- A `// canonical: ../../components/ui/Modal.tsx — migrate when next touched` marker
- A POLISH_TBD entry with `decision: grandfather` and the reason
- Their bespoke pattern stays documented as an outlier in MODAL_DRAWER_SYSTEM.md

If your call is different — that we should force-migrate one or all of these — say so and I revise.

## What's NOT in this remediation

To be explicit:

- New-sale form (`transactions-v2/`) — separate Phase 3 surface
- The Sidebar's chain-link UI — chain arc owns this
- ExchangeCelebration full-screen overlay — bespoke exception per spec
- RoundChip flip animation — locked grandfather from Phase 0
- `PanelSkeletons.tsx` overall structure — wraps `<Skeleton>` internally, not subsumed
- Any data-layer changes — pure presentation
- Any new features — Law 5 (one concern per PR)

---

## PR sequence (proposed)

12-13 PRs, each behind the `CANONICAL_FILE_DETAIL_V2` env flag, default off, per-agency rollout via flag-flip.

### Wave A — Low-risk panel migrations (bundled to ~4 PRs)

| PR | Bundle | Scope | Risk |
|---|---|---|---|
| A1 | PropertyHero + SidebarPanel | glass-card → Card on hero + 8 sidebar cards | Low — visual identical, no logic |
| A2 | OverviewPanel + ActivityPanel | glass-card → Card on tab body cards + inline empty → EmptyState where it fits | Low |
| A3 | StepsPanel + ToDoPanel | agent-btn → Button on milestone confirm controls + agent-acc → Accordion on ToDo sections | Low |
| A4 | RemindersPanel + AutomatedEmailsCard + PanelSkeletons | agent-acc → Accordion on all sections + Skeleton primitive in panel skeletons | Low-medium (AutomatedEmailsCard has more state) |

### Wave B — Modal/Drawer migrations (individual, smaller-first)

| PR | File | Risk | Notes |
|---|---|---|---|
| B1 | UndoMilestoneModal | Low | Simple confirm modal, smallest scope |
| B2 | AddBrokerModal | Medium | Form modal, the canonical reference pattern per MODAL_DRAWER_SYSTEM |
| B3 | AddFirmModal | Medium | Same pattern as AddBroker |
| B4 | AutomationStopModal | Low | Simple confirmation |
| B5 | SwitchServiceTypeModal | Low | Simple confirmation |
| B6 | ClaimWelcomeModal | Low | Onboarding, low-stakes |
| B7 | MortgageModal | Medium | Form modal with several fields |
| B8 | SurveyNrConfirmModal | Low | Has known grandfathered inline hover state — preserve |
| B9 | ArchivedRoundDrawer | Medium | Read-only drawer, low logic risk |

### Wave C — Voice sweep (1 PR)

| PR | Scope | Notes |
|---|---|---|
| C1 | Voice-pass every user-facing string on the surface | Single commit, strings-only, tsc clean per DoD gate 7 |

### Grandfathered (NOT in this remediation)

- RelistFileModal
- ReconciliationDrawer
- EditSaleDetailsDrawer

Filed in POLISH_TBD with `decision: grandfather` and a re-evaluation date at the next quarterly review.

---

## Per-PR workflow

Each PR follows the same template:

1. **Pre-flight (5 min):** read the file we're about to touch. Confirm no other PR is mid-flight on it.
2. **Migration (15-30 min):** swap raw classes for primitives, hand-rolled per Law 16. No bulk regex.
3. **`npx tsc --noEmit`** — must be clean.
4. **Local visual check:** render the surface, click through the migrated component. Compare against the baseline screenshot in `screenshots/before/`.
5. **Behavioural check:** if the component has interactions (button click, modal open, accordion toggle), exercise each path manually.
6. **E2E sentinel:** `npx playwright test e2e/surface-file-detail.spec.ts` — must pass when creds are configured (skips cleanly otherwise).
7. **Multi-tenant safety:** `npx jest __tests__/multi-tenant` — must pass (catches accidental drops of access-scope filtering).
8. **Commit + push master + merge to staging + push staging.**
9. **Post-PR screenshot:** re-run `npx playwright test e2e/baseline-file-detail.spec.ts` (when creds set) — captures the post-migration state.
10. **Brief PR report:** what changed, what stayed, screenshot diff status, any behaviour observation.

For Wave A bundled PRs: same workflow but multiple files in one PR. The bundling rule is "no behavioural overlap between files in the same PR." A1 (PropertyHero + SidebarPanel) is safe because they touch different surfaces of the page.

---

## Feature flag rollout

**Flag name:** `CANONICAL_FILE_DETAIL_V2`
**Default:** off in production.
**Mechanism:** server-side env check at the page level. When off, the existing surface renders. When on, the migrated components render.

**Implementation:** a single conditional at the top of the file-detail page that picks the canonical primitive path or the legacy path. Each PR migrates ONE side of the conditional. Once Wave A completes, we flip the flag to ON for **one agency** (Akeman) and monitor. If clean for 48h, flip globally.

This is more conservative than typical migrations because we explicitly committed to "no regression."

**Note:** if implementation reveals the dual-render approach adds more complexity than it saves (e.g. for low-risk panels), we can downgrade to a "ship and watch" approach with a quick-revert plan. I'll surface this case-by-case if it comes up.

---

## Exit criteria (when is surface 1 DONE)

The surface is **done** when ALL of these are true:

1. **All Wave A + Wave B + Wave C PRs shipped** (or grandfather entries filed for any deferred items)
2. **Visual diff clean** — re-running `e2e/baseline-file-detail.spec.ts` produces post-migration screenshots that look identical to before/ (or any diff is explained in a PR)
3. **E2E happy-path green** — `e2e/surface-file-detail.spec.ts` passes against the staging test director
4. **Multi-tenant safety green** — `__tests__/multi-tenant/access-scope-coverage.test.ts` passes
5. **`tsc --noEmit` clean**
6. **Founder walk** — you spend 10 min on the migrated surface on staging, click through each tab, open each modal/drawer, confirm nothing feels off
7. **Feature flag flipped globally** — `CANONICAL_FILE_DETAIL_V2=true` in production env
8. **Status marked DONE** in [BUILD_PLAN.md](../../BUILD_PLAN.md) Phase 3 table

Only after exit criteria 1-6 do we flip the flag in production (criterion 7).

---

## Risks & how I'll mitigate

| Risk | Mitigation |
|---|---|
| Modal migration breaks subtle behaviour (focus, scroll, z-index) | Per-modal manual click-through after each B PR. E2E sentinel catches regressions of the happy path. |
| Visual diff fails on backdrop-blur rendering differences | Acceptable visual diff threshold is documented in each gallery spec (0.5%). For surface screenshots we eyeball the diffs case-by-case rather than enforce a pixel-perfect threshold. |
| Voice sweep introduces accidental copy regressions | Sweep is its own PR (C1), single commit, strings-only. Reviewed file-by-file before merge per DoD gate 7. |
| Per-section unsaved-state in EditSaleDetailsDrawer can't be cleanly preserved | Grandfathered. Out of scope for this remediation. |
| Feature flag fails to gate cleanly | Per-PR test on a real consumer with the flag both on and off before merging. |
| Surface unexpectedly breaks for one agency post-rollout | Per-agency rollout means we flip Akeman first, monitor 48h, then global. Per-agency revert is a single env edit. |

---

## Sign-off

Recorded at top of doc. All five questions approved as-is on 2026-06-30. **Gate open.** Wave A1 (PropertyHero + SidebarPanel `glass-card` → `Card` migration) is the next code change.
