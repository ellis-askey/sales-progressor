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
