// lib/services/milestones.ts — Sprint 5: generates summaryText on completion

import { prisma } from "@/lib/prisma";
import { generateSummaryText } from "@/lib/services/summary";
import { autoCompleteRemindersForMilestone } from "@/lib/services/reminders";
import type { MilestoneSide, MilestoneDefinition, MilestoneCompletion } from "@prisma/client";

export type DefinitionWithCompletion = MilestoneDefinition & {
  activeCompletion: MilestoneCompletion | null;
  isComplete: boolean;
  isNotRequired: boolean;
  isAvailable: boolean;
};

export type MilestonesByTransaction = {
  vendor: DefinitionWithCompletion[];
  purchaser: DefinitionWithCompletion[];
  exchangeReady: boolean;
  vendorGateReady: boolean;
  purchaserGateReady: boolean;
};

export async function getMilestonesForTransaction(
  transactionId: string,
  agencyId: string
): Promise<MilestonesByTransaction> {
  const transaction = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId },
    select: { id: true },
  });
  if (!transaction) throw new Error("Transaction not found");

  const definitions = await prisma.milestoneDefinition.findMany({
    orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
  });

  const completions = await prisma.milestoneCompletion.findMany({
    where: { transactionId, isActive: true },
  });

  const completionMap = new Map<string, MilestoneCompletion>();
  completions.forEach((c) => completionMap.set(c.milestoneDefinitionId, c));

  const vendorDefs = definitions.filter((d) => d.side === "vendor");
  const purchaserDefs = definitions.filter((d) => d.side === "purchaser");

  const enrich = (defs: MilestoneDefinition[]): DefinitionWithCompletion[] => {
    return defs.map((def) => {
      const completion = completionMap.get(def.id) ?? null;
      const isComplete = !!completion && !completion.isNotRequired;
      const isNotRequired = !!completion?.isNotRequired;

      // Only exchange gate milestones are hard-locked until their blocking predecessors are done.
      // All other milestones are available — the implied predecessors modal handles UX guidance.
      let isAvailable = true;
      if (def.isExchangeGate) {
        const priorBlockers = defs.filter((d) => d.blocksExchange && d.orderIndex < def.orderIndex);
        isAvailable = priorBlockers.every((d) => {
          const c = completionMap.get(d.id);
          return c && c.isActive;
        });
      }

      return { ...def, activeCompletion: completion, isComplete, isNotRequired, isAvailable };
    });
  };

  const vendor = enrich(vendorDefs);
  const purchaser = enrich(purchaserDefs);

  const vendorGateReady = vendor.filter((d) => d.blocksExchange).every((d) => d.isComplete || d.isNotRequired);
  const purchaserGateReady = purchaser.filter((d) => d.blocksExchange).every((d) => d.isComplete || d.isNotRequired);
  const exchangeReady = vendorGateReady && purchaserGateReady;

  return { vendor, purchaser, exchangeReady, vendorGateReady, purchaserGateReady };
}

// Direct physical prerequisites: only the milestone(s) that cannot logically be skipped
// before the keyed milestone is possible. Parallel-track milestones are excluded.
const DIRECT_PREREQUISITES: Record<string, string[]> = {
  // Vendor
  VM2:  ["VM1"],
  VM3:  ["VM1"],
  VM14: ["VM1"],
  VM15: ["VM1"],
  VM4:  ["VM15"],
  VM5:  ["VM4"],
  VM6:  ["VM5"],
  VM7:  ["VM6"],
  VM16: ["VM5"],
  VM17: ["VM16"],
  VM8:  ["VM17"],
  VM18: ["VM8"],
  VM19: ["VM18"],
  VM9:  ["VM19"],
  VM10: ["VM5"],
  VM11: ["VM10"],
  VM20: ["VM11"],
  VM12: ["VM20"],
  VM13: ["VM12"],
  // Purchaser
  PM2:  ["PM1"],
  PM14a:["PM1"],
  PM15a:["PM14a"],
  PM4:  ["PM1"],
  PM5:  ["PM4"],
  PM6:  ["PM5"],
  PM9:  ["PM3"],
  PM20: ["PM7"],
  PM8:  ["PM3"],
  PM10: ["PM9"],
  PM11: ["PM10"],
  PM21: ["PM11"],
  PM22: ["PM21"],
  PM12: ["PM22"],
  PM23: ["PM12"],
  PM24: ["PM23"],
  PM25: ["PM24"],
  PM26: ["PM25"],
  PM13: ["PM26"],
  PM14b:["PM13"],
  PM15b:["PM14b"],
  PM27: ["PM15b"],
  PM16: ["PM27"],
  PM17: ["PM16"],
};

