// lib/services/comms.ts
// Sprint 5: Communication record CRUD and activity timeline queries.
// Sprint 7: Added AI generation fields (chaseTaskId, generatedText, tone, wasAiGenerated, wasEdited)
//           and chaseCount increment on outbound chase comms.

import { prisma } from "@/lib/prisma";
import type { CommType, CommMethod } from "@prisma/client";
import { pushToTransaction } from "@/lib/services/push";
import { sendEmail } from "@/lib/email";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { touchLastActivity } from "@/lib/services/activity";
import { buildGreeting } from "@/lib/portal-copy";
import { scopeOwnershipWhere, type AccessScope } from "@/lib/security/access-scope";
import { applyChaseToTask } from "@/lib/services/reminders";
import { forRound, milestoneScopeWhere, type MilestoneScope } from "@/lib/services/milestone-scope";
import { confirmationSentence, resolveConfirmer } from "@/lib/updates-copy";
import { confirmationSubtext, confirmerBucket } from "@/lib/milestone-confirmation-subtext";
import { getWhatsAppMediaSignedUrlMap } from "@/lib/supabase-storage";
import type { ActorRole } from "@/components/ui/Avatar";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityEntry =
  | {
      kind: "milestone";
      id: string;
      at: Date | null;
      summaryText: string | null;
      milestoneName: string;
      milestoneCode: string;
      completedByName: string | null;
      isNotRequired: boolean;
      confirmedByClient: boolean;
      confirmerName: string | null;
      // Inline "{who} confirmed {clause}" sentence + the confirmer's name/photo,
      // so the timeline reads as one line (matches the agent Updates feed).
      // who = the agent/progressor's full name, the client's name(s), or the
      // solicitor firm. See lib/updates-copy.ts confirmationSentence.
      sentence: string;
      byName: string | null;
      byImage: string | null;
      // Avatar/colour for the person who completed the step.
      actorRole: ActorRole;
      actorName: string;
      actorImage: string | null;
      // Approved one-line progress note shown under the sentence. Keyed by
      // milestone code + who confirmed. Null for skipped steps or any
      // code/confirmer pairing with no supplied line. See
      // lib/milestone-confirmation-subtext.ts.
      subtext: string | null;
    }
  | {
      kind: "comm";
      id: string;
      at: Date;
      type: CommType;
      method: CommMethod | null;
      content: string;
      createdById: string | null;
      createdByName: string | null;
      createdByImage: string | null;
      createdByRole: string | null;
      contactNames: string[];
      // Raw fields exposed so the inline edit form on ActivityTimeline can
      // pre-populate without a second round-trip. contactIds drives the
      // contact picker; visibleToClient drives the toggle; wasEdited drives
      // the "(edited)" indicator next to the timestamp.
      contactIds: string[];
      visibleToClient: boolean;
      wasEdited: boolean;
      wasAiGenerated: boolean;
      isAutomated: boolean;
      tone: string | null;
      // "Setup note" marks internal notes written from the new-sale
      // form's notes box (2026-08-19) — the Notes card pins these.
      subject: string | null;
      // WhatsApp: resolved sender display name + stored media (null for other
      // channels). senderLabel is shown as the row's author. mediaUrl is a
      // ready-to-use signed URL (or null); mediaType drives how it renders.
      senderLabel: string | null;
      mediaUrl: string | null;
      mediaType: string | null;
      // Who the row represents — avatar photo/colour + name + optional sublabel
      // ("Seller" / "Buyer" / "Solicitor"). See resolveActor.
      actorRole: ActorRole;
      actorName: string;
      actorImage: string | null;
      actorSubLabel: string | null;
    };

// ─── Actor role helpers (activity avatars) ─────────────────────────────────────

