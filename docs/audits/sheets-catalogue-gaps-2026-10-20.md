# /dev/sheets catalogue — completeness audit, 2026-10-20

Checked every overlay in the codebase (by `components/ui/Modal|Drawer` imports, `createPortal`, `role="dialog"`/`aria-modal`, fixed-overlay patterns, and filename sweeps) against the 118 entries in `app/dev/sheets/_registry/*`. Registry last touched 2026-10-13; the original completeness sweep was 2026-09-19.

**Verdict: NOT complete.** ~20 live overlays are missing, almost all shipped after the September sweep. Also one registry note is stale and a few registered-adjacent components are orphaned.

---

## A. Missing — agent-app modals & drawers (true overlays, live)

| Component | File | What it is | Used in |
|---|---|---|---|
| SentEmailModal | `components/transaction/SentEmailModal.tsx` | Sent-email viewer (centre modal desktop / bottom drawer mobile, iframe) | Focus client comms + chase timeline — **new 2026-10** |
| LogUpdateModal | `components/activity/LogUpdateModal.tsx` | "Log an update" modal/drawer (draft/WhatsApp/voice panels) | Activity tab, notes card, file setup checklist — shipped 2026-10-11 |
| ComposeEmailModal | `components/compose/ComposeEmailModal.tsx` | Full email composer (modal desktop / bottom sheet mobile) | ComposeEmailButton, Focus, SurveyEmailModal, WeeklyTouchCard |
| SurveyEmailModal | `components/milestones/SurveyEmailModal.tsx` | Surveyor-access picker modal (hands off to composer) | MilestoneRow (PM9) |
| OnwardNudgeModal | `components/transaction/OnwardNudgeModal.tsx` | Onward-purchase review-and-send modal with iframe preview | OnwardPurchaseCard |
| ReassignOwnerControl | `components/transaction/ReassignOwnerControl.tsx` | Reassign-file-owner modal (hosts AgentPicker) | File page, director-only |
| PropertyFlagsCard confirm | `components/transaction/PropertyFlagsCard.tsx` | Confirm modal for reversing pack/shared-ownership steps | File sidebar Property card — **recent shared-ownership work** |
| HousingAssociationSection modal | `components/transaction/HousingAssociationSection.tsx` | HA add/edit modal | Overview panel (shared-ownership files) — **recent** |
| AttentionCard resume modal | `components/hub/AttentionCard.tsx` | "Take off hold" resume-chooser modal | Hub |
| CheckInsList HistoryModal | `components/chain/CheckInsList.tsx` | Check-in history modal | Chains → check-ins |
| MapView Street View modal | `components/transactions/map/MapView.tsx` | Street View modal with blur scrim | All Files → Map |
| EnquiriesTriageList confirm | `components/enquiries/EnquiriesTriageList.tsx` | Drag-to-stage confirm modal | /agent/enquiries |
| useDemoExplore modal | `components/transactions-v2/useDemoExplore.tsx` | Full-screen demo intro/loading modal | Demo hero card + 3 empty states |
| SelfManagedWelcomeModal | `components/agent/SelfManagedWelcomeModal.tsx` | First-run welcome modal (self-managed + claim variant) | First-run directors (WelcomeModal + ClaimWelcomeModal ARE registered; this one isn't) |
| ProgressorWelcomeModal | `components/agent/ProgressorWelcomeModal.tsx` | First-run welcome modal (external progressor owners) | First-run progressors |
| DemoTourController | `components/transaction/demo-tour/DemoTourController.tsx` | Full-screen guided-tour spotlight overlay | Live demo files |
| ClientsWorkspace modals | `components/progression/ClientsWorkspace.tsx` | AddClientModal + BusinessSettingsModal (internal, ui/Modal chrome) | /agent/clients |
| ClientPeople modals | `components/progression/ClientPeople.tsx` | InviteModal + EditModal (internal, ui/Modal chrome) | Agency workspace People tab |
| BusinessTeamView confirm | `components/progression/BusinessTeamView.tsx` | "+£39/mo" invite confirm dialog (self-owned portal) | /agent/team |
| BringInSaleDrawer | `components/progression/BringInSaleDrawer.tsx` | Right-side bring-in-sale drawer | BusinessSalesActions |
| AddCardGateModal | `components/progression/AddCardGateModal.tsx` | Card-on-file gate modal | NewSaleFlow + BusinessSalesActions |
| ActivityTimeline email drawer | `components/activity/ActivityTimeline.tsx` | Email conversation drawer (ui/Drawer chrome, distinct surface) | Activity tab |
| ContactsSection delete-confirm | `components/contacts/ContactsSection.tsx` | Remove-contact confirm modal (ui/Modal chrome; its row menus are already noted as inspect-in-situ) | Contacts card |

## B. Missing — menus / popovers (registry has a menus section; these aren't in it or its documented-exclusion note)

| Component | File | What | Used in |
|---|---|---|---|
| ReviewsSection menus | `components/agent/ReviewsSection.tsx` | Hold-row split-button menu + review options menu (portal'd) | To-do → Reviews |
| CheckpointsPanel row menu | `components/transaction/CheckpointsPanel.tsx` | Nudge/Remove row menu (portal + scrim) | Overview panel |
| BuildingInvoiceHero popover | `components/billing/v2/BuildingInvoiceHero.tsx` | Address-cell glassy property popover | Account billing |
| InfoTip | `components/ui/InfoTip.tsx` | Portal tooltip/popover (hover + click-pin) | Auto-emails list, chase grid |
| TransactionRowView hovers | `components/transactions/TransactionRowView.tsx` | JourneyHover hover popover (tooltip-class). CORRECTION during remediation: the WithdrawnCell reason popover is dead code, `renderCell` routes withdrawn columns through DateCell + ReasonCell and nothing calls WithdrawnCell | All Files list |

## C. Missing — portal-side surfaces

| Component | File | What | Note |
|---|---|---|---|
| PortalThingsToConfirm sheet | `components/portal/PortalThingsToConfirm.tsx` | Confirm bottom-sheet + confetti | Not in the portal registry's NOT-REGISTRABLE note either |
| Solicitor portal welcome | `app/s/[token]/SolicitorWelcome.tsx` | First-visit bottom sheet | Solicitor portal isn't covered by the catalogue at all |
| Solicitor portal menu | `app/s/[token]/SolicitorPortalShell.tsx` | MenuSheet bottom sheet | — |
| Solicitor add-update drawer | `app/s/[token]/OpenUpdatesCard.tsx` | AddUpdateDrawer bottom sheet | — |
| Advisor confirm sheet | `app/a/[token]/AdvisorMortgageSteps.tsx` | Confirm/note bottom sheet | Advisor portal not covered |

Scope question: the 2026-09-19 sweep scoped "portal" = client portal. Solicitor (`/s/[token]`) and advisor (`/a/[token]`) portals have since shipped overlays. Decide whether they join the catalogue.

## D. Already documented as inspect-in-situ (NOT missed — listed in registry header comments)

- Menus note (`menus.tsx` lines 12–21): ContactsSection / TransactionRowView / ReminderCard / LinkCard / ChainMapPanel / OnwardPurchaseCard row menus; HeroAddressEdit / HeroSaleFields hero popovers; PipelineStageHover; ThemePicker.
- Portal note (`portal.tsx` lines 12–15): PortalDocumentsTab, PortalBrokerCard + PortalExchangeDayCard popups, PortalFollowupButton flow, PortalCustomizeOverview.
- **Stale label**: the portal note says "PortalDocumentsTab's lightbox" — there is no lightbox; its real overlays are a 3-dot options popover + an add-document sheet (PortalSheet chrome). Fix the comment when next touched.
- Note: HeroAddressEdit's overlay is actually a confirm *modal* (portal'd, backdrop), not a popover — arguably registrable despite the note.

## E. Deliberately out of scope (confirmed, no action)

- **Command Centre** (`/command/*`, `components/command/*`) — excluded by Ellis's 2026-09-19 decision (recorded in `types.ts` + `portal.tsx`). Includes ProspectDrawer, CritiqueLauncher.
- **Boardwalk** (`components/boardwalk/*`) — separate product/brand (QuickAddModal, ProjectModal, ProjectBrowserSheet, SearchOverlay, NotificationsPopover, TaskDetailPanel etc.).
- **Dev-only**: welcome-modals previews, sent-email-viewer sandbox, DesignLabDrawer + PortalDesignLab (founder tools), OverlaysGallery, PerfOverlay, polish/audit pages.
- **Not overlay-class**: PullToRefresh spinner, ConfirmReviewTray pill (fixed floating pill; its modal — ConfirmReviewModal — IS registered), toasts that fire through the registered AgentToaster (ClaimedToast, MosConfirmedNotice).

## F. Orphaned / stale components found along the way

- `components/hub/ExpiredHoldsCard.tsx` — superseded by AttentionCard; only dev pages import it.
- `components/hub/PipelineStageHover.tsx` — hover bubble not rendered anywhere (only its `useIsDarkTheme` helper is imported).
- `components/reminders/ReminderCard.tsx` — only consumer is a `helpdrawertest` example; its portal menus are dead live.
- `components/account/v2/ThemePickerPlain.tsx` + `components/agent/ThemePicker.tsx` full export — unused live (AppColourStudio replaced them).
- `components/milestones/ReconciliationModal.tsx` — re-export shim of ReconciliationDrawer (registered) — fine.

These are candidates for the registry's `stale` flag or deletion tickets, not catalogue entries.

---

## Resolution — same day (2026-10-20)

All gaps remediated in one pass. The registry grew from 118 to 148 entries; `npx tsc --noEmit` clean; no component source touched.

**Registered (30 new entries):**
- Modals (20): `modal-sent-email`, `modal-log-update`, `modal-compose-email`, `modal-survey-email`, `modal-onward-nudge`, `modal-reassign-owner`, `modal-self-managed-welcome`, `modal-progressor-welcome`, `modal-add-card-gate`, `modal-demo-explore`, `modal-property-flags-confirm`, `modal-housing-association`, `modal-attention-take-off-hold`, `modal-checkins-history`, `modal-enquiries-drag-confirm`, `modal-demo-tour`, `modal-clients-workspace`, `modal-client-people`, `modal-business-team-invite`, `modal-contacts-remove` (ContactsSection judged cleanly mountable after all, so registered rather than noted).
- Drawers (2): `drawer-bring-in-sale`, `drawer-email-conversation` (ActivityTimeline's drawer, props-driven, mounted inline).
- Menus (5): `menu-info-tip`, `menu-reviews-section`, `menu-checkpoints-row`, `menu-invoice-address-pop`, `menu-files-journey-hover`.
- Portal (3): `portal-things-to-confirm`, `portal-solicitor-open-updates`, `portal-advisor-mortgage-steps`. Solicitor + advisor portals are now IN scope (new areas in types.ts).

**Honest NOT-REGISTRABLE notes added instead of entries:**
- `modals.tsx`: MapView's Street View modal (needs live MapLibre canvas + geocoding + Maps key).
- `portal.tsx`: SolicitorWelcome (one-shot localStorage-gated self-mount), SolicitorPortalShell's MenuSheet (private inner component of the full page shell). Stale "lightbox" label fixed.
- `menus.tsx`: TransactionRowView bullet extended; WithdrawnCell popover found to be dead code (B-table correction above).

**Entry caveats a reviewer must know (carried in the entries' notes):** ComposeEmailModal's sale search reads the signed-in user's real files and Send is real; ReviewsSection's "Add a review" writes to the signed-in account; demo-tour's CTA navigates; SentEmailModal has no HTML prop so the harness shows its loading-then-error state (open a real sent row for the iframe render).

**Still open from section F:** orphan cleanup (ExpiredHoldsCard, PipelineStageHover, ReminderCard, ThemePickerPlain + ThemePicker full export, and now WithdrawnCell) — deletion tickets, separate concern per Law 5.
