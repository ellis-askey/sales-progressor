// WhatsApp ingest — turns a normalised message from the bridge into either an
// OutboundMessage on the right property file, or a WhatsAppPendingMessage in the
// "needs assigning" holding area. See docs/WHATSAPP_INTEGRATION.md §4-5.
//
// This is an internal, system-level ingest (the bridge is operated by internal
// staff), so matching queries run unscoped across all agencies; the written
// OutboundMessage inherits the matched transaction's agencyId, so reads stay
// agency-scoped (Law 7) exactly as the Outlook sync does.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/utils";

const ACTIVE_STATUSES = ["draft", "active", "on_hold"] as const;

export type BridgeMedia = {
  type: string; // image | video | document | audio | sticker | ...
  mimetype?: string;
  caption?: string;
  filename?: string;
};

// The shape the bridge POSTs. One object per WhatsApp message.
export type BridgeMessage = {
  waMessageId: string; // WhatsApp message id — the idempotency key
  waChatId: string; // group id (…@g.us) or DM id (…@s.whatsapp.net)
  isGroup: boolean;
  groupName?: string | null;
  fromMe: boolean; // true when Ellis sent it from his own app
  senderPhone?: string | null;
  senderName?: string | null;
  body?: string | null;
  timestamp: number; // unix ms (seconds also tolerated)
  media?: BridgeMedia | null;
};

export type IngestResult = {
  waMessageId: string;
  status: "logged" | "pending" | "duplicate" | "invalid";
  transactionId?: string;
  reason?: string;
};

export type Side = "BUYER" | "SELLER";
type MatchResult = {
  txId: string | null;
  side: Side | null;
  contactId?: string | null;
  reason?: string; // no_match | ambiguous
  candidates?: string[];
};

export async function ingestWhatsAppMessages(messages: BridgeMessage[]): Promise<IngestResult[]> {
  const out: IngestResult[] = [];
  for (const m of messages) {
    try {
      out.push(await ingestOne(m));
    } catch (err) {
      console.error("[whatsapp] ingest failed", m?.waMessageId, err);
      out.push({ waMessageId: m?.waMessageId ?? "", status: "invalid", reason: "error" });
    }
  }
  return out;
}

async function ingestOne(m: BridgeMessage): Promise<IngestResult> {
  if (!m.waMessageId || !m.waChatId) {
    return { waMessageId: m.waMessageId ?? "", status: "invalid", reason: "missing_ids" };
  }

  // Dedup: events replay after reconnects. Check both the logged table and the
  // pending holding area.
  const logged = await prisma.outboundMessage.findFirst({
    where: { method: "whatsapp", providerMessageId: m.waMessageId },
    select: { id: true, transactionId: true },
  });
  if (logged) {
    return { waMessageId: m.waMessageId, status: "duplicate", transactionId: logged.transactionId ?? undefined };
  }
  const pending = await prisma.whatsAppPendingMessage.findUnique({
    where: { waMessageId: m.waMessageId },
    select: { id: true },
  });
  if (pending) return { waMessageId: m.waMessageId, status: "duplicate" };

  // A chat that's already been assigned (group OR direct, auto or manually) is
  // the source of truth — survives renames and never re-asks.
  const mapping = await prisma.whatsAppGroupMapping.findUnique({
    where: { waChatId: m.waChatId },
    select: { transactionId: true, side: true },
  });
  if (mapping) {
    await writeMessage(m, mapping.transactionId, mapping.side as Side);
    return { waMessageId: m.waMessageId, status: "logged", transactionId: mapping.transactionId };
  }

  const match = m.isGroup ? await matchGroup(m) : await matchDirect(m);

  if (match.txId) {
    await writeMessage(m, match.txId, match.side);
    return { waMessageId: m.waMessageId, status: "logged", transactionId: match.txId };
  }

  await writePending(m, match.reason ?? "no_match", match.candidates ?? []);
  return { waMessageId: m.waMessageId, status: "pending", reason: match.reason ?? "no_match" };
}

// ── Group matching ───────────────────────────────────────────────────────────

