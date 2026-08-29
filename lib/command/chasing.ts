import { commandDb } from "@/lib/command/prisma";

// Command Centre → Chasing hub. Effectiveness of every automated chase we send,
// across three systems, each on its own tab:
//   - enquiries  (ChaseSend: raise + reply-loop)   — full sent→opened→acted
//   - solicitor  (SolicitorChaseState)             — sent + outcome
//   - client     (OutboundEmailQueue CLIENT_CHASE) — sent + delivery + engagement
// Rows are clickable to show what was actually sent (getChaseDetail).
// Excludes internal/test/demo files everywhere.

const WINDOW_DAYS = 56;
const realFile = { isDemo: false, agency: { isInternal: false } } as const;

export type ChaseType = "enquiries" | "solicitor" | "client";
export type OutcomeTone = "good" | "warn" | "muted";

export type ChaseRow = {
  id: string;
  type: ChaseType;
  transactionId: string;
  address: string;
  sentAt: Date | null;
  chasedLabel: string;
  chasedSub: string | null;
  openedAt: Date | null;
  opensTracked: boolean;
  outcome: string;
  outcomeTone: OutcomeTone;
  canEmailTick: boolean;
  repliedByEmail: boolean;
};

export type ChaseSummary = {
  sent: number;
  responded: number;
  responseRate: number | null; // null when opens/acted not tracked
  opened: number;
  opensTracked: boolean;
  rateLabel: string; // headline rate card title ("Response rate" / "Open rate")
  respondedVerb: string; // what "responded" means here ("acted" / "opened")
  extraLabel: string; // right-hand context stat label
  extra: number;
};

export type ChaseTabData = {
  type: ChaseType;
  title: string;
  blurb: string;
  summary: ChaseSummary;
  rows: ChaseRow[];
  sinceLabel: string | null;
};

const RECIPIENT_LABEL: Record<string, string> = {
  seller_solicitor: "Seller's solicitor",
  buyer_solicitor: "Buyer's solicitor",
  buyer: "Buyer",
};
const KIND_LABEL: Record<string, string> = { raise: "Raise chase", reply_loop: "Reply chase", milestone: "Milestone chase" };
const RESPONSE_LABEL: Record<string, string> = { update: "Left an update", date: "Gave a date", confirm: "Confirmed" };

function fmtSince(d: Date | null): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ── Enquiries (full effectiveness, from ChaseSend) ────────────────────────────
async function getEnquiriesTab(): Promise<ChaseTabData> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const sends = await commandDb.chaseSend.findMany({
    where: { sentAt: { gte: since }, kind: { in: ["raise", "reply_loop"] }, transaction: realFile },
    orderBy: { sentAt: "desc" },
    select: {
      id: true, kind: true, recipient: true, recipientName: true, sentAt: true, transactionId: true,
      openedAt: true, respondedAt: true, responseType: true, repliedByEmailAt: true,
      transaction: { select: { propertyAddress: true } },
    },
  });

  const solicitor = sends.filter((s) => s.recipient !== "buyer");
  const respondedFn = (s: (typeof sends)[number]) => !!s.respondedAt || !!s.repliedByEmailAt;
  const respondedCount = solicitor.filter(respondedFn).length;
  const opened = solicitor.filter((s) => s.openedAt && !respondedFn(s)).length;
  const rate = solicitor.length ? Math.round((respondedCount / solicitor.length) * 100) : 0;

  const rows: ChaseRow[] = sends.map((s) => {
    const responded = respondedFn(s);
    const outcome = s.respondedAt
      ? RESPONSE_LABEL[s.responseType ?? ""] ?? "Responded"
      : s.repliedByEmailAt ? "Replied by email"
      : s.openedAt ? "Opened, no action"
      : "No response yet";
    return {
      id: s.id,
      type: "enquiries",
      transactionId: s.transactionId,
      address: s.transaction.propertyAddress ?? "—",
      sentAt: s.sentAt,
      chasedLabel: `${RECIPIENT_LABEL[s.recipient] ?? s.recipient} · ${KIND_LABEL[s.kind] ?? s.kind}`,
      chasedSub: s.recipientName ?? null,
      openedAt: s.openedAt,
      opensTracked: true,
      outcome,
      outcomeTone: responded ? "good" : s.openedAt ? "warn" : "muted",
      canEmailTick: s.recipient !== "buyer",
      repliedByEmail: !!s.repliedByEmailAt,
    };
  });

  return {
    type: "enquiries",
    title: "Enquiries chase",
    blurb: "Getting enquiries raised, then getting the solicitor holding the ball to reply. We know when they opened the link and what they did.",
    summary: {
      sent: solicitor.length, responded: respondedCount, responseRate: rate,
      opened, opensTracked: true, rateLabel: "Response rate", respondedVerb: "acted",
      extraLabel: "Opened, no action", extra: opened,
    },
    rows,
    sinceLabel: fmtSince(sends.length ? sends[sends.length - 1].sentAt : null),
  };
}