// Internal-staff role → progressor (SP team) vs agent (customer agency).
function userRoleToActor(role: string | null | undefined): ActorRole {
  if (role === "sales_progressor" || role === "admin" || role === "superadmin") return "progressor";
  return "agent"; // director / negotiator / viewer / anything else
}
// Contact role → seller / buyer / solicitor(grey). Broker + other → grey too.
function contactRoleToActor(roleType: string | null | undefined): ActorRole {
  if (roleType === "vendor") return "seller";
  if (roleType === "purchaser") return "buyer";
  return "solicitor";
}
function actorSubLabel(role: ActorRole): string | null {
  if (role === "seller") return "Seller";
  if (role === "buyer") return "Buyer";
  if (role === "solicitor") return "Solicitor";
  return null; // progressor / agent / system carry no sublabel
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getActivityTimeline(
  transactionId: string,
  agencyId: string | null,
  // Phase 1 commit 4d — optional milestone scope. Default (omitted) =
  // active-round view used by the live agent file detail. The archived-
  // round view in Phase 1 commit 7/8 will pass forRound(archivedId, txId)
  // to read THAT round's PMs + vendor file-level. Comms are file-level
  // and not filtered by scope; only the milestone completions side is.
  milestoneScope?: MilestoneScope,
): Promise<ActivityEntry[]> {
  const tx = await prisma.propertyTransaction.findFirst({
    where: agencyId ? { id: transactionId, agencyId } : { id: transactionId },
    select: {
      id: true,
      activeBuyerRoundId: true,
      // Pass 3 B2: relist-clean timeline. NULL-stamped rows (status-change
      // internal_notes, pre-Phase-0 unstamped rows) that pre-date the active
      // round's createdAt are old-sale residue. Filter them out so the live
      // timeline reads as just-this-sale, matching the buyer-attributed scope.
      activeBuyerRound: { select: { createdAt: true } },
      contacts: { select: { id: true, name: true, roleType: true, image: true, isPrincipal: true } },
      // Solicitor contacts ride on the same outboundMessage.contactIds
      // array as vendor/purchaser contacts (CommsEntry lets the agent
      // toggle either row when logging the comm). They must be in the
      // same name-lookup map below, otherwise the .filter(Boolean) on
      // the result drops the solicitor IDs and the row renders without
      // their names — looks to the agent like the solicitor was never
      // attached at all.
      vendorSolicitorContact:    { select: { id: true, name: true } },
      purchaserSolicitorContact: { select: { id: true, name: true } },
    },
  });
  if (!tx) throw new Error("Transaction not found");

  type ContactInfo = { name: string; roleType: string | null; image: string | null };
  const contactInfo = new Map<string, ContactInfo>(
    tx.contacts.map((c) => [c.id, { name: c.name, roleType: c.roleType ?? null, image: c.image ?? null }]),
  );
  // Solicitor contacts are a separate model (no roleType/image) — grey avatar.
  if (tx.vendorSolicitorContact)
    contactInfo.set(tx.vendorSolicitorContact.id, { name: tx.vendorSolicitorContact.name, roleType: "solicitor", image: null });
  if (tx.purchaserSolicitorContact)
    contactInfo.set(tx.purchaserSolicitorContact.id, { name: tx.purchaserSolicitorContact.name, roleType: "solicitor", image: null });

  const scope = milestoneScope ?? forRound(tx.activeBuyerRoundId, transactionId);

  const [completions, comms] = await Promise.all([
    prisma.milestoneCompletion.findMany({
      where: {
        transactionId,
        state: { in: ["complete", "not_required"] },
        ...milestoneScopeWhere(scope),
      },
      orderBy: { completedAt: "desc" },
      include: {
        milestoneDefinition: { select: { name: true, code: true, side: true } },
        completedBy: { select: { name: true, image: true, role: true } },
        confirmedBySolicitorFirm: { select: { name: true } },
      },
    }),
    // Phase-2 PR 3 (OutboundMessage scoping): scope buyer-attributed
    // comms to the active round. File-level rows (buyerRoundId NULL —
    // vendor / shared / pre-Phase-0) pass through unchanged.
    // A relisted file no longer surfaces Sale 1's chase emails, portal-
    // action notes, or internal_notes about the fall-through buyer on
    // the live activity timeline.
    //
    // Pass 3 B2: NULL-stamped rows are further gated on
    // `createdAt >= activeBuyerRound.createdAt` so an old-sale
    // status-change internal_note doesn't leak through the "file-level"
    // branch. Legacy files (no active round) fall back to "all NULL".
    prisma.outboundMessage.findMany({
      where: {
        transactionId,
        // Hide chase-engine bookkeeping notes ("Automated chase scheduled /
        // moved / closed"). That lifecycle now lives in the chase timeline
        // (components/transaction/ChaseTimeline.tsx), so the activity feed
        // stays human comms + milestones + notes. Signature: an automated
        // internal_note with no chaseTaskId. The fallback "handed back to
        // agent" notes carry a chaseTaskId and stay — they're actionable.
        NOT: { type: "internal_note", isAutomated: true, chaseTaskId: null },
        // WhatsApp is surfaced on its own surface, not the activity timeline
        // (founder decision 2026-08-22) — keep this tab uncluttered.
        method: { not: "whatsapp" },
        ...(tx.activeBuyerRoundId
          ? {
              OR: [
                {
                  buyerRoundId: null,
                  ...(tx.activeBuyerRound?.createdAt
                    ? { createdAt: { gte: tx.activeBuyerRound.createdAt } }
                    : {}),
                },
                { buyerRoundId: tx.activeBuyerRoundId },
              ],
            }
          : { buyerRoundId: null }),
      },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { name: true, image: true } },
      },
    }),
  ]);

  const milestoneEntries: ActivityEntry[] = completions.map((c) => {
    const confirmedByClient = c.confirmedByPortal;
    const side = c.milestoneDefinition.side as "vendor" | "purchaser";
    const sideContacts = tx.contacts
      .filter((ct) => ct.roleType === side)
      .map((ct) => ({ id: ct.id, name: ct.name, isPrincipal: ct.isPrincipal }));

    // Classify who confirmed (a helper reads "on behalf of ...") and get the
    // side's PRINCIPAL names — helpers are never in the named list. Null = a
    // genuine system auto-confirm.
    const { confirmer, principals } = resolveConfirmer(c, sideContacts);

    const sentence = c.state === "not_required"
      ? (c.summaryText ?? c.milestoneDefinition.name)
      : confirmer
        ? confirmationSentence({ code: c.milestoneDefinition.code, side, confirmer, sideContacts: principals, milestoneName: c.milestoneDefinition.name, isDesktopValuation: c.milestoneDefinition.code === "PM6" && !c.eventDate })
        : (c.summaryText ?? c.milestoneDefinition.name);

    // The confirmer's name + photo for the inline avatar. For a portal confirm
    // this is the specific client; otherwise the completing user.
    const clientContact = confirmedByClient
      ? (tx.contacts.find((ct) => ct.id === c.confirmedByContactId) ?? tx.contacts.find((ct) => ct.roleType === side))
      : null;
    const byName = confirmedByClient ? (clientContact?.name ?? null) : (c.completedBy?.name ?? null);
    const byImage = confirmedByClient ? (clientContact?.image ?? null) : (c.completedBy?.image ?? null);

    return {
      kind: "milestone",
      id: c.id,
      at: c.completedAt,
      summaryText: c.summaryText,
      milestoneName: c.milestoneDefinition.name,
      milestoneCode: c.milestoneDefinition.code,
      completedByName: c.completedBy?.name ?? null,
      isNotRequired: c.state === "not_required",
      confirmedByClient,
      confirmerName: confirmedByClient ? "Client (portal)" : null,
      sentence,
      byName,
      byImage,
      actorRole: confirmedByClient ? "other" : c.completedBy ? userRoleToActor(c.completedBy.role) : c.confirmedBySolicitorFirmId ? "other" : "system",
      actorName: byName ?? "System",
      actorImage: byImage,
      // Skipped steps carry no subtext; completed steps take the approved
      // line for their code + confirmer bucket (null when none supplied).
      subtext: c.state === "not_required"
        ? null
        : confirmationSubtext(c.milestoneDefinition.code, confirmerBucket(confirmer)),
    };
  });

  // Who a comm row represents: automated → system; a real logging user →
  // progressor/agent; otherwise (e.g. a synced inbound email) → the linked
  // contact (seller/buyer/solicitor).
  const resolveCommActor = (c: (typeof comms)[number]) => {
    if (c.isAutomated) return { role: "system" as ActorRole, name: "System", image: null, sub: null };
    // A solicitor-left update (the /s/<token> flow) is stored as an
    // internal_note but authored by the firm, carried on senderLabel. Show the
    // firm as the author rather than the file's agent (whose id we borrow for
    // createdById because the solicitor isn't a system user).
    if (c.type === "internal_note" && c.senderLabel) {
      return { role: "solicitor" as ActorRole, name: c.senderLabel, image: null, sub: null };
    }
    if (c.createdById) {
      return {
        role: userRoleToActor(c.createdByRole),
        name: c.createdBy?.name ?? "Team",
        image: c.createdBy?.image ?? null,
        sub: null,
      };
    }
    const info = c.contactIds.map((id) => contactInfo.get(id)).find(Boolean);
    if (info) {
      const role = contactRoleToActor(info.roleType);
      return { role, name: info.name, image: info.image, sub: actorSubLabel(role) };
    }
    return { role: "system" as ActorRole, name: "System", image: null, sub: null };
  };

  const commEntries: ActivityEntry[] = comms.map((c) => {
    const actor = resolveCommActor(c);
    return {
    kind: "comm",
    id: c.id,
    // sentAt = actual message time (set on backdated WhatsApp imports);
    // createdAt = row-logged time (the legacy default). Backfilled rows slot
    // into chronological position by sentAt; normal rows keep createdAt.
    at: c.sentAt ?? c.createdAt,
    type: c.type,
    method: c.method,
    content: c.content,
    createdById: c.createdById ?? null,
    createdByName: c.createdBy?.name ?? null,
    createdByImage: c.createdBy?.image ?? null,
    createdByRole: c.createdByRole ?? null,
    actorRole: actor.role,
    actorName: actor.name,
    actorImage: actor.image,
    actorSubLabel: actor.sub,
    contactNames: c.contactIds
      .map((id) => contactInfo.get(id)?.name)
      .filter(Boolean) as string[],
    contactIds: c.contactIds,
    visibleToClient: c.visibleToClient,
    wasEdited: c.wasEdited,
    wasAiGenerated: c.wasAiGenerated,
    isAutomated: c.isAutomated,
    tone: c.tone,
    subject: c.subject ?? null,
    senderLabel: c.senderLabel ?? null,
    mediaUrl: c.mediaUrl ?? null, // object path here; signed below
    mediaType:
      (c.providerWebhookData as { media?: { type?: string } } | null)?.media?.type ?? null,
    };
  });

  // Sign WhatsApp media object paths into short-lived URLs for rendering.
  const mediaPaths = commEntries
    .filter((e): e is Extract<ActivityEntry, { kind: "comm" }> => e.kind === "comm")
    .map((e) => e.mediaUrl);
  if (mediaPaths.some(Boolean)) {
    const signed = await getWhatsAppMediaSignedUrlMap(mediaPaths);
    for (const e of commEntries) {
      if (e.kind === "comm" && e.mediaUrl) e.mediaUrl = signed.get(e.mediaUrl) ?? null;
    }
  }

  return [...milestoneEntries, ...commEntries].sort(
    (a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0)
  );
}

