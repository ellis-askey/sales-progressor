"use client";
// Modal / dialog entries for the /dev/sheets catalogue. See types.ts.
//
// Every entry mounts a REAL production modal/dialog with edge-case fixtures
// so a reviewer can inspect each visual state against the live agent
// background. All action handlers are wired to ctx.onClose (or noop) and every
// id is a "demo-*" so any server action that escapes a handler hits a
// non-existent record and no-ops rather than mutating live data.
//
// NOT REGISTRABLE (inspect in situ — listed here so the sweep is honest):
//   - MapView's Street View modal (components/transactions/map/MapView.tsx) —
//     only reachable by clicking a sale pin on the live MapLibre canvas, which
//     needs client-side postcode geocoding (postcodes.io network calls) plus a
//     configured Google Maps key before the iframe shows anything beyond the
//     key-missing line. The overlay is defined inline with no standalone
//     export to mount.

import { useEffect } from "react";
import type { SheetEntry } from "./types";
import {
  DEMO_TX_ID,
  ADDRESS,
  LONG_ADDRESS,
  NAME,
  LONG_NAME,
  FIRM,
  LONG_FIRM,
  EMAIL,
  LONG_EMAIL,
  PRICE_PENCE,
  DATE_TODAY,
  DATE_PAST,
  noop,
} from "./fixtures";

// ── Real components ──────────────────────────────────────────────────────────
import { AddBrokerModal } from "@/components/brokers/AddBrokerModal";
import { PartnerPopup } from "@/components/agent/partners/PartnerPopup";
import { BrokerForm } from "@/components/agent/PreferredBrokerSettings";
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
import { ClaimLoginForm } from "@/components/claim/ClaimLoginForm";
import "@/app/claim/styles/claim-flow.css";
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
// Completeness sweep additions (2026-09-19)
import { ConfirmMilestoneDateModal } from "@/components/milestones/ConfirmMilestoneDateModal";
import { ChangeBookingDateModal } from "@/components/milestones/ChangeBookingDateModal";
import { AutoChasePreviewModal } from "@/components/reminders/AutoChasePreviewModal";
import { AddClientEmailModal } from "@/components/reminders/AddClientEmailModal";
import { ReachOutModal } from "@/components/todos/ReachOutModal";
import { WhatsappGroupModal } from "@/components/contacts/WhatsappGroupModal";
import { AddSolicitorModal } from "@/components/enquiries/AddSolicitorModal";
import { EnquiryLogSheet } from "@/components/enquiries/EnquiryLogSheet";
import { EnquiryEmailPreview } from "@/components/enquiries/EnquiryEmailPreview";
import { AgentDocumentUpload } from "@/components/transaction/AgentDocumentUpload";
import { TrialExpiredModal } from "@/components/billing/TrialExpiredModal";
import { WithdrawFileModal } from "@/components/transaction/WithdrawFileModal";
import { ResumeFileModal } from "@/components/transaction/ResumeFileModal";
import { ReviseExchangeDateModal } from "@/components/transaction/ReviseExchangeDateModal";
// Gap sweep additions (2026-10-20)
import { SentEmailModal } from "@/components/transaction/SentEmailModal";
import { LogUpdateModal } from "@/components/activity/LogUpdateModal";
import { ComposeEmailModal } from "@/components/compose/ComposeEmailModal";
import { SurveyEmailModal } from "@/components/milestones/SurveyEmailModal";
import { OnwardNudgeModal } from "@/components/transaction/OnwardNudgeModal";
import { ReassignOwnerControl } from "@/components/transaction/ReassignOwnerControl";
import { SelfManagedWelcomeModal } from "@/components/agent/SelfManagedWelcomeModal";
import { ProgressorWelcomeModal } from "@/components/agent/ProgressorWelcomeModal";
import { AddCardGateModal } from "@/components/progression/AddCardGateModal";
import { useDemoExplore } from "@/components/transactions-v2/useDemoExplore";
// Gap sweep batch 2 (2026-10-20) — cards/lists that own an embedded modal
import { PropertyFlagsCard } from "@/components/transaction/PropertyFlagsCard";
import { HousingAssociationSection } from "@/components/transaction/HousingAssociationSection";
import { AttentionCard } from "@/components/hub/AttentionCard";
import { CheckInsList } from "@/components/chain/CheckInsList";
import { EnquiriesTriageList } from "@/components/enquiries/EnquiriesTriageList";
import { DemoTourController } from "@/components/transaction/demo-tour/DemoTourController";
import { DEMO_TOUR_STEPS, type TourStep } from "@/components/transaction/demo-tour/types";
import { ClientsWorkspace } from "@/components/progression/ClientsWorkspace";
import { ClientPeople } from "@/components/progression/ClientPeople";
import { BusinessTeamView } from "@/components/progression/BusinessTeamView";
import { ContactsSection } from "@/components/contacts/ContactsSection";
import { CHECK_IN_STEPS } from "@/lib/chain/check-in-steps";

// ── Component prop-shape types (imported so fixtures match precisely) ─────────
import type { UndoImpact, UndoImpactItem } from "@/lib/services/milestones";
import type { SurveyBookingOption } from "@/lib/services/survey-booking";
import type { SaleDetailsDelta } from "@/app/actions/transactions";
import type { DiaryItem } from "@/lib/services/hub";
import type { ChainMember } from "@/components/transaction/ClaimWelcomeModal";
import type { MilestoneDefinitionLite } from "@/components/milestones/ReconcileMilestonePicker";
import type { PendingQueueItem } from "@/app/actions/confirm-review-queue";
import type { AssignableAgent } from "@/lib/services/agency-team";
import type { ProgressorChasePrefs } from "@/lib/services/progressor-chase-prefs";
import type { CardGatePreview, GateNotice } from "@/components/progression/AddCardGateModal";
// Gap sweep batch 2 (2026-10-20) prop-shape types
import type { ExpiredHoldItem } from "@/lib/services/hub";
import type { CheckInRow } from "@/lib/services/chains";
import type { OpenEnquiryRow } from "@/lib/services/enquiries";
import type {
  ClientsOverview,
  OutgoingConnectionRequest,
  AgencyPerson,
  RemovedPerson,
  BusinessTeamMember,
} from "@/lib/services/progression-clients";

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

// Change to cash (cash buyer): the three mortgage steps drop to not-required.
// Two were complete, so this fires the loud "confirmed work will be cleared"
// warning. Nothing re-activates going TO cash — the deposit step only comes
// back when a buyer LEAVES cash-from-proceeds. Real milestone names + codes.
const DELTA_WITH_REOPEN: SaleDetailsDelta = {
  noChange: false,
  becomingNr: [
    { id: "d-1", name: "Submit mortgage application", code: "PM5", side: "purchaser", weight: 3, wasComplete: true },
    { id: "d-2", name: "Lender valuation booked", code: "PM6", side: "purchaser", weight: 2, wasComplete: true },
    { id: "d-3", name: "Mortgage offer received", code: "PM11", side: "purchaser", weight: 3, wasComplete: false },
  ],
  becomingRequired: [],
  currentPercent: 64,
  projectedPercent: 58,
  currentRemaining: 9,
  projectedRemaining: 8,
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
  photoStoragePath: null,
  status: "ready",
};

const DIARY_COMPLETION: DiaryItem = {
  type: "completion",
  transactionId: DEMO_TX_ID,
  address: LONG_ADDRESS,
  photoStoragePath: null,
  status: "ready",
};