// ── Solicitor milestone chase (full funnel, from ChaseSend kind=milestone) ─────
async function getSolicitorTab(): Promise<ChaseTabData> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const sends = await commandDb.chaseSend.findMany({
    where: { sentAt: { gte: since }, kind: "milestone", transaction: realFile },
    orderBy: { sentAt: "desc" },
    select: {
      id: true, recipient: true, recipientName: true, sentAt: true, transactionId: true,
      openedAt: true, respondedAt: true, responseType: true, repliedByEmailAt: true,
      transaction: { select: { propertyAddress: true } },
    },
  });

  const respondedFn = (s: (typeof sends)[number]) => !!s.respondedAt || !!s.repliedByEmailAt;
  const respondedCount = sends.filter(respondedFn).length;
  const opened = sends.filter((s) => s.openedAt && !respondedFn(s)).length;
  const rate = sends.length ? Math.round((respondedCount / sends.length) * 100) : 0;

  const rows: ChaseRow[] = sends.map((s) => {
    const responded = respondedFn(s);
    return {
      id: s.id,
      type: "solicitor",
      transactionId: s.transactionId,
      address: s.transaction.propertyAddress ?? "—",
      sentAt: s.sentAt,
      chasedLabel: `${RECIPIENT_LABEL[s.recipient] ?? s.recipient} · Milestone chase`,
      chasedSub: s.recipientName ?? null,
      openedAt: s.openedAt,
      opensTracked: true,
      outcome: s.respondedAt ? "Confirmed the step" : s.repliedByEmailAt ? "Replied by email" : s.openedAt ? "Opened, no action" : "No response yet",
      outcomeTone: responded ? "good" : s.openedAt ? "warn" : "muted",
      canEmailTick: false,
      repliedByEmail: !!s.repliedByEmailAt,
    };
  });

  return {
    type: "solicitor",
    title: "Solicitor chase",
    blurb: "Chasing solicitors to confirm the steps they own. We know when they opened the link and whether they confirmed. Rows appear from when chasing was switched on.",
    summary: {
      sent: sends.length, responded: respondedCount, responseRate: rate,
      opened, opensTracked: true, rateLabel: "Response rate", respondedVerb: "acted",
      extraLabel: "Opened, no action", extra: opened,
    },
    rows,
    sinceLabel: fmtSince(sends.length ? sends[sends.length - 1].sentAt : null),
  };
}

