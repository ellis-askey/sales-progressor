// lib/services/milestones.ts

import { prisma } from "@/lib/prisma";
import { generateSummaryText, resolveTemplateTokens } from "@/lib/services/summary";
import { autoCompleteRemindersForMilestone } from "@/lib/services/reminders";
import { touchLastActivity } from "@/lib/services/activity";
import type { MilestoneSide, MilestoneDefinition, MilestoneCompletion, Tenure, PurchaseType } from "@prisma/client";

export type DefinitionWithCompletion = MilestoneDefinition & {
  completion: MilestoneCompletion | null;
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

// ── Prerequisite maps ──────────────────────────────────────────────────────────

// Direct prerequisites per the canonical spec (MILESTONES_SPEC_v1.md).
// Cross-side dependency: PM12 depends on VM9.
export const DIRECT_PREREQUISITES: Record<string, string[]> = {
  VM3:  ["VM1"],
  VM4:  ["VM3"],
  VM5:  ["VM4"],
  VM6:  ["VM5"],
  VM7:  ["VM6"],
  VM9:  ["VM8"],
  VM10: ["VM7"],
  VM11: ["VM10"],
  VM12: ["VM11"],
  VM13: ["VM10"],
  VM14: ["VM13"],
  VM15: ["VM14"],
  VM16: ["VM7"],
  VM17: ["VM16"],
  VM19: ["VM18"],
  VM20: ["VM19"],
  PM3:  ["PM1"],
  PM4:  ["PM1"],
  PM6:  ["PM5"],
  PM7:  ["PM4"],
  PM8:  ["PM7"],
  PM10: ["PM9"],
  PM11: ["PM6"],
  PM12: ["VM9"],
  PM13: ["PM8"],
  PM14: ["PM7"],
  PM15: ["PM14"],
  PM16: ["PM15"],
  PM17: ["PM14"],
  PM18: ["PM17"],
  PM19: ["PM18"],
  PM20: ["PM19"],
  PM21: ["PM20"],
  PM22: ["PM21"],
  PM23: ["PM22"],
  PM24: ["PM23"],
  PM26: ["PM25"],
  PM27: ["PM26"],
};

// Only PM9 can be manually marked Not Required; PM10 cascades from it.
export const NR_CASCADE: Record<string, string[]> = {
  PM9: ["PM10"],
};

// Exchange gate codes — start LOCKED; availability is computed in Deploy B.
const EXCHANGE_GATE_CODES = new Set(["VM18", "PM25"]);

// ── Inverse: code → codes that directly depend on it ─────────────────────────

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

// ── File creation: initialize all milestone completions ───────────────────────

export async function initializeMilestoneCompletions(
  transactionId: string,
  tenure: Tenure,
  purchaseType: PurchaseType,
  createdById?: string
) {
  const defs = await prisma.milestoneDefinition.findMany({
    orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
  });

  // Determine auto-NR codes at creation
  const autoNrCodes = new Set<string>();
  if (tenure === "freehold") {
    autoNrCodes.add("VM8");
    autoNrCodes.add("VM9");
    autoNrCodes.add("PM12"); // no management pack for freehold
  }
  if (purchaseType === "cash_buyer" || purchaseType === "cash_from_proceeds") {
    autoNrCodes.add("PM5");
    autoNrCodes.add("PM6");
    autoNrCodes.add("PM11");
  }

  // Available = no prerequisites (or all prereqs are auto-NR), AND not an exchange gate
  const availableCodes = new Set<string>();
  for (const def of defs) {
    if (autoNrCodes.has(def.code)) continue;
    if (EXCHANGE_GATE_CODES.has(def.code)) continue;
    const prereqs = DIRECT_PREREQUISITES[def.code] ?? [];
    if (prereqs.length === 0 || prereqs.every((p) => autoNrCodes.has(p))) {
      availableCodes.add(def.code);
    }
  }

  const now = new Date();

  await Promise.all(
    defs.map((def) => {
      const isNr = autoNrCodes.has(def.code);
      const isAvail = availableCodes.has(def.code);
      const state = isNr ? "not_required" : isAvail ? "available" : "locked";

      return prisma.milestoneCompletion.upsert({
        where: {
          transactionId_milestoneDefinitionId: {
            transactionId,
            milestoneDefinitionId: def.id,
          },
        },
        create: {
          transactionId,
          milestoneDefinitionId: def.id,
          state,
          notRequiredReason: isNr ? "Auto-set at file creation" : null,
          completedById: createdById ?? null,
          createdAt: now,
        },
        update: {},
      });
    })
  );

  return autoNrCodes;
}

// ── Re-evaluate availability of direct dependents after a state change ─────────

async function unlockDirectDependents(transactionId: string, completedCode: string) {
  const dependentCodes = DIRECT_DEPENDENTS[completedCode] ?? [];
  if (dependentCodes.length === 0) return;

  const dependentDefs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: dependentCodes } },
    select: { id: true, code: true },
  });

  const codeToId = new Map(dependentDefs.map((d) => [d.code, d.id]));

  // For each dependent, check if all its prereqs are now satisfied
  const allDefs = await prisma.milestoneDefinition.findMany({ select: { id: true, code: true } });
  const allCodeToId = new Map(allDefs.map((d) => [d.code, d.id]));

  const allCompletions = await prisma.milestoneCompletion.findMany({
    where: { transactionId },
    select: { milestoneDefinitionId: true, state: true },
  });
  const completionMap = new Map(allCompletions.map((c) => [c.milestoneDefinitionId, c.state]));

  for (const dep of dependentDefs) {
    const prereqs = DIRECT_PREREQUISITES[dep.code] ?? [];
    const allSatisfied = prereqs.every((p) => {
      const pid = allCodeToId.get(p);
      if (!pid) return true;
      const s = completionMap.get(pid);
      return s === "complete" || s === "not_required";
    });

    if (allSatisfied) {
      const currentState = completionMap.get(dep.id);
      if (currentState === "locked") {
        await prisma.milestoneCompletion.update({
          where: {
            transactionId_milestoneDefinitionId: {
              transactionId,
              milestoneDefinitionId: dep.id,
            },
          },
          data: { state: "available" },
        });
      }
    }
  }
}

