// lib/services/comms.ts
// Sprint 5: Communication record CRUD and activity timeline queries.
// Sprint 7: Added AI generation fields (chaseTaskId, generatedText, tone, wasAiGenerated, wasEdited)
//           and chaseCount increment on outbound chase comms.

import { prisma } from "@/lib/prisma";
import type { CommType, CommMethod } from "@prisma/client";
import { pushToTransaction } from "@/lib/services/push";
import { sendEmail } from "@/lib/email";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityEntry =
  | {
      kind: "milestone";
      id: string;
      at: Date;
      summaryText: string | null;
      milestoneName: string;
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
      createdByName: string | null;
      contactNames: string[];
      wasAiGenerated: boolean;
      tone: string | null;
    };

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getActivityTimeline(
  transactionId: string,
  agencyId: string
): Promise<ActivityEntry[]> {
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId },
    select: { id: true, contacts: { select: { id: true, name: true } } },
  });
  if (!tx) throw new Error("Transaction not found");

  const contactMap = new Map(tx.contacts.map((c) => [c.id, c.name]));

  const [completions, comms] = await Promise.all([
    prisma.milestoneCompletion.findMany({
      where: { transactionId, isActive: true },
      orderBy: { completedAt: "desc" },
      include: {
        milestoneDefinition: { select: { name: true } },
        completedBy: { select: { name: true } },
      },
    }),
    prisma.communicationRecord.findMany({
      where: { transactionId },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { name: true } },
      },
    }),
  ]);

  const milestoneEntries: ActivityEntry[] = completions.map((c) => {
    const confirmedByClient = c.statusReason?.startsWith("Confirmed by") ?? false;
    const confirmerName = confirmedByClient
      ? (c.statusReason?.replace(/^Confirmed by /, "").replace(/ via portal$/, "") ?? null)
      : null;
    return {
      kind: "milestone",
      id: c.id,
      at: c.completedAt,
      summaryText: c.summaryText,
      milestoneName: c.milestoneDefinition.name,
      completedByName: c.completedBy?.name ?? null,
      isNotRequired: c.isNotRequired,
      confirmedByClient,
      confirmerName,
    };
  });

  const commEntries: ActivityEntry[] = comms.map((c) => ({
    kind: "comm",
    id: c.id,
    at: c.createdAt,
    type: c.type,
    method: c.method,
    content: c.content,
    createdByName: c.createdBy?.name ?? null,
    contactNames: c.contactIds
      .map((id) => contactMap.get(id))
      .filter(Boolean) as string[],
    wasAiGenerated: c.wasAiGenerated,
    tone: c.tone,
  }));

  return [...milestoneEntries, ...commEntries].sort(
    (a, b) => b.at.getTime() - a.at.getTime()
  );
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
  visibleToClient?: boolean;
  createdById: string;
  agencyId: string;
};

export async function createCommunicationRecord(input: CreateCommInput) {
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: input.transactionId, agencyId: input.agencyId },
    select: { id: true, propertyAddress: true },
  });
  if (!tx) throw new Error("Transaction not found");

  const record = await prisma.communicationRecord.create({
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
      visibleToClient: input.visibleToClient ?? false,
      createdById: input.createdById,
    },
  });

  // Increment chaseCount on the linked task when an outbound chase is logged
  if (input.chaseTaskId && input.type === "outbound") {
    await prisma.chaseTask.update({
      where: { id: input.chaseTaskId },
      data: { chaseCount: { increment: 1 } },
    });
  }

  // Notify subscribed contacts when a client-visible update is logged
  if (input.visibleToClient) {
    const preview = input.content.length > 100
      ? input.content.slice(0, 97) + "…"
      : input.content;

    const short = tx.propertyAddress.split(",")[0];
    pushToTransaction(input.transactionId, {
      title: `Update on ${short}`,
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
  const records = await prisma.communicationRecord.findMany({
    where: { transaction: { agencyId } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      transaction: { select: { propertyAddress: true } },
      createdBy: { select: { name: true } },
    },
  });

  return records.map((r) => ({
    id: r.id,
    transactionId: r.transactionId,
    propertyAddress: r.transaction.propertyAddress,
    type: r.type,
    method: r.method,
    content: r.content,
    createdByName: r.createdBy?.name ?? null,
    wasAiGenerated: r.wasAiGenerated,
    createdAt: r.createdAt,
  }));
}

export async function deleteCommunicationRecord(id: string, agencyId: string) {
  const comm = await prisma.communicationRecord.findFirst({
    where: { id, transaction: { agencyId } },
    select: { id: true },
  });
  if (!comm) throw new Error("Not found");
  return prisma.communicationRecord.delete({ where: { id } });
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
    const firstName = c.name.split(" ")[0];
    const portalUrl = `${base}/portal/${c.portalToken}/updates`;

    await sendEmail({
      to: c.email,
      subject: `Update on your ${saleWord} — ${address}`,
      text: [
        `Hi ${firstName},`,
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
<p style="margin:0 0 16px;font-size:15px">Hi ${firstName},</p>
<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#8b91a3;text-transform:uppercase;letter-spacing:0.06em">New update</p>
<div style="margin:0 0 24px;padding:16px 20px;background:#F8F9FB;border-radius:12px;font-size:14px;line-height:1.6;color:#1a1d29;white-space:pre-wrap">${content}</div>
<p><a href="${portalUrl}" style="display:inline-block;background:#FF6B4A;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px">View in portal</a></p>
<p style="margin:24px 0 0;font-size:12px;color:#8b91a3">You're receiving this because you have a ${saleWord} in progress with ${agency}.</p>
</body></html>`,
    }).catch(() => {});
  }
}