// ── Client chase (sent + delivery + opens, from OutboundEmailQueue) ────────────
async function getClientTab(): Promise<ChaseTabData> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const queued = await commandDb.outboundEmailQueue.findMany({
    where: { emailType: "CLIENT_CHASE", sentAt: { gte: since }, recipientContact: { transaction: realFile } },
    orderBy: { sentAt: "desc" },
    select: {
      id: true, sentAt: true, deliveredAt: true, bouncedAt: true, openedAt: true, payload: true,
      recipientContact: { select: { name: true, propertyTransactionId: true, transaction: { select: { propertyAddress: true } } } },
    },
  });

  const openedCount = queued.filter((q) => q.openedAt != null).length;
  const bounced = queued.filter((q) => q.bouncedAt != null).length;
  const rate = queued.length ? Math.round((openedCount / queued.length) * 100) : 0;

  const rows: ChaseRow[] = queued.map((q) => {
    const subject = (q.payload as { subject?: string } | null)?.subject ?? "Client chase";
    return {
      id: q.id,
      type: "client",
      transactionId: q.recipientContact?.propertyTransactionId ?? "",
      address: q.recipientContact?.transaction.propertyAddress ?? "—",
      sentAt: q.sentAt,
      chasedLabel: q.recipientContact?.name ?? "Client",
      chasedSub: subject,
      openedAt: q.openedAt,
      opensTracked: true,
      outcome: q.bouncedAt ? "Bounced" : q.openedAt ? "Opened" : q.deliveredAt ? "Delivered, not opened" : "Sent",
      outcomeTone: q.bouncedAt ? "warn" : q.openedAt ? "good" : "muted",
      canEmailTick: false,
      repliedByEmail: false,
    };
  });

  return {
    type: "client",
    title: "Client chase",
    blurb: "Nudging buyers and sellers to do their bit. Opens are tracked (from when tracking was switched on) but approximate: some mail apps block the signal and Apple Mail can inflate it.",
    summary: {
      sent: queued.length, responded: openedCount, responseRate: rate,
      opened: openedCount, opensTracked: true, rateLabel: "Open rate", respondedVerb: "opened",
      extraLabel: "Bounced", extra: bounced,
    },
    rows,
    sinceLabel: fmtSince(queued.length ? queued[queued.length - 1].sentAt : null),
  };
}

export async function getChasingData(type: ChaseType): Promise<ChaseTabData> {
  if (type === "solicitor") return getSolicitorTab();
  if (type === "client") return getClientTab();
  return getEnquiriesTab();
}

// Tab counts for the header, cheap.
export async function getChaseTabCounts(): Promise<Record<ChaseType, number>> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const [enquiries, solicitor, client] = await Promise.all([
    commandDb.chaseSend.count({ where: { sentAt: { gte: since }, kind: { in: ["raise", "reply_loop"] }, recipient: { not: "buyer" }, transaction: realFile } }),
    commandDb.chaseSend.count({ where: { sentAt: { gte: since }, kind: "milestone", transaction: realFile } }),
    commandDb.outboundEmailQueue.count({ where: { emailType: "CLIENT_CHASE", sentAt: { gte: since }, recipientContact: { transaction: realFile } } }),
  ]);
  return { enquiries, solicitor, client };
}

// ── Row detail: what was actually sent ────────────────────────────────────────
export type ChaseDetail = {
  subject: string;
  body: string | null;
  bodyNote: string | null;
  meta: { label: string; value: string }[];
  transactionId: string | null;
};

