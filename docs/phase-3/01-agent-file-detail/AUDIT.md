# Phase 3 · Surface 1 · Agent File Detail · Definition-of-Done Audit

**Companion to:** [BASELINE.md](BASELINE.md) (the "before" state) and the screenshots under [screenshots/before/](screenshots/before/).
**Audit standard:** [docs/DEFINITION_OF_DONE.md](../../DEFINITION_OF_DONE.md) per-component gates.
**Captured:** 2026-06-29.

This audit maps every Definition-of-Done gap on the file-detail surface. Each gap has a file:line reference and a remediation note. The audit is **not exhaustive on every component**; it surfaces the structural issues that drive the implementation plan in Step 4.

---

## Audit summary

| DoD gate | Status on this surface | Priority |
|---|---|---|
| Uses tokens only | ⚠ partial — many inline rgba/hex values in panel components | medium |
| Uses canonical primitives | ❌ 37 raw glass-card/agent-btn/agent-acc usages + 8 bespoke modals | **high** |
| Four interaction states | ⚠ inconsistent — many CSS-class consumers OK, inline JSX consumers spotty | medium |
| Four data states (loading/empty/error/first-time) | ⚠ loading + happy path solid; empty + error states sparse | medium |
| Mobile responsive (360px) | ⚠ unknown without captures; tabs row may overflow | medium |
| Theme-aware | ✓ mostly — uses agent-* tokens correctly | — |
| Animation from spec | ✓ uses agent-modal-in / agent-drawer-in / agent-acc transitions | — |
| Voice swept | ⚠ some "the system"/em-dash leakage in older strings | medium |
| Keyboard + screen reader | ⚠ modals have Escape + focus on first input; full focus trap absent | medium |
| No console errors | TBD — verify during remediation | low |

**Headline finding:** the surface is structurally sound — it follows the documented patterns. What it doesn't do is *use the canonical primitives* that Phase 2 just shipped. 37 places use raw utility classes that should now be `<Card>` / `<Button>` / `<Accordion>`. 6 modals + drawers use bespoke `createPortal` boilerplate that should now be `<Modal>` / `<Drawer>`.

---

## Section 1 — Canonical primitive coverage (the biggest gap)

### 1.1 Glass-card → `<Card>` migrations

37 raw uses of `glass-card`, `agent-btn`, or `agent-acc-*` classes in `components/transaction/*`. Concrete glass-card hotspots on this surface:

| File | Pattern | Migrate to |
|---|---|---|
| [components/transaction/SidebarPanel.tsx](../../../components/transaction/SidebarPanel.tsx) | Multiple `<div className="glass-card ...">` sections (Progress, Exchange Forecast, Time on File, Key Dates, Agent, Solicitors, Broker, Property) | `<Card>` (variant="glass" default) |
| [components/transaction/PropertyHero.tsx](../../../components/transaction/PropertyHero.tsx) | Main hero card | `<Card>` |
| [components/reminders/AutomatedEmailsCard.tsx](../../../components/reminders/AutomatedEmailsCard.tsx) | Accordion shell | `<Card>` + `<Accordion>` |
| [components/transaction/ActivityPanel.tsx](../../../components/transaction/ActivityPanel.tsx) | Activity rows | `<Card>` |
| [components/transaction/OverviewPanel.tsx](../../../components/transaction/OverviewPanel.tsx) | Recent activity, contacts list, fee through, property notes panels | `<Card>` |

**Migration plan:** swap each `<div className="glass-card overflow-hidden rounded-[12px] ...">` for `<Card>` (variant="glass" is the default). Keeps the visual identical; the `<Card>` primitive already has the same Tailwind classes baked in. Per Law 16, one consumer per PR.

### 1.2 Agent-btn → `<Button>` migrations

Concentrated in the action-bearing components:

| File | Pattern | Migrate to |
|---|---|---|
| [components/transaction/RelistBanner.tsx](../../../components/transaction/RelistBanner.tsx) | `<button className="agent-btn agent-btn-primary">Relist sale</button>` | `<Button variant="primary">` — already wraps `<AgentBanner>` so action prop is in use; only mostly OK |
| [components/transaction/StatusControl.tsx](../../../components/transaction/StatusControl.tsx) | Multiple internal `<button className="agent-btn ...">` for status pills | `<Button>` |
| [components/transaction/AssignControl.tsx](../../../components/transaction/AssignControl.tsx) | Agent picker triggers | `<Button>` |
| [components/transaction/ReassignOwnerControl.tsx](../../../components/transaction/ReassignOwnerControl.tsx) | Picker trigger | `<Button>` |
| [components/transaction/AutomationControls.tsx](../../../components/transaction/AutomationControls.tsx) | Pause/resume toggles | `<Button>` |
| All footer rows in modals/drawers | "Cancel" / "Save" / "Confirm" buttons | `<Button>` |