// ─── WhatsApp reader ────────────────────────────────────────────────────────
// The activity timeline deliberately hides WhatsApp (method !== "whatsapp"),
// so the captured chats need their own reader. This groups a file's WhatsApp
// messages back into conversations (a file can have a buyer-side and a
// vendor-side group) and returns them chat-style: oldest-first within a chat,
// newest chat first, media pre-signed. Read-only — we never send from here.

export type WhatsAppChatMessage = {
  id: string;
  // "outbound" = sent from the linked account (the agent); "inbound" = the
  // other party. Drives which side of the thread the bubble sits on.
  direction: CommType;
  senderLabel: string | null;
  content: string;
  at: Date;
  mediaUrl: string | null; // ready-to-use signed URL (or null)
  mediaType: string | null;
};

export type WhatsAppConversation = {
  chatId: string; // "side:seller" | "side:buyer" | "side:other"
  title: string; // "Seller" | "Buyer" | "Other"
  // Whether to render a sender name above inbound bubbles. Always true here —
  // a side thread merges a group and 1:1 DMs, so it can carry several people.
  showSenders: boolean;
  lastAt: Date;
  messages: WhatsAppChatMessage[];
};

type Side = "seller" | "buyer" | "other";

export async function getWhatsAppConversations(
  transactionId: string,
  agencyId: string | null,
): Promise<WhatsAppConversation[]> {
  const tx = await prisma.propertyTransaction.findFirst({
    where: agencyId ? { id: transactionId, agencyId } : { id: transactionId },
    select: {
      id: true,
      activeBuyerRoundId: true,
      contacts: { select: { id: true, name: true, roleType: true } },
    },
  });
  if (!tx) throw new Error("Transaction not found");

  const contactById = new Map(tx.contacts.map((c) => [c.id, c]));

  // A chat's side comes from its mapping (group OR DM, once assigned). Paste
  // history has no mapping, so it falls back to the contacts a row was logged
  // against. This lets us merge a side's group + 1:1 DMs into one thread.
  const mappings = await prisma.whatsAppGroupMapping.findMany({
    where: { transactionId },
    select: { waChatId: true, side: true },
  });
  const sideByChat = new Map(mappings.map((m) => [m.waChatId, m.side]));

  const rows = await prisma.outboundMessage.findMany({
    where: {
      transactionId,
      method: "whatsapp",
      // Match the activity timeline's relist scope: buyer-attributed rows
      // only for the active round, file-level (NULL) rows always. Stops an
      // old fall-through buyer's WhatsApp group surfacing on a relisted file.
      ...(tx.activeBuyerRoundId
        ? { OR: [{ buyerRoundId: null }, { buyerRoundId: tx.activeBuyerRoundId }] }
        : { buyerRoundId: null }),
    },
    orderBy: { sentAt: "asc" },
    select: {
      id: true,
      type: true,
      content: true,
      senderLabel: true,
      sentAt: true,
      createdAt: true,
      mediaUrl: true,
      providerWebhookData: true,
      contactIds: true,
      buyerRoundId: true,
    },
  });

  // Sign every media path in one round trip, then hand each row its URL.
  const signed = await getWhatsAppMediaSignedUrlMap(rows.map((r) => r.mediaUrl));

  type Meta = { waChatId?: string; media?: { type?: string } };

  const contactName = (contactIds: string[]): string | null => {
    for (const id of contactIds) {
      const n = contactById.get(id)?.name;
      if (n) return n;
    }
    return null;
  };
  const sideOf = (meta: Meta, contactIds: string[], buyerRoundId: string | null): Side => {
    // 1. The chat's mapped side (group or DM).
    if (meta.waChatId) {
      const s = sideByChat.get(meta.waChatId);
      if (s === "BUYER") return "buyer";
      if (s === "SELLER") return "seller";
    }
    // 2. Paste history / unmapped — infer from the contacts on the row.
    for (const id of contactIds) {
      const role = contactById.get(id)?.roleType;
      if (role === "vendor") return "seller";
      if (role === "purchaser") return "buyer";
    }
    return buyerRoundId ? "buyer" : "other";
  };

  const byChat = new Map<string, WhatsAppConversation>();
  for (const r of rows) {
    const meta = (r.providerWebhookData as Meta | null) ?? {};
    const at = r.sentAt ?? r.createdAt;
    const side = sideOf(meta, r.contactIds, r.buyerRoundId);
    const chatId = `side:${side}`;

    let convo = byChat.get(chatId);
    if (!convo) {
      const title = side === "seller" ? "Seller" : side === "buyer" ? "Buyer" : "Other";
      convo = { chatId, title, showSenders: true, lastAt: at, messages: [] };
      byChat.set(chatId, convo);
    }
    if (at > convo.lastAt) convo.lastAt = at;

    // Own (outbound) messages carry no name, WhatsApp-style. Inbound uses the
    // captured sender name, then the contact it was logged against.
    const senderLabel = r.type === "outbound" ? null : r.senderLabel ?? contactName(r.contactIds);

    convo.messages.push({
      id: r.id,
      direction: r.type,
      senderLabel,
      content: r.content,
      at,
      mediaUrl: r.mediaUrl ? signed.get(r.mediaUrl) ?? null : null,
      mediaType: meta.media?.type ?? null,
    });
  }

  // Order messages oldest-first within each side (group + DM interleave by time).
  for (const convo of byChat.values()) {
    convo.messages.sort((a, b) => a.at.getTime() - b.at.getTime());
  }
  // Seller / Buyer order: most-recently-active first so the reader opens live.
  return [...byChat.values()].sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
}

