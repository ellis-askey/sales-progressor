// lib/services/focus.ts
//
// Data for the founder-only Focus page. Two feeds:
//   - getFocusLeft(vis)  — the merged "client communications" cockpit: the weekly
//     "touch every side" quota (reused wholesale from getWeeklyTouch) enriched,
//     per side, with the LAST AUTOMATED client email (so you can see what actually
//     landed in their inbox + its delivery/open status) and a bounce flag (that
//     client is unreachable). Human-touch recency still drives the quiet/quota.
//   - getFocusRight(scope, vis) — the right rail: the three most urgent open
//     enquiries, and the files whose searches were ordered longest ago but whose
//     results aren't back yet.
//
// Everything is scoped to TSP's own outsourced book (via the vis / scope the
// page passes), matching every other internal surface.

import { prisma } from "@/lib/prisma";
import { getWeeklyTouch, type WeeklyTouchSide, type WeeklyTouchFile } from "@/lib/services/hub";
import { getOpenEnquiries, type OpenEnquiryRow } from "@/lib/services/enquiries";
import { txWhereWorkQueue } from "@/lib/services/work-queue";
import { loadActiveRoundIds, roundScopedOR } from "@/lib/services/round-scope";
import type { AgentVisibility } from "@/lib/services/agent";
import type { AccessScope } from "@/lib/security/access-scope";

// ─── Left: client communications ──────────────────────────────────────────────

export type FocusChannel = "email" | "whatsapp" | "call";

// The visible state word per channel. Email states come from the real send's
// delivery lifecycle; "logged" is a self-reported "I emailed them" with nothing
// to prove a send. WhatsApp is "replied" (inbound) / "messaged" (outbound).
// A call is always a manual log → "called".
export type FocusContactState =
  | "opened" | "delivered" | "sent" | "logged" | "bounced" | "failed"
  | "replied" | "messaged" | "called";

export type FocusChannelContact = {
  channel: FocusChannel;
  direction: "out" | "in";  // out = we reached them · in = they reached us
  automated: boolean;       // true = sent by the engine, not a person (email only)
  state: FocusContactState;
  at: Date;                 // the true event time (send / receipt), never import time
  proven: boolean;          // real provider-handled send vs a self-reported log
  messageId: string;        // OutboundMessage id — opens the exact message
  subject: string | null;   // email subject
  preview: string | null;   // short snippet for whatsapp / call
};

export type FocusSideContacts = {
  email: FocusChannelContact | null;
  whatsapp: FocusChannelContact | null;
  call: FocusChannelContact | null;
};

export type FocusSide = WeeklyTouchSide & {
  // Last contact on each channel — each the single most recent real record for
  // this side's client(s), dated by its true event time. Null = nothing on
  // record for that channel (rendered as an honest "none", never implied contact).
  lastContact: FocusSideContacts;
  // We messaged them (email / WhatsApp, 2+ days ago) and they haven't come back.
  // Drives the "Awaiting reply" view. Calls don't count as outreach here.
  awaitingReply: boolean;
};

export type FocusLeftFile = Omit<WeeklyTouchFile, "sides"> & { sides: FocusSide[] };
export type FocusLeft = {
  files: FocusLeftFile[];
  totalSides: number;
  doneSides: number;
  // Whether WhatsApp is a live channel for this book at all (any WhatsApp message
  // on any shown file). When false the WhatsApp column is hidden entirely rather
  // than showing "none" on every side.
  whatsappInUse: boolean;
};

const EMPTY_CONTACTS: FocusSideContacts = { email: null, whatsapp: null, call: null };

// Email statuses that mean "not actually sent yet" — excluded so a queued or
// draft message never reads as a real contact.
const NOT_SENT = new Set(["draft", "scheduled", "queued", "cancelled"]);

// A side counts as "awaiting reply" only once our outreach is at least this old
// with no reply back — so a message sent today doesn't immediately read as stale.
const AWAIT_REPLY_DAYS = 2;

function snippet(s: string | null): string | null {
  if (!s) return null;
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > 120 ? `${t.slice(0, 117)}…` : t;
}

// The minimal row shape classify needs. Prisma's richer row (enum fields, extra
// columns) is structurally assignable to this.
type RawRow = {
  id: string; transactionId: string | null; contactIds: string[];
  type: string; method: string | null; channel: string; status: string;
  isAutomated: boolean; subject: string | null; content: string;
  sentAt: Date | null; createdAt: Date;
  deliveredAt: Date | null; openedAt: Date | null; clickedAt: Date | null; failedAt: Date | null;
  providerMessageId: string | null;
};

