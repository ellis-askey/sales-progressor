"use client";

// /dev/timeline-catalogue, EVERY kind of entry that can land in the property
// file's Activity timeline, and every variant per kind, rendered through the
// REAL <ActivityTimeline> so each shows byte-for-byte how it ships. Pick a kind
// on the left; its variants render on the right (chrome hidden, all shown). This
// is the reference for building a canonical style per entry type. Blocks in prod.
//
// Milestone sentences/subtexts are produced by the REAL generators
// (lib/updates-copy.ts + lib/milestone-confirmation-subtext.ts), called per code,
// so this never drifts from the live feed. Comm rows are seeded by hand in the
// production ActivityEntry shape.

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
// The timeline styles itself entirely through the agent design tokens + classes.
// A bare /dev page gets neither, so pull them in and drive the theme ourselves.
import "@/app/agent/styles/themes.css";
import "@/app/agent/styles/agent-system.css";
import type { ActivityEntry, NoteReply } from "@/lib/services/comms";
import type { CommType, CommMethod } from "@prisma/client";
import type { ActorRole } from "@/components/ui/Avatar";
import { ActivityTimeline } from "@/components/activity/ActivityTimeline";
import { CommentThread, type ThreadComment } from "@/components/activity/comment-thread";
import { ArcProvider } from "@/components/arc/lib/arc-provider";
// Arc components get their tokens (--accent, --surface, --border, …) from
// foundation.css, applied under a .arc-scope wrapper — without it they render bare.
import "@/components/arc/foundation.css";
import {
  confirmationSentence,
  hasSolicitorClause,
  type UpdateConfirmer,
  type SideContact,
} from "@/lib/updates-copy";
import { confirmationSubtext, confirmerBucket } from "@/lib/milestone-confirmation-subtext";

