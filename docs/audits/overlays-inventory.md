# Overlay UI Audit — Inventory

**Date:** 2026-05-18
**Status:** Stage 1 — pending Ellis sign-off before building audit page
**Scope:** Every popup, drawer, modal, dialog, dropdown, popover, sheet, and toast in the agent app (`/agent/*` routes + shared components used exclusively by agent pages)

---

## Section 1 — Drawers

| Name | Component file | Used on pages | States | Notes |
|---|---|---|---|---|
| ChaseDrawer | `components/chase/ChaseDrawer.tsx` | `/agent/transactions/[id]` | closed / open-channel-select / open-email / open-whatsapp / tone-picker-open / ai-generating / ai-generated / message-editing / sending / error | Right-aligned slide-in. Uses `createPortal`. Backdrop. Channel toggle (Email / WhatsApp). Tone selector dropdown nested. AI generation with loading + error paths. WhatsApp contact picker. CC solicitor toggle. Multi-milestone chase mode. |
| EditSaleDetailsDrawer | `components/transaction/EditSaleDetailsDrawer.tsx` | `/agent/transactions/[id]` | closed / open-clean / open-property-dirty / open-price-dirty / open-timeline-dirty / saving / address-consequences-modal-nested / unsaved-changes-modal-nested | Right-aligned. Three independently-saving sections (Property, Price & Fees, Timeline). Dirty-section chips visible above fold. Nested modals for address consequences and unsaved changes. |
| ReconciliationDrawer | `components/milestones/ReconciliationDrawer.tsx` | `/agent/transactions/[id]` (via MilestoneRow) | closed / open-exchange / open-completion / with-outstanding-items / items-checking / date-filled / saving | Right-aligned. Non-dismissible backdrop (user has entered data). Handles exchange (VM19/PM26) and completion (VM12/PM16) flows. Completion date field conditional on flow type. |
| ChainDrawer | `components/chain/ChainDrawer.tsx` | `/agent/transactions/[id]` | closed / open-loading / open-empty / open-populated / link-delete-confirm / bulk-invite-pending | Right-aligned. Uses `createPortal`. Chain progress visualisation. LinkCard sub-components. Sticky footer for bulk invite. Inline delete confirmation (not a separate modal). |
| AddNodeDrawer | `components/chain/AddNodeDrawer.tsx` | `/agent/transactions/[id]` (via ChainDrawer) | closed / open-create / open-edit / form-validation-error / saving / server-error | Right-aligned. Add or edit chain node. Field-level validation (address, agency name, agent email). |

---

## Section 2 — Modals / Dialogs

