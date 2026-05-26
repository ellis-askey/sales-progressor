// lib/services/comms.ts
// Sprint 5: Communication record CRUD and activity timeline queries.
// Sprint 7: Added AI generation fields (chaseTaskId, generatedText, tone, wasAiGenerated, wasEdited)
//           and chaseCount increment on outbound chase comms.

import { prisma } from "@/lib/prisma";
import type { CommType, CommMethod } from "@prisma/client";
import { pushToTransaction } from "@/lib/services/push";
import { sendEmail } from "@/lib/email";
import { touchLastActivity } from "@/lib/services/activity";
import { buildGreeting } from "@/lib/portal-copy";
import { scopeOwnershipWhere, type AccessScope } from "@/lib/security/access-scope";

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
      createdByRole: string | null;
      contactNames: string[];
      wasAiGenerated: boolean;
      isAutomated: boolean;
      tone: string | null;
    };

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getActivityTimeline(
  transactionId: string,
  agencyId: string | null
): Promise<ActivityEntry[]> {
  const tx = await prisma.propertyTransaction.findFirst({
    where: agencyId ? { id: transactionId, agencyId } : { id: transactionId },
    select: { id: true, contacts: { select: { id: true, name: true } } },
  });
  if (!tx) throw new Error("Transaction not found");

  const contactMap = new Map(tx.contacts.map((c) => [c.id, c.name]));

  const [completions, comms] = await Promise.all([
    prisma.milestoneCompletion.findMany({
      where: { transactionId, state: { in: ["complete", "not_required"] } },
      orderBy: { completedAt: "desc" },
      include: {
        milestoneDefinition: { select: { name: true, code: true } },
        completedBy: { select: { name: true } },
      },
    }),
    prisma.outboundMessage.findMany({
      where: { transactionId },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { name: true } },
      },
    }),
  ]);

  const milestoneEntries: ActivityEntry[] = completions.map((c) => {
    const confirmedByClient = c.confirmedByPortal;
    const confirmerName = confirmedByClient ? "Client (portal)" : null;
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
      confirmerName,
    };
  });

  const commEntries: ActivityEntry[] = comms.map((c) => ({
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
    createdByRole: c.createdByRole ?? null,
    contactNames: c.contactIds
      .map((id) => contactMap.get(id))
      .filter(Boolean) as string[],
    wasAiGenerated: c.wasAiGenerated,
    isAutomated: c.isAutomated,
    tone: c.tone,
  }));

  return [...milestoneEntries, ...commEntries].sort(
    (a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0)
  );
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
};

export async function createCommunicationRecord(input: CreateCommInput) {
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(input.scope, input.transactionId),
    select: { id: true, propertyAddress: true },
  });
  if (!tx) throw new Error("Transaction not found");

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
    },
  });

  // Increment chaseCount on the linked task when an outbound chase is logged
  if (input.chaseTaskId && input.type === "outbound") {
    await prisma.chaseTask.update({
      where: { id: input.chaseTaskId },
      data: { chaseCount: { increment: 1 } },
    });
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

// ─── WhatsApp chat bulk-import ────────────────────────────────────────────────
// Takes parsed messages + a sender→identity mapping and inserts them as
// individual OutboundMessage rows in a single transaction. Backdates the
// actual message time onto `sentAt` (NOT createdAt — see plan / audit).

export type SenderMapping = Record<
  string,
  // "me" carries an optional recipientContactId — when the user picks a
  // specific contact as the recipient of their outbound messages, the
  // contactId is stored on OutboundMessage.contactIds so the timeline
  // reads "Outbound to {Recipient}" instead of just "Outbound". Null /
  // omitted = no specific recipient (backwards-compatible with legacy
  // imports).
  | { kind: "me"; recipientContactId?: string | null }
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
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: {
      id: true,
      agencyId: true,
      contacts: { select: { id: true } },
    },
  });
  if (!tx) throw new Error("Transaction not found");
  const validContactIds = new Set(tx.contacts.map((c) => c.id));

  // Validate every unique sender has a mapping; every mapped contact belongs to this tx.
  const uniqueSenders = Array.from(new Set(messages.map((m) => m.rawSender)));
  for (const sender of uniqueSenders) {
    const m = mapping[sender];
    if (!m) throw new Error(`Sender "${sender}" is unmapped`);
    if (m.kind === "contact" && !validContactIds.has(m.contactId)) {
      throw new Error(`Contact ID for "${sender}" does not belong to this transaction`);
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
        // If the user picked a specific recipient for their outbound
        // messages, attach it. Falls back to an empty array (legacy
        // behaviour) when no recipient was selected.
        contactIds: m.recipientContactId ? [m.recipientContactId] : [],
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

  await prisma.$transaction(async (txDb) => {
    for (const row of toInsert) {
      await txDb.outboundMessage.create({
        data: {
          transactionId,
          agencyId: tx.agencyId,
          type: row.type,
          method: "whatsapp",
          channel: "other",         // explicit — no WhatsApp value in OutboundChannel
          purpose: "other",         // manual log, not a chase
          status: row.status,       // sent for outbound, delivered for inbound
          contactIds: row.contactIds,
          content: row.content,
          // createdAt LEFT TO DEFAULT (now()) — this row was logged just now.
          sentAt: row.sentAt,       // actual WhatsApp message time
          createdById,
          createdByRole,
          importBatchId,
        },
      });
    }
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
        where: { roleType: { in: ["vendor", "purchaser"] } },
        select: { id: true, name: true, email: true, roleType: true, portalToken: true },
      },
    },
  });
  if (!tx) return;

  const base      = process.env.NEXTAUTH_URL ?? "";
  const address   = tx.propertyAddress;
  const agency    = tx.agency.name;

  for (const c of tx.contacts) {
    if (!c.email || !c.portalToken) continue;
    const saleWord  = c.roleType === "vendor" ? "sale" : "purchase";
    const greeting = buildGreeting(c.name);
    const portalUrl = `${base}/portal/${c.portalToken}/updates`;

    await sendEmail({
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
