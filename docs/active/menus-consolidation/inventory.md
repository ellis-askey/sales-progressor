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
- [x] 📋 **components/reminders/SnoozeMenu.tsx** — `4691aa1d` (retires the #276 scroll-dismiss workaround)
- [x] 📋 **components/reminders/ChaseSplitButton.tsx** — split-button menu — `f35f352c`
- [x] 📋 **components/transactions/FilterMenu.tsx** (files filter) — `8a6d1827` (bare mode)
- [x] 📋 **components/transactions/MonthlyTargetMenu.tsx** — `c943ba18`
- [x] 📋 **components/transactions/FilesWorkspace.tsx** — `files-view-menu` (the View dropdown, #278) — `b7566ded`
- [x] 📋 **components/transaction/StatusControl.tsx** — status dropdown — `52678ce5` (dropped the isDark MutationObserver)
- [x] 📋 **components/transaction/RescheduleChaseControl.tsx** — `d178eb7f`
- [x] 📋 **components/completions/CompletionCardMenus.tsx** — DateMenu + FeeMenu — `89d865c1`
- [x] 📋 **components/analytics/MissingFeeRow.tsx** — desktop popover — `0c43e189` (mobile bottom sheet kept as-is)
- [x] 📋 **components/agent/AuroraOpacityControl.tsx** — `1d76e1d7`
- [x] ⏭ **components/activity/LogUpdateModal.tsx** — `lum-menu`: GRANDFATHERED. In-flow accordion reveal (`margin-top`, not `position:absolute`) inside the modal — pushes content down, not a floating overlay, so it can't clip. Migrating to a floating Popover would change the UX. Out of scope.
- [x] 📋 **components/layout/AgentBell.tsx** — notifications dropdown — `5867ce66` (bare; trades its bespoke close-fade for the uniform open anim)
- [x] ⏭ **components/account/chrome/AccountSidebarUser.tsx** / **SectionMasterControl.tsx** — GRANDFATHERED (surface mismatch). The Account register is a deliberately neutral-light surface (hardcoded `#111827`/`#6b7280`/`#fff`), not the warm agent glass tokens. The locked Popover recipe pulls the agent `[data-theme]` tokens (warm sunset etc.), so dropping it here would visibly re-tint these menus and mix surface systems (Law 9). **Open question for Ellis:** unify the Account register too via a neutral Popover variant, or leave it on its own surface? Deferred pending that call.

## Priority 3 — Row / context menus
NB: the "two near-duplicates" turned out to be on DIFFERENT surfaces, so they don't fold into one.
- [x] ⏭ **components/account/chrome/RowActionsMenu.tsx** (consumers: TeamListViewPlain, CheckInsList, ClientPeople, FeeEngine) — GRANDFATHERED, same neutral-light Account-register surface as the account sidebar (see P2 note). Folds in when/if we do the neutral Popover variant.
- [x] 📋 **components/hub/RowActionMenu.tsx** — `40d8eb3b` (warm agent surface; real flip replaces its estimated-height guess)
- [x] 📋 **components/transaction/HeroSmallControls.tsx** — mobile kebab — `4681d290`
- [x] 📋 **components/transaction/OnwardPurchaseCard.tsx** — local Dropdown (setup chevron + kebab) — `1cda8a91` (MenuItem now token-based, adapts to night)

## Priority 4 — Pickers (search + list)
These are TYPEAHEADS (visibility driven by typing/focus), not click-menus — the click Popover doesn't model them. Built a controlled **`AnchoredPanel`** (shares the portal/positioning/locked glass, consumer drives `open`, `matchWidth` sizes to the input) + a live demo on `/dev/menus` (commit `23cd3162`). AWAITING Ellis's /dev review: option A (migrate the 3 pickers onto AnchoredPanel) vs B (grandfather). No real picker touched yet.
Ellis chose **A** (2026-10-24). Canonical `.ui-pop-pick*` row styles added (`8d0b99c1`).
- [x] 🗂 **components/brokers/BrokerPicker.tsx** — `ac888de6`
- [x] 🗂 **components/solicitors/SolicitorPicker.tsx** — firm typeahead + handler select — `f165d7dd`
- [x] 📋 **components/contacts/ContactsSection.tsx** — was actually a row kebab (not a typeahead), migrated to Popover — `58ecd8cd`

## Priority 5 — Tone dropdowns in the chase drawers (same pattern ×3)
All via the controlled `AnchoredPanel` (matchWidth select-style).
- [x] 📋 **components/chase/ChaseDrawer.tsx** — tone + recipient dropdowns — `cc2c4ae2`
- [x] 📋 **components/chase/ChaseNeighbourDrawer.tsx** — `17fc6dbf`
- [x] 📋 **components/enquiries/EnquiryChaseDrawer.tsx** — `45eb1c0b`

## Priority 6 — Tooltips & hover popovers
Added tap-to-pin + a `block` option to the canonical `Tooltip` (hover on desktop, tap on touch) — approved on /dev (`4c8d6737`).
- [x] 🧭 **components/ui/InfoTip.tsx** — rebased on Tooltip — `c2fd9e94`
- [x] 🧭 **components/transactions/TransactionRowView.tsx** — JourneyHover + WithdrawnCell on Tooltip — `bb9759de`
- [x] 📋 **components/chain/LinkCard.tsx** / **ChainMapPanel.tsx** — these were click ⋯ menus (not tooltips) → Popover — `837d255d`
- [x] ⏭ **components/focus/FocusClientComms.tsx** `fcl-tip` — GRANDFATHERED. Bespoke two-tap touch flow (#298: tap = peek, tap-again = open the thread) on a button that already has a primary click → conflicts with Tooltip's tap-to-pin. Already uses agent tokens (adapts to night).
- [x] ⏭ **components/transactions/RiskBadgeWithPopover.tsx** — GRANDFATHERED. Hover-*persistable* rich popover (grace-close + hover-into-content for a tall risk breakdown) — not the simple non-interactive Tooltip.
- [x] ⏭ **components/hub/PipelineStageHover.tsx** / **HubCharts.tsx** — GRANDFATHERED. Chart-integrated hovers: parent manages the anchor rect from chart interaction + a custom arrow pointer; not element-anchored. **PipelineAtAGlance.tsx** has no floating UI (not applicable).
- [x] ⏭ **components/command/shared/InfoTip.tsx** — GRANDFATHERED. Command Centre neutral surface (Law 9), same as the account register — folds in with a neutral-surface pass.

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