// ── Milestone code + DB name list (prisma/seed.ts). Retired codes kept so their
// historical rows are catalogued too. ───────────────────────────────────────────
type Code = { code: string; name: string; side: "vendor" | "purchaser" };
const CODES: Code[] = [
  { code: "VM1", side: "vendor", name: "Seller has instructed their solicitor" },
  { code: "VM2", side: "vendor", name: "Seller has received the memorandum of sale" },
  { code: "VM3", side: "vendor", name: "Seller has received the welcome pack from their solicitor" },
  { code: "VM4", side: "vendor", name: "Seller has completed ID and AML checks with their solicitor" },
  { code: "VM5", side: "vendor", name: "Seller has received the property information forms from their solicitor" },
  { code: "VM6", side: "vendor", name: "Seller has returned completed property information forms to their solicitor" },
  { code: "VM7", side: "vendor", name: "Seller's solicitor has issued the draft contract pack" },
  { code: "VM8", side: "vendor", name: "Seller's solicitor has requested the management pack" },
  { code: "VM9", side: "vendor", name: "Seller's solicitor has received the management pack" },
  { code: "VM10", side: "vendor", name: "Seller's solicitor has received initial enquiries" },
  { code: "VM11", side: "vendor", name: "Seller has provided initial replies to their solicitor" },
  { code: "VM12", side: "vendor", name: "Seller's solicitor has issued initial responses to the buyer's solicitor" },
  { code: "VM13", side: "vendor", name: "Seller's solicitor has received additional enquiries" },
  { code: "VM14", side: "vendor", name: "Seller has provided additional replies to their solicitor" },
  { code: "VM15", side: "vendor", name: "Seller's solicitor has issued additional responses to the buyer's solicitor" },
  { code: "VM21", side: "vendor", name: "All enquiries satisfied" },
  { code: "VM16", side: "vendor", name: "Seller's solicitor has issued contract documents to the seller" },
  { code: "VM17", side: "vendor", name: "Seller's solicitor has received signed contract documents back from the seller" },
  { code: "VM18", side: "vendor", name: "Seller's solicitor has confirmed readiness to exchange" },
  { code: "VM19", side: "vendor", name: "Seller has received confirmation that contracts have exchanged" },
  { code: "VM20", side: "vendor", name: "Seller has received confirmation that the sale has completed" },
  { code: "PM1", side: "purchaser", name: "Buyer has instructed their solicitor" },
  { code: "PM2", side: "purchaser", name: "Buyer has received the memorandum of sale" },
  { code: "PM3", side: "purchaser", name: "Buyer has completed ID and AML checks with their solicitor" },
  { code: "PM4", side: "purchaser", name: "Buyer has paid money on account to their solicitor" },
  { code: "PM5", side: "purchaser", name: "Buyer has submitted their mortgage application" },
  { code: "PM6", side: "purchaser", name: "Lender valuation has been booked" },
  { code: "PM7", side: "purchaser", name: "Buyer's solicitor has received the draft contract pack" },
  { code: "PM8", side: "purchaser", name: "Buyer's solicitor has ordered searches" },
  { code: "PM9", side: "purchaser", name: "Buyer has booked their private survey" },
  { code: "PM10", side: "purchaser", name: "Buyer has received the survey report" },
  { code: "PM11", side: "purchaser", name: "Buyer's solicitor has received the mortgage offer" },
  { code: "PM12", side: "purchaser", name: "Buyer's solicitor has received the management pack from the vendor's solicitor" },
  { code: "PM13", side: "purchaser", name: "Buyer's solicitor has received the search results" },
  { code: "PM14", side: "purchaser", name: "Buyer's solicitor has raised initial enquiries to the seller's solicitor" },
  { code: "PM15", side: "purchaser", name: "Buyer's solicitor has received initial replies from the seller's solicitor" },
  { code: "PM16", side: "purchaser", name: "Buyer's solicitor has reviewed the initial replies" },
  { code: "PM17", side: "purchaser", name: "Buyer's solicitor has raised additional enquiries" },
  { code: "PM18", side: "purchaser", name: "Buyer's solicitor has received additional replies" },
  { code: "PM19", side: "purchaser", name: "Buyer's solicitor has reviewed the additional replies" },
  { code: "PM20", side: "purchaser", name: "Buyer's solicitor has confirmed all enquiries are now satisfied" },
  { code: "PM21", side: "purchaser", name: "Buyer has received the final report from their solicitor" },
  { code: "PM22", side: "purchaser", name: "Buyer's solicitor has issued contract documents to the buyer" },
  { code: "PM23", side: "purchaser", name: "Buyer's solicitor has received the signed contract documents back from the buyer" },
  { code: "PM24", side: "purchaser", name: "Buyer has transferred the deposit" },
  { code: "PM25", side: "purchaser", name: "Buyer's solicitor has confirmed readiness to exchange" },
  { code: "PM26", side: "purchaser", name: "Buyer has received confirmation that contracts have exchanged" },
  { code: "PM27", side: "purchaser", name: "Buyer has received confirmation that the sale has completed" },
];

const VENDOR_CONTACT = "Joanne Phillips";
const PURCHASER_CONTACT = "Martin Down";
const AGENT = "Ellis Askey";
const FIRM = "Hodders Law";
const BASE = new Date("2026-03-12T14:30:00Z").getTime();

function milestone(
  opts: {
    code: string;
    name: string;
    side: "vendor" | "purchaser";
    confirmer: UpdateConfirmer | null;
    actorRole: ActorRole;
    actorName: string;
    confirmedByClient?: boolean;
    skipped?: boolean;
  },
  i: number,
): ActivityEntry {
  const sideContacts: SideContact[] = [{ name: opts.side === "vendor" ? VENDOR_CONTACT : PURCHASER_CONTACT }];
  const sentence = opts.skipped
    ? opts.name
    : confirmationSentence({
        code: opts.code,
        side: opts.side,
        confirmer: opts.confirmer,
        sideContacts,
        milestoneName: opts.name,
      });
  const subtext = opts.skipped ? null : confirmationSubtext(opts.code, confirmerBucket(opts.confirmer));
  const isSystem = opts.actorRole === "system";
  return {
    kind: "milestone",
    id: `ms-${opts.code}-${opts.confirmedByClient ? "client" : opts.skipped ? "skip" : opts.actorRole}-${i}`,
    at: new Date(BASE - i * 60_000),
    summaryText: null,
    milestoneName: opts.name,
    milestoneCode: opts.code,
    completedByName: isSystem ? null : opts.actorName,
    isNotRequired: !!opts.skipped,
    confirmedByClient: !!opts.confirmedByClient,
    confirmerName: opts.confirmedByClient ? "Client (portal)" : null,
    sentence,
    byName: isSystem ? null : opts.actorName,
    byImage: null,
    actorRole: opts.actorRole,
    actorName: opts.actorName,
    actorImage: null,
    subtext,
  };
}