// One OutboundMessage row → the channel contact it represents, or null when it
// isn't a client-reaching event we show (an inbound email, an unsent draft, a
// non-client method). The true event time is sentAt when the send path stamped
// it (real emails, WhatsApp messages), else createdAt (logged calls/emails, for
// which createCommunicationRecord never sets sentAt).
function classify(r: RawRow): FocusChannelContact | null {
  const at = r.sentAt ?? r.createdAt;

  if (r.method === "whatsapp") {
    const inbound = r.type === "inbound";
    return {
      channel: "whatsapp", direction: inbound ? "in" : "out", automated: false,
      state: inbound ? "replied" : "messaged", at, proven: true,
      messageId: r.id, subject: null, preview: snippet(r.content),
    };
  }

  if (r.method === "phone") {
    if (r.type !== "outbound") return null; // calls only ever exist as outbound logs
    return {
      channel: "call", direction: "out", automated: false,
      state: "called", at, proven: false,
      messageId: r.id, subject: null, preview: snippet(r.content),
    };
  }

  // Email — either direction. A client's reply is the strongest "engaged" signal,
  // so (like WhatsApp) the channel shows whichever is most recent: our outbound
  // with its delivery state, or their inbound "Replied".
  const isEmail = r.method === "email" || r.channel === "email";
  if (!isEmail) return null;
  if (r.type === "inbound") {
    return { channel: "email", direction: "in", automated: false, state: "replied", at, proven: true, messageId: r.id, subject: r.subject, preview: snippet(r.content) };
  }
  if (r.type !== "outbound") return null;
  if (NOT_SENT.has(r.status)) return null;

  const proven = r.sentAt != null || r.providerMessageId != null;
  let state: FocusContactState;
  if (r.status === "bounced") state = "bounced";
  else if (r.status === "failed" || r.failedAt) state = "failed";
  else if (r.clickedAt || r.status === "clicked" || r.openedAt || r.status === "opened") state = "opened";
  else if (r.deliveredAt || r.status === "delivered") state = "delivered";
  else if (proven) state = "sent";
  else state = "logged"; // sentAt null + default status = self-reported "I emailed them"

  return {
    channel: "email", direction: "out", automated: r.isAutomated,
    state, at, proven,
    messageId: r.id, subject: r.subject, preview: null,
  };
}