// Counts automated CHASE emails per contact on a transaction, in a rolling
// 7-day window. Used by the contact rows on the file detail page to surface
// "is this person being over-chased *right now*?" — a signal the agent
// can't see otherwise because they didn't author these messages themselves.
//
// Scope: purpose = "chase" only (confirmations, notifications, digests,
// password resets etc. are explicitly excluded — the pill should only flag
// repeat chasing of an unresponsive contact, not e.g. a milestone-confirmed
// email that fires once). Window: rolling 7 days from now — so 20 chase
// emails over 3 months is fine (no pill) but 6 chase emails in a single
// week reads red.
//
// One round-trip + JS aggregation: per file there are typically <50 rows
// in the window and <8 contacts; not worth a groupBy or N count() queries.
export async function getAutomatedEmailCountsByContact(
  transactionId: string,
): Promise<Record<string, number>> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await prisma.outboundMessage.findMany({
    where: {
      transactionId,
      isAutomated: true,
      channel: "email",
      purpose: "chase",
      sentAt: { gte: sevenDaysAgo },
    },
    select: { contactIds: true },
  });
  const counts: Record<string, number> = {};
  for (const r of rows) {
    for (const cid of r.contactIds) {
      counts[cid] = (counts[cid] ?? 0) + 1;
    }
  }
  return counts;
}

// Per-contact "last contacted" timestamp for the contact card on the file
// detail page. Outbound-only signal: tells the agent when WE last reached
// out to the contact (not when the contact last replied).
//
// What counts (three sources, max timestamp wins):
//   1. OutboundMessage with type = "outbound" AND a "past-the-wire" status
//      (sent / delivered / opened / clicked). The contactIds array contains
//      the contact's id. Manual chase emails, logged calls, WhatsApp paste
//      imports, etc. all land here.
//   2. PortalMessage with fromClient = false (agent → contact reply).
//   3. OutboundEmailQueue with sentAt non-null + recipientContactId set —
//      this is the daily client-chase digest path that bypasses
//      OutboundMessage entirely.
//
// What does NOT count:
//   - OutboundMessage type = "internal_note" (internal team only) or
//     "inbound" (from contact to us).
//   - OutboundMessage status in {draft, scheduled, queued, cancelled,
//     failed, bounced} — anything that didn't actually leave the platform.
//   - PortalMessage fromClient = true (from contact to us).
//   - ChaseTask state changes (ticking a chase done, the "↻ Chased"
//     advancement). These touch ChaseTask + ReminderLog and never insert
//     a comms row, so they're correctly invisible here.
//
// Returns a record keyed by contactId. Contacts with no qualifying event
// are absent from the map; callers should treat undefined as "never
// contacted" and render the empty-state pill.
export async function getLastContactedByContact(
  transactionId: string,
): Promise<Record<string, string>> {
  const SENT_STATUSES: Array<"sent" | "delivered" | "opened" | "clicked"> = [
    "sent",
    "delivered",
    "opened",
    "clicked",
  ];

  // Phase-2 PR 4: load activeBuyerRoundId once so the PortalMessage query
  // below can scope to active-round purchaser contacts only. Cheap
  // findUnique on PK; runs in parallel with the Promise.all below would
  // be ideal but we need the value before the queries.
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { activeBuyerRoundId: true },
  });

  const [outboundRows, portalRows, queueRows] = await Promise.all([
    // Outbound logs (manual emails, phone calls, WhatsApp, etc.)
    prisma.outboundMessage.findMany({
      where: {
        transactionId,
        type: "outbound",
        status: { in: SENT_STATUSES },
      },
      select: { contactIds: true, sentAt: true, createdAt: true },
    }),
    // Portal messages the agent sent to the contact.
    //
    // Phase-2 PR 4 (PortalMessage scoping): scope to active-round buyer
    // contacts + file-level (vendor / solicitor / broker). Fall-through
    // purchaser portal threads no longer affect the live "last contacted"
    // value on the file detail's contact rows.
    prisma.portalMessage.findMany({
      where: {
        transactionId,
        fromClient: false,
        contact: {
          OR: [
            { roleType: { not: "purchaser" as const } },
            { buyerRoundId: null },
            ...(tx?.activeBuyerRoundId ? [{ buyerRoundId: tx.activeBuyerRoundId }] : []),
          ],
        },
      },
      select: { contactId: true, createdAt: true },
    }),
    // Automated client-chase digests that actually went out via the queue
    prisma.outboundEmailQueue.findMany({
      where: {
        sentAt: { not: null },
        recipientContactId: { not: null },
        sourceId: { startsWith: `${transactionId}:` },
      },
      select: { recipientContactId: true, sentAt: true },
    }),
  ]);

  const out: Record<string, string> = {};

  function note(contactId: string, at: Date | null) {
    if (!at) return;
    const iso = at.toISOString();
    if (!out[contactId] || out[contactId] < iso) out[contactId] = iso;
  }

  for (const r of outboundRows) {
    const ts = r.sentAt ?? r.createdAt;
    for (const cid of r.contactIds) note(cid, ts);
  }
  for (const r of portalRows) {
    note(r.contactId, r.createdAt);
  }
  for (const r of queueRows) {
    if (r.recipientContactId) note(r.recipientContactId, r.sentAt);
  }

  return out;
}