| Name | Component file | Used on pages | States | Notes |
|---|---|---|---|---|
| WelcomeModal | `components/agent/WelcomeModal.tsx` | `/agent` (first login) | closed / open-welcome / open-tour | Centred. Gradient header. Portal. Tour slides on demand. |
| UndoMilestoneModal | `components/milestones/UndoMilestoneModal.tsx` | `/agent/transactions/[id]` (via MilestoneRow) | closed / open-no-cascade / open-cascade-target-only / open-cascade-all / pending-undo | Centred. Orange accent (warning semantic). Radio options. Impact visualisation with % and count. Expandable downstream list. |
| MortgageModal | `components/milestones/MortgageModal.tsx` | `/agent/transactions/[id]` (via MilestoneRow) | closed / open / pending | Centred. 3-option confirmation (Yes mortgage / Reinstate / Cancel). Non-dismissible backdrop. Portal. |
| SurveyNrConfirmModal | `components/milestones/SurveyNrConfirmModal.tsx` | `/agent/transactions/[id]` (via MilestoneRow — PM9 only) | closed / open | Centred. Simple 2-button (Yes skip / Cancel). Non-dismissible. |
| AddFirmModal | `components/solicitors/AddFirmModal.tsx` | Transaction form (via SolicitorPicker) | closed / open-empty / form-filling / validation-error / saving / error | Centred. Quick solicitor firm + handler creation. Field-level errors. Portal. |
| AddBrokerModal | `components/brokers/AddBrokerModal.tsx` | Transaction form (via BrokerPicker) | closed / open-empty / form-filling / validation-error / saving / error | Centred. Same shape as AddFirmModal. Optional handler. Portal. |
| DuplicateAddressModal | `components/transactions-v2/DuplicateAddressModal.tsx` | New sale flow | closed / open | Centred. z-index 2000. Warning: existing file at same address. Actions: View existing / Create anyway / Cancel. |
| NavAwayModal | `components/transactions-v2/NavAwayModal.tsx` | New sale flow (unsaved changes) | closed / open / saving-draft | Centred. Yellow accent. Three actions: Discard / Stay here / Save draft. Non-dismissible. |
| WithdrawalReasonModal | `components/transaction/StatusControl.tsx` (inline) | `/agent/transactions/[id]` | closed / open-reason-select / open-custom-reason / saving | Inline in StatusControl. Centred. 10 predefined reasons + Other. Custom input conditional. Portal. |
| AccountDeletionModal | `components/agent/AccountDangerZone.tsx` (inline) | `/agent/settings` | closed / open / email-valid / pending-delete | Red danger styling. Email confirmation gate. Inline fixed positioning (no portal). |
| UnsavedChangesModal | `components/transaction/EditSaleDetailsDrawer.tsx` (inline) | `/agent/transactions/[id]` | closed / open / saving-all | Nested inside EditSaleDetailsDrawer. Yellow accent. Lists dirty sections. Three actions: Save all / Discard / Keep editing. |
| AddressConsequencesModal | `components/transaction/EditSaleDetailsDrawer.tsx` (inline) | `/agent/transactions/[id]` | closed / open-with-count | Nested inside EditSaleDetailsDrawer. Shows impact count (comms, milestones). Non-dismissible. |
| ExchangeCelebration | `components/milestones/ExchangeCelebration.tsx` | `/agent/transactions/[id]` (post-exchange) | hidden / visible-animating / visible-idle / dismissed | Full-screen. Canvas confetti. Respects `prefers-reduced-motion`. Tap-to-dismiss. z-index 200. Portal. |

---

## Section 3 — Popovers / Pickers

| Name | Component file | Used on pages | States | Notes |
|---|---|---|---|---|
| RiskBadgePopover | `components/transactions/RiskBadgeWithPopover.tsx` | `/agent/transactions` (list rows) | closed / open-above / open-below / hover-delayed-close | Floating. Portal. Dynamic viewport positioning (above or below trigger). Hover + click activation. Debounced close on mouse-leave. Scroll-triggered close. Shows risk factor breakdown. |
| MissingFeePopover (desktop) | `components/analytics/MissingFeeRow.tsx` (inline) | `/agent/analytics` | closed / open / fee-type-amount / fee-type-percent / vat-toggle / saving | Floating. Portal. Desktop only — same trigger opens full-screen modal on mobile. Positioned near "Set fee" button. |
| MissingFeeSheet (mobile) | `components/analytics/MissingFeeRow.tsx` (inline) | `/agent/analytics` | closed / open / fee-type-amount / fee-type-percent / vat-toggle / saving | Full-screen mobile overlay. Same data/states as desktop popover, different chrome. Triggered by `window.innerWidth < 768`. Portal. |
| StatusControlDropdown | `components/transaction/StatusControl.tsx` (inline) | `/agent/transactions/[id]` | closed / open-4-options / changing | Positioned fixed dropdown. Portal. Dismisses on outside-click or scroll. Optimistic update. |
| ToneSelector | `components/chase/ChaseDrawer.tsx` (inline) | `/agent/transactions/[id]` (via ChaseDrawer) | closed / open | Floating dropdown below trigger. 6 tone options with colour pills. "Recommended" indicator. Portal. |

---

## Section 4 — Dropdown Menus