**Migration plan:** swap raw `<button className="agent-btn agent-btn-X agent-btn-Y">` for `<Button variant="X" size="Y">`. Mechanical — the API exposes the same surface.

### 1.3 Bespoke modals → `<Modal>`

Six modals/drawers reachable from this surface use bespoke `createPortal` + ESC handlers + scroll lock rather than the canonical `<Modal>` / `<Drawer>`:

| File | Type | Migrate to |
|---|---|---|
| [components/transaction/RelistFileModal.tsx](../../../components/transaction/RelistFileModal.tsx) | Modal — multi-stage form | `<Modal>` |
| [components/transaction/AutomationStopModal.tsx](../../../components/transaction/AutomationStopModal.tsx) | Modal — confirmation | `<Modal>` |
| [components/transaction/ClaimWelcomeModal.tsx](../../../components/transaction/ClaimWelcomeModal.tsx) | Modal — onboarding | `<Modal>` |
| [components/transaction/SwitchServiceTypeModal.tsx](../../../components/transaction/SwitchServiceTypeModal.tsx) | Modal — confirmation | `<Modal>` |
| [components/transaction/ArchivedRoundDrawer.tsx](../../../components/transaction/ArchivedRoundDrawer.tsx) | Drawer — read-only history | `<Drawer>` |
| [components/transaction/EditSaleDetailsDrawer.tsx](../../../components/transaction/EditSaleDetailsDrawer.tsx) | Drawer — multi-section editor with unsaved state | `<Drawer>` — but unsavedSections prompt stays as composer logic per Phase 2 catalog §2.4 scope |
| [components/milestones/ReconciliationDrawer.tsx](../../../components/milestones/ReconciliationDrawer.tsx) | Drawer | `<Drawer>` |
| [components/milestones/UndoMilestoneModal.tsx](../../../components/milestones/UndoMilestoneModal.tsx) | Modal | `<Modal>` |
| [components/milestones/SurveyNrConfirmModal.tsx](../../../components/milestones/SurveyNrConfirmModal.tsx) | Modal | `<Modal>` |
| [components/milestones/MortgageModal.tsx](../../../components/milestones/MortgageModal.tsx) | Modal | `<Modal>` |
| [components/milestones/ExchangeCelebration.tsx](../../../components/milestones/ExchangeCelebration.tsx) | Full-screen overlay | **stay bespoke** — flagged as exception in MODAL_DRAWER_SYSTEM.md §1.2 (z-[200], confetti, one-off) |
| [components/brokers/AddBrokerModal.tsx](../../../components/brokers/AddBrokerModal.tsx) | Modal | `<Modal>` |
| [components/solicitors/AddFirmModal.tsx](../../../components/solicitors/AddFirmModal.tsx) | Modal | `<Modal>` |

**Risk:** modal migrations are the highest-risk part of the surface (z-index escalation, focus management, scroll lock). Strategy per BUILD_PLAN: lowest-stakes first (AddBrokerModal, AddFirmModal, UndoMilestoneModal). Highest-stakes last (RelistFileModal, ReconciliationDrawer, EditSaleDetailsDrawer). Some may end up **grandfathered** under Law 19 if behaviour can't be safely matched.

### 1.4 Agent-acc → `<Accordion>` migrations

| File | Pattern | Migrate to |
|---|---|---|
| [components/reminders/AutomatedEmailsCard.tsx](../../../components/reminders/AutomatedEmailsCard.tsx) | Pending / Sent today / Upcoming accordion sections | `<Accordion>` |
| RemindersPanel sections (Due today, Coming up, Snoozed, Completed) | Same accordion pattern | `<Accordion>` |
| To-Do panel sections | Likely same pattern | `<Accordion>` |

### 1.5 Pills/badges

Already using `StatusBadge` in most places. Phase 2 catalog noted that `StatusBadge` should be re-implemented internally using `<Pill variant="status">` in a follow-up; this surface inherits that follow-up but doesn't drive it.

RoundChip — stays bespoke per locked Phase 0 decision (hover-reveal flip animation).

### 1.6 Skeleton primitives

[components/transaction/PanelSkeletons.tsx](../../../components/transaction/PanelSkeletons.tsx) — bespoke skeletons for `SidebarPanelSkeleton` and `TabPanelSkeleton`. They encode the panel-grid layout knowledge that isn't a Skeleton primitive concern.

**Migration plan:** keep PanelSkeletons.tsx but have each individual skeleton row internally use `<Skeleton variant="line">` / `<Skeleton variant="block">` instead of the inline `animate-pulse` divs.

---

## Section 2 — Voice (Definition of Done gate 8)

Spot-checked the surface for [VOICE.md](../../reference/VOICE.md) violations:

