"use client";
// Drawer entries for the /dev/sheets catalogue. See types.ts for the contract.
//
// Every entry mounts the REAL production drawer with edge-case fixture data so a
// reviewer can inspect its visual states against the live page background. All
// dismiss / save / send / confirm handlers are wired to ctx.onClose (terminal)
// or noop (stay-open) — nothing here can mutate real data. IDs are "demo-*" so
// any server action that escapes a fixture handler hits a non-existent record.
//
// Several drawers fetch on mount or fire a server action on open with no backend
// in this harness. That surfaces their loading → error / empty states, which is a
// valid thing to inspect; each such entry says so in its note.

import type { SheetEntry } from "./types";
import {
  DEMO_TX_ID,
  SHORT_ADDRESS,
  ADDRESS,
  LONG_ADDRESS,
  NAME,
  LONG_NAME,
  LONG_EMAIL,
  LONG_NOTE,
  SHORT_NOTE,
  CONTACTS,
  CONTACTS_SINGLE,
  PRICE_GBP,
  DATE_TODAY,
  noop,
} from "./fixtures";

import { ChainDrawer } from "@/components/chain/ChainDrawer";
import { AddNodeDrawer, type EditingLinkData } from "@/components/chain/AddNodeDrawer";
import { ChaseDrawer } from "@/components/chase/ChaseDrawer";
import { IntroCallDrawer } from "@/components/transaction/IntroCallDrawer";
import { EmailSettingsButton } from "@/components/transaction/EmailSettingsDrawer";
import { ArchivedRoundDrawer } from "@/components/transaction/ArchivedRoundDrawer";
import { StampDutyQuickAction } from "@/components/transaction/StampDutyDrawer";
import { ReconciliationDrawer, type ReconciliationItem } from "@/components/milestones/ReconciliationDrawer";
import { EmailDetailDrawer } from "@/components/automated-emails/EmailDetailDrawer";
import { AccountDrawer } from "@/components/account/chrome/AccountDrawer";
import { MemberManageDrawer, type ManageableMember } from "@/components/account/v2/MemberManageDrawer";
import type { IntroCallData } from "@/app/actions/intro-call";
import type { MoveInfo } from "@/lib/services/portal-info";
import type { EmailRow } from "@/lib/services/automated-emails-list";

// ── Shared local fixtures ────────────────────────────────────────────────────

// A stub link to drive AddNodeDrawer's edit mode (superset structurally accepted).
const EDITING_LINK: EditingLinkData = {
  id: "demo-link-0001",
  stubPropertyAddress: LONG_ADDRESS,
  stubAgencyName: "Featherstone & Marjoribanks Estates",
  stubAgentName: LONG_NAME,
  stubAgentEmail: LONG_EMAIL,
  stubAgentPhone: "07700 900444",
  stubNotes: LONG_NOTE,
};

// A full, empty-ish MoveInfo (the drawer prefills every field from it).
const demoMove = (over: Partial<MoveInfo> = {}): MoveInfo => ({
  preferredCompletionDate: null,
  noCompletionPreference: false,
  flexibility: null,
  mortgageOfferExpiry: null,
  fundsInPlace: null,
  fundsSource: null,
  needsNotice: null,
  noticePeriod: null,
  noticeGiven: null,
  noticeEndDate: null,
  buyingOnward: null,
  onwardReadyToExchange: null,
  onwardMortgageOfferExpiry: null,
  sellingRelated: null,
  removalStatus: null,
  removalCompany: null,
  vacantBeforeCompletion: null,
  unavailableDates: [],
  progressorNote: null,
  ...over,
});

// A complete IntroCallData snapshot. purchaseType left null (avoids the cash
// branch) so both buyer + seller question sets render in full.
const INTRO_DATA: IntroCallData = {
  transactionId: DEMO_TX_ID,
  introDone: false,
  hasVendor: true,
  hasPurchaser: true,
  vendor: { id: "demo-vendor", name: NAME, phone: "07700 900111", email: "priya.c@gmail.com" },
  purchaser: { id: "demo-purchaser", name: "Tom & Rebecca Whitfield", phone: "07700 900222", email: "t.whitfield@example.com" },
  purchaseType: null,
  tenure: null,
  isShareOfFreehold: false,
  costs: { depositGBP: 47500, mortgageGBP: 380000, otherFundsGBP: null, firstTimeBuyer: false, additionalProperty: false },
  moveVendor: demoMove({ buyingOnward: true, progressorNote: SHORT_NOTE }),
  movePurchaser: demoMove({ sellingRelated: false }),
  chainLinkId: null,
  chainId: null,
  chainIntel: null,
  onward: { trackerExists: false, typeFactsSet: false },
  address: ADDRESS,
  solVendor: { firm: null, contact: null },
  solPurchaser: { firm: null, contact: null },
  referredFirmId: null,
  referralFee: null,
  contactRoles: [
    { name: NAME, roleType: "vendor" },
    { name: "Tom & Rebecca Whitfield", roleType: "purchaser" },
  ],
};

