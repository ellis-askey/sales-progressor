// WhatsApp ingest — turns a normalised message from the bridge into either an
// OutboundMessage on the right property file, or a WhatsAppPendingMessage in the
// "needs assigning" holding area. See docs/WHATSAPP_INTEGRATION.md §4-5 and
// docs/active/whatsapp-agent-facing/SPEC.md §"Phase 1".
//
// GROUPS-ONLY (decision 2026-09-14, applies to every connection incl. the
// internal number): only WhatsApp *group* chats are captured. Direct 1-to-1
// chats are never auto-captured, and a group not named "Sale of {address}" /
// "Purchase of {address}" is silently ignored — never stored, never queued. A
// correctly-named property group that doesn't yet resolve to a single file is
// kept in the needs-assigning queue (manual match + self-heal).
//
// This is an internal, system-level ingest (the bridge is operated by internal
// staff), so matching queries run unscoped across all agencies; the written
// OutboundMessage inherits the matched transaction's agencyId, so reads stay
// agency-scoped (Law 7) exactly as the Outlook sync does.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/utils";
import { parseGroupName, firstLineAddress, chooseTransaction, type Side } from "./match";
import { resolveConnectionScope, touchConnectionMessage } from "./connections";

// Re-exported for existing importers (lib/command/whatsapp.ts, command actions).
export { parseGroupName };
export type { Side };

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
  // Which agent-linked connection forwarded this. Absent = the legacy internal
  // number (unscoped). A known id scopes matching to that connection's agency.
  connectionId?: string | null;
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
  status: "logged" | "pending" | "duplicate" | "invalid" | "ignored";
  transactionId?: string;
  reason?: string;
};

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

  // A dismissed chat (personal / non-property) is dropped, not re-queued, so the
  // "needs assigning" list doesn't refill with junk. Reversible in the DB.
  const ignored = await prisma.whatsAppIgnoredChat.findUnique({
    where: { waChatId: m.waChatId },
    select: { id: true },
  });
  if (ignored) return { waMessageId: m.waMessageId, status: "ignored" };

  // Resolve which connection (and agency) this came through. No connectionId =
  // the legacy internal number: unscoped, matches across all agencies, unchanged.
  // A known connectionId scopes matching to that connection's agency. An unknown
  // connectionId is dropped — we never capture from a connection we can't
  // attribute.
  let scopeAgencyId: string | null = null;
  if (m.connectionId) {
    const scope = await resolveConnectionScope(m.connectionId);
    if (!scope) return { waMessageId: m.waMessageId, status: "ignored", reason: "unknown_connection" };
    // Command Centre kill switch: an agency can be force-disabled even with a
    // linked connection.
    if (!scope.captureEnabled) {
      return { waMessageId: m.waMessageId, status: "ignored", reason: "capture_disabled" };
    }
    scopeAgencyId = scope.agencyId;
  }

  // A chat that's already been assigned (group OR direct, auto or manually) is
  // the source of truth — survives renames and never re-asks.
  const mapping = await prisma.whatsAppGroupMapping.findUnique({
    where: { waChatId: m.waChatId },
    select: { transactionId: true, side: true },
  });
  if (mapping) {
    await writeMessage(m, mapping.transactionId, mapping.side as Side);
    if (m.connectionId) await touchConnectionMessage(m.connectionId);
    return { waMessageId: m.waMessageId, status: "logged", transactionId: mapping.transactionId };
  }

  // Groups-only: a direct 1-to-1 chat is never auto-captured. Only an explicit
  // prior mapping (handled above) can attach a DM to a file.
  if (!m.isGroup) {
    return { waMessageId: m.waMessageId, status: "ignored", reason: "not_group" };
  }

  const match = await matchGroup(m, scopeAgencyId);

  if (match.txId) {
    await writeMessage(m, match.txId, match.side);
    if (m.connectionId) await touchConnectionMessage(m.connectionId);
    return { waMessageId: m.waMessageId, status: "logged", transactionId: match.txId };
  }

  // A group that isn't a "Sale of / Purchase of {address}" property group is
  // silently ignored — never stored, never queued.
  if (match.reason === "not_property") {
    return { waMessageId: m.waMessageId, status: "ignored", reason: "not_property" };
  }

  // An agency connection whose correctly-named group doesn't resolve to one of
  // that agency's files is dropped — we never spill an agency's WhatsApp content
  // into the internal needs-assigning queue. Only the legacy internal number
  // keeps the queue (so internal staff can hand-match a stray group).
  if (scopeAgencyId) {
    return { waMessageId: m.waMessageId, status: "ignored", reason: "no_file_in_agency" };
  }

  await writePending(m, match.reason ?? "no_match", match.candidates ?? []);
  return { waMessageId: m.waMessageId, status: "pending", reason: match.reason ?? "no_match" };
}

// ── Group matching ───────────────────────────────────────────────────────────