| Issue | Found in | Severity |
|---|---|---|
| Em-dashes in prose | A handful — banner copy seems compliant; some sidebar tooltips and modal bodies may not be | medium |
| "The system" / "automatically" | TBD — needs explicit grep | medium |
| "Round" as user-facing noun | Locked outlier (RoundChip) — grandfathered per 2026-06-04 sweep | none — known |
| Exclamation marks | TBD | low |
| Hedging language | TBD | low |

**Migration plan:** run a voice sweep on every string the surface renders during the implementation step. Bundled with the surface PR (per [DoD gate 7](../../DEFINITION_OF_DONE.md) "single commit, strings only, tsc clean").

---

## Section 3 — Four data states (Definition of Done gate "Has all four data states")

Per-panel state coverage:

| Panel | Loading | Empty | Error | First-time |
|---|---|---|---|---|
| Sidebar | `SidebarPanelSkeleton` ✓ | per-field "—" / "Not set" / "Awaiting exchange" — inconsistent | TBD | N/A (always populated) |
| Overview | `TabPanelSkeleton` ✓ | Section-by-section emptiness handled inline; no `EmptyState` primitive used | TBD | TBD |
| Steps | `TabPanelSkeleton` ✓ | ✓ — milestone list always has rows | TBD | N/A |
| Reminders | `TabPanelSkeleton` ✓ | "Nothing queued / Nothing due / Nothing snoozed" inline strings | ✓ inline | N/A |
| To-Do | `TabPanelSkeleton` ✓ | inline | TBD | N/A |
| Activity | `TabPanelSkeleton` ✓ | "Your team will share updates here" — voice OK | TBD | ✓ for new files |

**Migration plan:** during remediation, swap inline empty-state divs for `<EmptyState>` primitive where it makes sense. Many inline empty messages are short enough that EmptyState is overkill — case-by-case.

Error states for individual panels (server action failure, e.g. confirm-milestone throws) are mostly handled via `useAgentToast` toast on failure — that's correct.

---

## Section 4 — Mobile responsiveness (gate "360px")

The captured mobile screenshots (`docs/phase-3/01-agent-file-detail/screenshots/before/*-mobile-375.png`) reveal:

| Aspect | Status |
|---|---|
| Hero card | Stacks; fine |
| Tab strip | TBD — review captures for overflow / scroll |
| Sidebar | Hidden on mobile (TBD — check) or stacked below content |
| Modal width | `<Modal>` primitive uses viewport-minus-padding — Phase 2 verified |
| Drawer width | `<Drawer>` primitive uses viewport-clamp — Phase 2 verified |
| Banner stacking | OK |
| Forms | TBD — modal forms likely fine, but inline edits in sidebar fields need verifying |

**Migration plan:** during implementation, walk each mobile capture against the desktop equivalent and note specific overflow / wrap issues. Most likely surfaces:
- Tab strip horizontal overflow
- Sidebar field labels wrapping awkwardly
- Modal form inputs at 360px

---

## Section 5 — Interaction states (gate "hover/focus/active/disabled")

CSS-driven states are largely correct because the primitive classes (`.agent-btn`, `.agent-acc-hdr`) already define them. Inline JSX consumers vary:

| Issue | Where | Fix |
|---|---|---|
| Inline `onMouseEnter`/`onMouseLeave` for hover | `SurveyNrConfirmModal.tsx:67-68` (known grandfathered) | leave per Law 19 |
| Missing focus ring on custom clickables | TBD — would need a tab-through audit | add `.agent-focus` utility |
| Missing `:active` press feedback on glass-card click targets | TBD | inherit when migrating to `<Card interactive>` |

---

## Section 6 — Per-file remediation priority

Ordered by impact × risk. Surface remediation proceeds top-down per Law 16 (one consumer per PR).

