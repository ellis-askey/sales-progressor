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
import { ArchivedRoundDrawer, type ArchivedRoundPayload } from "@/components/transaction/ArchivedRoundDrawer";
import { StampDutyQuickAction } from "@/components/transaction/StampDutyDrawer";
import { ReconciliationDrawer, type ReconciliationItem } from "@/components/milestones/ReconciliationDrawer";
import { EmailDetailDrawer, type PreviewData } from "@/components/automated-emails/EmailDetailDrawer";
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
  noCompletionPreference: null,
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
  introDoneVendor: false,
  introDonePurchaser: false,
  hasVendor: true,
  hasPurchaser: true,
  vendor: { id: "demo-vendor", name: NAME, phone: "07700 900111", email: "priya.c@gmail.com" },
  purchaser: { id: "demo-purchaser", name: "Tom & Rebecca Whitfield", phone: "07700 900222", email: "t.whitfield@example.com" },
  purchaseType: null,
  tenure: null,
  isShareOfFreehold: false,
  costs: { depositGBP: 47500, mortgageGBP: 380000, otherFundsGBP: null, firstTimeBuyer: null, additionalProperty: null },
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

// Seeded preview for the queue row so /dev/sheets renders the full email body
// instead of the "Email not found" backend-miss state.
const EMAIL_PREVIEW_SEED: PreviewData = {
  id: "demo-email-queue",
  emailType: "CLIENT_CHASE",
  subject: "A quick nudge on your searches",
  text: "Hi Priya,\n\nJust a quick check-in on 14 Oakwood Avenue. Your searches have been with the local authority for a couple of weeks now. That's normal, but we like to keep things moving.\n\nThere's nothing you need to do right now. We're chasing the council for an update and will let you know as soon as they're back.\n\nKind regards,\n\nThe Sales Progressor Team",
  // Representative rendered email so the drawer's iframe shows exactly what the
  // inbox sees. Structured like the real client-chase template (grey page +
  // fixed 560px white card) so the drawer's preview-CSS injection normalises it
  // the same way it will the live payload HTML — /dev/sheets mirrors the app.
  html: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>A quick nudge on your searches</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td>
          <p style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#FF6B4A;text-transform:uppercase;margin:0 0 16px;">Sales Progressor</p>
          <p style="font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 16px;">Hi Priya,</p>
          <p style="font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 16px;">Just a quick check-in on <strong>14 Oakwood Avenue</strong>. Your searches have been with the local authority for a couple of weeks now. That&rsquo;s normal, but we like to keep things moving.</p>
          <p style="font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 24px;">There&rsquo;s nothing you need to do right now. We&rsquo;re chasing the council for an update and will let you know as soon as they&rsquo;re back.</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td style="border-radius:8px;background:#FF6B4A;"><a href="#" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:500;font-size:15px;">Open the page</a></td>
          </tr></table>
          <p style="font-size:15px;color:#4a5162;line-height:1.6;margin:28px 0 4px;">Kind regards,</p>
          <p style="font-size:15px;color:#1a1d29;font-weight:700;margin:0;">The Sales Progressor Team</p>
        </td></tr>
      </table>
      <p style="margin:20px 0 0;font-size:11px;color:#c0c4d0;text-align:center;">
        <a href="#" style="color:#c0c4d0;text-decoration:none;">Pause reminders for a week</a> &nbsp;&middot;&nbsp;
        <a href="#" style="color:#c0c4d0;text-decoration:none;">Unsubscribe</a>
      </p>
    </td></tr>
  </table>
</body></html>`,
  recipientName: NAME,
  recipientEmail: "priya.c@gmail.com",
  recipientRole: "purchaser",
  scheduledFor: new Date("2026-09-05T09:30:00Z"),
  sentAt: null,
  errorAt: null,
  editedAt: null,
  editedByName: null,
  canEdit: true,
  transactionId: DEMO_TX_ID,
  // Real getEmailForPreview derives this from the chased milestone's canonical
  // label — so the seed uses a real label, not an invented phrase.
  contextLabel: "Search results received",
  chaseNumber: 1,
  canOpenInNewWindow: true,
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

// Seeded preview for the solicitor (message) row. Solicitor chases now store the
// email they sent, so the drawer shows the real thing — this seed mirrors that:
// the actual rendered solicitor digest (navy header, matter block, steps, CTA,
// signature), the same shape buildSolicitorDigestEmail produces.
const SOLICITOR_SEED_STEPS = ["Draft contract pack issued to the buyer's solicitor", "Management pack requested"];
const EMAIL_MESSAGE_PREVIEW_SEED: PreviewData = {
  id: "demo-email-message",
  emailType: "SOLICITOR_CHASE",
  subject: "118-124 Cranbrook Road - Client: Whitlock",
  text: `Automated confirmation request sent to ${LONG_NAME} for: ${SOLICITOR_SEED_STEPS.join(", ")}.`,
  html: `<!doctype html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#eef1f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;"><tr><td>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f2740;border-radius:10px 10px 0 0;">
    <tr><td style="padding:22px 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:.2px;">Sales Progressor</td>
      <td align="right" style="font-size:11px;color:#9fb3c8;text-transform:uppercase;letter-spacing:1.4px;">Progress update</td>
    </tr></table></td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-left:1px solid #dfe5ec;border-right:1px solid #dfe5ec;">
    <tr><td style="padding:30px 28px 6px;">
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#33475b;">I hope you&rsquo;re well. I&rsquo;m looking after <strong style="color:#0f2740;">Jane &amp; Tom Whitlock</strong> and helping keep things moving on this sale.</p>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#33475b;">When you get a moment, could you let me know where things stand with the items below?</p>
    </td></tr>
    <tr><td style="padding:18px 28px 6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fb;border:1px solid #e3e9f0;border-radius:8px;"><tr><td style="padding:16px 18px;">
        <p style="margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#6b7c93;">Matter details</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:6px 0;color:#6b7c93;font-size:13px;">Property</td><td align="right" style="padding:6px 0;color:#0f2740;font-size:13px;font-weight:600;">118-124 Cranbrook Road</td></tr>
          <tr><td style="padding:6px 0;color:#6b7c93;font-size:13px;">Seller</td><td align="right" style="padding:6px 0;color:#0f2740;font-size:13px;font-weight:600;">Jane &amp; Tom Whitlock</td></tr>
          <tr><td style="padding:6px 0;color:#6b7c93;font-size:13px;">You are acting for</td><td align="right" style="padding:6px 0;color:#0f2740;font-size:13px;font-weight:600;">The seller</td></tr>
        </table>
      </td></tr></table>
    </td></tr>
    <tr><td style="padding:20px 28px 4px;">
      <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#0f2740;">Could you update me on these items?</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dde5ee;border-radius:10px;">
        ${SOLICITOR_SEED_STEPS.map((s, i) => `<tr><td style="padding:14px 16px;${i < SOLICITOR_SEED_STEPS.length - 1 ? "border-bottom:1px solid #eaeff5;" : ""}font-size:14px;font-weight:600;color:#0f2740;">${s}</td></tr>`).join("")}
      </table>
    </td></tr>
    <tr><td style="padding:22px 28px 4px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
        <td align="center" bgcolor="#0f2740" style="border-radius:8px;padding:15px 18px;"><a href="#" style="font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">Update these items</a></td>
      </tr></table>
      <p style="margin:12px 0 0;font-size:13px;line-height:1.55;color:#33475b;">Rather reply by email? Just reply to this message with an update. Thank you!</p>
    </td></tr>
    <tr><td style="padding:18px 28px 26px;">
      <p style="margin:0 0 12px;font-size:14px;color:#33475b;line-height:1.6;">Many thanks for your help,</p>
      <p style="margin:0;font-size:14px;font-weight:700;color:#0f2740;">Jordan Hayes</p>
      <p style="margin:2px 0 0;font-size:13px;color:#6b7c93;">Sales Progressor</p>
    </td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fb;border:1px solid #dfe5ec;border-top:none;border-radius:0 0 10px 10px;">
    <tr><td style="padding:18px 28px;"><p style="margin:0;font-size:11px;line-height:1.6;color:#8493a8;">Sent by Sales Progressor in relation to the matter above. If you&rsquo;re not the right person for this file, just reply and let me know.</p></td></tr>
  </table>
</td></tr></table></body></html>`,
  recipientName: LONG_NAME,
  recipientEmail: LONG_EMAIL,
  recipientRole: "solicitor",
  scheduledFor: new Date("2026-09-02T14:05:00Z"),
  sentAt: new Date("2026-09-02T14:05:00Z"),
  errorAt: null,
  editedAt: null,
  editedByName: null,
  canEdit: false,
  transactionId: DEMO_TX_ID,
  contextLabel: SOLICITOR_SEED_STEPS.join(", "),
  chaseNumber: null,
  canOpenInNewWindow: true,
};

// Seeded payloads for the Previous-sale (archived round) drawer, so /dev/sheets
// renders it fully instead of the "Loading…" fetch state. Shape mirrors the
// /api/transactions/[id]/rounds/[roundId] response the app uses.
function makeArchivedSeed(opts: {
  roundNumber: number;
  buyerName: string;
  buyerEmail: string;
  pricePence: number | null;
  archivedAt: string;
  fallThroughReason: string | null;
  withChain?: boolean;
}): ArchivedRoundPayload {
  const { roundNumber, buyerName, buyerEmail, pricePence, archivedAt, fallThroughReason, withChain } = opts;
  return {
    round: {
      id: `demo-round-${roundNumber}`,
      roundNumber,
      status: "archived",
      archivedAt,
      fallThroughReason,
      createdAt: "2026-03-02T09:00:00Z",
      purchasePrice: pricePence,
      purchaserSolicitorFirm: { id: "sf1", name: "Marsden & Cole Solicitors" },
      purchaserSolicitorContact: { id: "sc1", name: "Rachel Okonkwo", phone: "0117 496 2210", email: "r.okonkwo@marsdencole.co.uk" },
      brokerFirm: { id: "bf1", name: "Southgate Mortgage Partners" },
      brokerContact: { id: "bc1", name: "Daniel Price", phone: "0117 496 3300", email: null },
      vendorMilestoneSnapshot: [
        { code: "VM1", name: "Instruct your solicitor", orderIndex: 0, state: "complete", completedAt: "2026-03-05T10:00:00Z", eventDate: null, summaryText: null },
        { code: "VM7", name: "Draft contract pack issued", orderIndex: 6, state: "complete", completedAt: "2026-03-20T14:00:00Z", eventDate: null, summaryText: null },
        { code: "VM10", name: "Initial enquiries received", orderIndex: 9, state: "available", completedAt: null, eventDate: null, summaryText: null },
        { code: "VM12", name: "Replies sent to buyer's solicitor", orderIndex: 11, state: "locked", completedAt: null, eventDate: null, summaryText: null },
      ],
      chainSnapshot: withChain
        ? {
            chainId: "chain-demo",
            ourLinkId: "link-2",
            ourPosition: 2,
            withdrawalReason: "BUYER_WITHDREW",
            capturedAt: archivedAt,
            neighbours: [
              { linkId: "link-3", position: 3, withdrawalStatus: null, claimedByUserId: "u3", claimedAgentName: "Priya Shah", claimedAgencyName: "Hillcrest Estates", claimedTransactionId: "t3", claimedAddress: "8 Marlborough Court, Bristol", stubAddress: null, stubAgencyName: null, stubAgentName: null },
              { linkId: "link-2", position: 2, withdrawalStatus: "WITHDRAWN", claimedByUserId: "u2", claimedAgentName: "You", claimedAgencyName: "Brightmove", claimedTransactionId: DEMO_TX_ID, claimedAddress: ADDRESS, stubAddress: null, stubAgencyName: null, stubAgentName: null },
              { linkId: "link-1", position: 1, withdrawalStatus: null, claimedByUserId: null, claimedAgentName: null, claimedAgencyName: null, claimedTransactionId: null, claimedAddress: null, stubAddress: "14 Beacon Rise, Bristol", stubAgencyName: "Foxton Vale", stubAgentName: "Mark Ellery" },
            ],
            detachedSegment: null,
          }
        : null,
      chainNotifications: withChain
        ? [
            { id: "n1", type: "LOST_BUYER", direction: "outbound", recipientLinkId: "link-1", recipientEmail: "mark@foxtonvale.co.uk", response: "REMARKETING", respondedAt: "2026-05-12T11:00:00Z", emailSentAt: "2026-05-10T09:00:00Z", createdAt: "2026-05-10T09:00:00Z" },
          ]
        : [],
    },
    buyerContacts: [
      { id: "b1", name: buyerName, email: buyerEmail, phone: "07700 900321", roleType: "purchaser" },
    ],
    pmCompletions: [
      { code: "PM1", name: "Instruct your solicitor", orderIndex: 0, state: "complete", completedAt: "2026-03-06T10:00:00Z", completedByName: buyerName, eventDate: null, summaryText: null, confirmedByPortal: true },
      { code: "PM3", name: "Complete ID & AML checks", orderIndex: 2, state: "complete", completedAt: "2026-03-09T10:00:00Z", completedByName: buyerName, eventDate: null, summaryText: null, confirmedByPortal: true },
      { code: "PM4", name: "Pay money on account to solicitor", orderIndex: 3, state: "complete", completedAt: "2026-03-12T10:00:00Z", completedByName: buyerName, eventDate: null, summaryText: null, confirmedByPortal: false },
      { code: "PM7", name: "Draft contract pack received", orderIndex: 6, state: "complete", completedAt: "2026-03-22T10:00:00Z", completedByName: "Rachel Okonkwo", eventDate: null, summaryText: null, confirmedByPortal: false },
      { code: "PM8", name: "Searches ordered", orderIndex: 7, state: "available", completedAt: null, completedByName: null, eventDate: null, summaryText: null, confirmedByPortal: false },
      { code: "PM9", name: "Book your survey", orderIndex: 8, state: "not_required", completedAt: null, completedByName: null, eventDate: null, summaryText: null, confirmedByPortal: false },
      { code: "PM13", name: "Search results received", orderIndex: 12, state: "locked", completedAt: null, completedByName: null, eventDate: null, summaryText: null, confirmedByPortal: false },
    ],
    comms: [
      { id: "c1", type: "outbound", method: "email", content: "Chased the buyer's solicitor for an update on searches. They confirmed the local authority is running about three weeks behind.", createdAt: "2026-04-18T13:30:00Z", createdByName: "You", senderLabel: null, visibleToClient: false, isAutomated: false },
      { id: "c2", type: "note", method: null, content: "Buyer mentioned their mortgage offer was close to expiring and they were getting nervous about the searches delay.", createdAt: "2026-05-02T16:10:00Z", createdByName: "You", senderLabel: null, visibleToClient: false, isAutomated: false },
    ],
    fileDocuments: [
      { id: "d1", filename: "Memorandum of Sale.pdf", mimeType: "application/pdf", fileSize: 184320, source: "agent upload", createdAt: "2026-03-03T09:30:00Z", signedUrl: "#" },
      { id: "d2", filename: "Buyer proof of funds.pdf", mimeType: "application/pdf", fileSize: 96256, source: "buyer upload", createdAt: "2026-03-11T15:00:00Z", signedUrl: null },
    ],
  };
}

const ARCHIVED_SEED_SINGLE: Record<string, ArchivedRoundPayload> = {
  "demo-round-1": makeArchivedSeed({
    roundNumber: 1,
    buyerName: "Marcus Bellingham",
    buyerEmail: "m.bellingham@gmail.com",
    pricePence: 47500000,
    archivedAt: "2026-05-14T10:00:00Z",
    fallThroughReason: "Buyer's mortgage offer expired before searches came back and they were unable to secure new finance in time.",
    withChain: true,
  }),
};

const ARCHIVED_SEED_MANY: Record<string, ArchivedRoundPayload> = {
  "demo-round-3": makeArchivedSeed({ roundNumber: 3, buyerName: "Aisha Rahman", buyerEmail: "aisha.rahman@outlook.com", pricePence: 48200000, archivedAt: "2026-08-01T10:00:00Z", fallThroughReason: "Survey flagged damp the buyer wasn't willing to take on.", withChain: true }),
  "demo-round-2": makeArchivedSeed({ roundNumber: 2, buyerName: "Tom & Ellie Grant", buyerEmail: "tomgrant@gmail.com", pricePence: 47500000, archivedAt: "2026-06-20T10:00:00Z", fallThroughReason: "Buyers pulled out to pursue a new-build instead.", withChain: false }),
  "demo-round-1": makeArchivedSeed({ roundNumber: 1, buyerName: "Marcus Bellingham", buyerEmail: "m.bellingham@gmail.com", pricePence: 47000000, archivedAt: "2026-05-14T10:00:00Z", fallThroughReason: "Buyer's mortgage offer expired before searches came back.", withChain: false }),
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
                  { chaseTaskId: "demo-chase-0002", name: "Enquiries raised", chaseCount: 0 },
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
    note: "Two-page drawer (script + questions). Opened per side — buyer or seller — with no in-drawer toggle; the launching contact fixes the side. Field edits fire per-field server actions on blur against demo ids (dev-only, safe). Solicitor section is scoped to that side with the briefcase tile.",
    preview: "overlay",
    states: [
      { id: "buyer", label: "Buyer intro", hint: "focusSide purchaser" },
      { id: "seller", label: "Seller intro", hint: "focusSide vendor" },
    ],
    render: (ctx) => (
      <IntroCallDrawer
        data={INTRO_DATA}
        focusSide={ctx.stateId === "seller" ? "vendor" : "purchaser"}
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
    note: "Trigger button that owns the drawer state. Seeded here via seedState so it renders populated without a backend — click the 'Email settings' pill to open. Toggles call server actions that no-op in dev.",
    preview: "overlay",
    states: [
      { id: "active", label: "Everything on", hint: "active file, all recipients sending" },
      { id: "on-hold", label: "On hold", hint: "sale paused, a recipient paused" },
    ],
    render: (ctx) => {
      const onHold = ctx.stateId === "on-hold";
      return (
        <EmailSettingsButton
          transactionId={DEMO_TX_ID}
          seedState={{
            suppressPortalConfirmEmails: false,
            status: onHold ? "on_hold" : "active",
            clientEmailsPaused: onHold,
            serviceType: null,
            contacts: [
              { id: "seed-vendor", name: "Joe Court", roleType: "vendor", paused: false, stepConfirmPaused: false },
              { id: "seed-purchaser", name: "Livia Benova", roleType: "purchaser", paused: onHold, stepConfirmPaused: true },
            ],
            vendorSolicitor: { name: "Bower & Bailey", paused: false },
            purchaserSolicitor: { name: "Gough Thorne", paused: false },
          }}
        />
      );
    },
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
    note: "Canonical Drawer. Seeded (seedByRoundId) so the full payload renders here without a backend — buyer, price, solicitor, broker, both step lists, comms, chain-at-withdrawal and documents. Many-rounds state renders the switcher pill group; switching sale swaps the seeded payload.",
    preview: "overlay",
    states: [
      { id: "single-round", label: "One previous sale", hint: "no switcher, includes chain section" },
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
        seedByRoundId={ctx.stateId === "many-rounds" ? ARCHIVED_SEED_MANY : ARCHIVED_SEED_SINGLE}
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
    note: "Canonical Drawer keyed off row !== null, seeded (seedPreview) so it renders without a backend. Client chase: pending, full rendered email, Send now / Cancel / Edit (an edit re-renders the preview to match what sends). Solicitor chase: already sent; the sent email is now stored at send time, so the drawer shows the real solicitor email (older rows sent before this fall back to a steps summary).",
    preview: "overlay",
    states: [
      { id: "queued-editable", label: "Queued client chase", hint: "pending, real email, send now / cancel / edit" },
      { id: "sent-message", label: "Sent solicitor chase", hint: "real stored email, no pending actions" },
    ],
    render: (ctx) => (
      <EmailDetailDrawer
        row={ctx.open ? (ctx.stateId === "sent-message" ? EMAIL_ROW_MESSAGE : EMAIL_ROW_QUEUE) : null}
        seedPreview={ctx.stateId === "sent-message" ? EMAIL_MESSAGE_PREVIEW_SEED : EMAIL_PREVIEW_SEED}
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