// Phase 1 commit 4d post-fix — buyer-side detection rule for the
// OutboundMessage `buyerRoundId` stamp. Two-step logic, ordered by
// reliability:
//
//   1. If the caller supplies a `targetSide` hint (chase / digest /
//      AI-route paths derive it from chaseTask → rule.targetMilestoneCode;
//      "PM*" → purchaser, "VM*" → vendor), use it directly. This is the
//      AUTHORITATIVE signal — a chase to the purchaser-side solicitor is
//      a buyer-side comm even though the Contact row's roleType doesn't
//      say so.
//
//   2. Otherwise (manual logs without a chase task, WhatsApp imports),
//      fall back to the strict Phase 0 rule: every contactId resolves to
//      a Contact row with roleType='purchaser'. We do NOT pretend to
//      detect "the purchaser's solicitor" by Contact roleType — a
//      Contact row with roleType='solicitor' carries no side information
//      (the codebase convention at lib/services/summary.ts:32,
//      ChaseDrawer.tsx:102, app/api/ai/generate-chase/route.ts:43 all
//      use `contacts.find((c) => c.roleType === 'solicitor')`, treating
//      it as "the" solicitor with no side discrimination). Without a
//      caller-supplied hint there's no honest answer.
//
// PRIOR BUG (reverted in this fix): an earlier version compared
// contactId entries to tx.purchaserSolicitorContactId — but that FK
// targets SolicitorContact (the firm-directory table), not Contact.
// OutboundMessage.contactIds holds Contact.id values exclusively
// (ChaseDrawer.tsx:241, app/api/ai/generate-chase/route.ts:43), so the
// comparison was structurally impossible and silently never matched.

type StampDecisionInput = {
  contactIds: string[];
  targetSide?: "vendor" | "purchaser" | null;
};

async function decideBuyerSideStamp(input: StampDecisionInput): Promise<boolean> {
  // Authoritative path: caller knows the side.
  if (input.targetSide === "purchaser") return true;
  if (input.targetSide === "vendor") return false;

  // Fallback path — refined rule (Ellis-locked 2026-06-05 post-Phase-2-ledger):
  // stamp when AT LEAST ONE contact is purchaser-role AND all purchaser-role
  // contacts on the message share the same non-null buyerRoundId. Other-role
  // co-recipients (vendor / solicitor / broker) neither stamp nor block —
  // the purchaser's round attribution is unambiguous.
  //
  // The previous rule ("ALL contacts purchaser-role") was stricter than the
  // policy required and had a cost: a message to (active buyer + their
  // solicitor) stayed file-level, meaning it survived on the live timeline
  // after that buyer fell through — the exact leak this arc closes. The
  // ambiguity decision 5 originally guarded against was solicitor-ONLY
  // attribution; a message that includes an identifiable purchaser is not
  // ambiguous.
  if (input.contactIds.length === 0) return false;
  const contacts = await prisma.contact.findMany({
    where: { id: { in: input.contactIds } },
    select: { id: true, roleType: true, buyerRoundId: true },
  });
  if (contacts.length !== input.contactIds.length) return false;

  const purchasers = contacts.filter((c) => c.roleType === "purchaser");
  if (purchasers.length === 0) return false;
  if (purchasers.some((c) => c.buyerRoundId === null)) return false;
  const distinctRounds = new Set(purchasers.map((c) => c.buyerRoundId));
  if (distinctRounds.size > 1) return false;

  return true;
}

