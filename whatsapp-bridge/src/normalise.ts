// Turn a Baileys WAMessage into the PWA's BridgeMessage shape. Returns null for
// anything we don't ingest (protocol messages, reactions, empty payloads).

import type { proto } from "@whiskeysockets/baileys";
import type { BridgeMedia, BridgeMessage } from "./types.js";

// Digits-only phone from a WhatsApp jid ("447700900000@s.whatsapp.net" -> "447700900000").
// Returns null for a privacy LID jid ("...@lid"): that number is not a real phone
// and must never be treated as one (it breaks contact matching and shows as a
// meaningless long number). Callers fall back to the display name instead.
function phoneFromJid(jid: string | null | undefined): string | null {
  if (!jid) return null;
  if (jid.endsWith("@lid")) return null;
  const user = jid.split("@")[0]?.split(":")[0] ?? "";
  const digits = user.replace(/\D/g, "");
  return digits ? `+${digits}` : null;
}

// A group participant's real phone jid, when Baileys exposes one alongside the
// LID. Field names vary across Baileys versions during the LID migration, so we
// read them defensively and only accept a real "@s.whatsapp.net" jid.
function realPhoneJid(key: Record<string, unknown> | null | undefined, senderJid: string | null): string | null {
  const candidates = [
    key?.participantPn,
    key?.participantAlt,
    key?.senderPn,
    senderJid,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.endsWith("@s.whatsapp.net")) return c;
  }
  return null;
}

function toMillis(ts: number | Long | null | undefined): number {
  if (ts == null) return Date.now();
  const n = typeof ts === "number" ? ts : Number(ts.toString());
  // Baileys reports seconds.
  return n < 1e12 ? n * 1000 : n;
}

// Minimal Long shape so we don't depend on the `long` package's types.
type Long = { toString(): string };

function extractText(m: proto.IMessage | null | undefined): string | null {
  if (!m) return null;
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    m.documentMessage?.caption ??
    null
  );
}

function extractMedia(m: proto.IMessage | null | undefined): BridgeMedia | null {
  if (!m) return null;
  if (m.imageMessage) {
    return { type: "image", mimetype: m.imageMessage.mimetype ?? undefined, caption: m.imageMessage.caption ?? undefined };
  }
  if (m.videoMessage) {
    return { type: "video", mimetype: m.videoMessage.mimetype ?? undefined, caption: m.videoMessage.caption ?? undefined };
  }
  if (m.documentMessage) {
    return {
      type: "document",
      mimetype: m.documentMessage.mimetype ?? undefined,
      caption: m.documentMessage.caption ?? undefined,
      filename: m.documentMessage.fileName ?? undefined,
    };
  }
  if (m.audioMessage) {
    return { type: m.audioMessage.ptt ? "voice" : "audio", mimetype: m.audioMessage.mimetype ?? undefined };
  }
  if (m.stickerMessage) {
    return { type: "sticker", mimetype: m.stickerMessage.mimetype ?? undefined };
  }
  return null;
}

// Ignore anything that isn't a real human message.
function isIngestable(m: proto.IMessage | null | undefined): boolean {
  if (!m) return false;
  if (m.protocolMessage || m.reactionMessage || m.pollUpdateMessage || m.senderKeyDistributionMessage) {
    return false;
  }
  return true;
}

export function normaliseMessage(
  wa: proto.IWebMessageInfo,
  groupName: string | null,
): BridgeMessage | null {
  const key = wa.key;
  const remoteJid = key?.remoteJid ?? null;
  const id = key?.id ?? null;
  if (!remoteJid || !id) return null;
  // Skip status broadcasts.
  if (remoteJid === "status@broadcast") return null;

  const content = wa.message;
  if (!isIngestable(content)) return null;

  const body = extractText(content);
  const media = extractMedia(content);
  if (!body && !media) return null; // nothing to store

  const isGroup = remoteJid.endsWith("@g.us");
  const fromMe = Boolean(key?.fromMe);
  // In a group, the real sender is `participant`; in a DM it's the chat jid.
  const senderJid = isGroup ? key?.participant ?? null : remoteJid;
  // Prefer a real phone jid (for contact matching); a LID resolves to null and
  // the PWA then attributes by pushName.
  const phoneJid = realPhoneJid(key as unknown as Record<string, unknown>, senderJid);

  return {
    waMessageId: id,
    waChatId: remoteJid,
    isGroup,
    groupName: isGroup ? groupName : null,
    fromMe,
    senderPhone: fromMe ? null : phoneFromJid(phoneJid),
    senderName: wa.pushName ?? null,
    body: body ?? null,
    timestamp: toMillis(wa.messageTimestamp as number | Long | null | undefined),
    media,
  };
}