| Name | Component file | Used on pages | States | Notes |
|---|---|---|---|---|
| SolicitorPicker | `components/solicitors/SolicitorPicker.tsx` | New sale form, transaction form tabs | closed / open-loading / open-results / open-empty / firm-selected / handler-dropdown-open / add-firm-modal-nested | Combobox-style. Debounced search (200ms). Nested AddFirmModal. Portal positioning via `dropdownPortalRef`. |
| BrokerPicker | `components/brokers/BrokerPicker.tsx` | New sale form, transaction form tabs | closed / open-loading / open-results / firm-selected / handler-selector-open / add-broker-modal-nested / preferred-auto-filled | Same shape as SolicitorPicker. Pre-population from agency preferences on mount. Portal. |
| SideSnoozeMenu | `components/reminders/AgentRemindersList.tsx` (inline) | `/agent/work-queue` | closed / open | Dropdown above trigger (transforms translateY -100%). Uses Portal + `agent-dropdown-in/out` animation. 5 snooze duration options. "Snooze all" for a reminder group. |
| RowSnoozeMenu | `components/reminders/AgentRemindersList.tsx` (inline) | `/agent/work-queue` | closed / open | Same snooze options but per individual reminder row. Portal. Clock-icon trigger button. |

---

## Section 5 — Toasts

| Name | Component file | Used on pages | States | Notes |
|---|---|---|---|---|
| AgentToaster | `components/agent/AgentToaster.tsx` | Global (agent layout) | empty / single-toast / multi-stacked / toast-exiting / paused-on-hover / with-action-button | Bottom-right stack. success / info / warning / error types with semantic icons. Max 4 visible. Action button support. Pause-on-hover timer management. `agent-dropdown-in` animation. z-index 9999. |
| ToastContext | `components/ui/ToastContext.tsx` | Some form pages, older components | empty / toast-with-subtext / toast-auto-dismissing | Legacy simpler system. Fixed bottom-right. success / info / error. Auto-dismiss after 4s. Subtext optional. |
| NewTransactionToast | `components/transaction/NewTransactionToast.tsx` | Post-creation redirect | shown-once / dismissed | Session-storage gate (shows once per session). Address as subtext. File creation success. |

---

## Section 6 — Full-Screen Search Overlay

| Name | Component file | Used on pages | States | Notes |
|---|---|---|---|---|
| AgentGlobalSearch | `components/layout/AgentGlobalSearch.tsx` | All agent pages (AgentShell) | closed / open-empty / open-loading / open-results-files / open-results-nav / open-results-mixed / open-no-results | Full-screen centred panel. `Cmd+K` / `Ctrl+K` trigger + search button in sidebar. Portal. Keyboard nav (↑↓ Enter). Navigates on select. Escape closes. Debounced fetch. |

---

## Section 7 — Feedback / Support Widget

| Name | Component file | Used on pages | States | Notes |
|---|---|---|---|---|
| FeedbackWidget | `components/feedback/FeedbackWidget.tsx` | All agent pages (agent layout) | closed / open-categories / open-bug-form / open-suggestion-form / open-question-form / submitting / success / error | `role="dialog"` `aria-modal`. Categories: Bug / Suggestion / Question. Screenshot capture (base64). Browser detection. Fixed floating button (bottom-right). Portal. |

---

## Section 8 — Submission Overlay (Loading)

| Name | Component file | Used on pages | States | Notes |
|---|---|---|---|---|
| SubmissionOverlay | `components/transactions-v2/SubmissionOverlay.tsx` | New sale flow (file creation) | hidden / visible-cycling | Full-screen backdrop. z-index 3000. Spinner + rotating messages (6 variants). Portal. Mounts when form submits, unmounts on success/error. |

---

## Excluded from audit page

| Item | Reason |
|---|---|
| `CookieConsentBanner` (`components/analytics/CookieConsentBanner.tsx`) | PostHog infrastructure, no production trigger (PostHog key not configured) |
| `AssignControl` (`components/transaction/AssignControl.tsx`) | Inline select expand — not a floating overlay |
| MilestoneRow inline forms (event date, N/R reason, counterpart notice) | Inline expand within milestone row — not floating overlays |
| GlobalSearch (`components/layout/GlobalSearch.tsx`) | Internal dashboard (AppShell) — agent app uses `AgentGlobalSearch` |
| `FeedbackButton` (`components/feedback/FeedbackButton.tsx`) | Internal dashboard only (AppShellClient) |

---

## Totals

| Category | Count |
|---|---|
| Drawers | 5 |
| Modals / Dialogs | 13 |
| Popovers / Pickers | 5 |
| Dropdown menus | 4 |
| Toasts | 3 |
| Full-screen search | 1 |
| Feedback widget | 1 |
| Loading overlay | 1 |
| **Total** | **33** |