// Derive the chase target side from a chaseTaskId. Returns "purchaser"
// for PM* targets, "vendor" for VM*, null when unknown (no chase task
// or unrecognised code prefix). Used by createCommunicationRecord and
// /api/chase/send-email to obtain the side hint without each caller
// re-implementing the lookup.
export async function deriveChaseTargetSide(
  chaseTaskId: string | null | undefined,
): Promise<"vendor" | "purchaser" | null> {
  if (!chaseTaskId) return null;
  const task = await prisma.chaseTask.findUnique({
    where: { id: chaseTaskId },
    select: { reminderLog: { select: { reminderRule: { select: { targetMilestoneCode: true } } } } },
  });
  const code = task?.reminderLog?.reminderRule?.targetMilestoneCode ?? null;
  if (!code) return null;
  if (code.startsWith("PM")) return "purchaser";
  if (code.startsWith("VM")) return "vendor";
  return null;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export type CreateCommInput = {
  transactionId: string;
  chaseTaskId?: string | null;
  type: CommType;
  method?: CommMethod | null;
  contactIds: string[];
  content: string;
  ccEmails?: string;
  generatedText?: string | null;
  tone?: string | null;
  wasAiGenerated?: boolean;
  wasEdited?: boolean;
  isAutomated?: boolean;
  visibleToClient?: boolean;
  createdById: string;
  createdByRole?: string | null;
  // scope replaces agencyId — use getAccessScope(session) at the call site.
  // scopeOwnershipWhere enforces assignedUserId for SP, agencyId for agents, bare id for admin.
  scope: AccessScope;
  // Phase 1 commit 4d post-fix — optional side hint for buyerRoundId
  // stamping. "purchaser" = active-round stamp; "vendor" = file-level.
  // Auto-derived from chaseTaskId when omitted; explicit override is
  // accepted for non-chase send paths that still know their target
  // (e.g. a milestone-confirmation notification to the buyer's
  // solicitor that doesn't go through a chase task).
  targetSide?: "vendor" | "purchaser" | null;
};

export async function createCommunicationRecord(input: CreateCommInput) {
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(input.scope, input.transactionId),
    select: { id: true, propertyAddress: true, activeBuyerRoundId: true },
  });
  if (!tx) throw new Error("Transaction not found");

  // Phase 1 commit 4d post-fix — send-time round attribution. Side-hint
  // first (authoritative when present), Phase 0 contactIds fallback
  // otherwise. See banner above decideBuyerSideStamp for why the
  // earlier SolicitorContact-FK fiction was reverted.
  //
  // Auto-derive targetSide from chaseTaskId when the caller didn't
  // pass it explicitly — keeps existing call sites round-correct
  // without forcing every drawer/route to know about the rule.
  let stampBuyerRoundId: string | null = null;
  if (tx.activeBuyerRoundId) {
    let effectiveTargetSide = input.targetSide ?? null;
    if (effectiveTargetSide == null && input.chaseTaskId) {
      effectiveTargetSide = await deriveChaseTargetSide(input.chaseTaskId);
    }
    const stampDecision = await decideBuyerSideStamp({
      contactIds: input.contactIds,
      targetSide: effectiveTargetSide,
    });
    if (stampDecision) stampBuyerRoundId = tx.activeBuyerRoundId;
  }

  const record = await prisma.outboundMessage.create({
    data: {
      transactionId: input.transactionId,
      chaseTaskId: input.chaseTaskId ?? null,
      type: input.type,
      method: input.method ?? null,
      contactIds: input.contactIds,
      content: input.content,
      ccEmails: input.ccEmails ?? null,
      generatedText: input.generatedText ?? null,
      tone: input.tone ?? null,
      wasAiGenerated: input.wasAiGenerated ?? false,
      wasEdited: input.wasEdited ?? false,
      isAutomated: input.isAutomated ?? false,
      visibleToClient: input.visibleToClient ?? false,
      createdById: input.createdById,
      createdByRole: input.createdByRole ?? null,
      buyerRoundId: stampBuyerRoundId,
    },
  });

  // Honest-chase-count: a real outbound chase bumps the counter, stamps
  // lastChasedAt, resets priority to normal, AND advances the associated
  // ReminderLog.nextDueDate forward by repeatEveryDays. Same source of
  // truth as the ↻ Chased button (advanceChaseTask) — see applyChaseToTask
  // in lib/services/reminders.ts. Without the nextDueDate advance the row
  // stays classified as overdue after the chase email lands, which is the
  // bug fixed on 2026-06.
  if (input.chaseTaskId && input.type === "outbound") {
    // An agent-composed outbound chase is a human chase; an automated one
    // (isAutomated) is not — route so only human chases arm escalation.
    await applyChaseToTask(input.chaseTaskId, { origin: input.isAutomated ? "auto" : "manual" });
  }

  touchLastActivity(input.transactionId).catch(() => {});

  // Notify subscribed contacts when a client-visible update is logged
  if (input.visibleToClient) {
    const preview = input.content.length > 100
      ? input.content.slice(0, 97) + "…"
      : input.content;

    const short = tx.propertyAddress.split(",")[0];
    pushToTransaction(input.transactionId, {
      title: `New update: ${short}`,
      body: preview,
      urlPath: "/updates",
    }).catch(() => {});

    emailVisibleUpdateToClients(input.transactionId, input.content).catch(() => {});
  }

  return record;
}

export type GlobalCommEntry = {
  id: string;
  transactionId: string;
  propertyAddress: string;
  type: CommType;
  method: CommMethod | null;
  content: string;
  createdByName: string | null;
  wasAiGenerated: boolean;
  createdAt: Date;
};