// Inverse of DIRECT_PREREQUISITES: code → codes that directly depend on it
const DIRECT_DEPENDENTS: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const [code, prereqs] of Object.entries(DIRECT_PREREQUISITES)) {
    for (const prereq of prereqs) {
      (map[prereq] ??= []).push(code);
    }
  }
  return map;
})();

function collectAllDependentCodes(startCode: string): string[] {
  const visited = new Set<string>();
  const queue = [startCode];
  while (queue.length > 0) {
    const code = queue.shift()!;
    for (const dep of DIRECT_DEPENDENTS[code] ?? []) {
      if (!visited.has(dep)) {
        visited.add(dep);
        queue.push(dep);
      }
    }
  }
  return Array.from(visited);
}

export async function getDownstreamCompleted(
  milestoneDefinitionId: string,
  transactionId: string
): Promise<MilestoneDefinition[]> {
  const target = await prisma.milestoneDefinition.findUnique({
    where: { id: milestoneDefinitionId },
  });
  if (!target) return [];

  const downstreamCodes = collectAllDependentCodes(target.code);
  if (downstreamCodes.length === 0) return [];

  const downstreamDefs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: downstreamCodes } },
    orderBy: { orderIndex: "asc" },
  });
  if (downstreamDefs.length === 0) return [];

  const completions = await prisma.milestoneCompletion.findMany({
    where: {
      transactionId,
      isActive: true,
      isNotRequired: false,
      milestoneDefinitionId: { in: downstreamDefs.map((d) => d.id) },
    },
    select: { milestoneDefinitionId: true },
  });

  const completedIds = new Set(completions.map((c) => c.milestoneDefinitionId));
  return downstreamDefs.filter((d) => completedIds.has(d.id));
}

function collectAllPrereqCodes(startCode: string): string[] {
  const visited = new Set<string>();
  const queue = [startCode];
  while (queue.length > 0) {
    const code = queue.shift()!;
    for (const prereq of DIRECT_PREREQUISITES[code] ?? []) {
      if (!visited.has(prereq)) {
        visited.add(prereq);
        queue.push(prereq);
      }
    }
  }
  return Array.from(visited);
}

export async function getImpliedPredecessors(
  milestoneDefinitionId: string,
  transactionId: string
): Promise<MilestoneDefinition[]> {
  const target = await prisma.milestoneDefinition.findUnique({
    where: { id: milestoneDefinitionId },
  });
  if (!target) return [];

  const allPrereqCodes = collectAllPrereqCodes(target.code);
  if (allPrereqCodes.length === 0) return [];

  const prereqDefs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: allPrereqCodes } },
    orderBy: { orderIndex: "asc" },
  });
  if (prereqDefs.length === 0) return [];

  const completions = await prisma.milestoneCompletion.findMany({
    where: {
      transactionId,
      isActive: true,
      milestoneDefinitionId: { in: prereqDefs.map((p) => p.id) },
    },
    select: { milestoneDefinitionId: true, isNotRequired: true },
  });

  const doneIds = new Set(completions.map((c) => c.milestoneDefinitionId));
  return prereqDefs.filter((p) => !doneIds.has(p.id));
}

export type CompleteMilestoneInput = {
  transactionId: string;
  milestoneDefinitionId: string;
  completedById: string;
  completedByName: string;
  eventDate?: Date | null;
  completedAt?: Date;
};

export async function completeMilestone(input: CompleteMilestoneInput) {
  const def = await prisma.milestoneDefinition.findUnique({
    where: { id: input.milestoneDefinitionId },
    select: { code: true, timeSensitive: true, summaryTemplate: true },
  });

  if (!def) throw new Error("Milestone definition not found");

  if (def.timeSensitive && !input.eventDate) {
    throw new Error("event_date is required for time-sensitive milestones");
  }

  // Generate summary text
  const summaryText = def.summaryTemplate
    ? await generateSummaryText(input.transactionId, def.summaryTemplate, input.completedByName)
    : null;

  await prisma.milestoneCompletion.updateMany({
    where: { transactionId: input.transactionId, milestoneDefinitionId: input.milestoneDefinitionId, isActive: true },
    data: { isActive: false, statusReason: "Superseded by new completion" },
  });

  const completion = await prisma.milestoneCompletion.create({
    data: {
      transactionId: input.transactionId,
      milestoneDefinitionId: input.milestoneDefinitionId,
      isActive: true,
      isNotRequired: false,
      completedAt: input.completedAt ?? new Date(),
      eventDate: input.eventDate ?? null,
      completedById: input.completedById,
      summaryText,
    },
  });

  // Auto-complete any active reminders watching this milestone
  await autoCompleteRemindersForMilestone(input.transactionId, def.code);

  return completion;
}