// ── Exchange gate unlock ──────────────────────────────────────────────────────
// Called after completeMilestone / markNotRequired / bulkCompleteMilestones.
// Flips VM18 (vendor) or PM25 (purchaser) from locked → available when every
// same-side blocksExchange milestone is complete or not_required.

async function maybeUnlockExchangeGate(
  transactionId: string,
  side: MilestoneSide,
  createdById: string
): Promise<void> {
  const gateCode = side === "vendor" ? "VM18" : "PM25";

  const gateDef = await prisma.milestoneDefinition.findFirst({
    where: { code: gateCode },
    select: { id: true },
  });
  if (!gateDef) return;

  const gateCompletion = await prisma.milestoneCompletion.findFirst({
    where: { transactionId, milestoneDefinitionId: gateDef.id },
    select: { state: true },
  });
  if (!gateCompletion || gateCompletion.state !== "locked") return;

  const blockers = await prisma.milestoneDefinition.findMany({
    where: { side, blocksExchange: true },
    select: { id: true },
  });
  if (blockers.length === 0) return;

  const blockerCompletions = await prisma.milestoneCompletion.findMany({
    where: { transactionId, milestoneDefinitionId: { in: blockers.map((b) => b.id) } },
    select: { milestoneDefinitionId: true, state: true },
  });
  const blockerMap = new Map(blockerCompletions.map((c) => [c.milestoneDefinitionId, c.state]));

  const allClear = blockers.every((b) => {
    const s = blockerMap.get(b.id);
    return s === "complete" || s === "not_required";
  });
  if (!allClear) return;

  await prisma.milestoneCompletion.update({
    where: {
      transactionId_milestoneDefinitionId: {
        transactionId,
        milestoneDefinitionId: gateDef.id,
      },
    },
    data: { state: "available" },
  });

  const sideLabel = side === "vendor" ? "Vendor" : "Purchaser";
  await prisma.communicationRecord.create({
    data: {
      transactionId,
      type: "internal_note",
      contactIds: [],
      content: `${sideLabel} side ready to exchange — all required milestones complete`,
      createdById,
    },
  });
}