export async function getGlobalCommsLog(agencyId: string, limit = 150): Promise<GlobalCommEntry[]> {
  const records = await prisma.outboundMessage.findMany({
    where: { transaction: { agencyId } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      transaction: { select: { propertyAddress: true } },
      createdBy: { select: { name: true } },
    },
  });

  return records
    .map((r) => ({
      id: r.id,
      transactionId: r.transactionId!,
      propertyAddress: r.transaction!.propertyAddress,
      type: r.type,
      method: r.method,
      content: r.content,
      createdByName: r.createdBy?.name ?? null,
      wasAiGenerated: r.wasAiGenerated,
      // sentAt overrides createdAt for backdated import rows (see ActivityTimeline)
      createdAt: r.sentAt ?? r.createdAt,
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function deleteCommunicationRecord(id: string, scope: AccessScope) {
  // Verify the comm's transaction is in scope before deleting.
  const where =
    scope.kind === "all"      ? { id } :
    scope.kind === "assigned" ? { id, transaction: { assignedUserId: scope.userId } } :
                                { id, transaction: { agencyId: scope.agencyIds[0] } };
  const comm = await prisma.outboundMessage.findFirst({ where, select: { id: true } });
  if (!comm) throw new Error("Not found");
  return prisma.outboundMessage.delete({ where: { id } });
}

export type UpdateCommInput = {
  id: string;
  content: string;
  contactIds: string[];
  visibleToClient: boolean;
  scope: AccessScope;
};

// Edits a manually-logged comms entry (phone / WhatsApp / note / etc.).
// Automated entries (system-fired emails) are not editable — they're
// already-sent transactional sends; pre-send edits happen via the
// email-preview modal on the queue row, not here.
//
// Scope semantics match deleteCommunicationRecord exactly:
//   admin / superadmin  → any file
//   sales_progressor    → assigned files
//   director / negotiator / viewer → their agency's files
//
// `wasEdited` flips to true on the first edit and stays true (no audit
// trail of individual edits in v1 — updatedAt + the flag is enough).
// Returns the updated row.
export async function updateCommunicationRecord(input: UpdateCommInput) {
  const { id, content, contactIds, visibleToClient, scope } = input;
  const where =
    scope.kind === "all"      ? { id } :
    scope.kind === "assigned" ? { id, transaction: { assignedUserId: scope.userId } } :
                                { id, transaction: { agencyId: scope.agencyIds[0] } };
  const comm = await prisma.outboundMessage.findFirst({
    where,
    select: { id: true, isAutomated: true, transactionId: true },
  });
  if (!comm) throw new Error("Not found");
  if (comm.isAutomated) throw new Error("Automated comms cannot be edited");
  const updated = await prisma.outboundMessage.update({
    where: { id },
    data: {
      content,
      contactIds,
      visibleToClient,
      wasEdited: true,
    },
  });
  if (comm.transactionId) {
    touchLastActivity(comm.transactionId).catch(() => {});
  }
  return updated;
}

// ─── WhatsApp chat bulk-import ────────────────────────────────────────────────
// Takes parsed messages + a sender→identity mapping and inserts them as
// individual OutboundMessage rows in a single transaction. Backdates the
// actual message time onto `sentAt` (NOT createdAt — see plan / audit).

export type SenderMapping = Record<
  string,
  // "me" carries an optional list of recipient contact IDs. Group chats
  // almost always have multiple recipients on the same outbound message,
  // so the field is an array. Each id is stored on
  // OutboundMessage.contactIds so the timeline reads
  // "Outbound to {names…}" rather than just "Outbound". Empty / omitted
  // = no specific recipient (backwards-compatible with legacy single-id
  // callers and pre-multi-recipient imports).
  | { kind: "me"; recipientContactIds?: string[] }
  | { kind: "contact"; contactId: string }
  | { kind: "skip" }
>;

export type ImportMessageInput = {
  rawSender: string;
  content: string;
  whatsappTimestamp: Date;
};

export type ImportResult = {
  inserted: number;
  skipped: number;
  importBatchId: string;
};

const UNDO_WINDOW_MS = 10 * 60 * 1000; // 10 minutes — defence in depth vs 5s client toast

export async function importWhatsAppChat(
  transactionId: string,
  messages: ImportMessageInput[],
  mapping: SenderMapping,
  createdById: string,
  createdByRole: string | null,
  scope: AccessScope,
): Promise<ImportResult> {
  if (messages.length === 0) {
    return { inserted: 0, skipped: 0, importBatchId: "" };
  }
  if (messages.length > 500) {
    throw new Error("Too many messages — maximum per import is 500");
  }

  // Verify transaction is in scope + load contacts to validate mapping IDs.
  // Phase 1 commit 4d post-fix — strict "all contactIds are Contact
  // rows with roleType='purchaser'" rule. The WhatsApp import has no
  // side hint per row (it's a bulk historical paste), so the fallback
  // is the only honest rule. NB the previous version mistakenly added
  // tx.purchaserSolicitorContactId / brokerContactId to the buyer-side
  // set — those FKs target SolicitorContact / BrokerContact tables and
  // never appear in Contact.id space, so the adds were dead.
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: {
      id: true,
      agencyId: true,
      activeBuyerRoundId: true,
      contacts: { select: { id: true, roleType: true } },
    },
  });
  if (!tx) throw new Error("Transaction not found");
  const validContactIds = new Set(tx.contacts.map((c) => c.id));
  const buyerSideIds = new Set<string>();
  for (const c of tx.contacts) {
    if (c.roleType === "purchaser") buyerSideIds.add(c.id);
  }

  // Validate every unique sender has a mapping; every mapped contact belongs to this tx.
  const uniqueSenders = Array.from(new Set(messages.map((m) => m.rawSender)));
  for (const sender of uniqueSenders) {
    const m = mapping[sender];
    if (!m) throw new Error(`Sender "${sender}" is unmapped`);
    if (m.kind === "contact" && !validContactIds.has(m.contactId)) {
      throw new Error(`Contact ID for "${sender}" does not belong to this transaction`);
    }
    if (m.kind === "me" && m.recipientContactIds) {
      for (const rid of m.recipientContactIds) {
        if (!validContactIds.has(rid)) {
          throw new Error(`Recipient contact ID for "${sender}" does not belong to this transaction`);
        }
      }
    }
  }

  // Dedupe against existing whatsapp comms on this tx in last 30 days.
  const sinceCutoff = new Date(Date.now() - 30 * 86_400_000);
  const existing = await prisma.outboundMessage.findMany({
    where: {
      transactionId,
      method: "whatsapp",
      OR: [
        { createdAt: { gte: sinceCutoff } },
        { sentAt: { gte: sinceCutoff } },
      ],
    },
    select: { content: true, sentAt: true, createdAt: true },
  });
  const existingHashes = new Set(
    existing.map((e) => buildDedupeHash(e.content, e.sentAt ?? e.createdAt))
  );

  // Resolve mapping and filter
  type ToInsert = {
    type: "outbound" | "inbound";
    contactIds: string[];
    content: string;
    sentAt: Date;
    status: "sent" | "delivered";
  };
  const toInsert: ToInsert[] = [];
  let dropped = 0;

  for (const msg of messages) {
    const m = mapping[msg.rawSender];
    if (!m || m.kind === "skip") { dropped++; continue; }
    if (existingHashes.has(buildDedupeHash(msg.content, msg.whatsappTimestamp))) {
      dropped++;
      continue;
    }
    if (m.kind === "me") {
      toInsert.push({
        type: "outbound",
        // Multi-recipient outbound. Every selected contact id ends up on
        // the row's contactIds; the timeline renders them as a
        // comma-joined "Outbound to A, B" line. Empty array stays
        // backwards-compatible with legacy "no recipient" imports.
        contactIds: m.recipientContactIds ?? [],
        content: msg.content,
        sentAt: msg.whatsappTimestamp,
        status: "sent",
      });
    } else {
      toInsert.push({
        type: "inbound",
        contactIds: [m.contactId],
        content: msg.content,
        sentAt: msg.whatsappTimestamp,
        status: "delivered",
      });
    }
  }

  if (toInsert.length === 0) {
    return { inserted: 0, skipped: dropped, importBatchId: "" };
  }

  const importBatchId = crypto.randomUUID();

  // Single batched insert — one round-trip to the pooler regardless of
  // the message count. The previous implementation looped sequential
  // creates inside a $transaction which could exceed Prisma's default
  // 5 s transaction timeout on bigger pastes (39+ messages over a slow
  // pooler), causing the whole import to abort. createMany is a single
  // statement, internally atomic, and orders of magnitude faster.
  // Undo path is unaffected: every row carries the same importBatchId.
  await prisma.outboundMessage.createMany({
    data: toInsert.map((row) => {
      // Phase 1 commit 4d — per-row buyer-side check using the
      // pre-built set. Empty contactIds → file-level (no recipient).
      // Mixed sides → file-level. Buyer-side-only → active round.
      const allBuyerSide =
        row.contactIds.length > 0 && row.contactIds.every((id) => buyerSideIds.has(id));
      return {
        transactionId,
        agencyId: tx.agencyId,
        type: row.type,
        method: "whatsapp" as const,
        channel: "other" as const,         // explicit — no WhatsApp value in OutboundChannel
        purpose: "other" as const,         // manual log, not a chase
        status: row.status,                // sent for outbound, delivered for inbound
        contactIds: row.contactIds,
        content: row.content,
        // createdAt LEFT TO DEFAULT (now()) — these rows were logged just now.
        sentAt: row.sentAt,                // actual WhatsApp message time
        createdById,
        createdByRole,
        importBatchId,
        buyerRoundId: allBuyerSide ? tx.activeBuyerRoundId : null,
      };
    }),
  });

  touchLastActivity(transactionId).catch(() => {});

  return { inserted: toInsert.length, skipped: dropped, importBatchId };
}

export async function undoWhatsAppImport(
  importBatchId: string,
  scope: AccessScope,
): Promise<{ deleted: number }> {
  if (!importBatchId) return { deleted: 0 };
  const cutoff = new Date(Date.now() - UNDO_WINDOW_MS);

  // Verify scope — pick any one row from the batch and check ownership.
  const sample = await prisma.outboundMessage.findFirst({
    where: { importBatchId, createdAt: { gte: cutoff } },
    select: { transactionId: true },
  });
  if (!sample?.transactionId) return { deleted: 0 };

  const ownsTx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, sample.transactionId),
    select: { id: true },
  });
  if (!ownsTx) throw new Error("Not authorised to undo this import");

  const res = await prisma.outboundMessage.deleteMany({
    where: { importBatchId, createdAt: { gte: cutoff } },
  });

  touchLastActivity(sample.transactionId).catch(() => {});

  return { deleted: res.count };
}