export async function bulkCompleteMilestones(
  milestoneDefinitionIds: string[],
  transactionId: string,
  completedById: string,
  completedByName: string
) {
  const baseTime = new Date();
  const results = [];
  // Stagger completedAt by 1ms per entry so the activity timeline preserves
  // logical order (earliest prerequisite first, clicked milestone lands last).
  for (let i = 0; i < milestoneDefinitionIds.length; i++) {
    const defId = milestoneDefinitionIds[i];
    const completedAt = new Date(baseTime.getTime() + i);

    const def = await prisma.milestoneDefinition.findUnique({
      where: { id: defId },
      select: { code: true, summaryTemplate: true },
    });
    const summaryText = def?.summaryTemplate
      ? await generateSummaryText(transactionId, def.summaryTemplate, completedByName)
      : null;

    await prisma.milestoneCompletion.updateMany({
      where: { transactionId, milestoneDefinitionId: defId, isActive: true },
      data: { isActive: false, statusReason: "Superseded by bulk completion" },
    });
    const result = await prisma.milestoneCompletion.create({
      data: {
        transactionId,
        milestoneDefinitionId: defId,
        isActive: true,
        isNotRequired: false,
        completedAt,
        completedById,
        summaryText,
        statusReason: "Bulk completed via implied predecessor",
      },
    });
    results.push(result);

    if (def?.code) {
      await autoCompleteRemindersForMilestone(transactionId, def.code);
    }
  }
  return results;
}

export async function reverseMilestone(
  transactionId: string,
  milestoneDefinitionId: string,
  completedById: string,
  completedByName: string,
  reason?: string
) {
  const def = await prisma.milestoneDefinition.findUnique({
    where: { id: milestoneDefinitionId },
    select: { name: true },
  });

  await prisma.milestoneCompletion.updateMany({
    where: { transactionId, milestoneDefinitionId, isActive: true },
    data: { isActive: false, statusReason: reason ?? "Reversed by user" },
  });

  await prisma.communicationRecord.create({
    data: {
      transactionId,
      type: "internal_note",
      contactIds: [],
      content: `${completedByName} marked "${def?.name ?? "milestone"}" as incomplete.${reason ? ` Reason: ${reason}` : ""}`,
      createdById: completedById,
    },
  });
}

export async function bulkReverseMilestones(
  milestoneDefinitionIds: string[],
  transactionId: string,
  completedById: string,
  completedByName: string
) {
  for (const defId of milestoneDefinitionIds) {
    const def = await prisma.milestoneDefinition.findUnique({
      where: { id: defId },
      select: { name: true },
    });

    await prisma.milestoneCompletion.updateMany({
      where: { transactionId, milestoneDefinitionId: defId, isActive: true },
      data: { isActive: false, statusReason: "Reversed as downstream of another reversal" },
    });

    await prisma.communicationRecord.create({
      data: {
        transactionId,
        type: "internal_note",
        contactIds: [],
        content: `${completedByName} marked "${def?.name ?? "milestone"}" as incomplete (downstream of another reversal).`,
        createdById: completedById,
      },
    });
  }
}

export async function bulkMarkNotRequired(
  milestoneDefinitionIds: string[],
  transactionId: string,
  completedById: string,
  reason: string
) {
  for (const defId of milestoneDefinitionIds) {
    await prisma.milestoneCompletion.updateMany({
      where: { transactionId, milestoneDefinitionId: defId, isActive: true },
      data: { isActive: false, statusReason: "Cascaded not required" },
    });
    await prisma.milestoneCompletion.create({
      data: {
        transactionId,
        milestoneDefinitionId: defId,
        isActive: true,
        isNotRequired: true,
        completedAt: new Date(),
        completedById,
        notRequiredReason: reason,
        statusReason: "Cascaded not required",
      },
    });
  }
}

export async function markNotRequired(
  transactionId: string,
  milestoneDefinitionId: string,
  completedById: string,
  completedByName: string,
  reason: string
) {
  const def = await prisma.milestoneDefinition.findUnique({
    where: { id: milestoneDefinitionId },
    select: { name: true },
  });

  await prisma.milestoneCompletion.updateMany({
    where: { transactionId, milestoneDefinitionId, isActive: true },
    data: { isActive: false, statusReason: "Marked not required" },
  });

  const completion = await prisma.milestoneCompletion.create({
    data: {
      transactionId,
      milestoneDefinitionId,
      isActive: true,
      isNotRequired: true,
      completedAt: new Date(),
      completedById,
      notRequiredReason: reason,
      statusReason: "Marked not required",
    },
  });

  await prisma.communicationRecord.create({
    data: {
      transactionId,
      type: "internal_note",
      contactIds: [],
      content: `${completedByName} marked "${def?.name ?? "milestone"}" as not required. Reason: ${reason}`,
      createdById: completedById,
    },
  });

  return completion;
}