// ── getMilestonesForTransaction ───────────────────────────────────────────────

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
    where: { transactionId },
  });

  const completionMap = new Map<string, MilestoneCompletion>();
  completions.forEach((c) => completionMap.set(c.milestoneDefinitionId, c));

  const vendorDefs = definitions.filter((d) => d.side === "vendor");
  const purchaserDefs = definitions.filter((d) => d.side === "purchaser");

  const enrich = (defs: MilestoneDefinition[]): DefinitionWithCompletion[] => {
    return defs.map((def) => {
      const completion = completionMap.get(def.id) ?? null;
      const state = completion?.state ?? "locked";
      return {
        ...def,
        completion,
        isComplete: state === "complete",
        isNotRequired: state === "not_required",
        isAvailable: state === "available" || state === "complete" || state === "not_required",
      };
    });
  };

  const vendor = enrich(vendorDefs);
  const purchaser = enrich(purchaserDefs);

  const vendorGateReady = vendor.filter((d) => d.blocksExchange).every((d) => d.isComplete || d.isNotRequired);
  const purchaserGateReady = purchaser.filter((d) => d.blocksExchange).every((d) => d.isComplete || d.isNotRequired);
  const exchangeReady = vendorGateReady && purchaserGateReady;

  return { vendor, purchaser, exchangeReady, vendorGateReady, purchaserGateReady };
}

// ── getDownstreamCompleted ───────────────────────────────────────────────────

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
      state: "complete",
      milestoneDefinitionId: { in: downstreamDefs.map((d) => d.id) },
    },
    select: { milestoneDefinitionId: true },
  });

  const completedIds = new Set(completions.map((c) => c.milestoneDefinitionId));
  return downstreamDefs.filter((d) => completedIds.has(d.id));
}

// ── getImpliedPredecessors ───────────────────────────────────────────────────

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
      state: { in: ["complete", "not_required"] },
      milestoneDefinitionId: { in: prereqDefs.map((p) => p.id) },
    },
    select: { milestoneDefinitionId: true },
  });

  const doneIds = new Set(completions.map((c) => c.milestoneDefinitionId));
  return prereqDefs.filter((p) => !doneIds.has(p.id));
}

// ── completeMilestone ────────────────────────────────────────────────────────

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
    select: { code: true, summaryTemplate: true, side: true },
  });
  if (!def) throw new Error("Milestone definition not found");

  // Prerequisite guard
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
        state: { in: ["complete", "not_required"] },
      },
    });
    if (satisfied < prereqDefs.length) {
      throw new Error("Prerequisites not complete — confirm earlier milestones first");
    }
  }

  const summaryText = def.summaryTemplate
    ? await generateSummaryText(input.transactionId, def.summaryTemplate, input.completedByName)
    : null;

  const completion = await prisma.milestoneCompletion.upsert({
    where: {
      transactionId_milestoneDefinitionId: {
        transactionId: input.transactionId,
        milestoneDefinitionId: input.milestoneDefinitionId,
      },
    },
    create: {
      transactionId: input.transactionId,
      milestoneDefinitionId: input.milestoneDefinitionId,
      state: "complete",
      completedAt: input.completedAt ?? new Date(),
      eventDate: input.eventDate ?? null,
      completedById: input.completedById,
      summaryText,
    },
    update: {
      state: "complete",
      completedAt: input.completedAt ?? new Date(),
      eventDate: input.eventDate ?? null,
      completedById: input.completedById,
      summaryText,
      notRequiredReason: null,
    },
  });

  await unlockDirectDependents(input.transactionId, def.code);
  await autoCompleteRemindersForMilestone(input.transactionId, def.code);
  await maybeUnlockExchangeGate(input.transactionId, def.side, input.completedById);
  touchLastActivity(input.transactionId).catch(() => {});

  return completion;
}

// ── bulkCompleteMilestones ──────────────────────────────────────────────────