/** Stable hash for dedupe: same minute + same normalised content = same message. */
function buildDedupeHash(content: string, timestamp: Date): string {
  const minuteBucket = Math.floor(timestamp.getTime() / 60_000);
  const normalised = content.trim().replace(/\s+/g, " ");
  return `${minuteBucket}:${normalised}`;
}

async function emailVisibleUpdateToClients(transactionId: string, content: string): Promise<void> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      propertyAddress: true,
      agency: { select: { name: true } },
      contacts: {
        where: { roleType: { in: ["vendor", "purchaser"] }, portalEligible: true },
        select: { id: true, name: true, email: true, roleType: true, portalToken: true },
      },
    },
  });
  if (!tx) return;

  const base      = process.env.NEXTAUTH_URL ?? "";
  const address   = tx.propertyAddress;
  const agency    = tx.agency.name;
  const sender    = await resolveAgencySenderForTransaction(transactionId);

  for (const c of tx.contacts) {
    if (!c.email || !c.portalToken) continue;
    const saleWord  = c.roleType === "vendor" ? "sale" : "purchase";
    const greeting = buildGreeting(c.name);
    const portalUrl = `${base}/portal/${c.portalToken}/updates`;

    await sendEmail({
      from: sender.from,
      replyTo: sender.replyTo,
      to: c.email,
      subject: `Update on your ${saleWord} — ${address}`,
      text: [
        greeting,
        "",
        `There's a new update on your ${saleWord} at ${address}:`,
        "",
        content,
        "",
        `View your portal: ${portalUrl}`,
        "",
        agency,
      ].join("\n"),
      html: `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">
<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#FF6B4A">${agency}</p>
<p style="margin:0 0 20px;font-size:14px;color:#4a5162">${address}</p>
<p style="margin:0 0 16px;font-size:15px">${greeting}</p>
<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#8b91a3;text-transform:uppercase;letter-spacing:0.06em">New update</p>
<div style="margin:0 0 24px;padding:16px 20px;background:#F8F9FB;border-radius:12px;font-size:14px;line-height:1.6;color:#1a1d29;white-space:pre-wrap">${content}</div>
<p><a href="${portalUrl}" style="display:inline-block;background:#FF6B4A;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px">View in portal</a></p>
<p style="margin:24px 0 0;font-size:12px;color:#8b91a3">You're receiving this because you have a ${saleWord} in progress with ${agency}.</p>
</body></html>`,
    }).catch(() => {});
  }
}
