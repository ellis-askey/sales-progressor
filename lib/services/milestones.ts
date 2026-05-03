// lib/services/milestones.ts

import { prisma } from "@/lib/prisma";
import { generateSummaryText, resolveTemplateTokens } from "@/lib/services/summary";
import { autoCompleteRemindersForMilestone } from "@/lib/services/reminders";
import { touchLastActivity } from "@/lib/services/activity";
import type { Prisma, MilestoneSide, MilestoneDefinition, MilestoneCompletion, Tenure, PurchaseType } from "@prisma/client";

export type DefinitionWithCompletion = Omit<MilestoneDefinition, "weight"> & {
  weight: number;
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

import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";
export { DIRECT_PREREQUISITES };

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

// Bilateral milestone pairs — reverse (or confirm) together
export const BILATERAL_UNDO_PAIRS: Record<string, string> = {
  VM19: "PM26", PM26: "VM19",
  VM20: "PM27", PM27: "VM20",
};

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

async function unlockDirectDependents(
  transactionId: string,
  completedCode: string,
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? prisma;
  const dependentCodes = DIRECT_DEPENDENTS[completedCode] ?? [];
  if (dependentCodes.length === 0) return;

  const dependentDefs = await db.milestoneDefinition.findMany({
    where: { code: { in: dependentCodes } },
    select: { id: true, code: true },
  });

  const allDefs = await db.milestoneDefinition.findMany({ select: { id: true, code: true } });
  const allCodeToId = new Map(allDefs.map((d) => [d.code, d.id]));

  const allCompletions = await db.milestoneCompletion.findMany({
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
        await db.milestoneCompletion.update({
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

export async function maybeUnlockExchangeGate(
  transactionId: string,
  side: MilestoneSide,
  createdById: string,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx ?? prisma;
  const gateCode = side === "vendor" ? "VM18" : "PM25";

  const gateDef = await db.milestoneDefinition.findFirst({
    where: { code: gateCode },
    select: { id: true },
  });
  if (!gateDef) return;

  const gateCompletion = await db.milestoneCompletion.findFirst({
    where: { transactionId, milestoneDefinitionId: gateDef.id },
    select: { state: true },
  });
  if (!gateCompletion || gateCompletion.state !== "locked") return;

  const blockers = await db.milestoneDefinition.findMany({
    where: { side, blocksExchange: true },
    select: { id: true },
  });
  if (blockers.length === 0) return;

  const blockerCompletions = await db.milestoneCompletion.findMany({
    where: { transactionId, milestoneDefinitionId: { in: blockers.map((b) => b.id) } },
    select: { milestoneDefinitionId: true, state: true },
  });
  const blockerMap = new Map(blockerCompletions.map((c) => [c.milestoneDefinitionId, c.state]));

  const allClear = blockers.every((b) => {
    const s = blockerMap.get(b.id);
    return s === "complete" || s === "not_required";
  });
  if (!allClear) return;

  await db.milestoneCompletion.update({
    where: {
      transactionId_milestoneDefinitionId: {
        transactionId,
        milestoneDefinitionId: gateDef.id,
      },
    },
    data: { state: "available" },
  });

  const sideLabel = side === "vendor" ? "Vendor" : "Purchaser";
  await db.outboundMessage.create({
    data: {
      transactionId,
      type: "internal_note",
      contactIds: [],
      content: `${sideLabel} side ready to exchange — all required milestones complete`,
      createdById,
    },
  });
}

// ── maybeLockExchangeGate ────────────────────────────────────────────────────
// Called after a milestone reversal. Re-locks VM18 or PM25 if a blocker is no
// longer complete, and the gate was previously available (not yet confirmed).

export async function maybeLockExchangeGate(
  transactionId: string,
  side: MilestoneSide,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx ?? prisma;
  const gateCode = side === "vendor" ? "VM18" : "PM25";

  const gateDef = await db.milestoneDefinition.findFirst({
    where: { code: gateCode },
    select: { id: true },
  });
  if (!gateDef) return;

  const gateCompletion = await db.milestoneCompletion.findFirst({
    where: { transactionId, milestoneDefinitionId: gateDef.id },
    select: { state: true },
  });
  if (!gateCompletion || gateCompletion.state !== "available") return;

  const blockers = await db.milestoneDefinition.findMany({
    where: { side, blocksExchange: true, code: { not: gateCode } },
    select: { id: true },
  });
  if (blockers.length === 0) return;

  const blockerCompletions = await db.milestoneCompletion.findMany({
    where: { transactionId, milestoneDefinitionId: { in: blockers.map((b) => b.id) } },
    select: { milestoneDefinitionId: true, state: true },
  });
  const blockerMap = new Map(blockerCompletions.map((c) => [c.milestoneDefinitionId, c.state]));

  const allClear = blockers.every((b) => {
    const s = blockerMap.get(b.id);
    return s === "complete" || s === "not_required";
  });

  if (!allClear) {
    await db.milestoneCompletion.update({
      where: {
        transactionId_milestoneDefinitionId: {
          transactionId,
          milestoneDefinitionId: gateDef.id,
        },
      },
      data: { state: "locked" },
    });
  }
}

// ── getMilestonesForTransaction ───────────────────────────────────────────────

export async function getMilestonesForTransaction(
  transactionId: string,
  agencyId: string | null
): Promise<MilestonesByTransaction> {
  const transaction = await prisma.propertyTransaction.findFirst({
    where: agencyId ? { id: transactionId, agencyId } : { id: transactionId },
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
        weight: Number(def.weight),
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

export async function completeMilestone(input: CompleteMilestoneInput, tx?: Prisma.TransactionClient) {
  const db = tx ?? prisma;

  const def = await db.milestoneDefinition.findUnique({
    where: { id: input.milestoneDefinitionId },
    select: { code: true, summaryTemplate: true, side: true },
  });
  if (!def) throw new Error("Milestone definition not found");

  // Prerequisite guard
  const prereqCodes = DIRECT_PREREQUISITES[def.code] ?? [];
  if (prereqCodes.length > 0) {
    const prereqDefs = await db.milestoneDefinition.findMany({
      where: { code: { in: prereqCodes } },
      select: { id: true },
    });
    const satisfied = await db.milestoneCompletion.count({
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

  const completion = await db.milestoneCompletion.upsert({
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

  await unlockDirectDependents(input.transactionId, def.code, tx);
  await autoCompleteRemindersForMilestone(input.transactionId, def.code, tx);
  await maybeUnlockExchangeGate(input.transactionId, def.side, input.completedById, tx);

  // Self-resolve outOfOrderCompletion flags: clear them when their full prereq
  // chain is now satisfied (the agent re-confirmed the missing upstream milestone).
  const outOfOrderRows = await db.milestoneCompletion.findMany({
    where: { transactionId: input.transactionId, outOfOrderCompletion: true },
    select: { milestoneDefinitionId: true },
  });
  if (outOfOrderRows.length > 0) {
    const allCurrentCompletions = await db.milestoneCompletion.findMany({
      where: { transactionId: input.transactionId },
      select: { milestoneDefinitionId: true, state: true },
    });
    const resolveStateMap = new Map(allCurrentCompletions.map((c) => [c.milestoneDefinitionId, c.state as string]));
    resolveStateMap.set(input.milestoneDefinitionId, "complete");
    const allDefCodes = await db.milestoneDefinition.findMany({ select: { id: true, code: true } });
    const resolveCodeToId = new Map(allDefCodes.map((d) => [d.code, d.id]));
    const resolveIdToCode = new Map(allDefCodes.map((d) => [d.id, d.code]));
    const toResolve: string[] = [];
    for (const { milestoneDefinitionId } of outOfOrderRows) {
      const code = resolveIdToCode.get(milestoneDefinitionId);
      if (!code) continue;
      const allPrereqs = collectAllPrereqCodes(code);
      const allSatisfied = allPrereqs.every((prereqCode) => {
        const pid = resolveCodeToId.get(prereqCode);
        if (!pid) return true;
        const s = resolveStateMap.get(pid);
        return s === "complete" || s === "not_required";
      });
      if (allSatisfied) toResolve.push(milestoneDefinitionId);
    }
    if (toResolve.length > 0) {
      await db.milestoneCompletion.updateMany({
        where: {
          transactionId: input.transactionId,
          milestoneDefinitionId: { in: toResolve },
          outOfOrderCompletion: true,
        },
        data: { outOfOrderCompletion: false },
      });
    }
  }

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
  reason?: string,
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? prisma;

  const def = await db.milestoneDefinition.findUnique({
    where: { id: milestoneDefinitionId },
    select: { name: true },
  });

  await db.milestoneCompletion.update({
    where: {
      transactionId_milestoneDefinitionId: { transactionId, milestoneDefinitionId },
    },
    data: { state: "available", completedAt: null, completedById: null, summaryText: null },
  });

  await db.outboundMessage.create({
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
      prisma.outboundMessage.create({
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

  await prisma.outboundMessage.create({
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

// ── getUndoImpact ─────────────────────────────────────────────────────────────
// Read-only: returns the cascade list and three projected % values.

export type UndoImpactItem = {
  id: string;
  name: string;
  side: string;
  code: string;
  reconciledAtExchange: boolean;
};

export type UndoImpact = {
  cascade: UndoImpactItem[];
  currentPercent: number;
  targetOnlyPercent: number;
  cascadePercent: number;
};

export async function getUndoImpact(
  transactionId: string,
  milestoneDefinitionId: string
): Promise<UndoImpact> {
  const target = await prisma.milestoneDefinition.findUnique({
    where: { id: milestoneDefinitionId },
    select: { id: true, code: true, side: true, name: true },
  });
  if (!target) throw new Error("Milestone not found");

  const partnerCode = BILATERAL_UNDO_PAIRS[target.code];
  let partnerDef: { id: string; code: string; name: string; side: string } | null = null;
  if (partnerCode) {
    partnerDef = await prisma.milestoneDefinition.findFirst({
      where: { code: partnerCode },
      select: { id: true, code: true, name: true, side: true },
    }) ?? null;
  }

  const targetDownstream = await getDownstreamCompleted(milestoneDefinitionId, transactionId);
  const partnerDownstream = partnerDef
    ? await getDownstreamCompleted(partnerDef.id, transactionId)
    : [];

  const allDownstreamIds = [...new Set([
    ...targetDownstream.map((m) => m.id),
    ...partnerDownstream.map((m) => m.id),
  ])];

  const reconciledCompletions = allDownstreamIds.length > 0
    ? await prisma.milestoneCompletion.findMany({
        where: { transactionId, milestoneDefinitionId: { in: allDownstreamIds }, reconciledAtExchange: true },
        select: { milestoneDefinitionId: true },
      })
    : [];
  const reconciledSet = new Set(reconciledCompletions.map((c) => c.milestoneDefinitionId));

  const cascadeMap = new Map<string, UndoImpactItem>();
  for (const m of [...targetDownstream, ...partnerDownstream]) {
    if (!cascadeMap.has(m.id)) {
      cascadeMap.set(m.id, {
        id: m.id,
        name: m.name,
        side: m.side,
        code: m.code,
        reconciledAtExchange: reconciledSet.has(m.id),
      });
    }
  }
  const cascade = Array.from(cascadeMap.values());

  const [allDefs, allCompletions] = await Promise.all([
    prisma.milestoneDefinition.findMany({ select: { id: true, side: true, weight: true } }),
    prisma.milestoneCompletion.findMany({
      where: { transactionId },
      select: { milestoneDefinitionId: true, state: true },
    }),
  ]);
  const completionMap = new Map(allCompletions.map((c) => [c.milestoneDefinitionId, c]));

  const targetAndPartnerIds = new Set<string>([milestoneDefinitionId]);
  if (partnerDef) targetAndPartnerIds.add(partnerDef.id);
  const allRemovedIds = new Set<string>([...targetAndPartnerIds, ...cascade.map((m) => m.id)]);

  function sidePercent(side: string, removeSet: Set<string>): number {
    const sideDefs = allDefs.filter((d) => d.side === side);
    const applicable = sideDefs.filter((d) => completionMap.get(d.id)?.state !== "not_required");
    const applicableWeight = applicable.reduce((s, d) => s + Number(d.weight), 0);
    if (applicableWeight === 0) return 100;
    const completedWeight = applicable
      .filter((d) => completionMap.get(d.id)?.state === "complete" && !removeSet.has(d.id))
      .reduce((s, d) => s + Number(d.weight), 0);
    return (completedWeight / applicableWeight) * 100;
  }

  const emptySet = new Set<string>();
  const currentPercent = Math.round((sidePercent("vendor", emptySet) + sidePercent("purchaser", emptySet)) / 2);
  const targetOnlyPercent = Math.round(
    (sidePercent("vendor", targetAndPartnerIds) + sidePercent("purchaser", targetAndPartnerIds)) / 2
  );
  const cascadePercent = Math.round(
    (sidePercent("vendor", allRemovedIds) + sidePercent("purchaser", allRemovedIds)) / 2
  );

  return { cascade, currentPercent, targetOnlyPercent, cascadePercent };
}

// ── executeUndoMilestone ──────────────────────────────────────────────────────
// Atomic write: reverse target (+ bilateral partner) and optionally all cascade.

export async function executeUndoMilestone(input: {
  transactionId: string;
  milestoneDefinitionId: string;
  mode: "target_only" | "cascade";
  completedById: string;
  completedByName: string;
}): Promise<void> {
  const { transactionId, milestoneDefinitionId, mode, completedById, completedByName } = input;

  const targetDef = await prisma.milestoneDefinition.findUnique({
    where: { id: milestoneDefinitionId },
    select: { id: true, code: true, name: true, side: true },
  });
  if (!targetDef) throw new Error("Milestone definition not found");

  const partnerCode = BILATERAL_UNDO_PAIRS[targetDef.code];
  let partnerDef: { id: string; code: string; name: string; side: string } | null = null;
  if (partnerCode) {
    partnerDef = await prisma.milestoneDefinition.findFirst({
      where: { code: partnerCode },
      select: { id: true, code: true, name: true, side: true },
    }) ?? null;
  }

  const targetDownstream = await getDownstreamCompleted(milestoneDefinitionId, transactionId);
  const partnerDownstream = partnerDef
    ? await getDownstreamCompleted(partnerDef.id, transactionId)
    : [];

  const cascadeMap = new Map<string, { id: string; code: string; name: string }>();
  for (const m of [...targetDownstream, ...partnerDownstream]) {
    if (!cascadeMap.has(m.id)) cascadeMap.set(m.id, { id: m.id, code: m.code, name: m.name });
  }
  const cascadeItems = Array.from(cascadeMap.values());

  const primaryIds = [milestoneDefinitionId, ...(partnerDef ? [partnerDef.id] : [])];
  const primaryCodes = new Set([targetDef.code, ...(partnerDef ? [partnerDef.code] : [])]);
  const cascadeIds = mode === "cascade" ? cascadeItems.map((m) => m.id) : [];
  const allReverseIds = [...primaryIds, ...cascadeIds];
  const allReverseCodes = new Set([
    ...primaryCodes,
    ...(mode === "cascade" ? cascadeItems.map((m) => m.code) : []),
  ]);

  const allDefs = await prisma.milestoneDefinition.findMany({
    select: { id: true, code: true, side: true },
  });
  const codeToId = new Map(allDefs.map((d) => [d.code, d.id]));
  const idToCode = new Map(allDefs.map((d) => [d.id, d.code]));
  const idToSide = new Map(allDefs.map((d) => [d.id, d.side]));

  const allCompletions = await prisma.milestoneCompletion.findMany({
    where: { transactionId },
    select: { milestoneDefinitionId: true, state: true },
  });
  const stateMap = new Map(allCompletions.map((c) => [c.milestoneDefinitionId, c.state as string]));

  function computeNewState(defId: string): "available" | "locked" {
    const code = idToCode.get(defId);
    if (!code) return "locked";
    const prereqs = DIRECT_PREREQUISITES[code] ?? [];
    const allSatisfied = prereqs.every((p) => {
      if (allReverseCodes.has(p)) return false;
      const pid = codeToId.get(p);
      if (!pid) return true;
      const s = stateMap.get(pid);
      return s === "complete" || s === "not_required";
    });
    return allSatisfied ? "available" : "locked";
  }

  // Available milestones that now have an unsatisfied prereq (need re-locking)
  const availableToRelock: string[] = [];
  for (const def of allDefs) {
    if (allReverseCodes.has(def.code)) continue;
    if (stateMap.get(def.id) !== "available") continue;
    const prereqs = DIRECT_PREREQUISITES[def.code] ?? [];
    if (!prereqs.some((p) => allReverseCodes.has(p))) continue;
    const stillSatisfied = prereqs.every((p) => {
      if (allReverseCodes.has(p)) return false;
      const pid = codeToId.get(p);
      if (!pid) return true;
      const s = stateMap.get(pid);
      return s === "complete" || s === "not_required";
    });
    if (!stillSatisfied) availableToRelock.push(def.id);
  }

  const affectedSides = new Set<MilestoneSide>();
  for (const id of allReverseIds) {
    const side = idToSide.get(id) as MilestoneSide | undefined;
    if (side) affectedSides.add(side);
  }

  const cancelReminderCodes = mode === "target_only"
    ? Array.from(primaryCodes)
    : Array.from(allReverseCodes);

  await prisma.$transaction(async (ptx) => {
    // Reverse primary milestones (target + bilateral partner)
    for (const defId of primaryIds) {
      await ptx.milestoneCompletion.update({
        where: { transactionId_milestoneDefinitionId: { transactionId, milestoneDefinitionId: defId } },
        data: {
          state: computeNewState(defId),
          completedAt: null,
          completedById: null,
          summaryText: null,
          notRequiredReason: null,
          reconciledAtExchange: false,
          outOfOrderCompletion: false,
        },
      });
    }

    // Reverse cascade milestones (cascade mode only)
    for (const defId of cascadeIds) {
      await ptx.milestoneCompletion.update({
        where: { transactionId_milestoneDefinitionId: { transactionId, milestoneDefinitionId: defId } },
        data: {
          state: computeNewState(defId),
          completedAt: null,
          completedById: null,
          summaryText: null,
          notRequiredReason: null,
          reconciledAtExchange: false,
          outOfOrderCompletion: false,
        },
      });
    }

    // Re-lock available milestones whose prereqs are now unsatisfied
    if (availableToRelock.length > 0) {
      await ptx.milestoneCompletion.updateMany({
        where: { transactionId, milestoneDefinitionId: { in: availableToRelock } },
        data: { state: "locked" },
      });
    }

    // target_only: flag still-complete downstream with outOfOrderCompletion
    if (mode === "target_only" && cascadeItems.length > 0) {
      await ptx.milestoneCompletion.updateMany({
        where: { transactionId, milestoneDefinitionId: { in: cascadeItems.map((m) => m.id) } },
        data: { outOfOrderCompletion: true },
      });
    }

    // Re-evaluate exchange gate (re-lock if a blocker was undone)
    for (const side of affectedSides) {
      await maybeLockExchangeGate(transactionId, side, ptx);
    }

    // Cancel active reminder logs + pending chase tasks for reversed codes
    const logs = await ptx.reminderLog.findMany({
      where: {
        transactionId,
        status: "active",
        reminderRule: { targetMilestoneCode: { in: cancelReminderCodes } },
      },
      select: { id: true },
    });
    if (logs.length > 0) {
      const logIds = logs.map((l) => l.id);
      await ptx.chaseTask.updateMany({
        where: { reminderLogId: { in: logIds }, status: "pending" },
        data: { status: "cancelled" },
      });
      await ptx.reminderLog.updateMany({
        where: { id: { in: logIds } },
        data: { status: "cancelled", statusReason: "Milestone reversed" },
      });
    }

    // Communication records — primary milestones
    const modeNote = mode === "target_only"
      ? " — downstream milestones kept as-is"
      : ` — undone by ${completedByName}`;
    for (const defId of primaryIds) {
      const defName = defId === milestoneDefinitionId
        ? targetDef.name
        : (partnerDef?.name ?? "milestone");
      await ptx.outboundMessage.create({
        data: {
          transactionId,
          type: "internal_note",
          contactIds: [],
          content: `Milestone reversed: ${defName}${modeNote}`,
          createdById: completedById,
        },
      });
    }

    // Communication records — cascade milestones
    if (mode === "cascade") {
      for (const item of cascadeItems) {
        await ptx.outboundMessage.create({
          data: {
            transactionId,
            type: "internal_note",
            contactIds: [],
            content: `Milestone reversed: ${item.name} — cascaded from undo of ${targetDef.name}`,
            createdById: completedById,
          },
        });
      }
    }
  });

  touchLastActivity(transactionId).catch(() => {});
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
    select: { code: true, side: true },
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

  // Reverse + gate re-lock in a single transaction so both writes are atomic.
  // maybeLockExchangeGate is a no-op if the gate is already locked or if no
  // blocker was affected; passing tx scopes it to the same connection.
  await prisma.$transaction(async (tx) => {
    await reverseMilestone(
      input.transactionId,
      input.milestoneDefinitionId,
      input.completedById,
      input.completedByName,
      input.reason,
      tx,
    );
    if (def?.side) {
      await maybeLockExchangeGate(input.transactionId, def.side, tx);
    }
  });
}