// Outstanding steps for the reconciliation drawer (one requires an event date).
const RECON_FEW: ReconciliationItem[] = [
  { id: "demo-ms-1", name: "Searches applied for", side: "purchaser", code: "SEARCHES_APPLIED", eventDateRequired: false },
  { id: "demo-ms-2", name: "Mortgage offer received", side: "purchaser", code: "MORTGAGE_OFFER", eventDateRequired: true },
  { id: "demo-ms-3", name: "Enquiries raised", side: "vendor", code: "ENQUIRIES_RAISED", eventDateRequired: false },
];

const RECON_MANY: ReconciliationItem[] = [
  ...RECON_FEW,
  { id: "demo-ms-4", name: "Enquiries answered", side: "vendor", code: "ENQUIRIES_ANSWERED", eventDateRequired: false },
  { id: "demo-ms-5", name: "Survey booked", side: "purchaser", code: "SURVEY_BOOKED", eventDateRequired: false },
  { id: "demo-ms-6", name: "Survey completed", side: "purchaser", code: "SURVEY_DONE", eventDateRequired: true },
  { id: "demo-ms-7", name: "Contract received", side: "vendor", code: "CONTRACT_RECEIVED", eventDateRequired: false },
  { id: "demo-ms-8", name: "Deposit funds ready", side: "purchaser", code: "DEPOSIT_READY", eventDateRequired: false },
];

// EmailRow fixtures for the automated-email detail drawer.
const EMAIL_ROW_QUEUE: EmailRow = {
  id: "demo-email-queue",
  source: "queue",
  emailType: "CLIENT_CHASE",
  category: "chase",
  transactionId: DEMO_TX_ID,
  transactionAddress: ADDRESS,
  recipientName: NAME,
  recipientRole: "purchaser",
  subject: "A quick nudge on your searches",
  status: "pending",
  deliveryStatus: "pending",
  scheduledFor: new Date("2026-09-05T09:30:00Z"),
  sentAt: null,
  errorAt: null,
  errorMessage: null,
  chaseNumber: 1,
};

const EMAIL_ROW_MESSAGE: EmailRow = {
  id: "demo-email-message",
  source: "message",
  emailType: "SOLICITOR_CHASE",
  category: "chase",
  transactionId: DEMO_TX_ID,
  transactionAddress: LONG_ADDRESS,
  recipientName: LONG_NAME,
  recipientRole: "solicitor",
  subject: "Chasing outstanding enquiries on 118-124 Cranbrook Road",
  status: "sent",
  deliveryStatus: "delivered",
  scheduledFor: null,
  sentAt: new Date("2026-09-02T14:05:00Z"),
  errorAt: null,
  errorMessage: null,
};

// Team member for MemberManageDrawer.
const MEMBER: ManageableMember = {
  id: "demo-member",
  name: NAME,
  email: "priya@brightmove.co.uk",
  jobTitle: "Sales Negotiator",
  directMobile: "07700 900555",
  image: null,
};

const MEMBER_LONG: ManageableMember = {
  id: "demo-member-long",
  name: LONG_NAME,
  email: LONG_EMAIL,
  jobTitle: "Senior Residential Sales & Lettings Progression Coordinator",
  directMobile: "07700 900666",
  image: null,
};

