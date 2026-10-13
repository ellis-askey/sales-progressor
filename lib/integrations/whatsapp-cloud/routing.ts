// Pure thread-routing helpers (Phase 2, REBUILD_PLAN §C3 matching ladder).
// Dependency-free so the matching rules unit-test cleanly. The accuracy rule:
// a message is only ever auto-attached when its sender matches contacts on
// exactly ONE live sale — anything else queues for a human.

// What one webhook message resolves to as a conversation key.
export type ThreadKey = {
  kind: "direct" | "group";
  waId: string; // the person's wa_id, or the group id
  displayName: string | null;
};

type WebhookMessage = {
  id?: string;
  from?: string;
  type?: string;
  group_id?: string; // present on group messages (Groups API)
  text?: { body?: string };
};
type WebhookValue = {
  messages?: WebhookMessage[];
  contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
};

export function threadKeyFromMessage(value: WebhookValue, msg: WebhookMessage): ThreadKey | null {
  if (msg.group_id) {
    return { kind: "group", waId: msg.group_id, displayName: null };
  }
  if (!msg.from) return null;
  const profile = value.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name ?? null;
  return { kind: "direct", waId: msg.from, displayName: profile };
}

// Inbox list line for a message of any type.
export function previewFromMessage(msg: WebhookMessage): string {
  if (msg.type === "text") return (msg.text?.body ?? "").slice(0, 160);
  return msg.type ? `[${msg.type}]` : "[message]";
}

// ── Media (Phase 4b) ────────────────────────────────────────────────────────
// A media message carries an object keyed by its type with a Meta media id;
// the file itself must be fetched within Meta's 30-day retention and stored in
// our own bucket. `kind` drives rendering: image inline, audio as a player,
// document/video as a download link.

export type MediaRef = {
  kind: "image" | "document" | "audio" | "video" | "sticker";
  mediaId: string;
  mimeType: string | null;
  filename: string | null;
  caption: string | null;
  voice: boolean;
};

type MediaObject = { id?: string; mime_type?: string; caption?: string; filename?: string; voice?: boolean };
type MediaMessage = WebhookMessage & {
  image?: MediaObject;
  document?: MediaObject;
  audio?: MediaObject;
  video?: MediaObject;
  sticker?: MediaObject;
};

export function mediaRefFromMessage(msg: MediaMessage): MediaRef | null {
  const kinds = ["image", "document", "audio", "video", "sticker"] as const;
  for (const kind of kinds) {
    const obj = msg[kind];
    if (obj?.id) {
      return {
        kind,
        mediaId: obj.id,
        mimeType: obj.mime_type ?? null,
        filename: obj.filename ?? null,
        caption: obj.caption ?? null,
        voice: !!obj.voice,
      };
    }
  }
  return null;
}

// What a media message shows as its text line when there's no caption.
export function mediaPlaceholder(ref: MediaRef): string {
  if (ref.kind === "image") return "[photo]";
  if (ref.kind === "audio") return ref.voice ? "[voice note]" : "[audio]";
  if (ref.kind === "video") return "[video]";
  if (ref.kind === "sticker") return "[sticker]";
  return ref.filename ? `[file] ${ref.filename}` : "[document]";
}

// Phone identity: WhatsApp wa_ids are international digits ("4475088…");
// stored contact phones are UK-formatted. The last 9 digits are the stable
// common core (same rule the Baileys ingest used).
export function last9(phoneOrWaId: string | null | undefined): string | null {
  const digits = (phoneOrWaId ?? "").replace(/[^0-9]/g, "");
  if (digits.length < 9) return null;
  return digits.slice(-9);
}

export type ContactMatch = {
  contactId: string;
  transactionId: string;
  roleType: string; // vendor | purchaser | solicitor | broker | other
};

export type Assignment =
  | { state: "auto"; transactionId: string; side: "BUYER" | "SELLER" | null; contactIds: string[]; candidates: [] }
  | { state: "needs_assigning"; transactionId: null; side: null; contactIds: string[]; candidates: string[] };

// ── Reply-window maths (Phase 4) ────────────────────────────────────────────
// Meta's 24-hour customer-service window: free-form messages may only be sent
// within 24h of the person's LAST inbound message; it re-opens on every reply.
// Outside it, only approved templates (Phase 5) can start a conversation.

export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function windowOpenUntil(lastInboundAt: Date | null | undefined, now: Date = new Date()): Date | null {
  if (!lastInboundAt) return null;
  const until = new Date(lastInboundAt.getTime() + SERVICE_WINDOW_MS);
  return until.getTime() > now.getTime() ? until : null;
}

// ── Ledger status mapping (Phase 3) ─────────────────────────────────────────
// WhatsApp lifecycle → the OutboundMessage status enum + its timestamp column.
// `read` maps to `opened` (the ledger's email-era name for the same truth).

export type LedgerStatusUpdate = {
  status: "sent" | "delivered" | "opened" | "failed";
  stampField: "sentAt" | "deliveredAt" | "openedAt" | "failedAt";
};

export function ledgerUpdateForWaStatus(waStatus: string): LedgerStatusUpdate | null {
  switch (waStatus) {
    case "sent": return { status: "sent", stampField: "sentAt" };
    case "delivered": return { status: "delivered", stampField: "deliveredAt" };
    case "read": return { status: "opened", stampField: "openedAt" };
    case "failed": return { status: "failed", stampField: "failedAt" };
    default: return null; // `played` etc. — no ledger column; event store keeps it
  }
}

// Translate a ledger status back to WhatsApp-rank space so advance-only
// ordering works on the row (opened ≙ read).
export function waRankOfLedgerStatus(ledgerStatus: string): string {
  return ledgerStatus === "opened" ? "read" : ledgerStatus;
}

// The ladder's decision step. `matches` = every live-sale contact whose phone
// shares the sender's last-9 core.
export function chooseAssignment(matches: ContactMatch[]): Assignment {
  const txIds = [...new Set(matches.map((m) => m.transactionId))];
  if (txIds.length === 1) {
    const roles = new Set(matches.map((m) => m.roleType));
    const side = roles.size === 1 && roles.has("vendor")
      ? ("SELLER" as const)
      : roles.size === 1 && roles.has("purchaser")
        ? ("BUYER" as const)
        : null;
    return { state: "auto", transactionId: txIds[0], side, contactIds: matches.map((m) => m.contactId), candidates: [] };
  }
  // Zero → unknown sender; several → ambiguous. Both queue — never guess.
  return {
    state: "needs_assigning",
    transactionId: null,
    side: null,
    contactIds: matches.map((m) => m.contactId),
    candidates: txIds,
  };
}
