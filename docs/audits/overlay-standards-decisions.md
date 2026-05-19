# Overlay Standards — Decisions

**Status:** Stage 3 complete — all categories decided 2026-05-19
**Based on:** Stage 2 audit page review at `/agent/audit/overlays`
**Taxonomy source:** `docs/audits/overlay-standards-proposal.md`

---

## Category decisions

| Category | Decision | Key constraints |
|---|---|---|
| Drawers (1a / 1b / 1c) | V1 | 440px all · neutral chrome · crisp ease |
| Modals / Dialogs (2a–2e) | V1 | right-aligned footer · X button on 2b+ |
| Popovers / Pickers (3a–3c) | V2 | bottom-start · no arrow |
| Dropdown Menus (4a / 4b) | V2 | simple fade |
| Toasts (5a–5e) | V1 | bottom-right · progress bar |
| Fullscreen Overlays (6a–6c) | V1 | blur backdrop · slide |

---

## V1 spec — System Neutral

Applied to: Drawers, Modals, Toasts

| Property | Value |
|---|---|
| Panel background | `rgba(255,255,255,0.97)` |
| Panel shadow | `0 4px 24px rgba(0,0,0,0.10)` |
| Top/side accent | none |
| Header height | 52px (drawers) · 56px (modals) |
| Header layout | title (14px, 600) left · X button right |
| Header border | `1px solid rgba(0,0,0,0.07)` bottom only |
| Brand colour in header | none |
| Entry animation | `cubic-bezier(0.25,0,0,1)` 240ms — crisp, no spring |
| Exit animation | same easing reversed |
| Drawer width | 440px all (1a compose · 1b edit · 1c view) |
| Modal footer | right-aligned · primary + cancel |
| Modal X button | present on 2b (decision) · 2c (form) · 2d (onboarding) · 2e (celebration) · absent on non-dismissible 2a |
| Toast position | bottom-right stack |
| Toast progress bar | yes — drains left to right over dismiss duration |

---

## V2 spec — Glass Elevated

Applied to: Popovers, Dropdowns, Fullscreen Overlays

| Property | Value |
|---|---|
| Panel background | `backdrop-filter: blur(24px)` · `rgba(255,255,255,0.72)` base |
| Panel shadow | `0 8px 40px rgba(0,0,0,0.14)` |
| Border | `0.5px solid rgba(255,255,255,0.60)` outer · `0.5px solid rgba(0,0,0,0.06)` inner |
| Popover position | bottom-start of trigger · no arrow |
| Popover offset | 6px gap from trigger |
| Dropdown animation | simple opacity fade 120ms |
| Fullscreen backdrop | `rgba(0,0,0,0.45)` dim · no blur |
| Fullscreen panel animation | opacity fade 180ms |

---

## Component-level decisions

| Component | Category | Decision | Notes |
|---|---|---|---|
| ChaseDrawer | 1a | V1 | 440px · neutral header · crisp ease |
| EditSaleDetailsDrawer | 1b | V1 | 440px |
| ReconciliationDrawer | 1b | V1 | 440px |
| ChainDrawer | 1c | V1 | 440px |
| AddNodeDrawer | 1a | V1 | 440px |
| WelcomeModal | 2d | V1 | right footer · X present |
| UndoMilestoneModal | 2b | V1 | right footer · X present |
| MortgageModal | 2a | V1 | right footer · no X (non-dismissible) |
| SurveyNrConfirmModal | 2a | V1 | right footer · no X (non-dismissible) |
| AddFirmModal | 2c | V1 | right footer · X present |
| AddBrokerModal | 2c | V1 | right footer · X present |
| DuplicateAddressModal | 2b | V1 | right footer · X present |
| NavAwayModal | 2b | V1 | right footer · X present |
| WithdrawalReasonModal | 2b | V1 | right footer · X present |
| AccountDangerZone | 2b | V1 | right footer · X present |
| UnsavedChangesModal | 2b | V1 | right footer · X present |
| AddressConsequencesModal | 2b | V1 | right footer · no X (non-dismissible) |
| ExchangeCelebration | 2e | V1 | tap-to-dismiss retained · no X button needed |
| RiskBadgeWithPopover | 3a | V2 | bottom-start · no arrow · glass |
| MissingFeeRow (desktop) | 3a | V2 | bottom-start · no arrow · glass |
| MissingFeeRow (mobile) | 3b | V2 | full-screen sheet — glass surface |
| ChangelogDropdown | 3c | V2 | bottom-start · no arrow · glass |
| ToneSelector | 4a | V2 | simple fade · glass |
| StatusControlDropdown | 4a | V2 | simple fade · glass |
| SolicitorPicker | 4a | V2 | simple fade · glass |
| BrokerPicker | 4a | V2 | simple fade · glass |
| SideSnoozeMenu | 4b | V2 | simple fade · glass |
| RowSnoozeMenu | 4b | V2 | simple fade · glass |
| AgentToaster | 5a–5e | V1 | bottom-right · progress bar |
| ToastContext (legacy) | retire | retire | replace all call sites with AgentToaster |
| NewTransactionToast | 5a | V1 | bottom-right · progress bar |
| AgentGlobalSearch | 6a | V2 | dim backdrop · fade |
| FeedbackWidget | 6b | V2 | dim backdrop · fade |
| SubmissionOverlay | 6c | V2 | dim backdrop · fade |
| window.confirm() × 5 | → 2a | V1 | replace with proper modals · right footer · no X |