export const DRAWER_ENTRIES: SheetEntry[] = [
  // 1 ── Chain drawer ─────────────────────────────────────────────────────────
  {
    id: "drawer-chain",
    name: "Chain",
    type: "drawer",
    area: "Chains",
    usedIn: "Property file · chain button",
    file: "components/chain/ChainDrawer.tsx",
    componentName: "ChainDrawer",
    note: "Fetches GET /api/chains on mount. With no backend it shows the loading skeleton then the 'No chain yet' empty state — that empty/error path is the inspectable state here. Role switches which empty copy shows (internal staff vs agency).",
    preview: "overlay",
    states: [
      { id: "agency", label: "Agency user", hint: "negotiator role — loads then empty state" },
      { id: "internal", label: "Internal staff", hint: "admin role — same fetch, internal copy" },
    ],
    render: (ctx) => (
      <ChainDrawer
        transactionId={DEMO_TX_ID}
        currentUserId="demo-user-0001"
        currentUserRole={ctx.stateId === "internal" ? "admin" : "negotiator"}
        onClose={ctx.onClose}
        onOpenAddNode={noop}
        declineNotification={null}
      />
    ),
  },

  // 2 ── Add node to chain ──────────────────────────────────────────────────────
  {
    id: "drawer-add-node",
    name: "Add sale to chain",
    type: "drawer",
    area: "Chains",
    usedIn: "Chain drawer · add above / below",
    file: "components/chain/AddNodeDrawer.tsx",
    componentName: "AddNodeDrawer",
    note: "In-memory mode (no chainId) so Save never hits the network — it calls onSaveToMemory. Edit mode prefills from a long-content stub link so the fields show overflow behaviour.",
    preview: "overlay",
    states: [
      { id: "add-above", label: "Add above", hint: "direction ↑" },
      { id: "add-below", label: "Add below", hint: "direction ↓" },
      { id: "edit", label: "Edit sale", hint: "prefilled long values" },
    ],
    render: (ctx) => (
      <AddNodeDrawer
        direction={ctx.stateId === "add-below" ? "below" : "above"}
        editingLink={ctx.stateId === "edit" ? EDITING_LINK : undefined}
        onSaveToMemory={noop}
        onClose={ctx.onClose}
        onSaved={ctx.onClose}
      />
    ),
  },

  // 3 ── Chase drawer ───────────────────────────────────────────────────────────
  {
    id: "drawer-chase",
    name: "Chase",
    type: "drawer",
    area: "Reminders",
    usedIn: "Property file · reminders · chase",
    file: "components/chase/ChaseDrawer.tsx",
    componentName: "ChaseDrawer",
    note: "All data via props (no mount fetch). Generate calls the AI route on click (errors with no backend — inspect the error state). Multi state drives the 'Chase all' header; long-content stresses the address + recipient list.",
    preview: "overlay",
    states: [
      { id: "single", label: "Single recipient", hint: "one contact, short address" },
      { id: "multi", label: "Chase all", hint: "several steps bundled" },
      { id: "long-content", label: "Long content", hint: "long address, high chase count, all contacts" },
    ],
    render: (ctx) => {
      const isMulti = ctx.stateId === "multi";
      const isLong = ctx.stateId === "long-content";
      return (
        <ChaseDrawer
          chaseTaskId="demo-chase-0001"
          transactionId={DEMO_TX_ID}
          propertyAddress={isLong ? LONG_ADDRESS : SHORT_ADDRESS}
          milestoneName="Searches applied for"
          chaseCount={isLong ? 5 : 1}
          contacts={ctx.stateId === "single" ? CONTACTS_SINGLE : CONTACTS}
          milestones={
            isMulti
              ? [
                  { chaseTaskId: "demo-chase-0001", name: "Searches applied for", chaseCount: 2 },
                  { chaseTaskId: "demo-chase-0002", name: "Enquiries raised", chaseCount: 3 },
                  { chaseTaskId: "demo-chase-0003", name: "Mortgage offer", chaseCount: 1 },
                ]
              : undefined
          }
          onClose={ctx.onClose}
          onSent={ctx.onClose}
        />
      );
    },
  },

  // 4 ── Intro call drawer ──────────────────────────────────────────────────────
  {
    id: "drawer-intro-call",
    name: "Intro call",
    type: "drawer",
    area: "Property file",
    usedIn: "Property file · contact card · intro call",
    file: "components/transaction/IntroCallDrawer.tsx",
    componentName: "IntroCallDrawer",
    note: "Two-page drawer (script + questions). Field edits fire per-field server actions on blur against demo ids — dev-only and safe (they hit non-existent records). focusSide scopes to one side. The embedded SolicitorSection renders from the fixture (both firms null).",
    preview: "overlay",
    states: [
      { id: "both-sides", label: "Both sides", hint: "buyer + seller question sets" },
      { id: "vendor-only", label: "Seller only", hint: "focusSide vendor" },
      { id: "purchaser-only", label: "Buyer only", hint: "focusSide purchaser" },
    ],
    render: (ctx) => (
      <IntroCallDrawer
        data={INTRO_DATA}
        focusSide={
          ctx.stateId === "vendor-only" ? "vendor" : ctx.stateId === "purchaser-only" ? "purchaser" : null
        }
        onClose={ctx.onClose}
        onCompleted={ctx.onClose}
      />
    ),
  },

  // 5 ── Email settings ────────────────────────────────────────────────────────
  {
    id: "drawer-email-settings",
    name: "Email settings",
    type: "drawer",
    area: "Auto emails",
    usedIn: "Property file · hero · email settings",
    file: "components/transaction/EmailSettingsDrawer.tsx",
    componentName: "EmailSettingsButton",
    note: "Exports a trigger button that owns the drawer state. Click the 'Email settings' pill to open — the drawer loads its state via a server action which fails with no backend, so it shows the drawer chrome + the 'Loading…' state.",
    preview: "overlay",
    states: [{ id: "default", label: "Trigger + drawer", hint: "click the pill to open" }],
    render: () => <EmailSettingsButton transactionId={DEMO_TX_ID} />,
  },

  // 6 ── Archived (previous) sale ──────────────────────────────────────────────
  {
    id: "drawer-archived-round",
    name: "Previous sale record",
    type: "drawer",
    area: "Completions",
    usedIn: "Property file · previous sales chip",
    file: "components/transaction/ArchivedRoundDrawer.tsx",
    componentName: "ArchivedRoundDrawer",
    note: "Canonical Drawer. Fetches the selected sale's payload on open (errors with no backend — inspect the error state + the sale-switcher pills). Many-rounds state renders the switcher pill group.",
    preview: "overlay",
    states: [
      { id: "single-round", label: "One previous sale", hint: "no switcher" },
      { id: "many-rounds", label: "Several previous sales", hint: "switcher pill group" },
    ],
    render: (ctx) => (
      <ArchivedRoundDrawer
        open={ctx.open}
        transactionId={DEMO_TX_ID}
        archivedRounds={
          ctx.stateId === "many-rounds"
            ? [
                { id: "demo-round-3", roundNumber: 3 },
                { id: "demo-round-2", roundNumber: 2 },
                { id: "demo-round-1", roundNumber: 1 },
              ]
            : [{ id: "demo-round-1", roundNumber: 1 }]
        }
        onClose={ctx.onClose}
      />
    ),
  },

  // 7 ── Stamp duty calculator ─────────────────────────────────────────────────
  {
    id: "drawer-stamp-duty",
    name: "Stamp duty calculator",
    type: "drawer",
    area: "Property file",
    usedIn: "Property file · quick links",
    file: "components/transaction/StampDutyDrawer.tsx",
    componentName: "StampDutyQuickAction",
    note: "A quick-link button that opens its own SDLT calculator drawer. Pure client-side calc (lib/sdlt.ts) — no backend. Click the link to open; toggle first-time-buyer / additional-property and expand the band breakdown.",
    preview: "overlay",
    states: [
      { id: "standard", label: "Standard price", hint: "£475,000" },
      { id: "high-value", label: "High value", hint: "£1,250,000 — surcharge bands" },
    ],
    render: (ctx) => <StampDutyQuickAction priceGBP={ctx.stateId === "high-value" ? 1250000 : PRICE_GBP} />,
  },

  // 8 ── Reconciliation drawer ─────────────────────────────────────────────────
  {
    id: "drawer-reconciliation",
    name: "Confirm exchange / completion",
    type: "drawer",
    area: "Milestones",
    usedIn: "Steps · exchange / completion confirm",
    file: "components/milestones/ReconciliationDrawer.tsx",
    componentName: "ReconciliationDrawer",
    note: "All data via props. Backdrop deliberately does NOT dismiss (data entered). Many-items trips the 'Show N more' expander; no-items hides the outstanding block entirely.",
    preview: "overlay",
    states: [
      { id: "exchange-flow", label: "Exchange", hint: "adds expected-completion field" },
      { id: "completion-flow", label: "Completion", hint: "single date" },
      { id: "many-items", label: "Many outstanding", hint: ">5 — show-more expander" },
      { id: "no-items", label: "Nothing outstanding", hint: "empty outstanding list" },
    ],
    render: (ctx) => {
      const outstanding =
        ctx.stateId === "no-items" ? [] : ctx.stateId === "many-items" ? RECON_MANY : RECON_FEW;
      return (
        <ReconciliationDrawer
          isExchangeFlow={ctx.stateId === "exchange-flow"}
          outstanding={outstanding}
          initialEventDate={DATE_TODAY}
          onConfirm={() => ctx.onClose()}
          onCancel={ctx.onClose}
        />
      );
    },
  },

  // 9 ── Automated email detail ────────────────────────────────────────────────
  {
    id: "drawer-email-detail",
    name: "Automated email detail",
    type: "drawer",
    area: "Auto emails",
    usedIn: "Automated emails · row",
    file: "components/automated-emails/EmailDetailDrawer.tsx",
    componentName: "EmailDetailDrawer",
    note: "Canonical Drawer keyed off row !== null. Queue rows load the full payload + the file's timeline via server actions on open (error with no backend — inspect the 'Couldn't load' preview state + the Send now / Cancel footer). Message rows show metadata only.",
    preview: "overlay",
    states: [
      { id: "queued-editable", label: "Queued client chase", hint: "pending — send now / cancel" },
      { id: "sent-message", label: "Sent solicitor chase", hint: "message row, metadata only" },
    ],
    render: (ctx) => (
      <EmailDetailDrawer
        row={ctx.open ? (ctx.stateId === "sent-message" ? EMAIL_ROW_MESSAGE : EMAIL_ROW_QUEUE) : null}
        onClose={ctx.onClose}
        onChanged={noop}
      />
    ),
  },

  // 10 ── Account drawer shell ─────────────────────────────────────────────────
  {
    id: "drawer-account-shell",
    name: "Account drawer (shell)",
    type: "drawer",
    area: "Onboarding & account",
    usedIn: "Account · email editors host",
    file: "components/account/chrome/AccountDrawer.tsx",
    componentName: "AccountDrawer",
    note: "Generic light-register shell (title + optional subtitle + children). Rendered with fixture form fields so the header, close button and scroll body can be judged.",
    preview: "overlay",
    states: [
      { id: "default", label: "Title only", hint: "no subtitle" },
      { id: "with-subtitle", label: "With subtitle", hint: "two-line header" },
    ],
    render: (ctx) => (
      <AccountDrawer
        open={ctx.open}
        onClose={ctx.onClose}
        title="Edit welcome email"
        subtitle={ctx.stateId === "with-subtitle" ? "Shown to buyers and sellers when a sale starts." : undefined}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label style={{ display: "block", fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.7, fontWeight: 500, marginBottom: 5 }}>
              Subject line
            </label>
            <input
              className="account-input"
              defaultValue="Welcome to your sale"
              style={{ width: "100%", padding: "10px 12px", fontSize: 13.5, color: "#111827", background: "#fff", border: "0.5px solid rgba(0,0,0,0.16)", borderRadius: 8, outline: "none" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.7, fontWeight: 500, marginBottom: 5 }}>
              Body
            </label>
            <textarea
              className="account-input"
              rows={6}
              defaultValue={SHORT_NOTE}
              style={{ width: "100%", padding: "10px 12px", fontSize: 13.5, color: "#111827", background: "#fff", border: "0.5px solid rgba(0,0,0,0.16)", borderRadius: 8, outline: "none", resize: "vertical" }}
            />
          </div>
        </div>
      </AccountDrawer>
    ),
  },

  // 11 ── Manage member ────────────────────────────────────────────────────────
  {
    id: "drawer-member-manage",
    name: "Manage member",
    type: "drawer",
    area: "Onboarding & account",
    usedIn: "Account · Team tab · manage",
    file: "components/account/v2/MemberManageDrawer.tsx",
    componentName: "MemberManageDrawer",
    note: "Built on the AccountDrawer shell. Photo upload + PATCH save target demo ids (safe, dev-only). Long-values state stresses the header subtitle (email) and the name / job-title fields.",
    preview: "overlay",
    states: [
      { id: "default", label: "Typical member", hint: "short values" },
      { id: "long-values", label: "Long values", hint: "long name, email + job title" },
    ],
    render: (ctx) => (
      <MemberManageDrawer
        member={ctx.stateId === "long-values" ? MEMBER_LONG : MEMBER}
        onClose={ctx.onClose}
        onSaved={ctx.onClose}
      />
    ),
  },
];