const MS_CONFIRMED_PROGRESSOR = CODES.map((c, i) =>
  milestone({ code: c.code, name: c.name, side: c.side, confirmer: { kind: "agent", name: AGENT }, actorRole: "progressor", actorName: AGENT }, i),
);
const MS_CONFIRMED_CLIENT = CODES.map((c, i) =>
  milestone({
    code: c.code, name: c.name, side: c.side,
    confirmer: { kind: "client" },
    actorRole: c.side === "vendor" ? "seller" : "buyer",
    actorName: c.side === "vendor" ? VENDOR_CONTACT : PURCHASER_CONTACT,
    confirmedByClient: true,
  }, i),
);
const MS_CONFIRMED_SOLICITOR = CODES.filter((c) => hasSolicitorClause(c.code)).map((c, i) =>
  milestone({ code: c.code, name: c.name, side: c.side, confirmer: { kind: "solicitor", firm: FIRM }, actorRole: "solicitor", actorName: FIRM }, i),
);
const MS_CONFIRMED_SYSTEM = CODES.map((c, i) =>
  milestone({ code: c.code, name: c.name, side: c.side, confirmer: null, actorRole: "system", actorName: "System" }, i),
);
const MS_SKIPPED = CODES.map((c, i) =>
  milestone({ code: c.code, name: c.name, side: c.side, confirmer: null, actorRole: "system", actorName: "System", skipped: true }, i),
);

// ── Comm rows ────────────────────────────────────────────────────────────────
type CommEntry = Extract<ActivityEntry, { kind: "comm" }>;
type CommSpec = { content: string } & Partial<CommEntry>;