async function matchGroup(m: BridgeMessage, scopeAgencyId: string | null): Promise<MatchResult> {
  // Mapping is checked upstream in ingestOne. Here we only name-match a group
  // we've never seen before.
  const name = (m.groupName ?? "").trim();
  const parsed = parseGroupName(name);
  // Not a property group ("Sale of…" / "Purchase of…") → caller silently ignores.
  if (!parsed) return { txId: null, side: null, reason: "not_property" };

  // Match on the first line of the address (text before the first comma) so a
  // group named with either the full address or just the first line resolves to
  // the same file. Narrow in the DB by a first-line substring, then refine with
  // exact first-line equality in chooseTransaction (a substring alone would let
  // "18 High St" mis-hit "118 High St"). When scoped to an agency, only that
  // agency's files are considered (multi-tenant safety).
  const needle = firstLineAddress(parsed.address);
  if (!needle) return { txId: null, side: null, reason: "not_property" };

  const rows = await prisma.propertyTransaction.findMany({
    where: {
      status: { in: [...ACTIVE_STATUSES] },
      ...(scopeAgencyId ? { agencyId: scopeAgencyId } : {}),
      propertyAddress: { contains: needle, mode: "insensitive" },
    },
    select: { id: true, status: true, propertyAddress: true },
    orderBy: { updatedAt: "desc" },
    take: 25,
  });

  const chosenId = chooseTransaction(needle, rows);
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

// Direct-message matching was removed with the groups-only decision
// (2026-09-14): DMs are no longer auto-captured. resolveSender below still
// matches a sender's phone to name them inside a matched group.

// ── Writers ──────────────────────────────────────────────────────────────────

async function writeMessage(m: BridgeMessage, txId: string, side: Side | null, mediaUrl?: string | null) {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: txId },
    select: { agencyId: true, activeBuyerRoundId: true, assignedUserId: true, agentUserId: true, contacts: { select: { id: true, roleType: true } } },
  });

  const sender = await resolveSender(m, txId, tx?.assignedUserId ?? tx?.agentUserId ?? null);
  const content = (m.body && m.body.trim()) || mediaPlaceholder(m.media) || "[no content]";
  const sentAt = toDate(m.timestamp);

  // Cross-connection dedup. When two linked accounts are both in a group they
  // each forward the same message with DIFFERENT ids, so the id check in
  // ingestOne can't catch it. The same underlying message always shares the file,
  // the exact text, and the WhatsApp timestamp — so a row already on this file
  // with the same content + sentAt is that other account's copy: skip it. (Two
  // genuinely separate sends of the same text have different timestamps.)
  const twin = await prisma.outboundMessage.findFirst({
    where: { transactionId: txId, method: "whatsapp", content, sentAt },
    select: { id: true },
  });
  if (twin) return;

  // Direction by WHO sent it, not which account saw it. A message is "ours"
  // (right/green) when the sending account is us (fromMe) OR the sender resolves
  // to one of our own users (an agent/progressor). Otherwise it's incoming from a
  // client (left). This is what stops an agent's own message being drawn on the
  // left just because a second linked account captured it as a participant.
  const isOurs = m.fromMe || sender.createdById != null;

  // Attribute the message to the client on THIS side of the chat. Inbound
  // messages resolve to the specific client sender; outbound (ours) messages have
  // no client sender, so we attribute them to this side's client contact(s) —
  // otherwise the No-comms / Gone-quiet detectors (which key off contactIds)
  // never register our own WhatsApps as contact with the client.
  const sideRole = side === "BUYER" ? "purchaser" : side === "SELLER" ? "vendor" : null;
  const sideContactIds = sideRole ? (tx?.contacts ?? []).filter((c) => c.roleType === sideRole).map((c) => c.id) : [];

  const webhookData: Prisma.InputJsonValue = {
    source: "whatsapp",
    waChatId: m.waChatId,
    // Which agent connection captured this (null = the internal number). Phase 4
    // reads this to route WhatsApp promises to the right owner.
    connectionId: m.connectionId ?? null,
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
      type: isOurs ? "outbound" : "inbound",
      method: "whatsapp",
      channel: "other", // no WhatsApp value in OutboundChannel yet — timeline keys off `method`
      purpose: "other",
      status: isOurs ? "sent" : "delivered",
      contactIds: isOurs ? sideContactIds : (sender.contactId ? [sender.contactId] : sideContactIds),
      content,
      mediaUrl: mediaUrl ?? null,
      senderLabel: sender.label,
      recipientName: isOurs ? null : sender.label,
      recipientHandle: m.senderPhone ?? null,
      sentAt,
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

  // 3. Fallback — prefer the WhatsApp display name (pushName). In groups the
  // participant id is often a privacy LID (a long non-phone number), so the raw
  // number is meaningless to a human; the name is what identifies the sender.
  return { label: m.senderName ?? m.senderPhone ?? null, contactId: null, createdById: null };
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

// Move an already-assigned chat to a different file: remap it and relocate every
// WhatsApp message from that chat onto the new file. Non-destructive — messages
// are moved, never deleted. Fixes a mis-assignment.
export async function reassignChat(waChatId: string, newTransactionId: string, side: Side) {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: newTransactionId },
    select: { agencyId: true, activeBuyerRoundId: true },
  });
  if (!tx) return;
  await prisma.whatsAppGroupMapping.upsert({
    where: { waChatId },
    create: { waChatId, transactionId: newTransactionId, side, matchMethod: "manual" },
    update: { transactionId: newTransactionId, side, matchMethod: "manual" },
  });
  await prisma.outboundMessage.updateMany({
    where: { method: "whatsapp", providerWebhookData: { path: ["waChatId"], equals: waChatId } },
    data: {
      transactionId: newTransactionId,
      agencyId: tx.agencyId,
      buyerRoundId: side === "BUYER" ? tx.activeBuyerRoundId : null,
    },
  });
}

// Stop capturing a chat onto its file: drop the mapping so future messages
// return to the "needs assigning" queue. Existing messages stay where they are
// (non-destructive); use reassignChat to move them instead.
export async function unassignChat(waChatId: string) {
  await prisma.whatsAppGroupMapping.deleteMany({ where: { waChatId } });
}

// Dismiss a chat from the "needs assigning" queue: remember it as ignored (so
// ingest drops its future messages) and clear its pending rows.
export async function dismissChat(waChatId: string, title: string | null) {
  await prisma.whatsAppIgnoredChat.upsert({
    where: { waChatId },
    create: { waChatId, title },
    update: { title },
  });
  await prisma.whatsAppPendingMessage.deleteMany({ where: { waChatId } });
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