export async function bulkCompleteMilestones(
  milestoneDefinitionIds: string[],
  transactionId: string,
  completedById: string,
  completedByName: string
) {
  if (milestoneDefinitionIds.length === 0) return [];

  const baseTime = new Date();

  const defs = await prisma.milestoneDefinition.findMany({
    where: { id: { in: milestoneDefinitionIds } },
    select: { id: true, code: true, summaryTemplate: true, side: true },
  });
  const defMap = new Map(defs.map((d) => [d.id, d]));

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

  const results = await Promise.all(
    milestoneDefinitionIds.map((defId, i) =>
      prisma.milestoneCompletion.upsert({
        where: {
          transactionId_milestoneDefinitionId: { transactionId, milestoneDefinitionId: defId },
        },
        create: {
          transactionId,
          milestoneDefinitionId: defId,
          state: "complete",
          completedAt: new Date(baseTime.getTime() + i),
          completedById,
          summaryText: summaryTexts[i],
        },
        update: {
          state: "complete",
          completedAt: new Date(baseTime.getTime() + i),
          completedById,
          summaryText: summaryTexts[i],
          notRequiredReason: null,
        },
      })
    )
  );

  // Unlock dependents and auto-complete reminders for each completed milestone
  await Promise.all(
    milestoneDefinitionIds.map(async (defId) => {
      const def = defMap.get(defId);
      if (!def?.code) return;
      await unlockDirectDependents(transactionId, def.code);
      return autoCompleteRemindersForMilestone(transactionId, def.code);
    })
  );

  // Check exchange gate for each affected side
  const uniqueSides = [...new Set(defs.map((d) => d.side))];
  await Promise.all(uniqueSides.map((side) => maybeUnlockExchangeGate(transactionId, side, completedById)));

  touchLastActivity(transactionId).catch(() => {});
  return results;
}

// ── reverseMilestone ────────────────────────────────────────────────────────

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

  await prisma.milestoneCompletion.update({
    where: {
      transactionId_milestoneDefinitionId: { transactionId, milestoneDefinitionId },
    },
    data: { state: "available", completedAt: null, completedById: null, summaryText: null },
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

// ── bulkReverseMilestones ────────────────────────────────────────────────────

export async function bulkReverseMilestones(
  milestoneDefinitionIds: string[],
  transactionId: string,
  completedById: string,
  completedByName: string
) {
  if (milestoneDefinitionIds.length === 0) return;

  const defs = await prisma.milestoneDefinition.findMany({
    where: { id: { in: milestoneDefinitionIds } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(defs.map((d) => [d.id, d.name]));

  await Promise.all(
    milestoneDefinitionIds.map((defId) =>
      prisma.milestoneCompletion.update({
        where: {
          transactionId_milestoneDefinitionId: { transactionId, milestoneDefinitionId: defId },
        },
        data: { state: "locked", completedAt: null, completedById: null, summaryText: null },
      })
    )
  );

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

// ── markNotRequired ──────────────────────────────────────────────────────────

export async function markNotRequired(
  transactionId: string,
  milestoneDefinitionId: string,
  completedById: string,
  completedByName: string,
  reason: string
) {
  const def = await prisma.milestoneDefinition.findUnique({
    where: { id: milestoneDefinitionId },
    select: { name: true, code: true, side: true },
  });

  const completion = await prisma.milestoneCompletion.upsert({
    where: {
      transactionId_milestoneDefinitionId: { transactionId, milestoneDefinitionId },
    },
    create: {
      transactionId,
      milestoneDefinitionId,
      state: "not_required",
      completedById,
      notRequiredReason: reason,
    },
    update: {
      state: "not_required",
      completedAt: null,
      summaryText: null,
      completedById,
      notRequiredReason: reason,
    },
  });

  // NR also unlocks dependents (NR counts as satisfied for prereq purposes)
  if (def?.code) {
    await unlockDirectDependents(transactionId, def.code);
  }
  if (def?.side) {
    await maybeUnlockExchangeGate(transactionId, def.side, completedById);
  }

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

// ── bulkMarkNotRequired ──────────────────────────────────────────────────────

export async function bulkMarkNotRequired(
  milestoneDefinitionIds: string[],
  transactionId: string,
  completedById: string,
  reason: string
) {
  if (milestoneDefinitionIds.length === 0) return;

  await Promise.all(
    milestoneDefinitionIds.map((defId) =>
      prisma.milestoneCompletion.upsert({
        where: {
          transactionId_milestoneDefinitionId: { transactionId, milestoneDefinitionId: defId },
        },
        create: {
          transactionId,
          milestoneDefinitionId: defId,
          state: "not_required",
          completedById,
          notRequiredReason: reason,
        },
        update: {
          state: "not_required",
          completedAt: null,
          summaryText: null,
          notRequiredReason: reason,
        },
      })
    )
  );
}

// ── markNotRequiredWithCascade ───────────────────────────────────────────────

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

// ── reverseMilestoneWithCascade ──────────────────────────────────────────────

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

  // Un-cascade any NR cascade that was triggered by this milestone
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
        state: "not_required",
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
