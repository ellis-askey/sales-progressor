"use client";
// Modal / dialog entries for the /dev/sheets catalogue. See types.ts.
//
// Every entry mounts a REAL production modal/dialog with edge-case fixtures
// so a reviewer can inspect each visual state against the live agent
// background. All action handlers are wired to ctx.onClose (or noop) and every
// id is a "demo-*" so any server action that escapes a handler hits a
// non-existent record and no-ops rather than mutating live data.

import type { SheetEntry } from "./types";
import {
  DEMO_TX_ID,
  ADDRESS,
  LONG_ADDRESS,
  NAME,
  FIRM,
  LONG_FIRM,
  EMAIL,
  PRICE_PENCE,
  DATE_TODAY,
  DATE_PAST,
  noop,
} from "./fixtures";

// ── Real components ──────────────────────────────────────────────────────────
import { AddBrokerModal } from "@/components/brokers/AddBrokerModal";
import { PartnerPopup } from "@/components/agent/partners/PartnerPopup";
import { AddFirmModal } from "@/components/solicitors/AddFirmModal";
import { UndoMilestoneModal } from "@/components/milestones/UndoMilestoneModal";
import { MortgageModal } from "@/components/milestones/MortgageModal";
import { SurveyNrConfirmModal } from "@/components/milestones/SurveyNrConfirmModal";
import { SurveyBookingModal } from "@/components/milestones/SurveyBookingModal";
import { ExchangeCelebration } from "@/components/milestones/ExchangeCelebration";
import { AutomationStopModal } from "@/components/transaction/AutomationStopModal";
import { SwitchServiceTypeModal } from "@/components/transaction/SwitchServiceTypeModal";
import { SaleDetailChangeModal } from "@/components/transaction/SaleDetailChangeModal";
import { RelistFileModal } from "@/components/transaction/RelistFileModal";
import { ReviseExchangeBanner } from "@/components/transaction/ReviseExchangeBanner";
import { StatusControl } from "@/components/transaction/StatusControl";
import { ExchangeDayControl } from "@/components/transaction/ExchangeDayControl";
import { DiaryEventRow } from "@/components/hub/DiaryEventRow";
import { ClaimWelcomeModal } from "@/components/transaction/ClaimWelcomeModal";
import { DuplicateAddressModal } from "@/components/transactions-v2/DuplicateAddressModal";
import { NavAwayModal } from "@/components/transactions-v2/NavAwayModal";
import { ChangeFileModal } from "@/components/transactions-v2/form/ChangeFileModal";
import { SubmissionOverlay } from "@/components/transactions-v2/SubmissionOverlay";
import { EmailPreviewModal } from "@/components/email/EmailPreviewModal";
import { ConfirmReviewModal } from "@/components/confirm-review/ConfirmReviewModal";
import { BillingNegotiatorModal } from "@/components/billing/BillingNegotiatorModal";
import { WelcomeModal } from "@/components/agent/WelcomeModal";
import { AccountDangerZonePlain } from "@/components/account/v2/AccountDangerZonePlain";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { MissingFeeRow } from "@/components/analytics/MissingFeeRow";

// ── Component prop-shape types (imported so fixtures match precisely) ─────────
import type { UndoImpact, UndoImpactItem } from "@/lib/services/milestones";
import type { SurveyBookingOption } from "@/lib/services/survey-booking";
import type { SaleDetailsDelta } from "@/app/actions/transactions";
import type { DiaryItem } from "@/lib/services/hub";
import type { ChainMember } from "@/components/transaction/ClaimWelcomeModal";
import type { PendingQueueItem } from "@/app/actions/confirm-review-queue";

// ── Local fixtures ───────────────────────────────────────────────────────────

const UNDO_NO_CASCADE: UndoImpact = {
  cascade: [],
  currentPercent: 62,
  targetOnlyPercent: 58,
  cascadePercent: 58,
};