export async function getFocusLeft(vis: AgentVisibility): Promise<FocusLeft> {
  const weekly = await getWeeklyTouch(vis);
  const fileIds = weekly.files.map((f) => f.transactionId);
  const contactIds = [...new Set(weekly.files.flatMap((f) => f.sides.flatMap((s) => s.contactIds)))];

  if (contactIds.length === 0) {
    return {
      files: weekly.files.map((f) => ({ ...f, sides: f.sides.map((s) => ({ ...s, lastContact: EMPTY_CONTACTS, awaitingReply: false })) })),
      totalSides: weekly.totalSides,
      doneSides: weekly.doneSides,
      whatsappInUse: false,
    };
  }

  // Every email / WhatsApp / logged-call row touching these sides' clients. We
  // reduce to the latest per side per channel in JS — per-side attribution is by
  // the contactIds array, which SQL can't group on. Ordered newest-first and
  // generously bounded; a weekly cockpit never has deeper recent history.
  // Alongside: is WhatsApp a live channel here at all? (Any WhatsApp message on
  // any shown file, including threads not yet mapped to a client contact.) When
  // not, the WhatsApp column is dropped rather than showing "none" everywhere.
  const [rows, waAny] = await Promise.all([
    prisma.outboundMessage.findMany({
      where: {
        transactionId: { in: fileIds },
        contactIds: { hasSome: contactIds },
        OR: [
          { method: "whatsapp" },
          { method: "phone", type: "outbound" },
          { method: "email", type: "outbound" },
          { channel: "email", type: "outbound" },
          { type: "inbound" }, // client replies — for the awaiting-reply signal
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 4000,
      select: {
        id: true, transactionId: true, contactIds: true, type: true, method: true, channel: true,
        status: true, isAutomated: true, subject: true, content: true, sentAt: true, createdAt: true,
        deliveredAt: true, openedAt: true, clickedAt: true, failedAt: true, providerMessageId: true,
      },
    }),
    prisma.outboundMessage.findFirst({
      where: { transactionId: { in: fileIds }, method: "whatsapp" },
      select: { id: true },
    }),
  ]);
  const whatsappInUse = waAny != null;

  // Pre-process once, grouped by file, so each side only scans its own file's rows.
  // `classified` feeds the per-channel readout; `raw` feeds the awaiting-reply
  // signal (last messaging outreach vs last inbound reply). Calls are excluded
  // from outreach — a phone call doesn't leave you "awaiting a reply".
  type Raw = { ids: string[]; inbound: boolean; outreach: boolean; at: number };
  const byTx = new Map<string, { ids: string[]; c: FocusChannelContact }[]>();
  const rawByTx = new Map<string, Raw[]>();
  for (const r of rows) {
    if (!r.transactionId) continue;
    const at = (r.sentAt ?? r.createdAt).getTime();
    const inbound = r.type === "inbound";
    const raw: Raw = { ids: r.contactIds, inbound, outreach: !inbound && r.method !== "phone", at };
    const rarr = rawByTx.get(r.transactionId);
    if (rarr) rarr.push(raw); else rawByTx.set(r.transactionId, [raw]);

    const c = classify(r);
    if (!c) continue;
    const arr = byTx.get(r.transactionId);
    if (arr) arr.push({ ids: r.contactIds, c });
    else byTx.set(r.transactionId, [{ ids: r.contactIds, c }]);
  }

  const awaitCutoff = Date.now() - AWAIT_REPLY_DAYS * 86_400_000;
  const files: FocusLeftFile[] = weekly.files.map((f) => {
    const pool = byTx.get(f.transactionId) ?? [];
    const rawPool = rawByTx.get(f.transactionId) ?? [];
    return {
      ...f,
      sides: f.sides.map((s) => {
        const sideIds = new Set(s.contactIds);
        const lc: FocusSideContacts = { email: null, whatsapp: null, call: null };
        for (const { ids, c } of pool) {
          if (!ids.some((id) => sideIds.has(id))) continue;
          const cur = lc[c.channel];
          if (!cur || c.at.getTime() > cur.at.getTime()) lc[c.channel] = c;
        }
        let lastOutreach = 0, lastInbound = 0;
        for (const r of rawPool) {
          if (!r.ids.some((id) => sideIds.has(id))) continue;
          if (r.outreach && r.at > lastOutreach) lastOutreach = r.at;
          if (r.inbound && r.at > lastInbound) lastInbound = r.at;
        }
        const awaitingReply = lastOutreach > 0 && lastOutreach > lastInbound && lastOutreach <= awaitCutoff;
        return { ...s, lastContact: lc, awaitingReply };
      }),
    };
  });

  return { files, totalSides: weekly.totalSides, doneSides: weekly.doneSides, whatsappInUse };
}

// ─── Right: enquiries + searches ──────────────────────────────────────────────

export type FocusEnquiry = {
  transactionId: string;
  address: string;
  clientNames: string;
  withLabel: string;           // who holds it: "Seller's solicitor" / "Buyer's solicitor"
  solicitorName: string | null;
  quietDays: number;
  stage: "chase" | "escalate" | "escalated" | "hold";
  stalled: boolean;
  needsAttention: boolean;
};

export type FocusSearch = {
  transactionId: string;
  address: string;
  orderedAt: Date;
  daysAgo: number;
};

// Files that need you most right now — an escalating/gone-dark enquiry or a badly
// overdue search. Cross-referenced onto the left-column sides so a quiet client
// whose file is also on fire reads as the top priority.
export type FocusNeedsYou = { transactionId: string; reason: string };

export type FocusRight = {
  enquiries: FocusEnquiry[];
  openEnquiryCount: number;
  searches: FocusSearch[];
  searchCount: number;
  needsYou: FocusNeedsYou[];
};

const SEARCH_OVERDUE_DAYS = 21;

// Worst-first ranking for the top-3: gone-dark (stalled) → needs-you → the rest →
// snoozed, then longest-quiet within each band.
function enquiryRank(e: OpenEnquiryRow): number {
  if (e.stalled) return 0;
  if (e.needsAttention) return 1;
  if (e.status === "snoozed") return 3;
  return 2;
}

export async function getFocusRight(scope: AccessScope, vis: AgentVisibility): Promise<FocusRight> {
  const [openEnquiries, searches] = await Promise.all([
    getOpenEnquiries(scope),
    getSearchesOutstanding(vis),
  ]);

  const ranked = [...openEnquiries].sort((a, b) => enquiryRank(a) - enquiryRank(b) || b.quietDays - a.quietDays);
  const enquiries: FocusEnquiry[] = ranked.slice(0, 3).map((e) => ({
    transactionId: e.transactionId,
    address: e.address,
    clientNames: e.clientNames,
    withLabel: e.currentlyWith === "seller_solicitor" ? "Seller's solicitor" : "Buyer's solicitor",
    solicitorName: e.currentlyWith === "seller_solicitor" ? e.vendorSolicitor : e.purchaserSolicitor,
    quietDays: e.quietDays,
    stage: e.chaseBar.stage,
    stalled: e.stalled,
    needsAttention: e.needsAttention,
  }));

  // "Needs you most": strongest enquiry signal per file (gone-dark > escalating >
  // needs-you), else a badly overdue search. Computed from the FULL lists, not
  // just the displayed top few.
  const enqBest = new Map<string, { rank: number; reason: string }>();
  for (const e of openEnquiries) {
    if (e.status === "snoozed") continue;
    const sig = e.stalled
      ? { rank: 3, reason: "Enquiry gone dark" }
      : e.chaseBar.stage === "escalate" || e.chaseBar.stage === "escalated"
        ? { rank: 2, reason: "Enquiry escalating" }
        : e.needsAttention
          ? { rank: 1, reason: "Enquiry needs you" }
          : null;
    if (!sig) continue;
    const cur = enqBest.get(e.transactionId);
    if (!cur || sig.rank > cur.rank) enqBest.set(e.transactionId, sig);
  }
  const hot = new Map<string, string>();
  for (const s of searches) {
    if (s.daysAgo >= SEARCH_OVERDUE_DAYS && !hot.has(s.transactionId)) hot.set(s.transactionId, `Searches ${s.daysAgo} days overdue`);
  }
  for (const [tx, sig] of enqBest) hot.set(tx, sig.reason); // enquiry overrides search
  const needsYou: FocusNeedsYou[] = [...hot].map(([transactionId, reason]) => ({ transactionId, reason }));

  return { enquiries, openEnquiryCount: openEnquiries.length, searches: searches.slice(0, 5), searchCount: searches.length, needsYou };
}

// Files where searches were ordered (PM8 complete) but results aren't back
// (PM13 not complete), oldest-ordered first. Age uses the real eventDate when
// set, else the system completedAt. Round-scoped so a relisted file's previous
// buyer's PM8 can't match. TSP's own outsourced book only.
async function getSearchesOutstanding(vis: AgentVisibility): Promise<FocusSearch[]> {
  const txWhere = txWhereWorkQueue(vis); // admin_all → { serviceType: "outsourced", ...TSP_ONLY }
  const activeRoundIds = await loadActiveRoundIds(txWhere);

  const rows = await prisma.milestoneCompletion.findMany({
    where: {
      state: "complete",
      milestoneDefinition: { code: "PM8" },
      OR: roundScopedOR(activeRoundIds),
      transaction: {
        ...txWhere,
        status: "active",
        isDemo: false,
        // "Results not received" must be scoped to the ACTIVE round. Without the
        // roundScopedOR, a relisted file whose PREVIOUS (withdrawn) round had its
        // search results back counts as received forever, so the file silently
        // drops off this card even though the current buyer's searches are still
        // outstanding (4 Old Oak Gardens). PM8 above is already round-scoped; this
        // mirrors it. (roundScopedOR allows the active round + file-level nulls.)
        milestoneCompletions: {
          none: { state: "complete", milestoneDefinition: { code: "PM13" }, OR: roundScopedOR(activeRoundIds) },
        },
      },
    },
    orderBy: [{ eventDate: "asc" }, { completedAt: "asc" }],
    distinct: ["transactionId"],
    take: 30,
    select: { eventDate: true, completedAt: true, transaction: { select: { id: true, propertyAddress: true } } },
  });

  const now = Date.now();
  return rows
    .map((r): FocusSearch | null => {
      const ordered = r.eventDate ?? r.completedAt;
      if (!ordered || !r.transaction) return null;
      return {
        transactionId: r.transaction.id,
        address: r.transaction.propertyAddress,
        orderedAt: ordered,
        daysAgo: Math.floor((now - ordered.getTime()) / 86_400_000),
      };
    })
    .filter((x): x is FocusSearch => x !== null)
    .sort((a, b) => b.daysAgo - a.daysAgo); // oldest ordered first
}
