# Little-menus consolidation — inventory & migration checklist

Phase 2 of the menus/tooltips/popovers consolidation. Target: migrate every floating UI onto the canonical **`Popover`** primitive ([components/ui/Popover.tsx](../../../components/ui/Popover.tsx)) — one surface (locked recipe), one behaviour (portal + flip/shift + edge gutter). Phase 3 migrates these one small reviewable pass at a time (Law 16). Clip offenders first.

**Legend:** 🔴 inline (not portalled — clips / hugs edge; priority) · 🟡 portalled but ad-hoc surface · 🧭 tooltip/hover · 📋 dropdown menu · 🗂 picker (search+list) · 🧰 rich popover

---

## Priority 1 — Clip offenders (inline menus that get cut off)
These render inside a card's overflow/transform, so they clip and hug the mobile edge — the exact bug behind the report.

- [x] 🔴🧰 **components/agent/AgentTodoList.tsx** — the `/agent/to-do` reschedule+update popover (the one in the screenshots) and its row menu — `81a178be`
- [x] 🔴🧰 **components/todos/ManualTaskCard.tsx** — file To-Do tab reschedule popover — `7992ac44`
- [x] 🔴📋 **components/activity/ActivityTimeline.tsx** — row menu (More → view original/cleaned) — `3c70a112`. Scope filter menu deferred to P2 (radio-select family).
- [x] 🔴📋 **components/activity/CommsEntry.tsx** — log/channel More menu — `ccd62c43`
- [x] 🔴📋 **components/chain/ChainsWorkspace.tsx** — Filters menu — `0ce43c27`
- [x] 🔴📋 **components/layout/ChangelogDropdown.tsx** — changelog dropdown (added Popover `bare` for full-bleed panels, `9fc101d7`) — `486c93b2`

## Priority 2 — High-traffic dropdown menus
- [ ] 📋 **components/reminders/SnoozeMenu.tsx**
- [ ] 📋 **components/reminders/ChaseSplitButton.tsx** — split-button menu
- [ ] 📋 **components/transactions/FilterMenu.tsx** (files filter)
- [ ] 📋 **components/transactions/MonthlyTargetMenu.tsx**
- [ ] 📋 **components/transactions/FilesWorkspace.tsx** — `files-view-menu` (the View dropdown, #278)
- [ ] 📋 **components/transaction/StatusControl.tsx** — status dropdown (already catalogued separately)
- [ ] 📋 **components/transaction/RescheduleChaseControl.tsx**
- [ ] 📋 **components/completions/CompletionCardMenus.tsx**
- [ ] 📋 **components/analytics/MissingFeeRow.tsx**
- [ ] 📋 **components/agent/AuroraOpacityControl.tsx**
- [ ] 📋 **components/activity/LogUpdateModal.tsx** — `lum-menu` (the "Log" menu)
- [ ] 📋 **components/layout/AgentBell.tsx** — notifications dropdown
- [ ] 📋 **components/account/chrome/AccountSidebarUser.tsx** / **SectionMasterControl.tsx**

## Priority 3 — Row / context menus (two near-duplicate components to unify)
- [ ] 📋 **components/account/chrome/RowActionsMenu.tsx** (+ consumers: TeamListViewPlain, CheckInsList, ClientPeople, FeeEngine)
- [ ] 📋 **components/hub/RowActionMenu.tsx** — second, near-duplicate row menu → fold into the one primitive
- [ ] 📋 **components/transaction/HeroSmallControls.tsx**
- [ ] 📋 **components/transaction/OnwardPurchaseCard.tsx**

## Priority 4 — Pickers (search + list)
- [ ] 🗂 **components/brokers/BrokerPicker.tsx**
- [ ] 🗂 **components/solicitors/SolicitorPicker.tsx**
- [ ] 🗂 **components/contacts/ContactsSection.tsx**

## Priority 5 — Tone dropdowns in the chase drawers (same pattern ×3)
- [ ] 📋 **components/chase/ChaseDrawer.tsx**
- [ ] 📋 **components/chase/ChaseNeighbourDrawer.tsx**
- [ ] 📋 **components/enquiries/EnquiryChaseDrawer.tsx**

## Priority 6 — Tooltips & hover popovers
- [ ] 🧭 **components/focus/FocusClientComms.tsx** — `fcl-tip` (reworked in #298; re-base on Tooltip)
- [ ] 🧭 **components/ui/InfoTip.tsx** + **components/command/shared/InfoTip.tsx** — TWO InfoTips → unify on Tooltip
- [ ] 🧭 **components/transactions/RiskBadgeWithPopover.tsx**
- [ ] 🧭 **components/hub/PipelineStageHover.tsx** / **PipelineAtAGlance.tsx** / **HubCharts.tsx** — chart/stage hovers
- [ ] 🧭 **components/transactions/TransactionRowView.tsx**
- [ ] 🧭 **components/chain/LinkCard.tsx** / **ChainMapPanel.tsx**

## Priority 7 — Remaining menus
- [ ] 📋 **components/transaction/CheckpointsPanel.tsx**
- [ ] 📋 **components/agent/ReviewsSection.tsx**
- [ ] 📋 **components/comms/CommsActivityFeed.tsx**
- [ ] 📋 **components/enquiries/EnquiriesTriageList.tsx**
- [ ] 📋 **components/automated-emails/EmailDetailDrawer.tsx**
- [ ] 📋 **components/progression/ClientPeople.tsx** / **FeeEngine.tsx**
- [ ] 📋 **components/account/v2/TeamListViewPlain.tsx**

---

## Scale
~40 files with floating UI across the agent/TSP surfaces. No canonical primitive existed before `Popover`. Dev/audit/polish preview pages excluded. `FloatingThoughtCapture` already removed from the shell (orphaned file).

## Migration rules (Phase 3)
- One consumer per reviewable change (Law 16). Capture before/after behaviour on the clip offenders.
- Keep each consumer's trigger + open/close logic; swap only the floating surface + positioning onto `Popover`/`Tooltip`.
- Grandfather anything whose behaviour can't be preserved safely; note it here.
- `StatusControl` stays catalogued separately but re-bases its surface on the primitive.