const CASCADE_ITEMS: UndoImpactItem[] = [
  { id: "m-1", name: "Draft contract issued", side: "vendor", code: "VM10", reconciledAtExchange: false },
  { id: "m-2", name: "Enquiries raised", side: "purchaser", code: "PM12", reconciledAtExchange: false },
  { id: "m-3", name: "Searches ordered", side: "purchaser", code: "PM13", reconciledAtExchange: true },
  { id: "m-4", name: "Searches returned and reviewed by the buyer's solicitor", side: "purchaser", code: "PM14", reconciledAtExchange: false },
  { id: "m-5", name: "Mortgage offer received", side: "purchaser", code: "PM16", reconciledAtExchange: true },
  { id: "m-6", name: "Enquiries answered and satisfied", side: "vendor", code: "VM14", reconciledAtExchange: false },
  { id: "m-7", name: "Report on title sent to the buyer", side: "purchaser", code: "PM18", reconciledAtExchange: false },
];

const UNDO_WITH_CASCADE: UndoImpact = {
  cascade: CASCADE_ITEMS,
  currentPercent: 78,
  targetOnlyPercent: 54,
  cascadePercent: 41,
};

const SURVEY_OPTIONS: SurveyBookingOption[] = [
  { quoteRequestId: "demo-quote-1", firmName: "Harding Surveyors", status: "pending", submittedAt: DATE_PAST },
  { quoteRequestId: "demo-quote-2", firmName: "Cornerstone Building Consultancy", status: "booked", submittedAt: DATE_PAST },
];

const SURVEY_OPTIONS_SINGLE: SurveyBookingOption[] = [SURVEY_OPTIONS[0]];

// Reopened-steps delta: 2 completed steps flip to not-required (loud warning).
const DELTA_WITH_REOPEN: SaleDetailsDelta = {
  noChange: false,
  becomingNr: [
    { id: "d-1", name: "Mortgage application submitted", code: "PM6", side: "purchaser", weight: 3, wasComplete: true },
    { id: "d-2", name: "Mortgage valuation booked", code: "PM7", side: "purchaser", weight: 2, wasComplete: true },
    { id: "d-3", name: "Mortgage offer received", code: "PM8", side: "purchaser", weight: 3, wasComplete: false },
  ],
  becomingRequired: [
    { id: "d-4", name: "Proof of funds received", code: "PM4", side: "purchaser", weight: 2, wasComplete: false },
  ],
  currentPercent: 64,
  projectedPercent: 52,
  currentRemaining: 9,
  projectedRemaining: 11,
};

const DELTA_NO_CHANGES: SaleDetailsDelta = {
  noChange: true,
  becomingNr: [],
  becomingRequired: [],
  currentPercent: 64,
  projectedPercent: 64,
  currentRemaining: 9,
  projectedRemaining: 9,
};

const DIARY_EXCHANGE: DiaryItem = {
  type: "exchange",
  transactionId: DEMO_TX_ID,
  address: ADDRESS,
  status: "ready",
};

const DIARY_COMPLETION: DiaryItem = {
  type: "completion",
  transactionId: DEMO_TX_ID,
  address: LONG_ADDRESS,
  status: "ready",
};

const CHAIN_MEMBERS: ChainMember[] = [
  { address: "12 Mill Lane, Leeds", status: "joined", progress: 84 },
  { address: ADDRESS, status: "you", progress: null },
  { address: "5 Beckside Court, Harrogate", status: "pending", progress: null },
  { address: LONG_ADDRESS, status: "joined", progress: 37 },
];

// One recipient with a single pending row, and another with two rows (the
// second recipient exercises the merged-digest path when a matching digest
// is supplied).
const CONFIRM_ITEMS_SINGLE: PendingQueueItem[] = [
  {
    id: "demo-q-1",
    recipientContactId: "demo-c-vendor",
    recipientName: NAME,
    recipientRole: "vendor",
    recipientEmail: "priya.c@example.com",
    milestoneCode: "VM10",
    subject: `Update on your sale of ${ADDRESS}`,
    bodyText: "Your draft contract has now been issued to the buyer's solicitor. We'll let you know the moment enquiries come back.",
    scheduledFor: DATE_TODAY,
    editedAt: null,
    isExchangeCompletion: false,
  },
];

