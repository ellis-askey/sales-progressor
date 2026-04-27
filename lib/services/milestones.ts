// lib/services/milestones.ts — Sprint 5: generates summaryText on completion

import { prisma } from "@/lib/prisma";
import { generateSummaryText, resolveTemplateTokens } from "@/lib/services/summary";
import { autoCompleteRemindersForMilestone } from "@/lib/services/reminders";
import { touchLastActivity } from "@/lib/services/activity";
import type { MilestoneSide, MilestoneDefinition, MilestoneCompletion, PurchaseType } from "@prisma/client";

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

  const codeToId = new Map(definitions.map((d) => [d.code, d.id]));

  const vendorDefs = definitions.filter((d) => d.side === "vendor");
  const purchaserDefs = definitions.filter((d) => d.side === "purchaser");

  const enrich = (defs: MilestoneDefinition[]): DefinitionWithCompletion[] => {
    return defs.map((def) => {
      const completion = completionMap.get(def.id) ?? null;
      const isComplete = !!completion && !completion.isNotRequired;
      const isNotRequired = !!completion?.isNotRequired;

      // Apply the same prerequisite graph used by the client portal.
      // A milestone is available when all its direct prerequisites are confirmed (and not N/R).
      // Already-complete or N/R milestones short-circuit so their rows render correctly.
      const prereqCodes = DIRECT_PREREQUISITES[def.code] ?? [];
      const isAvailable =
        isComplete ||
        isNotRequired ||
        prereqCodes.every((code) => {
          const id = codeToId.get(code);
          if (!id) return true;
          const c = completionMap.get(id);
          return c !== undefined && !c.isNotRequired;
        });

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
  // Vendor — VM2 (MOS received) has no prereq: available from file creation
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
  // Purchaser — PM2 (MOS received) has no prereq: available from file creation
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

  // Server-side prerequisite guard — mirrors portal validation
  const prereqCodes = DIRECT_PREREQUISITES[def.code] ?? [];
  if (prereqCodes.length > 0) {
    const prereqDefs = await prisma.milestoneDefinition.findMany({
      where: { code: { in: prereqCodes } },
      select: { id: true },
    });
    const satisfied = await prisma.milestoneCompletion.count({
      where: {
        transactionId: input.transactionId,
        milestoneDefinitionId: { in: prereqDefs.map((d) => d.id) },
        isActive: true,
        isNotRequired: false,
      },
    });
    if (satisfied < prereqDefs.length) {
      throw new Error("Prerequisites not complete — confirm earlier milestones first");
    }
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

  touchLastActivity(input.transactionId).catch(() => {});

  return completion;
}

export async function bulkCompleteMilestones(
  milestoneDefinitionIds: string[],
  transactionId: string,
  completedById: string,
  completedByName: string
) {
  if (milestoneDefinitionIds.length === 0) return [];

  const baseTime = new Date();

  // 1 query: fetch all definitions at once (was: N separate findUnique calls)
  const defs = await prisma.milestoneDefinition.findMany({
    where: { id: { in: milestoneDefinitionIds } },
    select: { id: true, code: true, summaryTemplate: true },
  });
  const defMap = new Map(defs.map((d) => [d.id, d]));

  // 1 query: deactivate all existing completions at once (was: N separate updateMany calls)
  await prisma.milestoneCompletion.updateMany({
    where: { transactionId, milestoneDefinitionId: { in: milestoneDefinitionIds }, isActive: true },
    data: { isActive: false, statusReason: "Superseded by bulk completion" },
  });

  // 1 query: resolve template tokens once if any def needs a summary (was: N separate contact lookups)
  const needsSummary = defs.some((d) => d.summaryTemplate);
  const tokens = needsSummary ? await resolveTemplateTokens(transactionId, completedByName) : null;

  const summaryTexts = milestoneDefinitionIds.map((defId) => {
    const def = defMap.get(defId);
    if (!def?.summaryTemplate || !tokens) return null;
    let text = def.summaryTemplate;
    for (const [key, value] of Object.entries(tokens)) {
      text = text.replaceAll(`{${key}}`, value);
    }
    return text.charAt(0).toUpperCase() + text.slice(1);
  });

  // Stagger completedAt by 1ms per entry so the activity timeline preserves
  // logical order (earliest prerequisite first, clicked milestone lands last).
  // All creates run concurrently (was: serial).
  const results = await Promise.all(
    milestoneDefinitionIds.map((defId, i) =>
      prisma.milestoneCompletion.create({
        data: {
          transactionId,
          milestoneDefinitionId: defId,
          isActive: true,
          isNotRequired: false,
          completedAt: new Date(baseTime.getTime() + i),
          completedById,
          summaryText: summaryTexts[i],
          statusReason: "Bulk completed via implied predecessor",
        },
      })
    )
  );

  // Reminder auto-completes run concurrently (was: serial)
  await Promise.all(
    milestoneDefinitionIds.map((defId) => {
      const def = defMap.get(defId);
      return def?.code ? autoCompleteRemindersForMilestone(transactionId, def.code) : Promise.resolve();
    })
  );

  touchLastActivity(transactionId).catch(() => {});

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
  if (milestoneDefinitionIds.length === 0) return;

  // 1 query: fetch all definitions at once (was: N separate findUnique calls)
  const defs = await prisma.milestoneDefinition.findMany({
    where: { id: { in: milestoneDefinitionIds } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(defs.map((d) => [d.id, d.name]));

  // 1 query: deactivate all completions at once (was: N separate updateMany calls)
  await prisma.milestoneCompletion.updateMany({
    where: { transactionId, milestoneDefinitionId: { in: milestoneDefinitionIds }, isActive: true },
    data: { isActive: false, statusReason: "Reversed as downstream of another reversal" },
  });

  // Audit notes run concurrently (was: serial)
  await Promise.all(
    milestoneDefinitionIds.map((defId) =>
      prisma.communicationRecord.create({
        data: {
          transactionId,
          type: "internal_note",
          contactIds: [],
          content: `${completedByName} marked "${nameMap.get(defId) ?? "milestone"}" as incomplete (downstream of another reversal).`,
          createdById: completedById,
        },
      })
    )
  );
}

export async function bulkMarkNotRequired(
  milestoneDefinitionIds: string[],
  transactionId: string,
  completedById: string,
  reason: string
) {
  if (milestoneDefinitionIds.length === 0) return;

  // 1 query: deactivate all at once (was: N separate updateMany calls)
  await prisma.milestoneCompletion.updateMany({
    where: { transactionId, milestoneDefinitionId: { in: milestoneDefinitionIds }, isActive: true },
    data: { isActive: false, statusReason: "Cascaded not required" },
  });

  // Creates run concurrently (was: serial)
  const now = new Date();
  await Promise.all(
    milestoneDefinitionIds.map((defId) =>
      prisma.milestoneCompletion.create({
        data: {
          transactionId,
          milestoneDefinitionId: defId,
          isActive: true,
          isNotRequired: true,
          completedAt: now,
          completedById,
          notRequiredReason: reason,
          statusReason: "Cascaded not required",
        },
      })
    )
  );
}

// Codes that cascade N/R when their anchor is marked N/R (mirrors NR_CASCADE in route handler)
export const NR_CASCADE: Record<string, string[]> = {
  PM4: ["PM5", "PM6"],
  PM7: ["PM20"],
};

export async function markNotRequiredWithCascade(input: {
  transactionId: string;
  milestoneDefinitionId: string;
  completedById: string;
  completedByName: string;
  reason: string;
  purchaseType?: PurchaseType;
}) {
  const def = await prisma.milestoneDefinition.findUnique({
    where: { id: input.milestoneDefinitionId },
    select: { code: true },
  });

  if (def?.code && NR_CASCADE[def.code]) {
    const cascadeCodes = NR_CASCADE[def.code];
    const cascadeDefs = await prisma.milestoneDefinition.findMany({
      where: { code: { in: cascadeCodes } },
      select: { id: true },
    });
    if (cascadeDefs.length > 0) {
      await bulkMarkNotRequired(
        cascadeDefs.map((d) => d.id),
        input.transactionId,
        input.completedById,
        input.reason
      );
    }
  }

  if (input.purchaseType) {
    await prisma.propertyTransaction.update({
      where: { id: input.transactionId },
      data: { purchaseType: input.purchaseType },
    });
  }

  return markNotRequired(
    input.transactionId,
    input.milestoneDefinitionId,
    input.completedById,
    input.completedByName,
    input.reason
  );
}

export async function reverseMilestoneWithCascade(input: {
  transactionId: string;
  milestoneDefinitionId: string;
  completedById: string;
  completedByName: string;
  reason?: string;
  downstreamIds?: string[];
  newPurchaseType?: PurchaseType;
}) {
  const def = await prisma.milestoneDefinition.findUnique({
    where: { id: input.milestoneDefinitionId },
    select: { code: true },
  });

  if (def?.code && NR_CASCADE[def.code]) {
    const cascadeCodes = NR_CASCADE[def.code];
    const cascadeDefs = await prisma.milestoneDefinition.findMany({
      where: { code: { in: cascadeCodes } },
      select: { id: true },
    });
    const nrCascaded = await prisma.milestoneCompletion.findMany({
      where: {
        transactionId: input.transactionId,
        milestoneDefinitionId: { in: cascadeDefs.map((d) => d.id) },
        isActive: true,
        isNotRequired: true,
      },
      select: { milestoneDefinitionId: true },
    });
    if (nrCascaded.length > 0) {
      await bulkReverseMilestones(
        nrCascaded.map((c) => c.milestoneDefinitionId),
        input.transactionId,
        input.completedById,
        input.completedByName
      );
    }
  }

  if (input.newPurchaseType) {
    await prisma.propertyTransaction.update({
      where: { id: input.transactionId },
      data: { purchaseType: input.newPurchaseType },
    });
  }

  if (input.downstreamIds && input.downstreamIds.length > 0) {
    await bulkReverseMilestones(
      input.downstreamIds,
      input.transactionId,
      input.completedById,
      input.completedByName
    );
  }

  return reverseMilestone(
    input.transactionId,
    input.milestoneDefinitionId,
    input.completedById,
    input.completedByName,
    input.reason
  );
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