async function matchGroup(m: BridgeMessage): Promise<MatchResult> {
  // Mapping is checked upstream in ingestOne. Here we only name-match a group
  // we've never seen before.
  const name = (m.groupName ?? "").trim();
  const parsed = parseGroupName(name);
  if (!parsed) return { txId: null, side: null, reason: "no_match" };

  const rows = await prisma.propertyTransaction.findMany({
    where: {
      status: { in: [...ACTIVE_STATUSES] },
      propertyAddress: { contains: parsed.address, mode: "insensitive" },
    },
    select: { id: true, status: true },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  // Pick the file. If several addresses match, prefer the one live file: a
  // property commonly has a `draft` shadow twin alongside the `active` record,
  // so favour a single active/on_hold match over draft before giving up.
  let chosenId: string | null = null;
  if (rows.length === 1) {
    chosenId = rows[0].id;
  } else if (rows.length > 1) {
    const live = rows.filter((r) => r.status === "active" || r.status === "on_hold");
    if (live.length === 1) chosenId = live[0].id;
  }
  if (!chosenId) return { txId: null, side: null, reason: "no_match" };

  // Persist the permanent mapping so we never name-match this group again.
  await prisma.whatsAppGroupMapping.create({
    data: {
      waChatId: m.waChatId,
      transactionId: chosenId,
      side: parsed.side,
      groupNameAtMatch: name,
      matchMethod: "name_auto",
    },
  });
  // Self-heal: pull any earlier messages from this chat that pended before the
  // group was known (e.g. a brand-new group's first message) onto the file.
  await flushPendingForChat(m.waChatId, chosenId, parsed.side);
  return { txId: chosenId, side: parsed.side };
}

// "Sale of {address}" → SELLER; "Purchase of {address}" → BUYER. Returns the
// address remainder used as a single-match `contains` needle against
// propertyAddress (same shape as the Outlook folder-hint matcher).
export function parseGroupName(name: string): { side: Side; address: string } | null {
  const sale = name.match(/^sale of\s+(.+)$/i);
  if (sale) return { side: "SELLER", address: sale[1].trim() };
  const purchase = name.match(/^purchase of\s+(.+)$/i);
  if (purchase) return { side: "BUYER", address: purchase[1].trim() };
  return null;
}

// ── Direct-message matching ──────────────────────────────────────────────────

async function matchDirect(m: BridgeMessage): Promise<MatchResult> {
  const norm = m.senderPhone ? normalizePhone(m.senderPhone) : "";
  if (!norm) return { txId: null, side: null, reason: "no_match" };

  // Narrow in the DB by the last 9 digits, then confirm with an exact
  // normalised compare (stored numbers vary in formatting).
  const last9 = norm.replace(/\D/g, "").slice(-9);
  const contacts = await prisma.contact.findMany({
    where: {
      roleType: { in: ["purchaser", "vendor"] },
      phone: { contains: last9 },
      transaction: { status: { in: [...ACTIVE_STATUSES] } },
    },
    select: { id: true, phone: true, roleType: true, propertyTransactionId: true },
  });

  const byTx = new Map<string, { contactId: string; roleType: string }>();
  for (const c of contacts) {
    if (!c.phone || normalizePhone(c.phone) !== norm) continue;
    if (!byTx.has(c.propertyTransactionId)) {
      byTx.set(c.propertyTransactionId, { contactId: c.id, roleType: c.roleType });
    }
  }

  const txIds = [...byTx.keys()];
  if (txIds.length === 1) {
    const info = byTx.get(txIds[0])!;
    return {
      txId: txIds[0],
      side: info.roleType === "vendor" ? "SELLER" : "BUYER",
      contactId: info.contactId,
    };
  }
  if (txIds.length > 1) return { txId: null, side: null, reason: "ambiguous", candidates: txIds };
  return { txId: null, side: null, reason: "no_match" };
}

// ── Writers ──────────────────────────────────────────────────────────────────

async function writeMessage(m: BridgeMessage, txId: string, side: Side | null, mediaUrl?: string | null) {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: txId },
    select: { agencyId: true, activeBuyerRoundId: true, assignedUserId: true, agentUserId: true },
  });

  const sender = await resolveSender(m, txId, tx?.assignedUserId ?? tx?.agentUserId ?? null);
  const content = (m.body && m.body.trim()) || mediaPlaceholder(m.media) || "[no content]";

  const webhookData: Prisma.InputJsonValue = {
    source: "whatsapp",
    waChatId: m.waChatId,
    isGroup: m.isGroup,
    groupName: m.groupName ?? null,
    senderName: m.senderName ?? null,
    senderPhone: m.senderPhone ?? null,
    media: m.media ?? null,
  };

  await prisma.outboundMessage.create({
    data: {
      transactionId: txId,
      agencyId: tx?.agencyId ?? null,
      type: m.fromMe ? "outbound" : "inbound",
      method: "whatsapp",
      channel: "other", // no WhatsApp value in OutboundChannel yet — timeline keys off `method`
      purpose: "other",
      status: m.fromMe ? "sent" : "delivered",
      contactIds: sender.contactId ? [sender.contactId] : [],
      content,
      mediaUrl: mediaUrl ?? null,
      senderLabel: sender.label,
      recipientName: m.fromMe ? null : sender.label,
      recipientHandle: m.senderPhone ?? null,
      sentAt: toDate(m.timestamp),
      createdById: sender.createdById,
      createdByRole: "system",
      providerMessageId: m.waMessageId,
      providerWebhookData: webhookData,
      // Buyer-side messages belong to the active relist round, matching the
      // paste importer's convention.
      buyerRoundId: side === "BUYER" ? tx?.activeBuyerRoundId ?? null : null,
    },
  });
}