const CONFIRM_ITEMS_MERGED: PendingQueueItem[] = [
  ...CONFIRM_ITEMS_SINGLE,
  {
    id: "demo-q-2",
    recipientContactId: "demo-c-purchaser",
    recipientName: "Tom & Rebecca Whitfield",
    recipientRole: "purchaser",
    recipientEmail: "t.whitfield@example.com",
    milestoneCode: "PM13",
    subject: "Searches ordered on your purchase",
    bodyText: "We've ordered the local searches on your purchase. These usually take two to three weeks to come back.",
    scheduledFor: DATE_TODAY,
    editedAt: null,
    isExchangeCompletion: false,
  },
  {
    id: "demo-q-3",
    recipientContactId: "demo-c-purchaser",
    recipientName: "Tom & Rebecca Whitfield",
    recipientRole: "purchaser",
    recipientEmail: "t.whitfield@example.com",
    milestoneCode: "PM16",
    subject: "Your mortgage offer is in",
    bodyText: "Your lender has issued the formal mortgage offer. Your solicitor has a copy and will review the conditions.",
    scheduledFor: DATE_TODAY,
    editedAt: null,
    isExchangeCompletion: false,
  },
];

// ── Entries ──────────────────────────────────────────────────────────────────

export const MODAL_ENTRIES: SheetEntry[] = [
  // ─────────────────────────────── Brokers & partners ────────────────────────
  {
    id: "modal-add-broker",
    name: "Add mortgage broker",
    type: "modal",
    area: "Brokers & partners",
    usedIn: "Broker picker · property file",
    file: "components/brokers/AddBrokerModal.tsx",
    componentName: "AddBrokerModal",
    note: "Prefilled firm name is selected on open so typing replaces it. Save posts to /api/broker-firms (no session here, so Save shows an error rather than creating).",
    preview: "overlay",
    states: [
      { id: "empty", label: "Empty", hint: "no prefill" },
      { id: "prefilled", label: "Long prefill", hint: "very long brokerage name" },
    ],
    render: ({ stateId, onClose }) => (
      <AddBrokerModal
        prefillName={stateId === "prefilled" ? LONG_FIRM : ""}
        onClose={onClose}
        onCreated={onClose}
      />
    ),
  },
  {
    id: "modal-partner-popup",
    name: "Add partner popup (shell)",
    type: "modal",
    area: "Brokers & partners",
    usedIn: "Partners page · add broker / add firm",
    file: "components/agent/partners/PartnerPopup.tsx",
    componentName: "PartnerPopup",
    note: "Generic responsive shell (centred card desktop, bottom sheet mobile, animated in AND out). Rendered here with fixture form content so the chrome and scroll can be judged.",
    preview: "overlay",
    states: [{ id: "default", label: "Default" }],
    render: ({ open, onClose }) => (
      <PartnerPopup open={open} onClose={onClose} ariaLabel="Add a partner" title="Add a partner">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="agent-section-label" style={{ display: "block", marginBottom: 6 }}>Firm name</label>
            <input className="agent-input" defaultValue={FIRM} readOnly />
          </div>
          <div>
            <label className="agent-section-label" style={{ display: "block", marginBottom: 6 }}>Contact email</label>
            <input className="agent-input" defaultValue={EMAIL} readOnly />
          </div>
          <button type="button" onClick={onClose} className="agent-btn agent-btn-color-primary" style={{ justifyContent: "center", padding: "10px 16px" }}>
            Save partner
          </button>
        </div>
      </PartnerPopup>
    ),
  },

  // ─────────────────────────────── Solicitors & contacts ─────────────────────
  {
    id: "modal-add-firm",
    name: "Add solicitor firm",
    type: "modal",
    area: "Solicitors & contacts",
    usedIn: "Solicitor picker · property file",
    file: "components/solicitors/AddFirmModal.tsx",
    componentName: "AddFirmModal",
    note: "lockFirm makes the firm field read-only and reframes as 'Add case handler'. Save posts to /api/solicitor-firms (errors here without a session).",
    preview: "overlay",
    states: [
      { id: "new-firm", label: "New firm", hint: "editable firm name" },
      { id: "lock-firm", label: "Add handler", hint: "firm locked, add a case handler" },
    ],
    render: ({ stateId, onClose }) => (
      <AddFirmModal
        prefillName={stateId === "lock-firm" ? LONG_FIRM : FIRM}
        lockFirm={stateId === "lock-firm"}
        onClose={onClose}
        onCreated={onClose}
      />
    ),
  },

  // ─────────────────────────────── Milestones ────────────────────────────────
  {
    id: "modal-undo-milestone",
    name: "Undo step",
    type: "modal",
    area: "Milestones",
    usedIn: "Milestone engine · undo a completed step",
    file: "components/milestones/UndoMilestoneModal.tsx",
    componentName: "UndoMilestoneModal",
    note: "No-cascade is a simple confirm with a before/after %. With-cascade offers the two-option picker; the cascade list is scrollable and collapses past 5 items (Show more).",
    preview: "overlay",
    states: [
      { id: "no-cascade", label: "No cascade", hint: "single step, no linked steps" },
      { id: "with-cascade", label: "With cascade", hint: "7 linked steps, 2 confirmed at exchange" },
    ],
    render: ({ stateId, onClose }) => (
      <UndoMilestoneModal
        milestoneName={stateId === "with-cascade" ? "Draft contract issued" : "Searches ordered"}
        milestoneId="demo-milestone-1"
        undoData={stateId === "with-cascade" ? UNDO_WITH_CASCADE : UNDO_NO_CASCADE}
        isPending={false}
        onConfirm={onClose}
        onCancel={onClose}
      />
    ),
  },
  {
    id: "modal-mortgage",
    name: "Mortgage buyer confirm",
    type: "modal",
    area: "Milestones",
    usedIn: "Milestone engine · re-open mortgage steps",
    file: "components/milestones/MortgageModal.tsx",
    componentName: "MortgageModal",
    note: "Three stacked choices: confirm mortgage buyer, re-open without changing type, or cancel.",
    preview: "overlay",
    states: [{ id: "default", label: "Default" }],
    render: ({ onClose }) => (
      <MortgageModal onConfirmMortgage={onClose} onConfirmReinstate={onClose} onCancel={onClose} />
    ),
  },
  {
    id: "modal-survey-nr-confirm",
    name: "Skip private survey confirm",
    type: "modal",
    area: "Milestones",
    usedIn: "Milestone engine · mark survey not required",
    file: "components/milestones/SurveyNrConfirmModal.tsx",
    componentName: "SurveyNrConfirmModal",
    note: "Small destructive-ish confirm. Fixed-width Cancel + flex primary.",
    preview: "overlay",
    states: [{ id: "default", label: "Default" }],
    render: ({ onClose }) => <SurveyNrConfirmModal onConfirm={onClose} onCancel={onClose} />,
  },
  {
    id: "modal-survey-booking",
    name: "Confirm survey booking",
    type: "modal",
    area: "Milestones",
    usedIn: "Milestone engine · survey booked step (with quotes)",
    file: "components/milestones/SurveyBookingModal.tsx",
    componentName: "SurveyBookingModal",
    note: "Date picker + which-surveyor selector. 'Booked someone else' reveals a name field; 'Not sure yet' shows a leave-quotes-open note.",
    preview: "overlay",
    states: [
      { id: "multi", label: "Two quotes", hint: "choose between two surveyors" },
      { id: "single", label: "One quote", hint: "single option in the list" },
    ],
    render: ({ stateId, onClose }) => (
      <SurveyBookingModal
        options={stateId === "single" ? SURVEY_OPTIONS_SINGLE : SURVEY_OPTIONS}
        saving={false}
        onConfirm={onClose}
        onCancel={onClose}
      />
    ),
  },
  {
    id: "modal-exchange-celebration",
    name: "Exchange celebration",
    type: "modal",
    area: "Milestones",
    usedIn: "Property file · confetti overlay on exchange",
    file: "components/milestones/ExchangeCelebration.tsx",
    componentName: "ExchangeCelebration",
    note: "Confetti canvas fires for ~3s on mount (respects reduced-motion). Tap backdrop or Continue to dismiss.",
    preview: "overlay",
    states: [
      { id: "short", label: "Short address" },
      { id: "long", label: "Long address", hint: "wraps the address line" },
    ],
    render: ({ stateId, onClose }) => (
      <ExchangeCelebration address={stateId === "long" ? LONG_ADDRESS : ADDRESS} onDismiss={onClose} />
    ),
  },

  // ─────────────────────────────── Property file ─────────────────────────────
  {
    id: "modal-automation-stop",
    name: "Stop automation chooser",
    type: "modal",
    area: "Property file",
    usedIn: "Automation banner · toggle off",
    file: "components/transaction/AutomationStopModal.tsx",
    componentName: "AutomationStopModal",
    note: "Two-step. 'choose' picks pause-vs-hold; picking hold advances to the return-date step. holdOnly opens straight on the date step.",
    preview: "overlay",
    states: [
      { id: "choose", label: "Choose", hint: "pause vs hold" },
      { id: "hold-only", label: "Hold only", hint: "skips straight to the date step" },
    ],
    render: ({ stateId, onClose }) => (
      <AutomationStopModal onPick={onClose} onClose={onClose} isPending={false} holdOnly={stateId === "hold-only"} />
    ),
  },
  {
    id: "modal-switch-service-type",
    name: "Switch service type",
    type: "modal",
    area: "Property file",
    usedIn: "Property hero · admin only",
    file: "components/transaction/SwitchServiceTypeModal.tsx",
    componentName: "SwitchServiceTypeModal",
    note: "Direction-aware copy. Confirm calls switchServiceTypeAction with DEMO_TX_ID (no record, so it returns an error rather than switching).",
    preview: "overlay",
    states: [
      { id: "to-outsourced", label: "To outsourced", hint: "current = self-managed" },
      { id: "to-self", label: "To self-progress", hint: "current = outsourced" },
    ],
    render: ({ open, stateId, onClose }) => (
      <SwitchServiceTypeModal
        open={open}
        transactionId={DEMO_TX_ID}
        current={stateId === "to-self" ? "outsourced" : "self_managed"}
        onClose={onClose}
      />
    ),
  },
  {
    id: "modal-sale-detail-change",
    name: "Sale detail change confirm",
    type: "modal",
    area: "Property file",
    usedIn: "Property hero · inline purchase-type / tenure change",
    file: "components/transaction/SaleDetailChangeModal.tsx",
    componentName: "SaleDetailChangeModal",
    note: "Loud reopened-steps warning at the top when completed steps flip to not-required, then the shared delta preview.",
    preview: "overlay",
    states: [
      { id: "loading", label: "Loading", hint: "checking what changes" },
      { id: "with-delta", label: "Reopens steps", hint: "2 completed steps reopened" },
      { id: "no-changes", label: "No changes" },
      { id: "error", label: "Error" },
    ],
    render: ({ open, stateId, onClose }) => (
      <SaleDetailChangeModal
        open={open}
        onClose={onClose}
        title="Change purchase type to cash?"
        delta={stateId === "loading" ? null : stateId === "no-changes" ? DELTA_NO_CHANGES : DELTA_WITH_REOPEN}
        loading={stateId === "loading"}
        confirming={false}
        error={stateId === "error" ? "Something went wrong working out the impact. Try again." : null}
        onConfirm={onClose}
      />
    ),
  },
  {
    id: "modal-relist-file",
    name: "Relist file",
    type: "modal",
    area: "Property file",
    usedIn: "Withdrawn file · relist to a new buyer",
    file: "components/transaction/RelistFileModal.tsx",
    componentName: "RelistFileModal",
    note: "Two-stage: buyer form then a locked confirm-copy stage. in-chain adds the buyer's-onward-sale step. Submit uses DEMO_TX_ID so the action throws and shows an error (no page reload).",
    preview: "overlay",
    states: [
      { id: "no-chain", label: "Not in chain", hint: "onward-sale step hidden" },
      { id: "in-chain", label: "In chain", hint: "onward-sale step shown" },
    ],
    render: ({ open, stateId, onClose }) => (
      <RelistFileModal
        open={open}
        transactionId={DEMO_TX_ID}
        previousPurchasePrice={PRICE_PENCE}
        inChain={stateId === "in-chain"}
        onClose={onClose}
      />
    ),
  },
  {
    id: "modal-revise-exchange-banner",
    name: "Revise exchange date",
    type: "modal",
    area: "Property file",
    usedIn: "Property file top · overdue-exchange banner",
    file: "components/transaction/ReviseExchangeBanner.tsx",
    componentName: "ReviseExchangeBanner",
    note: "Renders the warning banner. Click 'Set a new date' to open the modal. Save is hard-blocked until 'spoken to both parties' is ticked.",
    preview: "overlay",
    states: [{ id: "default", label: "Default" }],
    render: () => (
      <ReviseExchangeBanner transactionId={DEMO_TX_ID} address={ADDRESS} passedDateIso={DATE_PAST} />
    ),
  },
  {
    id: "modal-status-control",
    name: "Status control + dialogs",
    type: "modal",
    area: "Property file",
    usedIn: "Property file · status pill",
    file: "components/transaction/StatusControl.tsx",
    componentName: "StatusControl",
    note: "Renders the status pill. Click it to open the dropdown, then pick a status to open one of three dialogs: withdraw (reason picker), on-hold (date), resume (from on_hold).",
    preview: "overlay",
    states: [
      { id: "active", label: "Active", hint: "pick Withdrawn / On hold to open dialogs" },
      { id: "on_hold", label: "On hold", hint: "pick Active to open the resume dialog" },
    ],
    render: ({ stateId }) => (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 120 }}>
        <StatusControl transactionId={DEMO_TX_ID} currentStatus={stateId === "on_hold" ? "on_hold" : "active"} inChain />
      </div>
    ),
  },
  {
    id: "modal-exchange-day-control",
    name: "Exchange day control",
    type: "modal",
    area: "Property file",
    usedIn: "Property hero · exchange-day control",
    file: "components/transaction/ExchangeDayControl.tsx",
    componentName: "ExchangeDayControl",
    note: "Inactive shows a 'Start exchange day' button opening a confirm (requires a completion date). Active shows the chip + 'Not today' opening the end confirm.",
    preview: "overlay",
    states: [
      { id: "not-active", label: "Inactive", hint: "click Start exchange day" },
      { id: "active", label: "Active", hint: "click Not today" },
    ],
    render: ({ stateId }) => (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 120 }}>
        <ExchangeDayControl
          transactionId={DEMO_TX_ID}
          active={stateId === "active"}
          completionDate={DATE_TODAY}
          authority={stateId === "active" ? { seller: "given", buyer: "waiting" } : null}
        />
      </div>
    ),
  },

  // ─────────────────────────────── Completions ───────────────────────────────
  {
    id: "modal-diary-event-row",
    name: "Diary event confirm",
    type: "modal",
    area: "Completions",
    usedIn: "Hub · today's diary row",
    file: "components/hub/DiaryEventRow.tsx",
    componentName: "DiaryEventRow",
    note: "Renders the diary row. Click 'Confirm exchange/completion' to open the confirm modal. Confirm calls confirmDiaryEventAction with DEMO_TX_ID (no record, so it surfaces a gate/error message).",
    preview: "overlay",
    states: [
      { id: "exchange", label: "Exchange", hint: "coral accent" },
      { id: "completion", label: "Completion", hint: "success accent, long address" },
    ],
    render: ({ stateId }) => (
      <div style={{ maxWidth: 520, margin: "120px auto 0", borderRadius: 12, overflow: "hidden", border: "0.5px solid var(--agent-border-subtle)" }}>
        <DiaryEventRow item={stateId === "completion" ? DIARY_COMPLETION : DIARY_EXCHANGE} isFirst />
      </div>
    ),
  },

  // ─────────────────────────────── Chains ────────────────────────────────────
  {
    id: "modal-claim-welcome",
    name: "Claim welcome (chain)",
    type: "modal",
    area: "Chains",
    usedIn: "Freshly-claimed chain file · first visit",
    file: "components/transaction/ClaimWelcomeModal.tsx",
    componentName: "ClaimWelcomeModal",
    note: "CAVEAT: self-gates on the ?newUser=1 URL param, so it renders nothing here unless that param is present. Visit /dev/sheets?newUser=1 with this open to see it. Props/fixtures are wired for when it does show.",
    preview: "overlay",
    states: [{ id: "default", label: "Default" }],
    render: () => (
      <ClaimWelcomeModal
        address={ADDRESS}
        originatorAgency="Hartwell & Co"
        members={CHAIN_MEMBERS}
        connectedCount={CHAIN_MEMBERS.length}
      />
    ),
  },

  // ─────────────────────────────── My Files ──────────────────────────────────
  {
    id: "modal-duplicate-address",
    name: "Duplicate address",
    type: "modal",
    area: "My Files",
    usedIn: "New sale form · address clash",
    file: "components/transactions-v2/DuplicateAddressModal.tsx",
    componentName: "DuplicateAddressModal",
    note: "'View existing file' is a Link to the duplicate; 'Create anyway' fires onForceCreate. Assignee line only shows when assignedTo is set.",
    preview: "overlay",
    states: [
      { id: "assigned", label: "Assigned", hint: "shows 'Assigned to …'" },
      { id: "unassigned", label: "Unassigned" },
    ],
    render: ({ stateId, onClose }) => (
      <DuplicateAddressModal
        address={ADDRESS}
        duplicateId={DEMO_TX_ID}
        assignedTo={stateId === "assigned" ? NAME : null}
        onClose={onClose}
        onForceCreate={onClose}
      />
    ),
  },
  {
    id: "modal-nav-away",
    name: "Save draft on nav-away",
    type: "modal",
    area: "My Files",
    usedIn: "New sale form · unsaved changes guard",
    file: "components/transactions-v2/NavAwayModal.tsx",
    componentName: "NavAwayModal",
    note: "Three actions: discard / stay / save. Saving state disables the save button.",
    preview: "overlay",
    states: [
      { id: "default", label: "Default" },
      { id: "saving", label: "Saving", hint: "save button busy" },
    ],
    render: ({ stateId, onClose }) => (
      <NavAwayModal isSaving={stateId === "saving"} onDiscard={onClose} onStay={onClose} onSave={onClose} />
    ),
  },
  {
    id: "modal-change-file",
    name: "Change memo confirm",
    type: "modal",
    area: "My Files",
    usedIn: "New sale form · replace with new memo",
    file: "components/transactions-v2/form/ChangeFileModal.tsx",
    componentName: "ChangeFileModal",
    note: "Small warning confirm (amber top border). Change file / Cancel.",
    preview: "overlay",
    states: [{ id: "default", label: "Default" }],
    render: ({ onClose }) => <ChangeFileModal onConfirm={onClose} onCancel={onClose} />,
  },
  {
    id: "modal-submission-overlay",
    name: "Submission overlay",
    type: "modal",
    area: "My Files",
    usedIn: "New sale form · building-your-file overlay",
    file: "components/transactions-v2/SubmissionOverlay.tsx",
    componentName: "SubmissionOverlay",
    note: "Full-screen spinner that cycles through building messages every ~1.1s. isVisible is wired to the inspector's open state.",
    preview: "overlay",
    states: [{ id: "default", label: "Default" }],
    render: ({ open }) => <SubmissionOverlay isVisible={open} />,
  },
  {
    id: "modal-missing-fee-row",
    name: "Missing-fee row + popover",
    type: "modal",
    area: "My Files",
    usedIn: "Analytics · files missing a fee",
    file: "components/analytics/MissingFeeRow.tsx",
    componentName: "MissingFeeRow",
    note: "Renders the row. Click 'Set fee' to open the fee popover (desktop) / sheet (mobile). Save uses DEMO_TX_ID so it errors rather than persisting.",
    preview: "overlay",
    states: [
      { id: "default", label: "Default" },
      { id: "awaiting", label: "Awaiting assignment", hint: "owner line in warning colour" },
    ],
    render: ({ stateId }) => (
      <div style={{ maxWidth: 560, margin: "120px auto 0", borderRadius: 12, overflow: "hidden", border: "0.5px solid var(--agent-border-subtle)", background: "var(--agent-surface-elevated)" }}>
        <MissingFeeRow
          id={DEMO_TX_ID}
          propertyAddress={ADDRESS}
          ownerLine={stateId === "awaiting" ? "Awaiting assignment" : NAME}
          awaitingAssignment={stateId === "awaiting"}
          txBasePath="/agent/transactions"
        />
      </div>
    ),
  },

  // ─────────────────────────────── Auto emails ───────────────────────────────
  {
    id: "modal-email-preview",
    name: "Email preview / edit",
    type: "modal",
    area: "Auto emails",
    usedIn: "Automated emails · preview a queued email",
    file: "components/email/EmailPreviewModal.tsx",
    componentName: "EmailPreviewModal",
    note: "Fetches getEmailForPreview on mount. With DEMO ids and no session it resolves to the load-error state — a valid state to review.",
    preview: "overlay",
    states: [{ id: "default", label: "Default", hint: "load error (no backing record)" }],
    render: ({ onClose }) => <EmailPreviewModal emailId="demo-email-1" onClose={onClose} onSaved={onClose} />,
  },
  {
    id: "modal-confirm-review",
    name: "Confirm review queue",
    type: "modal",
    area: "Auto emails",
    usedIn: "Property file · confirm-review tray",
    file: "components/confirm-review/ConfirmReviewModal.tsx",
    componentName: "ConfirmReviewModal",
    note: "CAVEAT: 'Send now' really flushes the batch, but it calls server actions with DEMO_TX_ID (no record) so nothing sends. onChange is a no-op. single = 1 editable email; merged = a recipient with 2+ rows.",
    preview: "overlay",
    states: [
      { id: "single", label: "Single emails", hint: "one row per recipient" },
      { id: "merged", label: "Merged digest", hint: "purchaser has 2+ rows" },
      { id: "loading", label: "Loading" },
      { id: "empty", label: "Empty" },
    ],
    render: ({ open, stateId, onClose }) => (
      <ConfirmReviewModal
        open={open}
        onClose={onClose}
        transactionId={DEMO_TX_ID}
        items={stateId === "empty" ? [] : stateId === "merged" ? CONFIRM_ITEMS_MERGED : CONFIRM_ITEMS_SINGLE}
        loading={stateId === "loading"}
        onChange={noop}
      />
    ),
  },

  // ─────────────────────────────── Billing ───────────────────────────────────
  {
    id: "modal-billing-negotiator",
    name: "Billing (negotiator)",
    type: "modal",
    area: "Billing",
    usedIn: "User dropdown · negotiator clicks Billing",
    file: "components/billing/BillingNegotiatorModal.tsx",
    componentName: "BillingNegotiatorModal",
    note: "Explains billing is director-only. 'Make me the director' posts to /api/agent/promote-to-director (errors without a session); 'Invite a director' is a Link.",
    preview: "overlay",
    states: [{ id: "default", label: "Default" }],
    render: ({ open, onClose }) => <BillingNegotiatorModal open={open} onClose={onClose} />,
  },

  // ─────────────────────────────── Onboarding & account ──────────────────────
  {
    id: "modal-welcome",
    name: "Welcome modal",
    type: "modal",
    area: "Onboarding & account",
    usedIn: "Agent hub · first sign-in welcome",
    file: "components/agent/WelcomeModal.tsx",
    componentName: "WelcomeModal",
    note: "Fires markWelcomeSeenAction on mount (server action; caught no-op without a session). Copy adapts to the agency mode profile. 'Add a sale' routes away.",
    preview: "overlay",
    states: [
      { id: "self", label: "Self-progressed" },
      { id: "managed", label: "Progressor-managed" },
      { id: "mixed", label: "Mixed" },
    ],
    render: ({ stateId }) => (
      <WelcomeModal
        agencyModeProfile={stateId === "managed" ? "progressor_managed" : stateId === "mixed" ? "mixed" : "self_progressed"}
      />
    ),
  },
  {
    id: "modal-account-danger-zone",
    name: "Account danger zone",
    type: "modal",
    area: "Onboarding & account",
    usedIn: "Account tab · export + delete",
    file: "components/account/v2/AccountDangerZonePlain.tsx",
    componentName: "AccountDangerZonePlain",
    note: "Renders the export/delete section. Click 'Delete my account' to open the email-confirmation modal. CAVEAT: confirming calls deleteMyAccount and signs out — destructive; don't confirm here.",
    preview: "overlay",
    states: [{ id: "default", label: "Default" }],
    render: () => (
      <div style={{ maxWidth: 560, margin: "100px auto 0" }}>
        <AccountDangerZonePlain userEmail={EMAIL} />
      </div>
    ),
  },

  // ─────────────────────────────── Global chrome ─────────────────────────────
  {
    id: "modal-feedback-widget",
    name: "Feedback widget",
    type: "modal",
    area: "Global chrome",
    usedIn: "Agent shell · floating feedback button",
    file: "components/feedback/FeedbackWidget.tsx",
    componentName: "FeedbackWidget",
    note: "Renders the floating trigger (bottom-right). Click it to open the category → form → success/error panel.",
    preview: "overlay",
    states: [{ id: "default", label: "Default" }],
    render: () => <FeedbackWidget />,
  },
];