// Minimal milestone set for the claim-login fixture's reconcile picker.
const CLAIM_LOGIN_DEFS: MilestoneDefinitionLite[] = [
  { id: "dev-vm1", code: "VM1", name: "Seller has instructed their solicitor", side: "vendor", orderIndex: 1, blocksExchange: true },
  { id: "dev-vm2", code: "VM2", name: "Seller has received the memorandum of sale", side: "vendor", orderIndex: 2, blocksExchange: true },
  { id: "dev-vm3", code: "VM3", name: "Seller has received the welcome pack from their solicitor", side: "vendor", orderIndex: 3, blocksExchange: true },
  { id: "dev-pm1", code: "PM1", name: "Buyer has instructed their solicitor", side: "purchaser", orderIndex: 1, blocksExchange: true },
  { id: "dev-pm3", code: "PM3", name: "Buyer has completed ID and AML checks", side: "purchaser", orderIndex: 3, blocksExchange: true },
];

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
    portalUrl: "https://portal.thesalesprogressor.co.uk/portal/demo",
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
    portalUrl: "https://portal.thesalesprogressor.co.uk/portal/demo",
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
    portalUrl: "https://portal.thesalesprogressor.co.uk/portal/demo",
    scheduledFor: DATE_TODAY,
    editedAt: null,
    isExchangeCompletion: false,
  },
];

// ── Gap-sweep fixtures (2026-10-20) ──────────────────────────────────────────

// LogUpdateModal takes its own narrow contact/solicitor shapes (roleType drives
// the seller/buyer split; solicitor role must be "Vendor solicitor" to sit left).
const LOG_CONTACTS = [
  { id: "demo-c1", name: NAME, roleType: "vendor", phone: "07700 900111" },
  { id: "demo-c2", name: "Tom Whitfield", roleType: "purchaser", phone: "07700 900222" },
  { id: "demo-c3", name: "Rebecca Whitfield", roleType: "purchaser", phone: null },
];
const LOG_SOLICITORS = [
  { id: "demo-s1", name: "Margaret Osei-Bonsu", role: "Vendor solicitor", phone: "0113 496 0000" },
  { id: "demo-s2", name: LONG_NAME, role: "Purchaser solicitor", phone: "020 7946 0000" },
];

const ASSIGNABLE_AGENTS: AssignableAgent[] = [
  { id: "demo-user-1", name: NAME, email: "priya@hartwell.co.uk", role: "director" },
  { id: "demo-user-2", name: "Jordan Blake", email: "jordan@hartwell.co.uk", role: "negotiator" },
  { id: "demo-user-3", name: LONG_NAME, email: LONG_EMAIL, role: "negotiator" },
];

const CHASE_PREFS_ALL: ProgressorChasePrefs = {
  client: true, solicitor: true, enquiries: true, weekly: true, chain: true,
};

const CARD_GATE_PREVIEW: CardGatePreview = {
  dueTodayPence: 4377, // fractional so the 2dp formatting shows
  daysLeft: 12,
  monthLabel: "October",
  nextPaymentLabel: "1 November",
  basePence: 9900,
  perSalePence: 500,
  perMemberPence: 3900,
};

const CARD_GATE_NOTICE: GateNotice = {
  title: "Your plan is paused",
  body: "New sales are on hold while the plan is paused. Restart billing to add this sale.",
  actionLabel: "Go to billing",
  actionHref: "/agent/settings/billing",
};