function fmtDateTime(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export async function getChaseDetail(type: ChaseType, id: string): Promise<ChaseDetail | null> {
  if (type === "enquiries") {
    const send = await commandDb.chaseSend.findUnique({
      where: { id },
      select: {
        transactionId: true, kind: true, recipient: true, recipientName: true, sentAt: true,
        openedAt: true, respondedAt: true, responseType: true, repliedByEmailAt: true,
      },
    });
    if (!send) return null;
    // Correlate to the paired activity record written by the same cron iteration:
    // the automated chase OutboundMessage for this file, nearest in time.
    const candidates = await commandDb.outboundMessage.findMany({
      where: { transactionId: send.transactionId, purpose: "chase", isAutomated: true },
      orderBy: { sentAt: "desc" },
      select: { subject: true, content: true, sentAt: true, recipientName: true },
      take: 40,
    });
    const target = send.sentAt ? send.sentAt.getTime() : 0;
    const nearest = candidates
      .map((c) => ({ c, d: Math.abs((c.sentAt?.getTime() ?? 0) - target) }))
      .sort((a, b) => a.d - b.d)[0]?.c ?? null;
    return {
      subject: nearest?.subject ?? `${KIND_LABEL[send.kind] ?? send.kind} to ${RECIPIENT_LABEL[send.recipient] ?? send.recipient}`,
      body: nearest?.content ?? null,
      bodyNote: nearest ? null : "The exact copy wasn't stored for this send.",
      meta: [
        { label: "Chased", value: `${RECIPIENT_LABEL[send.recipient] ?? send.recipient}${send.recipientName ? ` · ${send.recipientName}` : ""}` },
        { label: "Sent", value: fmtDateTime(send.sentAt) },
        { label: "Opened", value: fmtDateTime(send.openedAt) },
        { label: "Responded", value: send.respondedAt ? `${fmtDateTime(send.respondedAt)} (${RESPONSE_LABEL[send.responseType ?? ""] ?? "action"})` : send.repliedByEmailAt ? `By email (${fmtDateTime(send.repliedByEmailAt)})` : "—" },
      ],
      transactionId: send.transactionId,
    };
  }

  if (type === "solicitor") {
    const send = await commandDb.chaseSend.findUnique({
      where: { id },
      select: { transactionId: true, recipient: true, recipientName: true, sentAt: true, openedAt: true, respondedAt: true, repliedByEmailAt: true },
    });
    if (!send) return null;
    // The chase cron mirrors an OutboundMessage with the real subject (the body
    // it stores is a summary line, so we show that and flag it).
    const candidates = await commandDb.outboundMessage.findMany({
      where: { transactionId: send.transactionId, purpose: "chase", isAutomated: true },
      orderBy: { sentAt: "desc" },
      select: { subject: true, content: true, sentAt: true },
      take: 40,
    });
    const target = send.sentAt ? send.sentAt.getTime() : 0;
    const msg = candidates.map((c) => ({ c, d: Math.abs((c.sentAt?.getTime() ?? 0) - target) })).sort((a, b) => a.d - b.d)[0]?.c ?? null;
    return {
      subject: msg?.subject ?? "Confirmation request",
      body: msg?.content ?? null,
      bodyNote: "Only a summary of this chase was stored, not the full email body.",
      meta: [
        { label: "Chased", value: `${RECIPIENT_LABEL[send.recipient] ?? send.recipient}${send.recipientName ? ` · ${send.recipientName}` : ""}` },
        { label: "Sent", value: fmtDateTime(send.sentAt) },
        { label: "Opened", value: fmtDateTime(send.openedAt) },
        { label: "Outcome", value: send.respondedAt ? `Confirmed (${fmtDateTime(send.respondedAt)})` : send.repliedByEmailAt ? `Replied by email (${fmtDateTime(send.repliedByEmailAt)})` : "—" },
      ],
      transactionId: send.transactionId,
    };
  }

  // client
  const q = await commandDb.outboundEmailQueue.findUnique({
    where: { id },
    select: { payload: true, sentAt: true, deliveredAt: true, openedAt: true, bouncedAt: true, bouncedReason: true, recipientContact: { select: { name: true, propertyTransactionId: true } } },
  });
  if (!q) return null;
  const p = q.payload as { subject?: string; text?: string } | null;
  return {
    subject: p?.subject ?? "Client chase",
    body: p?.text ?? null,
    bodyNote: p?.text ? null : "The email body wasn't stored for this send.",
    meta: [
      { label: "To", value: q.recipientContact?.name ?? "Client" },
      { label: "Sent", value: fmtDateTime(q.sentAt) },
      { label: "Delivered", value: fmtDateTime(q.deliveredAt) },
      { label: "Opened", value: q.openedAt ? `${fmtDateTime(q.openedAt)} (approx)` : "—" },
      { label: "Bounced", value: q.bouncedAt ? `${fmtDateTime(q.bouncedAt)}${q.bouncedReason ? ` · ${q.bouncedReason}` : ""}` : "—" },
    ],
    transactionId: q.recipientContact?.propertyTransactionId ?? null,
  };
}