function comm(spec: CommSpec, i: number): ActivityEntry {
  return {
    kind: "comm",
    id: `comm-${i}-${Math.abs(hashString(spec.content)).toString(36)}`,
    at: new Date(BASE - i * 60_000),
    type: "internal_note" as CommType,
    method: null as CommMethod | null,
    createdById: null,
    createdByName: AGENT,
    createdByImage: null,
    createdByRole: "sales_progressor",
    contactNames: [],
    contactIds: [],
    recipientName: null,
    visibleToClient: false,
    wasEdited: false,
    editedAt: null,
    wasAiGenerated: false,
    isAutomated: false,
    tone: null,
    subject: null,
    rawOriginal: null,
    conversationId: null,
    aiRead: null,
    contactSuggestion: null,
    senderLabel: null,
    mediaUrl: null,
    mediaType: null,
    attachments: null,
    delivery: null,
    actorRole: "progressor" as ActorRole,
    actorName: AGENT,
    actorImage: null,
    actorSubLabel: null,
    replies: [],
    editableByAuthor: true,
    reactions: [],
    ...spec,
  };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

const reply = (content: string, name: string, role: ActorRole): NoteReply => ({
  id: `reply-${Math.abs(hashString(content)).toString(36)}`,
  content,
  at: new Date(BASE - 30_000),
  createdById: null,
  createdByName: name,
  createdByImage: null,
  createdByRole: null,
  actorRole: role,
  actorName: name,
  actorImage: null,
  wasEdited: false,
  editedAt: null,
  editableByAuthor: false,
  reactions: [],
});

const out = (method: CommMethod): Partial<CommEntry> => ({ type: "outbound" as CommType, method });

// Notes & manual logs
const G_NOTES: CommSpec[] = [
  { content: "Spoke to the seller, they're chasing their solicitor for the draft contract and expect it this week." },
  { content: "No chain below or above this transaction. Limited company purchase. MIP in progress", subject: "Setup note" },
  { content: "Flagged the leasehold management pack delay to both sides.", contactNames: [VENDOR_CONTACT], visibleToClient: true },
  { content: "Called the buyer's solicitor: they'll reply to enquiries by Friday.", ...out("phone") },
  { content: "Texted the seller a reminder about the signed contract.", ...out("sms") },
  { content: "Logged a manual chase to the lender for the mortgage offer.", wasEdited: true, editedAt: new Date(BASE - 10_000) },
];

const G_NOTE_THREAD: CommSpec[] = [
  {
    content: "Buyer's solicitor raised three enquiries on the title, forwarding to the seller's side now.",
    createdByName: AGENT,
    reactions: [
      { emoji: "👍", users: ["dev-user", "u2"] },
      { emoji: "🎉", users: ["u3"] },
    ],
    replies: [
      { ...reply("Thanks, seller's solicitor acknowledged, says replies by early next week.", "Laura Smith", "progressor"), reactions: [{ emoji: "❤️", users: ["dev-user"] }] },
      reply("Great, I'll chase if nothing lands by Wednesday.", AGENT, "agent"),
    ],
  },
];

// Portal visit (hidden behind the Portal-visits toggle in production)
const G_PORTAL_VISIT: CommSpec[] = [
  { content: `${PURCHASER_CONTACT} viewed their client portal for 14 Oakfield Road, London SW4 7QP`, type: "internal_note" as CommType, actorRole: "buyer", actorName: PURCHASER_CONTACT, actorSubLabel: "Buyer", editableByAuthor: false },
];

// Outbound email, delivery states + the "View" sent-email link
const EMAIL_BODY = "Hi Martin,\n\nA quick update on your purchase at 23 Emperor Close. The searches are back and your solicitor is reviewing them now. Nothing needed from you at this stage, we'll be in touch as things progress.\n\nThanks,\nAkeman Residential";
const G_EMAIL: CommSpec[] = [
  { content: `Subject: Update on your purchase\n${EMAIL_BODY}`, subject: "Update on your purchase", ...out("email"), recipientName: PURCHASER_CONTACT, delivery: { state: "sent", reason: null } },
  { content: `Subject: Update on your purchase\n${EMAIL_BODY}`, subject: "Update on your purchase", ...out("email"), recipientName: PURCHASER_CONTACT, delivery: { state: "delivered", reason: null } },
  { content: `Subject: Update on your purchase\n${EMAIL_BODY}`, subject: "Update on your purchase", ...out("email"), recipientName: PURCHASER_CONTACT, delivery: { state: "bounced", reason: "550 5.1.1 recipient address rejected: user unknown" } },
  { content: `Subject: Documents attached\nHi Martin,\n\nPlease find the draft contract pack attached.\n\nThanks,\nAkeman Residential`, subject: "Documents attached", ...out("email"), recipientName: PURCHASER_CONTACT, delivery: { state: "delivered", reason: null }, attachments: [{ filename: "Draft-contract-pack.pdf", size: 284_000 }, { filename: "TA6-property-information.pdf", size: 120_000 }] },
];

// WhatsApp + media
const G_WHATSAPP: CommSpec[] = [
  { content: "Thanks, that's really helpful, I'll get the forms back to the solicitor today.", type: "inbound" as CommType, method: "whatsapp" as CommMethod, channel: "whatsapp", senderLabel: PURCHASER_CONTACT, actorRole: "buyer", actorName: PURCHASER_CONTACT, actorSubLabel: "Buyer", editableByAuthor: false },
  { content: "Photo of the signed contract", type: "inbound" as CommType, method: "whatsapp" as CommMethod, channel: "whatsapp", senderLabel: PURCHASER_CONTACT, actorRole: "buyer", actorName: PURCHASER_CONTACT, mediaUrl: "https://placehold.co/400x300/png?text=Signed+contract", mediaType: "image", editableByAuthor: false },
];

// Automated client chases (lib/email/client-chase-digest.ts). Content is the
// plain-text body (no "Subject:" prefix); the trailing /portal/<t>/respond line
// becomes the "Open response page" pill, the unsubscribe block is stripped.
const PORTAL = "https://portal.thesalesprogressor.co.uk/portal/abc123token";
const UNSUB = "\n\nIf you'd rather we stop sending these, unsubscribe here:\nhttps://portal.thesalesprogressor.co.uk/api/unsubscribe?t=abc123token";
const autoEmail = { ...out("email"), isAutomated: true, visibleToClient: true, createdByRole: "system", actorRole: "system" as ActorRole, actorName: "The Sales Progressor" };

const G_AUTO_CHASE: CommSpec[] = [
  {
    ...autoEmail,
    subject: "Quick update on 14 Oakfield Road",
    content: `Hi Sarah,\n\nJust a quick reminder that there's an outstanding item on your purchase at 14 Oakfield Road that needs your attention:\n\n  • Complete your ID and anti-money-laundering checks\n\nYou can use the link below to confirm it's been completed, provide an expected date, or leave us a quick update. It only takes a minute.\n\n${PORTAL}/respond?items=PM3&src=chase\n\nThanks,\nDawson & Clarke${UNSUB}`,
  },
  {
    ...autoEmail,
    subject: "An update on your sale at 14 Oakfield Road",
    content: `A quick update on your sale at 14 Oakfield Road.\n\n2 things are sitting with your solicitor right now that we haven't seen confirmed yet:\n\n  • Draft contract pack issued\n  • Reply to the buyer's enquiries\n\nYou don't need to do anything yourself. If it's been a while and you want to chase, a short email often helps.\n\nIf you've heard back and we just don't know yet, open the page below and let us know. We'll mark it done on our side so you don't get reminded again.\n\n${PORTAL}/respond?items=VM7,VM12&src=chase\n\nThanks,\nDawson & Clarke${UNSUB}`,
  },
  {
    ...autoEmail,
    subject: "On your purchase at 14 Oakfield Road",
    content: `A few updates on your purchase at 14 Oakfield Road. Some of these are yours to do; the rest are with your solicitor and we're just flagging that we haven't seen them confirmed yet.\n\nYours to do:\n  • Pay the money on account\nWith your solicitor (no action needed unless you want to chase):\n  • Order the property searches\n\nOpen the page below to confirm the items that are done, set an expected date, or leave a note for anything that's running late.\n\n${PORTAL}/respond?items=PM4,PM8&src=chase\n\nThanks,\nDawson & Clarke${UNSUB}`,
  },
  {
    ...autoEmail,
    subject: "Time to think about your survey",
    content: `Now is a good time to think about getting your survey booked.\n\nA survey gives you an independent view of the property's condition and can highlight anything you may want to look into before you move forward. This is separate from the valuation carried out by your mortgage lender.\n\nIf you'd like a recommendation, you can request quotes from a small selection of trusted local surveyors using the button below. It takes around 30 seconds.\n\nGet a survey quote:\nhttps://portal.thesalesprogressor.co.uk/quote/abc123token\n\nAlready arranged your own surveyor? You can confirm that on your page instead:\n${PORTAL}/respond?items=PM9&src=chase\n\nThanks,\nDawson & Clarke${UNSUB}`,
  },
];

// Other automated / system emails
const G_AUTO_SYSTEM: CommSpec[] = [
  { ...autoEmail, subject: "Confirmation request", content: `Automated confirmation request sent to Hartley & Rowe LLP for: Draft contract pack issued, Reply to initial enquiries.` },
  { ...autoEmail, subject: "Survey booked at 14 Oakfield Road", recipientName: "Taylor (Akeman Residential)", content: `Subject: Survey booked at 14 Oakfield Road\n\nHi Taylor,\n\nA survey has been booked at 14 Oakfield Road, London SW4 7QP.\n\nDate: Tuesday, 3 March 2026\nThe surveyor is collecting keys from you, so please have them ready.`, attachments: [{ filename: "survey-invite.ics", size: 2_400 }] },
  { ...autoEmail, subject: "An update on your purchase at 14 Oakfield Road", content: `Subject: An update on your purchase at 14 Oakfield Road\n\nHi Sarah,\n\nYour solicitor has issued the final report. Please review and confirm receipt.\n\n${PORTAL}/updates` },
  { ...autoEmail, subject: "Portal invite", recipientName: "Sarah Mitchell", content: `Subject: Portal invite\n\nHi Sarah,\n\nYou can now follow your purchase online. Open your portal to see live progress.\n\n${PORTAL}` },
];

// Real sent agent email (compose mirror), carries sentEmailHtml, so NOT editable;
// content leads with "Email sent to …" so the "Subject:" is NOT lifted to a heading.
const G_SENT_EMAIL: CommSpec[] = [
  { ...out("email"), subject: "Quick question on your survey", recipientName: PURCHASER_CONTACT, delivery: { state: "delivered", reason: null }, editableByAuthor: false, content: `Email sent to martin.down@email.com\n\nSubject: Quick question on your survey\n\nHi Martin,\n\nJust checking whether you've had a date through from the surveyor yet? No rush, just keeping our timeline accurate.\n\nThanks,\nAkeman Residential` },
];

// Inbound synced email, rawOriginal + conversationId + aiRead + contactSuggestion
const G_INBOUND: CommSpec[] = [
  {
    type: "inbound" as CommType, method: "email" as CommMethod, editableByAuthor: false,
    actorRole: "solicitor", actorName: "Jane Mason", actorSubLabel: "Buyer's solicitor · Hartley & Rowe LLP",
    subject: "RE: 14 Oakfield Road, searches",
    content: `Thanks for chasing. We have now applied for all searches and expect results within 2–3 weeks. The management pack is still outstanding with the freeholder; we'll flag as soon as it lands.\n\nKind regards,\nJane Mason`,
    rawOriginal: `Thanks for chasing. We have now applied for all searches and expect results within 2–3 weeks. The management pack is still outstanding with the freeholder; we'll flag as soon as it lands.\n\nKind regards,\nJane Mason\nHartley & Rowe LLP\n01234 567890\n\n> On 10 March, Akeman Residential wrote:\n> Hi Jane, any update on the searches and the management pack? Thanks.`,
    conversationId: "conv-oakfield-1",
    aiRead: {
      summary: "The buyer's solicitor confirms searches have been ordered; the management pack is still outstanding.",
      suggestions: [
        { kind: "milestone", code: "PM8", label: "Searches ordered", reason: "They write 'we have now applied for all searches'.", index: 0 },
        { kind: "todo", title: "Chase the management pack", when: "next_week", reason: "They note the management pack is still outstanding.", index: 1 },
      ],
    },
    contactSuggestion: { contactId: "c-jane", contactName: "Jane Mason", phone: "01234 567890" },
  },
];

// Channels & badges, one row per distinct getCommBadge output.
const G_BADGES: CommSpec[] = [
  { content: "Internal note, a free-typed note (amber badge).", type: "internal_note" as CommType },
  { content: "Searches ordered, the buyer's solicitor confirmed by portal.", type: "internal_note" as CommType, senderLabel: FIRM, actorRole: "solicitor", actorName: FIRM, actorSubLabel: "Solicitor", editableByAuthor: false },
  { ...autoEmail, subject: "System email", content: `Subject: System email\n\nAn automated email, badged "System email".` },
  { content: "Portal update, an in-app note (badged “Portal update”).", isAutomated: true, channel: "in_app", actorRole: "system", actorName: "The Sales Progressor" },
  { content: "Rang the seller to confirm the signed contract is on its way back.", ...out("phone") },
  { content: "Buyer called in to ask about the completion date.", type: "inbound" as CommType, method: "phone" as CommMethod, actorRole: "buyer", actorName: PURCHASER_CONTACT, editableByAuthor: false },
  { content: "Texted the seller a reminder about ID checks.", ...out("sms") },
  { content: "Left a voicemail for the buyer's solicitor.", ...out("voicemail") },
  { content: "Posted the signed TR1 to the solicitor.", ...out("post") },
];

// Prototype: the arc CommentThread we're folding into the timeline's note
// threads (emoji reactions + Reply / Edit / Delete, author-gated). Seeded,
// interactive and local-only, so we can refine it before implementing.
// Sarah has a photo (shows, shimmering while it loads); Ellis has none (role-
// tinted initials fallback) — so the prototype demonstrates both paths.
const DEMO_COMMENTS: ThreadComment[] = [
  {
    id: "c1",
    author: { id: "sj", name: "Sarah Jones", image: "https://i.pravatar.cc/96?img=47", role: "progressor" },
    body: "Looks good to me. The searches are back and nothing's flagged.",
    createdAt: "2h",
    reactions: [{ emoji: "👍", users: ["ea"] }],
    replies: [
      { id: "c1r1", author: { id: "ea", name: "Ellis Askey", role: "agent" }, body: "Thanks Sarah, I'll confirm the step now.", createdAt: "1h" },
    ],
  },
  {
    id: "c2",
    author: { id: "ea", name: "Ellis Askey", role: "agent" },
    body: "Chasing the management pack from the freeholder, will update here.",
    createdAt: "40m",
  },
];

type Group = { id: string; label: string; desc: string; entries: ActivityEntry[]; portalVisits?: boolean; prototype?: boolean };

const GROUPS: Group[] = [
  { id: "ms-progressor", label: "Step confirmed · by progressor", desc: `"Step confirmed" pill. Sentence from confirmationSentence() with an agent confirmer, progressor avatar. One per milestone code (${MS_CONFIRMED_PROGRESSOR.length}).`, entries: MS_CONFIRMED_PROGRESSOR },
  { id: "ms-client", label: "Step confirmed · by client (portal)", desc: `"Confirmed by client" pill. Client confirmer, seller/buyer avatar. One per code (${MS_CONFIRMED_CLIENT.length}).`, entries: MS_CONFIRMED_CLIENT },
  { id: "ms-solicitor", label: "Step confirmed · by solicitor", desc: `Solicitor confirmer (firm name + solicitor avatar). Only codes with a solicitor clause (${MS_CONFIRMED_SOLICITOR.length}).`, entries: MS_CONFIRMED_SOLICITOR },
  { id: "ms-system", label: "Step confirmed · system / auto", desc: `Twin-close / auto confirm (no named confirmer), TSP brand avatar. One per code (${MS_CONFIRMED_SYSTEM.length}).`, entries: MS_CONFIRMED_SYSTEM },
  { id: "ms-skipped", label: "Step skipped (not required)", desc: `"Skipped" pill, muted dot, TSP avatar. Sentence is the stored summary (milestone name shown here). One per code (${MS_SKIPPED.length}).`, entries: MS_SKIPPED },
  { id: "notes", label: "Notes & manual logs", desc: "Free-typed notes, setup note, client-visible note, logged call / SMS, edited.", entries: G_NOTES.map(comm) },
  { id: "note-thread", label: "Note with replies (thread)", desc: "An internal note with threaded replies + the inline reply composer.", entries: G_NOTE_THREAD.map(comm) },
  { id: "email", label: "Outbound email · delivery states", desc: "Sent / delivered / bounced dots, subject heading, the byte-for-byte “View” link, and filed attachments.", entries: G_EMAIL.map(comm) },
  { id: "sent-email", label: "Real sent email (compose mirror)", desc: "A real agent send, carries sentEmailHtml so it's not editable; content leads with “Email sent to …” so the Subject isn't lifted to a heading.", entries: G_SENT_EMAIL.map(comm) },
  { id: "auto-chase", label: "Automated client chase", desc: "Templated digest bodies (DIY / sitting-with-solicitor / mixed / survey). The /portal/…/respond line becomes the “Open response page” pill; the unsubscribe block is stripped.", entries: G_AUTO_CHASE.map(comm) },
  { id: "auto-system", label: "Automated / system emails", desc: "Solicitor-confirm chase summary, booking reminder (with .ics), a portal-deep-link update, and the portal invite. “Subject:” line becomes the bold heading.", entries: G_AUTO_SYSTEM.map(comm) },
  { id: "inbound", label: "Inbound synced email", desc: "A received email: cleaned body + “view original”, conversation thread, the AI read (summary + suggested confirms/to-dos) and a signature→phone suggestion.", entries: G_INBOUND.map(comm) },
  { id: "badges", label: "Channels & badges", desc: "One row per distinct channel badge, note, solicitor “Update”, system email, portal update, call, SMS, voicemail, letter, portal.", entries: G_BADGES.map(comm) },
  { id: "whatsapp", label: "WhatsApp (inbound + media)", desc: "A text reply and a media (image) message.", entries: G_WHATSAPP.map(comm) },
  { id: "portal-visit", label: "Portal visit", desc: "The “viewed their client portal” row, hidden behind the Portal-visits toggle in production.", entries: G_PORTAL_VISIT.map(comm), portalVisits: true },
  { id: "comment-thread", label: "Comment thread (prototype)", desc: "The arc CommentThread we're folding into note threads: emoji reactions + Reply / Edit / Delete (Edit/Delete author-only) + @mentions. Fully interactive here (local only) — the reference we'll refine, then implement into the real timeline note.", entries: [], prototype: true },
];

export default function TimelineCataloguePage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [activeId, setActiveId] = useState(GROUPS[0].id);
  const [dark, setDark] = useState(false);
  const active = GROUPS.find((g) => g.id === activeId) ?? GROUPS[0];

  // Drive the real theme the way the app does: data-theme on <html>. "sunset"
  // is the default light theme; "dark" is the dark mode (which the tokens scope
  // to .agent-shell-root, hence the wrapper below). Restore on unmount.
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute("data-theme");
    root.setAttribute("data-theme", dark ? "dark" : "sunset");
    return () => {
      if (prev) root.setAttribute("data-theme", prev);
      else root.removeAttribute("data-theme");
    };
  }, [dark]);

  return (
    <div
      className="agent-shell-root"
      style={{
        display: "flex", gap: 0, minHeight: "100vh", background: "var(--agent-bg-base)",
        color: "var(--agent-text-primary)",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Left nav, every kind + variant group */}
      <aside style={{ width: 260, flexShrink: 0, borderRight: "1px solid var(--agent-border-default)", padding: "22px 14px 60px", position: "sticky", top: 0, alignSelf: "flex-start", height: "100vh", overflowY: "auto" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--agent-text-muted)", margin: "0 0 2px" }}>Catalogue · /dev</p>
        <h1 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)" }}>Timeline entries</h1>
        {/* Light / dark, drives the real app theme so the component is tuned in both. */}
        <div style={{ display: "inline-flex", border: "1px solid var(--agent-border-default)", borderRadius: 9, overflow: "hidden", marginBottom: 16 }}>
          {([["Light", false], ["Dark", true]] as const).map(([label, on]) => (
            <button
              key={label}
              onClick={() => setDark(on)}
              style={{
                padding: "5px 14px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
                background: dark === on ? "var(--agent-coral-deep)" : "transparent",
                color: dark === on ? "#fff" : "var(--agent-text-muted)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {GROUPS.map((g) => {
            const on = g.id === activeId;
            return (
              <button
                key={g.id}
                onClick={() => setActiveId(g.id)}
                style={{
                  textAlign: "left", padding: "8px 10px", borderRadius: 9, cursor: "pointer", border: "1px solid transparent",
                  background: on ? "var(--agent-coral-tint, rgba(255,107,74,0.1))" : "transparent",
                  color: on ? "var(--agent-coral-deep)" : "var(--agent-text-primary)",
                  fontSize: 12.5, fontWeight: on ? 700 : 500, lineHeight: 1.3,
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                }}
              >
                <span style={{ minWidth: 0 }}>{g.label}</span>
                <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: "var(--agent-text-muted)", fontVariantNumeric: "tabular-nums" }}>{g.entries.length}</span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main, the selected kind's variants, rendered through the real timeline */}
      <main style={{ flex: 1, minWidth: 0, padding: "28px 28px 100px", maxWidth: 820 }}>
        <h2 style={{ margin: "0 0 2px", fontSize: 20, fontWeight: 700, color: "var(--agent-text-primary)" }}>{active.label}</h2>
        <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>{active.desc}</p>
        {active.prototype ? (
          <div className="arc-scope" data-accent="coral" style={{ maxWidth: 480 }}>
            <ArcProvider>
              <CommentThread
                defaultComments={DEMO_COMMENTS}
                currentUser={{ id: "ea", name: AGENT, role: "agent" }}
                title="Searches ordered"
              />
            </ArcProvider>
          </div>
        ) : (
          <ActivityTimeline
            key={active.id}
            entries={active.entries}
            transactionId="dev-timeline-catalogue"
            hideChrome
            initialShowPortalVisits={!!active.portalVisits}
            initialLimit={9999}
            mosDocUrl="https://example.com/mos.pdf"
            currentUserId="dev-user"
            currentUserName={AGENT}
            currentUserRole="sales_progressor"
            contacts={[{ id: "c1", name: VENDOR_CONTACT }, { id: "c2", name: PURCHASER_CONTACT }]}
          />
        )}
      </main>
    </div>
  );
}