// useDemoExplore is a hook returning { launch, node } — this thin harness mounts
// it the way DemoHeroCard / AllFilesEmptyState do, auto-launching the intro on
// mount. The hook owns its own dismissal (X / Escape / backdrop); there is no
// close callback to wire, so remounting the entry replays it.
function DemoExploreHarness() {
  const { launch, node } = useDemoExplore();
  useEffect(() => {
    launch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{node}</>;
}

// ── Gap-sweep batch 2 fixtures (2026-10-20) — embedded-modal owners ───────────

// AttentionCard consumes page-decorated items (photoUrl already signed). Two
// expired holds put the "Take off hold" / "Extend hold" actions on screen.
const ATTENTION_HOLDS: Array<ExpiredHoldItem & { photoUrl: string | null }> = [
  {
    transactionId: DEMO_TX_ID,
    propertyAddress: ADDRESS,
    plannedEndAt: new Date(DATE_PAST),
    startedAt: new Date("2026-08-01"),
    agencyName: "Hartwell & Co",
    reason: "Probate pending",
    placedByName: NAME,
    photoStoragePath: null,
    photoUrl: null,
  },
  {
    transactionId: "demo-transaction-0001",
    propertyAddress: LONG_ADDRESS,
    plannedEndAt: new Date(DATE_PAST),
    startedAt: new Date("2026-07-15"),
    agencyName: null,
    reason: null,
    placedByName: null,
    photoStoragePath: null,
    photoUrl: null,
  },
];

// Two nodes in one chain: a claimed neighbour WITH history (so the overflow
// menu offers "Update history") and a never-logged unclaimed stub, which
// floats to the top of the group by design.
const CHECK_IN_ROWS: CheckInRow[] = [
  {
    linkId: "demo-link-1",
    transactionId: "demo-transaction-0001",
    ourTransactionId: DEMO_TX_ID,
    address: "3 Orchard Way, Surbiton",
    agentName: "Jordan Blake",
    firmName: "Oak & Key",
    agentEmail: "jordan@oakandkey.co.uk",
    agentPhone: "07700 900444",
    claimed: true,
    progressPercent: 62,
    photoUrl: null,
    lastUpdateAt: "2026-08-20T10:00:00.000Z",
    lastUpdateBody: "Spoke to their agent. Searches are back and replies to enquiries are being drafted.",
    history: [
      { at: "2026-08-20T10:00:00.000Z", body: "Spoke to their agent. Searches are back and replies to enquiries are being drafted." },
      { at: "2026-08-06T09:30:00.000Z", body: "Left a voicemail chasing the mortgage offer." },
      { at: "2026-07-28T16:10:00.000Z", body: "Their agent says the survey is booked for next week." },
    ],
    steps: CHECK_IN_STEPS.slice(0, 4).map((s) => s.key),
    chainId: "demo-chain-1",
    chainName: "Oakwood Avenue chain",
    ourAddresses: [ADDRESS],
  },
  {
    linkId: "demo-link-2",
    transactionId: null,
    ourTransactionId: DEMO_TX_ID,
    address: LONG_ADDRESS,
    agentName: null,
    firmName: null,
    agentEmail: null,
    agentPhone: null,
    claimed: false,
    progressPercent: null,
    photoUrl: null,
    lastUpdateAt: null,
    lastUpdateBody: null,
    history: [],
    steps: [],
    chainId: "demo-chain-1",
    chainName: "Oakwood Avenue chain",
    ourAddresses: [ADDRESS],
  },
];

// One open enquiry loop in each court, so both drag directions on the court
// slider (and both resting reads) are on screen.
const ENQUIRY_ROWS: OpenEnquiryRow[] = [
  {
    transactionId: DEMO_TX_ID,
    address: ADDRESS,
    photoStoragePath: null,
    price: PRICE_PENCE,
    tenure: "freehold",
    currentlyWith: "seller_solicitor",
    status: "chasing",
    quietSince: new Date(DATE_PAST),
    quietDays: 6,
    chaseCount: 2,
    outstandingNote: "Replies to 12 enquiries outstanding",
    expectedDate: null,
    restingUntil: null,
    restingReason: null,
    awaitingPack: false,
    canHoldForPack: false,
    needsAttention: true,
    stalled: false,
    nextChaseAt: new Date(DATE_TODAY),
    chaseBar: { stage: "chase", progress: 0.8 },
    openedAt: new Date("2026-08-05"),
    partial: false,
    lastMovement: { note: "Chased the seller's solicitor by phone", kind: "chased", occurredAt: new Date(DATE_PAST), byName: NAME },
    clientNames: NAME,
    vendorSolicitor: FIRM,
    purchaserSolicitor: LONG_FIRM,
    vendorSolicitorEmail: EMAIL,
    purchaserSolicitorEmail: LONG_EMAIL,
    parties: [
      { id: "vsol", label: FIRM, side: "vendor", kind: "solicitor" },
      { id: "psol", label: LONG_FIRM, side: "purchaser", kind: "solicitor" },
      { id: "demo-c-vendor", label: NAME, side: "vendor", kind: "client", contactId: "demo-c-vendor", email: "priya.c@example.com" },
    ],
  },
  {
    transactionId: "demo-transaction-0001",
    address: LONG_ADDRESS,
    photoStoragePath: null,
    price: 32500000,
    tenure: "leasehold",
    currentlyWith: "buyer_solicitor",
    status: "chasing",
    quietSince: new Date(DATE_PAST),
    quietDays: 3,
    chaseCount: 0,
    outstandingNote: null,
    expectedDate: null,
    restingUntil: null,
    restingReason: null,
    awaitingPack: false,
    canHoldForPack: true,
    needsAttention: false,
    stalled: false,
    nextChaseAt: null,
    chaseBar: { stage: "chase", progress: 0.35 },
    openedAt: new Date("2026-08-12"),
    partial: false,
    lastMovement: { note: "Replies received in full", kind: "replies_received", occurredAt: new Date(DATE_PAST), byName: null },
    clientNames: "Tom & Rebecca Whitfield",
    vendorSolicitor: FIRM,
    purchaserSolicitor: LONG_FIRM,
    vendorSolicitorEmail: EMAIL,
    purchaserSolicitorEmail: LONG_EMAIL,
    parties: [
      { id: "vsol", label: FIRM, side: "vendor", kind: "solicitor" },
      { id: "psol", label: LONG_FIRM, side: "purchaser", kind: "solicitor" },
    ],
  },
];

// The guided tour spotlights whatever its step selector resolves to, so one
// fixture step (real production copy) targets the stage card the entry mounts.
// The veil, ring and guide card then render exactly as production draws them;
// the full 6-step story itself only makes sense on the live demo file.
const TOUR_FIXTURE_STEPS: TourStep[] = [
  {
    id: DEMO_TOUR_STEPS[0].id,
    target: "[data-demo-tour-stage]",
    placement: "bottom",
    title: DEMO_TOUR_STEPS[0].title,
    body: DEMO_TOUR_STEPS[0].body,
    advance: "continue",
  },
];

const CLIENTS_OVERVIEW: ClientsOverview = {
  business: { name: "Harbour & Co Sale Progression", shortName: "Harbour & Co" },
  totals: { agencies: 2, activeSales: 14, pipelinePence: 123400000, exchangedThisMonth: 3 },
  clients: [
    { linkId: "demo-cl-1", agencyId: "demo-agency-1", name: "Hartwell & Co Estate Agents", contact: NAME, email: EMAIL, pending: false, logoUrl: null, tileColor: null, people: 4, active: 9, pipelinePence: 89200000, exchanged: 2, status: "active", removed: false },
    { linkId: "demo-cl-2", agencyId: "demo-agency-2", name: "Featherstonehaugh & Worthington-Smythe Residential Sales and Lettings", contact: "Jordan Blake", email: null, pending: true, logoUrl: null, tileColor: null, people: 1, active: 5, pipelinePence: 34200000, exchanged: 1, status: "invite", removed: false },
    { linkId: "demo-cl-3", agencyId: "demo-agency-3", name: "Beckside Homes", contact: "Sam Rai", email: null, pending: false, logoUrl: null, tileColor: null, people: 0, active: 0, pipelinePence: 0, exchanged: 0, status: "removed", removed: true },
  ],
};

const CLIENT_REQUESTS: OutgoingConnectionRequest[] = [
  { id: "demo-req-1", agencyId: "demo-agency-4", agencyName: "Oak & Key", createdAt: new Date(DATE_PAST) },
];

const CLIENT_PEOPLE: AgencyPerson[] = [
  { id: "demo-p-1", name: NAME, email: EMAIL, role: "director", pending: false, image: null, canViewAll: true, inviteExpiresAt: null, lastLoginAt: Date.now() - 2 * 86400000 },
  { id: "demo-p-2", name: "Jordan Blake", email: "jordan@hartwell.co.uk", role: "negotiator", pending: false, image: null, canViewAll: false, inviteExpiresAt: null, lastLoginAt: Date.now() - 16 * 86400000 },
  { id: "demo-p-3", name: LONG_NAME, email: LONG_EMAIL, role: "negotiator", pending: true, image: null, canViewAll: true, inviteExpiresAt: Date.now() + 5 * 86400000, lastLoginAt: null },
];

const CLIENT_PEOPLE_REMOVED: RemovedPerson[] = [
  { id: "demo-p-4", name: "Sam Rai", email: "sam@hartwell.co.uk", image: null },
];

const BUSINESS_TEAM: BusinessTeamMember[] = [
  { id: "demo-m-1", name: NAME, email: "priya@harbourprogression.co.uk", role: "owner", canViewAllFiles: true, isYou: true, pending: false, removed: false, image: null, imageFocusX: 50, imageFocusY: 50 },
  { id: "demo-m-2", name: "Jordan Blake", email: "jordan@harbourprogression.co.uk", role: "progressor", canViewAllFiles: false, isYou: false, pending: false, removed: false, image: null, imageFocusX: 50, imageFocusY: 50 },
  { id: "demo-m-3", name: LONG_NAME, email: LONG_EMAIL, role: "progressor", canViewAllFiles: true, isYou: false, pending: true, removed: false, image: null, imageFocusX: 50, imageFocusY: 50 },
  { id: "demo-m-4", name: "Sam Rai", email: "sam@harbourprogression.co.uk", role: "progressor", canViewAllFiles: false, isYou: false, pending: false, removed: true, image: null, imageFocusX: 50, imageFocusY: 50 },
];

// ContactsSection's Contact prop shape is internal to the component, so this
// fixture matches it structurally: both principals plus a non-principal helper.
const SECTION_CONTACTS = [
  { id: "demo-c-vendor", name: NAME, phone: "07700 900111", email: "priya.c@example.com", roleType: "vendor", portalToken: "demo-portal-token", createdAt: new Date(DATE_PAST), lastVisitedPortalAt: new Date(DATE_PAST), isPrincipal: true },
  { id: "demo-c-purchaser", name: "Tom & Rebecca Whitfield", phone: "07700 900222", email: "t.whitfield@example.com", roleType: "purchaser", portalToken: null, createdAt: new Date(DATE_PAST), isPrincipal: true },
  { id: "demo-c-helper", name: "Sam Rai", phone: null, email: "sam.rai@example.com", roleType: "vendor", portalToken: null, createdAt: new Date(DATE_PAST), isPrincipal: false, portalEligible: false },
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
    name: "Add partner (mortgage broker)",
    type: "modal",
    area: "Brokers & partners",
    usedIn: "Partners page · add broker / add firm",
    file: "components/agent/partners/PartnerPopup.tsx",
    componentName: "PartnerPopup",
    note: "The real add-broker form inside the PartnerPopup shell (responsive: centred card desktop, bottom sheet mobile). Save posts to the API (errors here without a session). The solicitor variant uses the same shell + AddSolicitorForm.",
    preview: "overlay",
    states: [{ id: "default", label: "Default" }],
    render: ({ open, onClose }) => (
      <PartnerPopup
        open={open}
        onClose={onClose}
        ariaLabel="Add mortgage broker"
        title="Add mortgage broker"
        subtitle="The mortgage broker your agency works with."
      >
        <BrokerForm initial={null} isEdit={false} onCancel={onClose} onSaved={() => onClose()} />
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
    name: "Re-open mortgage steps",
    type: "modal",
    area: "Milestones",
    usedIn: "Milestone engine · reinstate a cash buyer's mortgage step",
    file: "components/milestones/MortgageModal.tsx",
    componentName: "MortgageModal",
    note: "Two radio options (switch to mortgage, with a nested 'offer already received' back-fill / keep as cash) + Cancel + Continue. Names the buyer in the subtitle. The back-fill completes applied/valuation/offer silently and is excluded from timeframes.",
    preview: "overlay",
    states: [{ id: "default", label: "Default" }],
    render: ({ onClose }) => (
      <MortgageModal buyerNames={["Jane Smith", "John Smith"]} onConfirm={onClose} onCancel={onClose} />
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
    note: "Hero with theme background image (light/dark), 4-step progress with red tick discs + a key on Completion, exchange/completion date cards, and a Continue-to-completion button (arrow slides on hover). Warm confetti fires for ~3s on mount (respects reduced-motion). Tap backdrop or Continue to dismiss.",
    preview: "overlay",
    states: [
      { id: "short", label: "Short address" },
      { id: "long", label: "Long address", hint: "address stays within the left half" },
      { id: "no-completion", label: "No completion date", hint: "shows the fallback" },
    ],
    render: ({ stateId, onClose }) => (
      <ExchangeCelebration
        address={stateId === "long" ? LONG_ADDRESS : ADDRESS}
        exchangeDate="2026-09-11"
        completionDate={stateId === "no-completion" ? undefined : "2026-09-18"}
        onDismiss={onClose}
      />
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
    note: "Direction-aware copy (title + lead in the header, detail in the body). Confirm calls switchServiceTypeAction with DEMO_TX_ID (no record, so it returns an error rather than switching).",
    preview: "overlay",
    states: [
      { id: "to-outsourced", label: "To TSP progression", hint: "current = self-managed" },
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
        <DiaryEventRow item={{ ...(stateId === "completion" ? DIARY_COMPLETION : DIARY_EXCHANGE), photoUrl: null }} isFirst onSnooze={() => {}} />
      </div>
    ),
  },

  // ─────────────────────────────── Chains ────────────────────────────────────
  {
    id: "card-claim-login",
    name: "Log in to claim (chain)",
    type: "modal",
    area: "Chains",
    usedIn: "/claim/login · existing-account claim path",
    file: "components/claim/ClaimLoginForm.tsx",
    componentName: "ClaimLoginForm",
    note: "The two-card claim login with the parity additions (2026-10-13): Google/Microsoft buttons + or-divider, and the authenticator-code step for 2FA accounts. Buttons are live sign-in triggers — don't click them here.",
    preview: "inline",
    states: [
      { id: "password", label: "Log in", hint: "SSO buttons + email/password" },
      { id: "totp", label: "Authenticator code", hint: "the 2FA second step" },
      { id: "share", label: "Share link", hint: "no invite email — field editable" },
    ],
    render: ({ stateId }) => (
      <div className="rec-scope" style={{ width: "min(960px, 94vw)" }}>
        <ClaimLoginForm
          key={stateId}
          token="dev-sheets-fixture"
          stubEmail={stateId === "share" ? "" : "jamie@orchardandco.co.uk"}
          milestoneDefinitions={CLAIM_LOGIN_DEFS}
          initialStage={stateId === "totp" ? "totp" : "password"}
        />
      </div>
    ),
  },
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
        userName="Sarah Jones"
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

  // ───────────────── Completeness sweep additions (2026-09-19) ─────────────────

  {
    id: "modal-confirm-milestone-date",
    name: "Confirm milestone date",
    type: "modal",
    area: "Milestones",
    usedIn: "Hub + reminders · confirm-step date prompt",
    file: "components/milestones/ConfirmMilestoneDateModal.tsx",
    componentName: "ConfirmMilestoneDateModal",
    note: "The when-did-this-happen prompt for date-bearing steps. Confirm closes the inspector.",
    preview: "overlay",
    states: [
      { id: "exchange", label: "Exchange (VM19)" },
      { id: "completion", label: "Completion (PM27)" },
    ],
    render: (ctx) => (
      <ConfirmMilestoneDateModal
        open={ctx.open}
        milestoneCode={ctx.stateId === "exchange" ? "VM19" : "PM27"}
        milestoneName={ctx.stateId === "exchange" ? "Contracts exchanged" : "Purchase completed"}
        onConfirm={() => ctx.onClose()}
        onClose={ctx.onClose}
      />
    ),
  },
  {
    id: "modal-change-booking-date",
    name: "Change booking date",
    type: "modal",
    area: "Milestones",
    usedIn: "Survey / valuation cards · move the date",
    file: "components/milestones/ChangeBookingDateModal.tsx",
    componentName: "ChangeBookingDateModal",
    note: "Always-open date mover; states cover both nouns.",
    preview: "overlay",
    states: [
      { id: "survey", label: "Survey" },
      { id: "valuation", label: "Lender valuation" },
    ],
    render: (ctx) => (
      <ChangeBookingDateModal
        currentDate={DATE_TODAY}
        noun={ctx.stateId === "valuation" ? "lender valuation" : "survey"}
        saving={false}
        onConfirm={() => ctx.onClose()}
        onCancel={ctx.onClose}
      />
    ),
  },
  {
    id: "modal-auto-chase-preview",
    name: "Auto-chase email preview",
    type: "modal",
    area: "Reminders",
    usedIn: "Work queue · View on an autopilot row",
    file: "components/reminders/AutoChasePreviewModal.tsx",
    componentName: "AutoChasePreviewModal",
    note: "Loads its preview via a server action — the demo id surfaces the loading → error state (valid to inspect).",
    preview: "overlay",
    states: [
      { id: "client", label: "Client pipeline" },
      { id: "solicitor", label: "Solicitor pipeline" },
    ],
    render: (ctx) => (
      <AutoChasePreviewModal
        open={ctx.open}
        onClose={ctx.onClose}
        logId="demo-log-0000"
        pipeline={ctx.stateId === "solicitor" ? "solicitor" : "client"}
        transactionId={DEMO_TX_ID}
        sendLabel="tomorrow at 10:30am"
      />
    ),
  },
  {
    id: "modal-add-client-email",
    name: "Add client email",
    type: "modal",
    area: "Reminders",
    usedIn: "Work queue · chase blocked on a missing email",
    file: "components/reminders/AddClientEmailModal.tsx",
    componentName: "AddClientEmailModal",
    note: "Save writes to a demo contact id and no-ops.",
    preview: "overlay",
    states: [
      { id: "missing", label: "One contact missing an email" },
      { id: "couple", label: "Couple, both missing" },
    ],
    render: (ctx) => (
      <AddClientEmailModal
        contacts={
          ctx.stateId === "couple"
            ? [
                { id: "demo-c1", name: "Tom Whitfield", roleType: "purchaser", email: null },
                { id: "demo-c2", name: "Rebecca Whitfield", roleType: "purchaser", email: null },
              ]
            : [
                { id: "demo-c1", name: NAME, roleType: "purchaser", email: null },
                { id: "demo-c2", name: "Tom Whitfield", roleType: "purchaser", email: "t.whitfield@example.com" },
              ]
        }
        isBuyer
        onClose={ctx.onClose}
        onSaved={ctx.onClose}
      />
    ),
  },
  {
    id: "modal-reach-out",
    name: "Reach out to a quiet client",
    type: "modal",
    area: "To-do",
    usedIn: "To-do · no-comms nudge",
    file: "components/todos/ReachOutModal.tsx",
    componentName: "ReachOutModal",
    note: "Send targets a demo file and no-ops. States cover each channel's compose.",
    preview: "overlay",
    states: [
      { id: "email", label: "Email" },
      { id: "whatsapp", label: "WhatsApp" },
      { id: "phone", label: "Phone log" },
      { id: "portal", label: "Portal update" },
    ],
    render: (ctx) => (
      <ReachOutModal
        txId={DEMO_TX_ID}
        address={ADDRESS}
        side={{
          side: "vendor",
          name: NAME,
          contactIds: ["demo-c1"],
          primaryContactId: "demo-c1",
          email: "priya.c@gmail.com",
          phone: "07700 900111",
          lastContactAt: null,
          daysSince: 18,
          drifting: true,
        }}
        initialChannel={(ctx.stateId as "email" | "whatsapp" | "phone" | "portal") ?? "email"}
        onClose={ctx.onClose}
        onSent={ctx.onClose}
      />
    ),
  },
  {
    id: "modal-whatsapp-group",
    name: "WhatsApp group",
    type: "modal",
    area: "Solicitors & contacts",
    usedIn: "Contacts · WhatsApp group setup",
    file: "components/contacts/WhatsappGroupModal.tsx",
    componentName: "WhatsappGroupModal",
    note: "Save writes the invite link to a demo file and no-ops.",
    preview: "overlay",
    states: [
      { id: "empty", label: "No link yet" },
      { id: "linked", label: "Link saved" },
    ],
    render: (ctx) => (
      <WhatsappGroupModal
        open={ctx.open}
        onClose={ctx.onClose}
        transactionId={DEMO_TX_ID}
        address={ADDRESS}
        contacts={[
          { id: "demo-c1", name: NAME, phone: "07700 900111", roleType: "vendor" },
          { id: "demo-c2", name: "Tom Whitfield", phone: "07700 900222", roleType: "purchaser" },
          { id: "demo-c3", name: "Rebecca Whitfield", phone: null, roleType: "purchaser" },
        ]}
        currentInviteUrl={ctx.stateId === "linked" ? "https://chat.whatsapp.com/DemoInviteCode123" : null}
      />
    ),
  },
  {
    id: "modal-add-solicitor",
    name: "Add solicitor (enquiries)",
    type: "modal",
    area: "Enquiries",
    usedIn: "Enquiries triage · add the missing solicitor",
    file: "components/enquiries/AddSolicitorModal.tsx",
    componentName: "AddSolicitorModal",
    note: "Firm search reads live data (read-only); save targets a demo file and no-ops.",
    preview: "overlay",
    states: [
      { id: "vendor", label: "Seller's side" },
      { id: "purchaser", label: "Buyer's side" },
    ],
    render: (ctx) => (
      <AddSolicitorModal
        transactionId={DEMO_TX_ID}
        side={ctx.stateId === "purchaser" ? "purchaser" : "vendor"}
        onAdded={() => ctx.onClose()}
        onClose={ctx.onClose}
      />
    ),
  },
  {
    id: "modal-enquiry-log-sheet",
    name: "Enquiry chase log sheet",
    type: "modal",
    area: "Enquiries",
    usedIn: "Enquiries triage · log a call / email",
    file: "components/enquiries/EnquiryLogSheet.tsx",
    componentName: "EnquiryLogSheet",
    note: "Centred popup on desktop, sheet on mobile. Submit hands back to the parent — wired to close.",
    preview: "overlay",
    states: [
      { id: "phone", label: "Log a call" },
      { id: "email", label: "Log an email" },
    ],
    render: (ctx) => (
      <EnquiryLogSheet
        mode={ctx.stateId === "email" ? "email" : "phone"}
        transactionId={DEMO_TX_ID}
        address={ADDRESS}
        parties={[
          { id: "vsol", label: FIRM, side: "vendor", kind: "solicitor" },
          { id: "psol", label: LONG_FIRM, side: "purchaser", kind: "solicitor" },
          { id: "demo-c1", label: NAME, side: "purchaser", kind: "client", contactId: "demo-c1", email: EMAIL },
        ]}
        defaultPartyId="vsol"
        busy={false}
        onSubmit={() => ctx.onClose()}
        onClose={ctx.onClose}
      />
    ),
  },
  {
    id: "modal-enquiry-email-preview",
    name: "Enquiry email preview",
    type: "modal",
    area: "Enquiries",
    usedIn: "Enquiries triage · sent-chase preview",
    file: "components/enquiries/EnquiryEmailPreview.tsx",
    componentName: "EnquiryEmailPreview",
    note: "Fetches the sent message by id — the demo id surfaces the loading → error state (valid to inspect).",
    preview: "overlay",
    states: [{ id: "default", label: "Default" }],
    render: (ctx) => <EnquiryEmailPreview messageId="demo-msg-0000" onClose={ctx.onClose} />,
  },
  {
    id: "modal-agent-document-upload",
    name: "Add document",
    type: "modal",
    area: "Documents",
    usedIn: "Property file · Documents tab",
    file: "components/transaction/AgentDocumentUpload.tsx",
    componentName: "AgentDocumentUpload",
    note: "Renders the real Add-document trigger; click it to open the category → type → file modal. Upload posts to a demo file and no-ops.",
    preview: "inline",
    states: [{ id: "default", label: "Default" }],
    render: () => <AgentDocumentUpload transactionId={DEMO_TX_ID} />,
  },
  {
    id: "modal-trial-expired",
    name: "Trial expired (add a card)",
    type: "modal",
    area: "Billing",
    usedIn: "Hub + new sale · card-on-file guard",
    file: "components/billing/TrialExpiredModal.tsx",
    componentName: "TrialExpiredModal",
    note: "Multi-step: intro → terms → card → success. The card step will error against the demo Stripe key — inspect intro/terms.",
    preview: "overlay",
    states: [
      { id: "new-sale", label: "From new sale (intro first)" },
      { id: "hub", label: "From hub (straight to terms)" },
    ],
    render: (ctx) => (
      <TrialExpiredModal
        publishableKey="pk_test_demo_0000000000000000"
        source={ctx.stateId === "hub" ? "hub" : "new-sale"}
        onClose={ctx.onClose}
        termsAcknowledged={false}
        termsVersionId="demo-terms-0000"
        termsVersionTag="2026-08-payments-v6"
        termsSections={[
          { heading: "The fee", body: "£59 per self-managed sale, charged on exchange. Outsourced files are charged on the published sliding scale." },
          { heading: "When you're charged", body: "Nothing is taken until a sale exchanges. Withdrawn and fallen-through files are never charged." },
        ]}
      />
    ),
  },
  {
    id: "modal-withdraw-file",
    name: "Withdraw file",
    type: "modal",
    area: "Property file",
    usedIn: "File status control + hub Files-to-review",
    file: "components/transaction/WithdrawFileModal.tsx",
    componentName: "WithdrawFileModal",
    note: "The shared structured withdraw flow (reason cards + optional detail). Confirm closes the inspector.",
    preview: "overlay",
    states: [
      { id: "solo", label: "Not in a chain" },
      { id: "chain", label: "In a chain", hint: "shows the cascade explainer" },
    ],
    render: (ctx) => (
      <WithdrawFileModal
        inChain={ctx.stateId === "chain"}
        onCancel={ctx.onClose}
        onConfirm={() => ctx.onClose()}
      />
    ),
  },
  {
    id: "modal-resume-file",
    name: "Take off hold (resume chooser)",
    type: "modal",
    area: "Property file",
    usedIn: "Hub Files-to-review · Take off hold",
    file: "components/transaction/ResumeFileModal.tsx",
    componentName: "ResumeFileModal",
    note: "Two-option chooser: resume automation vs reactivate with emails paused.",
    preview: "overlay",
    states: [{ id: "default", label: "Default" }],
    render: (ctx) => (
      <ResumeFileModal address={ADDRESS} onCancel={ctx.onClose} onResume={() => ctx.onClose()} />
    ),
  },
  {
    id: "modal-revise-exchange-date",
    name: "Revise exchange date",
    type: "modal",
    area: "Property file",
    usedIn: "File banner + hub Exchange-dates-passed",
    file: "components/transaction/ReviseExchangeDateModal.tsx",
    componentName: "ReviseExchangeDateModal",
    note: "The shared revise modal with the spoken-to-both-parties hard gate. Save targets a demo file and no-ops.",
    preview: "overlay",
    states: [{ id: "default", label: "Default" }],
    render: (ctx) => (
      <ReviseExchangeDateModal
        transactionId={DEMO_TX_ID}
        address={ADDRESS}
        onClose={ctx.onClose}
        onSaved={ctx.onClose}
      />
    ),
  },

  // ───────────────── Gap sweep additions (2026-10-20) ─────────────────

  {
    id: "modal-sent-email",
    name: "Sent email viewer",
    type: "modal",
    area: "Comms",
    usedIn: "Focus client comms + chase timeline · open a sent row",
    file: "components/transaction/SentEmailModal.tsx",
    componentName: "SentEmailModal",
    note: "Fetches the stored send by id on mount, so the demo id shows loading then the load error. There is no HTML prop to inject a fixture email, open a real sent row in the app to see the sandboxed iframe. Becomes a bottom drawer at 1024px and below.",
    preview: "overlay",
    states: [
      { id: "default", label: "Default", hint: "loading then load error, no backing record" },
    ],
    render: (ctx) => (
      <SentEmailModal
        email={{ id: "demo-msg-0000", label: "Solicitor chase" }}
        onClose={ctx.onClose}
      />
    ),
  },
  {
    id: "modal-log-update",
    name: "Log an update",
    type: "modal",
    area: "Updates",
    usedIn: "Property file · Activity tab",
    file: "components/activity/LogUpdateModal.tsx",
    componentName: "LogUpdateModal",
    note: "Renders the real Log-an-update trigger, click it for the home screen then Draft for everyone / Log / Record / note panels. Saves target the demo file and surface the inline error. Centred modal desktop, bottom sheet on mobile.",
    preview: "inline",
    states: [
      { id: "default", label: "Full menu", hint: "email log + paste-a-chat shown, private notes on" },
      { id: "email-connected", label: "Email connected", hint: "log-an-email hidden, no paste option" },
    ],
    render: (ctx) => (
      <LogUpdateModal
        transactionId={DEMO_TX_ID}
        contacts={LOG_CONTACTS}
        solicitors={LOG_SOLICITORS}
        canPasteChat={ctx.stateId !== "email-connected"}
        emailConnected={ctx.stateId === "email-connected"}
        canMarkPrivate
      />
    ),
  },
  {
    id: "modal-compose-email",
    name: "Compose email",
    type: "modal",
    area: "Comms",
    usedIn: "Compose button, Focus page, surveyor email, weekly touch",
    file: "components/compose/ComposeEmailModal.tsx",
    componentName: "ComposeEmailModal",
    note: "CAVEAT: the sale search reads your real files (read-only), and picking one builds a real compose context where Send really sends, so inspect without sending. The demo-sale state shows the couldn't-open toast and falls back to search.",
    preview: "overlay",
    states: [
      { id: "search", label: "Pick a sale", hint: "the sale-search first screen" },
      { id: "demo-sale", label: "Demo sale id", hint: "context load fails, toast then search" },
    ],
    render: (ctx) => (
      <ComposeEmailModal
        open={ctx.open}
        onClose={ctx.onClose}
        initialTransactionId={ctx.stateId === "demo-sale" ? DEMO_TX_ID : null}
      />
    ),
  },
  {
    id: "modal-survey-email",
    name: "Email the surveyor",
    type: "modal",
    area: "Milestones",
    usedIn: "Milestone engine · survey booked step",
    file: "components/milestones/SurveyEmailModal.tsx",
    componentName: "SurveyEmailModal",
    note: "Access picker (seller / keys / buyer / other, with the other free-text field). Compose builds the draft against the demo file and shows the inline error, with a real file it hands off pre-filled to ComposeEmailModal.",
    preview: "overlay",
    states: [{ id: "default", label: "Default" }],
    render: (ctx) => (
      <SurveyEmailModal transactionId={DEMO_TX_ID} open={ctx.open} onClose={ctx.onClose} />
    ),
  },
  {
    id: "modal-onward-nudge",
    name: "Onward purchase nudge",
    type: "modal",
    area: "Property file",
    usedIn: "Property file · onward purchase card",
    file: "components/transaction/OnwardNudgeModal.tsx",
    componentName: "OnwardNudgeModal",
    note: "Loads its preview via a server action, the demo ids surface the load-error state inside the Ribbon-header chrome. With a real file it shows editable subject / opening / message over a live sandboxed iframe preview.",
    preview: "overlay",
    states: [
      { id: "onward-setup", label: "Onward, set up", hint: "ask the seller to set up their purchase" },
      { id: "related-update", label: "Related, update", hint: "ask the buyer to update their sale" },
    ],
    render: (ctx) => (
      <OnwardNudgeModal
        transactionId={DEMO_TX_ID}
        contactId="demo-c-vendor"
        direction={ctx.stateId === "related-update" ? "related" : "onward"}
        mode={ctx.stateId === "related-update" ? "update" : "setup"}
        onClose={ctx.onClose}
        onSent={noop}
      />
    ),
  },
  {
    id: "modal-reassign-owner",
    name: "Reassign file owner",
    type: "modal",
    area: "Property file",
    usedIn: "Property file sidebar · director-only Reassign link",
    file: "components/transaction/ReassignOwnerControl.tsx",
    componentName: "ReassignOwnerControl",
    note: "Renders the small Reassign link, click it to open the modal with the agent picker. Confirm calls reassignAgentAction with the demo id, so it shows the inline error rather than reassigning.",
    preview: "overlay",
    states: [
      { id: "assigned", label: "Owned", hint: "currently owned by a named agent" },
      { id: "unassigned", label: "No owner", hint: "currently owned by no one" },
    ],
    render: (ctx) => (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 120 }}>
        <ReassignOwnerControl
          transactionId={DEMO_TX_ID}
          currentAgentUserId={ctx.stateId === "unassigned" ? null : "demo-user-1"}
          currentAgentName={ctx.stateId === "unassigned" ? null : NAME}
          currentUserId="demo-user-2"
          assignableAgents={ASSIGNABLE_AGENTS}
        />
      </div>
    ),
  },
  {
    id: "modal-self-managed-welcome",
    name: "Welcome, self-managed director",
    type: "modal",
    area: "Onboarding & account",
    usedIn: "First login · self-managed director, plus the claim first-run",
    file: "components/agent/SelfManagedWelcomeModal.tsx",
    componentName: "SelfManagedWelcomeModal",
    note: "3-step morphing welcome: what TSP does, choose your chases, add your first sale (with the quick tour). Marks the welcome seen on mount (caught without a session) and the chase toggles save via a caught action. The final CTA routes away. Claim variant re-cuts the copy around the claimed sale.",
    preview: "overlay",
    states: [
      { id: "self", label: "First login" },
      { id: "claim", label: "Claim variant", hint: "copy speaks to the claimed sale" },
    ],
    render: (ctx) => (
      <SelfManagedWelcomeModal
        userName="Sarah Hughes"
        initialPrefs={CHASE_PREFS_ALL}
        themeMode="system"
        variant={ctx.stateId === "claim" ? "claim" : "self"}
        propertyAddress={ctx.stateId === "claim" ? ADDRESS : undefined}
        onClosed={ctx.onClose}
      />
    ),
  },
  {
    id: "modal-progressor-welcome",
    name: "Welcome, progression owner",
    type: "modal",
    area: "Onboarding & account",
    usedIn: "First login · external progression business owner",
    file: "components/agent/ProgressorWelcomeModal.tsx",
    componentName: "ProgressorWelcomeModal",
    note: "The owner 3-step welcome (what TSP does, chases, add your first client), morphing width between steps. Closes itself via X or Escape, there is no close callback to wire, so reopen the entry to replay. The final CTA routes away.",
    preview: "overlay",
    states: [{ id: "default", label: "Default" }],
    render: () => (
      <ProgressorWelcomeModal
        businessName="Harbour & Co Progression"
        userName="Sarah Hughes"
        initialPrefs={CHASE_PREFS_ALL}
        themeMode="system"
      />
    ),
  },
  {
    id: "modal-add-card-gate",
    name: "Add a card gate",
    type: "modal",
    area: "Clients & team",
    usedIn: "New sale · business card-on-file gate",
    file: "components/progression/AddCardGateModal.tsx",
    componentName: "AddCardGateModal",
    note: "Plan rows + pro-rated Due today figure above the Stripe card form. The demo publishable key means the card step shows its error, judge the chrome and figures. The notice state swaps in the message-only gate (paused plan / ask the owner).",
    preview: "overlay",
    states: [
      { id: "due-today", label: "Due today", hint: "pro-rata figure + card form" },
      { id: "notice", label: "Paused plan", hint: "message-only gate, no card form" },
    ],
    render: (ctx) => (
      <AddCardGateModal
        publishableKey="pk_test_demo_0000000000000000"
        onClose={ctx.onClose}
        onSaved={ctx.onClose}
        preview={ctx.stateId === "notice" ? null : CARD_GATE_PREVIEW}
        notice={ctx.stateId === "notice" ? CARD_GATE_NOTICE : null}
      />
    ),
  },
  {
    id: "modal-demo-explore",
    name: "Explore the demo sale",
    type: "modal",
    area: "Onboarding & account",
    usedIn: "New sale hero + all-files empty state",
    file: "components/transactions-v2/useDemoExplore.tsx",
    componentName: "useDemoExplore (hook, mounted via a local harness)",
    note: "CAVEAT: the Explore CTA really provisions (or reopens) your demo sale and navigates into it, so inspect without clicking it. Dismisses via its own X / Escape, reopen the entry to replay. Full-screen pop-up at 1060px and below.",
    preview: "overlay",
    states: [{ id: "intro", label: "Intro" }],
    render: () => <DemoExploreHarness />,
  },

  // ─────────── Gap sweep batch 2 (2026-10-20) — embedded-modal owners ─────────

  {
    id: "modal-property-flags-confirm",
    name: "Property flags confirm",
    type: "modal",
    area: "Property file",
    usedIn: "Property file sidebar · Property card toggles",
    file: "components/transaction/PropertyFlagsCard.tsx",
    componentName: "PropertyFlagsCard",
    note: "The real sidebar Property card. Toggle the active flag OFF to open the confirm, since reversing the pack steps on a freehold asks first. Confirming saves against the demo file and surfaces the error toast.",
    preview: "inline",
    states: [
      { id: "managed-freehold", label: "Managed development", hint: "freehold with the pack on, toggle it off" },
      { id: "shared-ownership", label: "Shared ownership", hint: "freehold marked shared ownership, toggle it off" },
    ],
    render: ({ stateId }) => (
      <div style={{ maxWidth: 330, margin: "120px auto 0" }}>
        <PropertyFlagsCard
          transactionId={DEMO_TX_ID}
          tenure="freehold"
          purchaseType="mortgage"
          isShareOfFreehold={false}
          hasManagementPack={stateId === "managed-freehold"}
          isSharedOwnership={stateId === "shared-ownership"}
          canEdit
        />
      </div>
    ),
  },
  {
    id: "modal-housing-association",
    name: "Housing association add/edit",
    type: "modal",
    area: "Property file",
    usedIn: "Property file · Professionals view (shared-ownership files)",
    file: "components/transaction/HousingAssociationSection.tsx",
    componentName: "HousingAssociationSection",
    note: "Click Edit (populated) or the add CTA (empty) to open the four-field modal. Save posts to the demo file and surfaces the error toast.",
    preview: "inline",
    states: [
      { id: "populated", label: "On file", hint: "Edit opens the modal prefilled" },
      { id: "empty", label: "Not set", hint: "the add CTA opens the modal blank" },
    ],
    render: ({ stateId }) => (
      <div style={{ maxWidth: 560, margin: "120px auto 0" }}>
        <HousingAssociationSection
          transactionId={DEMO_TX_ID}
          name={stateId === "empty" ? null : "Peabody"}
          contactName={stateId === "empty" ? null : "Sarah Hughes"}
          email={stateId === "empty" ? null : "sales@peabody.org.uk"}
          phone={stateId === "empty" ? null : "020 7021 4000"}
          canEdit
        />
      </div>
    ),
  },
  {
    id: "modal-attention-take-off-hold",
    name: "Take off hold (attention card)",
    type: "modal",
    area: "Reminders",
    usedIn: "Hub · Needs-your-attention card",
    file: "components/hub/AttentionCard.tsx",
    componentName: "AttentionCard",
    note: "The real hub card with two expired holds. Take off hold opens the card's own portalled resume chooser (z1500, distinct from the shared ResumeFileModal); either option hits the demo file and surfaces the error toast. Extend hold shows the inline date extender as a bonus.",
    preview: "inline",
    states: [{ id: "default", label: "Expired holds" }],
    render: () => (
      <div style={{ maxWidth: 760, margin: "80px auto 0" }}>
        <AttentionCard holds={ATTENTION_HOLDS} reminders={[]} unassigned={[]} relists={[]} chainSetup={[]} />
      </div>
    ),
  },
  {
    id: "modal-checkins-history",
    name: "Check-in update history",
    type: "modal",
    area: "Chains",
    usedIn: "Chains · Check-ins tab",
    file: "components/chain/CheckInsList.tsx",
    componentName: "CheckInsList (HistoryModal)",
    note: "Real check-in rows. Open the claimed row's overflow menu and pick Update history for the private-notes modal. Log update posts to the demo link and surfaces the error toast; View chain opens the real ChainDrawer, which loads then errors on the demo file (valid to inspect).",
    preview: "inline",
    states: [{ id: "default", label: "One chain, two nodes" }],
    render: () => (
      <div style={{ maxWidth: 760, margin: "80px auto 0" }}>
        <CheckInsList rows={CHECK_IN_ROWS} currentUserId="demo-user-1" currentUserRole="director" />
      </div>
    ),
  },
  {
    id: "modal-enquiries-drag-confirm",
    name: "Enquiries drag-to-stage confirm",
    type: "modal",
    area: "Enquiries",
    usedIn: "Enquiries triage · court slider",
    file: "components/enquiries/EnquiriesTriageList.tsx",
    componentName: "EnquiriesTriageList",
    note: "The real triage list with one loop in each court. Drag the ball on a row's court track past halfway and release to open the confirm; confirming logs the handover on the demo file and surfaces the error toast. Expanding a row loads its history, which errors on the demo id (valid to inspect).",
    preview: "inline",
    states: [{ id: "default", label: "Two open loops" }],
    render: () => (
      <div style={{ maxWidth: 1040, margin: "40px auto 0" }}>
        <EnquiriesTriageList rows={ENQUIRY_ROWS} signedPhotos={{}} emailConnected={false} />
      </div>
    ),
  },
  {
    id: "modal-demo-tour",
    name: "Demo tour spotlight",
    type: "modal",
    area: "Onboarding & account",
    usedIn: "Demo sale file · guided walkthrough",
    file: "components/transaction/demo-tour/DemoTourController.tsx",
    componentName: "DemoTourController",
    note: "The tour resolves targets by selector, so the spotlight state passes one fixture step (real production copy) ringing the stage card below: the veil, ring and guide card are the real overlay. The finish state mounts the terminal card directly. CAVEAT: the finish card's Add-your-first-sale CTA routes away; Escape or the X skips out cleanly.",
    preview: "inline",
    states: [
      { id: "spotlight", label: "Spotlight step", hint: "veil + ring + guide card on a fixture target" },
      { id: "finish", label: "Finish card", hint: "the terminal celebration card" },
    ],
    render: (ctx) => (
      <div style={{ maxWidth: 620, margin: "140px auto 0" }}>
        <div
          data-demo-tour-stage
          style={{ padding: "22px 24px", borderRadius: 16, background: "var(--agent-surface-elevated)", border: "1px solid var(--agent-border-subtle)" }}
        >
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>{ADDRESS}</p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--agent-text-secondary)" }}>A fixture stage card for the tour to spotlight.</p>
        </div>
        <DemoTourController
          autoStart
          steps={ctx.stateId === "finish" ? [] : TOUR_FIXTURE_STEPS}
          onClose={() => ctx.onClose()}
        />
      </div>
    ),
  },
  {
    id: "modal-clients-workspace",
    name: "Add a client + business settings",
    type: "modal",
    area: "Clients & team",
    usedIn: "Clients landing · progression-business owner",
    file: "components/progression/ClientsWorkspace.tsx",
    componentName: "ClientsWorkspace",
    note: "The full Clients landing with fixture agencies. Add a client opens the two-mode modal (new agency or connect an existing one); the gear opens Business settings. Submits hit demo records and surface the inline error or toast. Row links navigate to real routes, so inspect without clicking through.",
    preview: "inline",
    states: [{ id: "default", label: "Populated book" }],
    render: () => (
      <div style={{ maxWidth: 1000, margin: "40px auto 0" }}>
        <ClientsWorkspace data={CLIENTS_OVERVIEW} pendingRequests={CLIENT_REQUESTS} />
      </div>
    ),
  },
  {
    id: "modal-client-people",
    name: "Invite / edit client person",
    type: "modal",
    area: "Clients & team",
    usedIn: "Client agency page · People tab",
    file: "components/progression/ClientPeople.tsx",
    componentName: "ClientPeople",
    note: "Real people rows: main contact, colleague, pending invite, one removed. Invite a colleague opens the invite modal; a row's menu then Edit details opens the edit modal. Sends hit the demo agency and surface the inline error. Make-main-contact and remove use window.confirm, not a modal.",
    preview: "inline",
    states: [{ id: "default", label: "Director + colleagues" }],
    render: () => (
      <div style={{ maxWidth: 760, margin: "60px auto 0" }}>
        <ClientPeople agencyId="demo-agency-1" agencyName="Hartwell & Co" people={CLIENT_PEOPLE} removed={CLIENT_PEOPLE_REMOVED} />
      </div>
    ),
  },
  {
    id: "modal-business-team-invite",
    name: "Team invite confirm (+£39/mo)",
    type: "modal",
    area: "Clients & team",
    usedIn: "Progression settings · Your team",
    file: "components/progression/BusinessTeamView.tsx",
    componentName: "BusinessTeamView",
    note: "The owner roster with fixture members. Click Invite teammate, enter any name and email, then Send invite to open the portalled seat-cost confirm. Confirming posts the real action and surfaces the error toast. The row Remove is an inline confirm, not a modal.",
    preview: "inline",
    states: [{ id: "default", label: "Owner + members + removed" }],
    render: () => (
      <div style={{ maxWidth: 820, margin: "40px auto 0" }}>
        <BusinessTeamView team={BUSINESS_TEAM} />
      </div>
    ),
  },
  {
    id: "modal-contacts-remove",
    name: "Remove contact confirm",
    type: "modal",
    area: "Solicitors & contacts",
    usedIn: "Property file · contacts card",
    file: "components/contacts/ContactsSection.tsx",
    componentName: "ContactsSection",
    note: "The full contacts card with fixture clients (its row menus are noted in the menus registry's in-situ list). Open a row's kebab and pick Remove for the confirm modal; confirming deletes against the demo file, so the row pops back with an error toast. Portal invites and add-contact also post to demo records and error rather than mutate.",
    preview: "inline",
    states: [{ id: "default", label: "Seller + buyer + helper" }],
    render: () => (
      <div style={{ maxWidth: 860, margin: "40px auto 0" }}>
        <ContactsSection transactionId={DEMO_TX_ID} contacts={SECTION_CONTACTS} address={ADDRESS} />
      </div>
    ),
  },
];
