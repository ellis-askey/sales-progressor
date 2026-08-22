import { commandDb } from "@/lib/command/prisma";
import { parseGroupName } from "@/lib/integrations/whatsapp/ingest";
import { normalizePhone } from "@/lib/utils";

// Command Centre → WhatsApp. Live bridge connection status + the "needs
// assigning" queue (chats we couldn't route), with suggested properties so the
// whole conversation can be assigned in one click. See docs/WHATSAPP_INTEGRATION.md.

const ACTIVE = ["draft", "active", "on_hold"] as const;

export type WhatsAppConnectionStatus = {
  configured: boolean; // bridge URL + secret set in env
  reachable: boolean; // bridge answered
  connection?: string; // open | connecting | qr | close
  phoneNumber?: string | null;
  lastMessageAt?: string | null;
  pairUrl?: string | null; // superadmin-only browser pairing link
};

export async function getWhatsAppConnectionStatus(): Promise<WhatsAppConnectionStatus> {
  const base = process.env.WHATSAPP_BRIDGE_URL?.trim().replace(/\/$/, "");
  const secret = process.env.WHATSAPP_BRIDGE_SECRET?.trim();
  if (!base || !secret) return { configured: false, reachable: false };
  try {
    const res = await fetch(`${base}/status`, {
      headers: { authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    if (!res.ok) return { configured: true, reachable: false };
    const d = (await res.json()) as {
      connection?: string;
      phoneNumber?: string | null;
      lastMessageAt?: string | null;
    };
    return {
      configured: true,
      reachable: true,
      connection: d.connection,
      phoneNumber: d.phoneNumber ?? null,
      lastMessageAt: d.lastMessageAt ?? null,
      pairUrl: `${base}/pair?key=${encodeURIComponent(secret)}`,
    };
  } catch {
    return { configured: true, reachable: false };
  }
}

export type ChatCandidate = { id: string; address: string; side: "BUYER" | "SELLER" };
export type UnmatchedChat = {
  waChatId: string;
  isGroup: boolean;
  title: string; // group name, or DM sender name/number
  suggestedSide: "BUYER" | "SELLER" | null;
  count: number;
  lastBody: string | null;
  lastAt: Date;
  candidates: ChatCandidate[];
};

// Unmatched WhatsApp messages, grouped into one row per conversation, each with
// suggested properties to assign it to.
export async function getUnmatchedChats(): Promise<UnmatchedChat[]> {
  const rows = await commandDb.whatsAppPendingMessage.findMany({ orderBy: { createdAt: "desc" } });

  const byChat = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = byChat.get(r.waChatId);
    if (arr) arr.push(r);
    else byChat.set(r.waChatId, [r]);
  }

  const out: UnmatchedChat[] = [];
  for (const [waChatId, msgs] of byChat) {
    const recent = msgs[0]; // findMany was desc, so [0] is newest
    const parsed = recent.isGroup ? parseGroupName((recent.groupName ?? "").trim()) : null;
    const title = recent.isGroup
      ? recent.groupName ?? "Unnamed group"
      : recent.senderName ?? recent.senderPhone ?? "Unknown sender";
    out.push({
      waChatId,
      isGroup: recent.isGroup,
      title,
      suggestedSide: parsed?.side ?? null,
      count: msgs.length,
      lastBody: recent.body,
      lastAt: recent.createdAt,
      candidates: await candidatesForChat(recent, parsed),
    });
  }
  return out;
}

async function candidatesForChat(
  recent: { isGroup: boolean; senderPhone: string | null },
  parsed: { side: "BUYER" | "SELLER"; address: string } | null,
): Promise<ChatCandidate[]> {
  if (recent.isGroup) {
    if (!parsed) return [];
    const rows = await commandDb.propertyTransaction.findMany({
      where: { status: { in: [...ACTIVE] }, propertyAddress: { contains: parsed.address, mode: "insensitive" } },
      select: { id: true, propertyAddress: true, status: true },
      take: 6,
    });
    // Live files first.
    return rows
      .sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1))
      .map((r) => ({ id: r.id, address: r.propertyAddress, side: parsed.side }));
  }

  // DM: candidate sales are those where the sender's number is a contact.
  const norm = recent.senderPhone ? normalizePhone(recent.senderPhone) : "";
  if (!norm) return [];
  const last9 = norm.replace(/\D/g, "").slice(-9);
  const contacts = await commandDb.contact.findMany({
    where: {
      phone: { contains: last9 },
      roleType: { in: ["purchaser", "vendor"] },
      transaction: { status: { in: [...ACTIVE] } },
    },
    select: { roleType: true, phone: true, transaction: { select: { id: true, propertyAddress: true } } },
    take: 12,
  });
  const seen = new Set<string>();
  const cands: ChatCandidate[] = [];
  for (const c of contacts) {
    if (!c.phone || normalizePhone(c.phone) !== norm) continue;
    if (seen.has(c.transaction.id)) continue;
    seen.add(c.transaction.id);
    cands.push({
      id: c.transaction.id,
      address: c.transaction.propertyAddress,
      side: c.roleType === "vendor" ? "SELLER" : "BUYER",
    });
  }
  return cands;
}