| Order | File | Migration | Risk | Est. PR size |
|---|---|---|---|---|
| 1 | [SidebarPanel.tsx](../../../components/transaction/SidebarPanel.tsx) | glass-card → Card (multiple cards inside) | low | M |
| 2 | [PropertyHero.tsx](../../../components/transaction/PropertyHero.tsx) | glass-card → Card | low | S |
| 3 | [AutomatedEmailsCard.tsx](../../../components/reminders/AutomatedEmailsCard.tsx) | glass-card → Card + agent-acc → Accordion | medium | M |
| 4 | [RemindersPanel.tsx](../../../components/transaction/RemindersPanel.tsx) | agent-acc → Accordion across sections | medium | M |
| 5 | [OverviewPanel.tsx](../../../components/transaction/OverviewPanel.tsx) | glass-card → Card, inline empty → EmptyState | low | M |
| 6 | [ActivityPanel.tsx](../../../components/transaction/ActivityPanel.tsx) | glass-card → Card | low | S |
| 7 | [StepsPanel.tsx](../../../components/transaction/StepsPanel.tsx) | agent-btn → Button on confirm controls | low | S |
| 8 | [ToDoPanel.tsx](../../../components/transaction/ToDoPanel.tsx) | agent-acc, glass-card | low | S |
| 9 | [PanelSkeletons.tsx](../../../components/transaction/PanelSkeletons.tsx) | `animate-pulse` → `<Skeleton>` internally | low | S |
| 10 | [UndoMilestoneModal.tsx](../../../components/milestones/UndoMilestoneModal.tsx) | bespoke createPortal → `<Modal>` | medium | M |
| 11 | [AddBrokerModal.tsx](../../../components/brokers/AddBrokerModal.tsx) | bespoke → `<Modal>` | medium | M |
| 12 | [AddFirmModal.tsx](../../../components/solicitors/AddFirmModal.tsx) | bespoke → `<Modal>` | medium | M |
| 13 | [AutomationStopModal.tsx](../../../components/transaction/AutomationStopModal.tsx) | bespoke → `<Modal>` | medium | S |
| 14 | [ClaimWelcomeModal.tsx](../../../components/transaction/ClaimWelcomeModal.tsx) | bespoke → `<Modal>` | medium | S |
| 15 | [SwitchServiceTypeModal.tsx](../../../components/transaction/SwitchServiceTypeModal.tsx) | bespoke → `<Modal>` | medium | S |
| 16 | [MortgageModal.tsx](../../../components/milestones/MortgageModal.tsx) | bespoke → `<Modal>` | medium | M |
| 17 | [SurveyNrConfirmModal.tsx](../../../components/milestones/SurveyNrConfirmModal.tsx) | bespoke → `<Modal>` | medium | S |
| 18 | [ArchivedRoundDrawer.tsx](../../../components/transaction/ArchivedRoundDrawer.tsx) | bespoke → `<Drawer>` | medium | M |
| 19 | [ReconciliationDrawer.tsx](../../../components/milestones/ReconciliationDrawer.tsx) | bespoke → `<Drawer>` | high | L |
| 20 | [RelistFileModal.tsx](../../../components/transaction/RelistFileModal.tsx) | bespoke → `<Modal>` (multi-stage form) | high | L |
| 21 | [EditSaleDetailsDrawer.tsx](../../../components/transaction/EditSaleDetailsDrawer.tsx) | bespoke → `<Drawer>` (per-section unsaved state composer stays) | **highest** | L |
| 22 | Voice sweep across all strings on the surface | single PR per [DoD gate 7](../../DEFINITION_OF_DONE.md) | medium | M |

**Estimate:** ~22 distinct PRs. At 1-2 per session, that's 11-22 sessions. The original estimate was "2 weeks of session time"; 22 sessions feels heavy. Two ways to trim:

1. **Bundle adjacent low-risk migrations.** PRs 1-9 (panels + skeletons) are all low-risk and could bundle 2-3 per PR — they touch different files and don't interact behaviourally. Brings the panel work down to ~4 PRs.
2. **Accept grandfathering more aggressively.** PRs 19, 20, 21 are the highest-risk modal/drawer migrations. If their behaviour can't be matched cleanly (multi-stage forms, unsaved-section prompts, reconciliation drawer flow), grandfather them per Law 19 and let them ship in a later round.

Recommended split: **PRs 1-9 bundled as 3-4 panel PRs + 10-18 as 9 modal/drawer PRs + 19-22 as grandfathered or deferred**. ~12-13 PRs across ~8 sessions, fits the 2-week estimate.

---

## Section 7 — Out-of-scope confirmations

Re-affirming items NOT in this surface's remediation:

- New-sale form (`transactions-v2/`) — separate surface
- Chain UI in sidebar — chain arc has its own active-package scope
- ExchangeCelebration full-screen overlay — bespoke exception per MODAL_DRAWER_SYSTEM
- RoundChip flip animation — locked grandfather
- `PanelSkeletons.tsx` as a whole — domain composer that wraps `<Skeleton>` internally; not subsumed

---

## Next: Step 4 — Plain-English plan for founder sign-off

The audit identifies WHAT to change. Step 4 is the WHEN/HOW summary you sign off on before any code changes:

- Which PRs we'll bundle (panel work) vs do solo (modal work)
- Which migrations we grandfather rather than force
- The feature-flag rollout (`CANONICAL_FILE_DETAIL_V2`, per-agency)
- The behavioural regression checks at each PR boundary
- The exit criteria (visual diff clean, E2E happy-path green, multi-tenant safety green, founder walk OK)

That doc lives at `docs/phase-3/01-agent-file-detail/PLAN.md` and is **the hard gate** before any code lands.