// Resolve who sent a message into a display label (+ contact/agent link):
//   outbound (fromMe) → the file's managing agent (the linked account operator)
//   inbound → a contact on the sale, else an agent by mobile, else the number.
async function resolveSender(
  m: BridgeMessage,
  txId: string,
  managingAgentId: string | null,
): Promise<{ label: string | null; contactId: string | null; createdById: string | null }> {
  if (m.fromMe) {
    if (managingAgentId) {
      const u = await prisma.user.findUnique({ where: { id: managingAgentId }, select: { name: true } });
      return { label: u?.name ?? null, contactId: null, createdById: managingAgentId };
    }
    return { label: null, contactId: null, createdById: null };
  }

  const phone = m.senderPhone ? normalizePhone(m.senderPhone) : "";
  if (phone) {
    const last9 = phone.replace(/\D/g, "").slice(-9);
    // 1. A contact on this sale.
    const contacts = await prisma.contact.findMany({
      where: { propertyTransactionId: txId, phone: { contains: last9 } },
      select: { id: true, name: true, phone: true },
    });
    const contact = contacts.find((c) => c.phone && normalizePhone(c.phone) === phone);
    if (contact) return { label: contact.name, contactId: contact.id, createdById: null };

    // 2. An agent, by their mobile.
    const agents = await prisma.user.findMany({
      where: { phone: { contains: last9 } },
      select: { id: true, name: true, phone: true },
    });
    const agent = agents.find((a) => a.phone && normalizePhone(a.phone) === phone);
    if (agent) return { label: agent.name, contactId: null, createdById: agent.id };
  }

  // 3. Fallback — the number (or the WhatsApp display name if we have no number).
  return { label: m.senderPhone ?? m.senderName ?? null, contactId: null, createdById: null };
}

// Manually assign a whole chat (group or DM) to a property: remember the chat →
// property + side, then replay every held message from it onto the file. Used by
// the Command Centre "needs assigning" screen. Idempotent.
export async function assignChatToTransaction(waChatId: string, transactionId: string, side: Side) {
  await prisma.whatsAppGroupMapping.upsert({
    where: { waChatId },
    create: { waChatId, transactionId, side, matchMethod: "manual" },
    update: { transactionId, side, matchMethod: "manual" },
  });
  await flushPendingForChat(waChatId, transactionId, side);
}

// Replay every pending message for a chat onto a now-known file, then clear the
// pending rows. Used when a chat first gets mapped (auto or, later, manually) so
// messages that arrived before the mapping existed still land on the file.
export async function flushPendingForChat(waChatId: string, txId: string, side: Side | null) {
  const rows = await prisma.whatsAppPendingMessage.findMany({ where: { waChatId } });
  for (const p of rows) {
    const bm: BridgeMessage = {
      waMessageId: p.waMessageId,
      waChatId: p.waChatId,
      isGroup: p.isGroup,
      groupName: p.groupName,
      fromMe: p.fromMe,
      senderPhone: p.senderPhone,
      senderName: p.senderName,
      body: p.body,
      timestamp: p.timestamp.getTime(),
      media: (p.mediaMeta as BridgeMedia | null) ?? null,
    };
    try {
      const already = await prisma.outboundMessage.findFirst({
        where: { method: "whatsapp", providerMessageId: bm.waMessageId },
        select: { id: true },
      });
      if (!already) await writeMessage(bm, txId, side, p.mediaUrl);
      await prisma.whatsAppPendingMessage.delete({ where: { id: p.id } });
    } catch (err) {
      console.error("[whatsapp] flush pending failed", p.waMessageId, err);
    }
  }
}

async function writePending(m: BridgeMessage, reason: string, candidates: string[]) {
  await prisma.whatsAppPendingMessage.create({
    data: {
      waMessageId: m.waMessageId,
      waChatId: m.waChatId,
      isGroup: m.isGroup,
      groupName: m.groupName ?? null,
      senderPhone: m.senderPhone ?? null,
      senderName: m.senderName ?? null,
      fromMe: m.fromMe,
      body: m.body ?? null,
      mediaMeta: (m.media ?? undefined) as Prisma.InputJsonValue | undefined,
      timestamp: toDate(m.timestamp),
      candidateTransactionIds: candidates,
      reason,
    },
  });
}

function mediaPlaceholder(media?: BridgeMedia | null): string {
  if (!media) return "";
  if (media.caption && media.caption.trim()) return media.caption.trim();
  const label = (media.type || "media").toLowerCase();
  return `[${label}]`;
}

// Tolerate seconds or milliseconds unix timestamps.
function toDate(ts: number): Date {
  const ms = ts > 0 && ts < 1e12 ? ts * 1000 : ts;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}
