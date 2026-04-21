// lib/services/comms.ts
// Sprint 5: Communication record CRUD and activity timeline queries.
// Sprint 7: Added AI generation fields (chaseTaskId, generatedText, tone, wasAiGenerated, wasEdited)
//           and chaseCount increment on outbound chase comms.

import { prisma } from "@/lib/prisma";
import type { CommType, CommMethod } from "@prisma/client";

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
    }
  | {
      kind: "comm";
      id: string;
      at: Date;
      type: CommType;
      method: CommMethod | null;
      content: string;
      createdByName: string;
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

  const milestoneEntries: ActivityEntry[] = completions.map((c) => ({
    kind: "milestone",
    id: c.id,
    at: c.completedAt,
    summaryText: c.summaryText,
    milestoneName: c.milestoneDefinition.name,
    completedByName: c.completedBy?.name ?? null,
    isNotRequired: c.isNotRequired,
  }));

  const commEntries: ActivityEntry[] = comms.map((c) => ({
    kind: "comm",
    id: c.id,
    at: c.createdAt,
    type: c.type,
    method: c.method,
    content: c.content,
    createdByName: c.createdBy.name,
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
    select: { id: true },
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

  return record;
}

export type GlobalCommEntry = {
  id: string;
  transactionId: string;
  propertyAddress: string;
  type: CommType;
  method: CommMethod | null;
  content: string;
  createdByName: string;
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
    createdByName: r.createdBy.name,
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
