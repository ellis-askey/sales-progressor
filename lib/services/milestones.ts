// lib/services/milestones.ts

import { prisma } from "@/lib/prisma";
import { enqueueChainMilestoneNotifications, maybeEnqueueCelebration } from "@/lib/email/chainNotifications";
import { generateSummaryText, resolveTemplateTokens } from "@/lib/services/summary";
import { autoCompleteRemindersForMilestone, evaluateTransactionReminders } from "@/lib/services/reminders";
import { touchLastActivity } from "@/lib/services/activity";
import { computeAutoNrCodes } from "@/lib/milestone-auto-nr";
import { maybeStampExchange } from "@/lib/services/billing-trigger";
import { handleExchangeReversal } from "@/lib/services/billing-reversal";
import { recordEvent } from "@/lib/command/events/write";
import { forRound, milestoneScopeWhere } from "@/lib/services/milestone-scope";
import type { MilestoneScope } from "@/lib/services/milestone-scope";
import type { Prisma, MilestoneSide, MilestoneDefinition, MilestoneCompletion, Tenure, PurchaseType, PrismaClient } from "@prisma/client";

// Internal helper: fetch the transaction's active round id and build a
// forRound(activeBuyerRoundId, transactionId) scope. Used by every read
// site in this file so the round-scoping pattern is identical
// everywhere. Caller passes the same db handle (prisma or a
// TransactionClient) it's about to read MilestoneCompletion with — so
// the activeBuyerRoundId fetch sees the same tx-snapshot as the
// MilestoneCompletion read that follows.
async function getActiveRoundScope(
  db: Prisma.TransactionClient | typeof prisma,
  transactionId: string,
): Promise<MilestoneScope> {
  const row = await db.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { activeBuyerRoundId: true },
  });
  return forRound(row?.activeBuyerRoundId ?? null, transactionId);
}

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
// Source of truth lives in lib/milestone-nr-cascade.ts (pure data, safely
// importable by client components for optimistic-cascade hiding).
export { NR_CASCADE } from "@/lib/milestone-nr-cascade";
import { NR_CASCADE } from "@/lib/milestone-nr-cascade";

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
  createdById?: string,
  // Phase 1 commit 3: when supplied, purchaser-side completion rows get
  // stamped with this round id at creation. Vendor-side rows stay
  // file-level (NULL) by Phase 0 attribution rules. Backwards-compatible:
  // omit to skip the stamping for callers that haven't migrated yet
  // (currently no such callers — createTransactionAction is the only
  // entry point and now passes the round).
  buyerRoundId?: string | null,
  // 2026-07-07: optional client override. When omitted uses the default
  // singleton (@/lib/prisma). Supplied by scripts/seed-demo.ts so it can
  // run against a cross-env Prisma client (STAGING_DATABASE_URL) without
  // milestone writes leaking back to the DATABASE_URL Prisma pool - the
  // FK on transactionId would then fail because the parent row lives
  // in a different DB.
  db?: Prisma.TransactionClient | PrismaClient
) {
  const client = db ?? prisma;
  const defs = await client.milestoneDefinition.findMany({
    orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
  });

  // Single source of truth: lib/milestone-auto-nr.ts. Shared with the
  // edit-sale-details cascade (confirmSaleDetailsAction) and the
  // ReconcileMilestonePicker client mirror — adding a new rule there
  // propagates here automatically.
  const autoNrCodes = computeAutoNrCodes(purchaseType, tenure);

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

  // Find-then-create-if-missing for each definition. The compound
  // upsert key (transactionId_milestoneDefinitionId) was dropped in
  // 20260604000000_buyer_round_milestone_uniqueness; uniqueness is
  // enforced by partial indexes (vendor file-level, purchaser per-round)
  // so the row is matched by (tx, def) here. Existing row → no-op
  // (parity with the old upsert's empty `update`). Missing row → create.
  //
  // Phase 1 commit 3: purchaser-side rows get stamped with the supplied
  // buyerRoundId so subsequent round-scoped reads (commit 4) find them.
  // Vendor-side rows stay file-level (buyerRoundId NULL).
  // 2026-07-13 fix (Chunk 1e): each per-def create wraps its own try/catch
  // that swallows P2002 (unique constraint violation). Between the
  // findFirst check and the create, a concurrent process (parallel init,
  // a cron-triggered re-eval that spins up rows) can insert the same
  // (transactionId, milestoneDefinitionId) row - the partial unique
  // index then throws on our create. Ignoring the duplicate here is
  // safe: the row exists in the desired state; we didn't win but the
  // outcome is the same. Prevents "file creation failed" toasts when
  // the file itself was actually created successfully.
  await Promise.all(
    defs.map(async (def) => {
      const existing = await client.milestoneCompletion.findFirst({
        where: { transactionId, milestoneDefinitionId: def.id },
        select: { id: true },
      });
      if (existing) return;
      const isNr = autoNrCodes.has(def.code);
      const isAvail = availableCodes.has(def.code);
      const state = isNr ? "not_required" : isAvail ? "available" : "locked";
      const stampRoundId = def.side === "purchaser" ? (buyerRoundId ?? null) : null;
      try {
        await client.milestoneCompletion.create({
          data: {
            transactionId,
            milestoneDefinitionId: def.id,
            state,
            notRequiredReason: isNr ? "Auto-set at file creation" : null,
            completedById: createdById ?? null,
            buyerRoundId: stampRoundId,
            createdAt: now,
          },
        });
      } catch (err) {
        const code = (err as { code?: string })?.code;
        if (code !== "P2002") throw err;
        // Concurrent init already created this row - no-op.
      }
    })
  );

  return autoNrCodes;
}

// ── Re-evaluate availability of direct dependents after a state change ─────────

export async function unlockDirectDependents(
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

  // Round-scoped: VM file-level + active round's PMs together. PM12-VM9
  // and similar cross-side prereqs are handled by the OR in forRound().
  const scope = await getActiveRoundScope(db, transactionId);
  const allCompletions = await db.milestoneCompletion.findMany({
    where: { transactionId, ...milestoneScopeWhere(scope) },
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
        const row = await db.milestoneCompletion.findFirst({
          where: { transactionId, milestoneDefinitionId: dep.id, ...milestoneScopeWhere(scope) },
          select: { id: true },
        });
        if (row) {
          await db.milestoneCompletion.update({
            where: { id: row.id },
            data: { state: "available" },
          });
        }
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
  createdById: string | null,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx ?? prisma;
  const gateCode = side === "vendor" ? "VM18" : "PM25";

  const gateDef = await db.milestoneDefinition.findFirst({
    where: { code: gateCode },
    select: { id: true },
  });
  if (!gateDef) return;

  // Round-scoped: gate code is side-specific so the OR picks vendor
  // file-level or active round's purchaser correctly.
  const scope = await getActiveRoundScope(db, transactionId);

  const gateCompletion = await db.milestoneCompletion.findFirst({
    where: { transactionId, milestoneDefinitionId: gateDef.id, ...milestoneScopeWhere(scope) },
    select: { state: true },
  });
  if (!gateCompletion || gateCompletion.state !== "locked") return;

  const blockers = await db.milestoneDefinition.findMany({
    where: { side, blocksExchange: true },
    select: { id: true },
  });
  if (blockers.length === 0) return;

  const blockerCompletions = await db.milestoneCompletion.findMany({
    where: {
      transactionId,
      milestoneDefinitionId: { in: blockers.map((b) => b.id) },
      ...milestoneScopeWhere(scope),
    },
    select: { milestoneDefinitionId: true, state: true },
  });
  const blockerMap = new Map(blockerCompletions.map((c) => [c.milestoneDefinitionId, c.state]));

  const allClear = blockers.every((b) => {
    const s = blockerMap.get(b.id);
    return s === "complete" || s === "not_required";
  });
  if (!allClear) return;

  const gateRow = await db.milestoneCompletion.findFirst({
    where: { transactionId, milestoneDefinitionId: gateDef.id, ...milestoneScopeWhere(scope) },
    select: { id: true },
  });
  if (!gateRow) return;
  await db.milestoneCompletion.update({
    where: { id: gateRow.id },
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

  // Command Centre event log. The state→"available" update above is the real
  // mutation. Fires once per side that flips from locked→available.
  await recordEvent({
    type: "exchange_gate_unlocked",
    userId: createdById ?? undefined,
    entityType: "PropertyTransaction",
    entityId: transactionId,
    metadata: { side },
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

  const scope = await getActiveRoundScope(db, transactionId);

  const gateCompletion = await db.milestoneCompletion.findFirst({
    where: { transactionId, milestoneDefinitionId: gateDef.id, ...milestoneScopeWhere(scope) },
    select: { state: true },
  });
  if (!gateCompletion || gateCompletion.state !== "available") return;

  const blockers = await db.milestoneDefinition.findMany({
    where: { side, blocksExchange: true, code: { not: gateCode } },
    select: { id: true },
  });
  if (blockers.length === 0) return;

  const blockerCompletions = await db.milestoneCompletion.findMany({
    where: {
      transactionId,
      milestoneDefinitionId: { in: blockers.map((b) => b.id) },
      ...milestoneScopeWhere(scope),
    },
    select: { milestoneDefinitionId: true, state: true },
  });
  const blockerMap = new Map(blockerCompletions.map((c) => [c.milestoneDefinitionId, c.state]));

  const allClear = blockers.every((b) => {
    const s = blockerMap.get(b.id);
    return s === "complete" || s === "not_required";
  });

  if (!allClear) {
    const gateRow = await db.milestoneCompletion.findFirst({
      where: { transactionId, milestoneDefinitionId: gateDef.id, ...milestoneScopeWhere(scope) },
      select: { id: true },
    });
    if (gateRow) {
      await db.milestoneCompletion.update({
        where: { id: gateRow.id },
        data: { state: "locked" },
      });
    }
  }
}

// ── getMilestonesForTransaction ───────────────────────────────────────────────

export async function getMilestonesForTransaction(
  transactionId: string,
  agencyId: string | null
): Promise<MilestonesByTransaction> {
  const transaction = await prisma.propertyTransaction.findFirst({
    where: agencyId ? { id: transactionId, agencyId } : { id: transactionId },
    select: { id: true, activeBuyerRoundId: true },
  });
  if (!transaction) throw new Error("Transaction not found");

  const definitions = await prisma.milestoneDefinition.findMany({
    orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
  });

  const completions = await prisma.milestoneCompletion.findMany({
    where: {
      transactionId,
      ...milestoneScopeWhere(forRound(transaction.activeBuyerRoundId, transactionId)),
    },
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

  const scope = await getActiveRoundScope(prisma, transactionId);
  const completions = await prisma.milestoneCompletion.findMany({
    where: {
      transactionId,
      state: "complete",
      milestoneDefinitionId: { in: downstreamDefs.map((d) => d.id) },
      ...milestoneScopeWhere(scope),
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

  // forRound handles the PM12-⊃-VM9 cross-side prereq via its OR clause:
  // a single query returns both vendor file-level rows (VM9) and active
  // round purchaser rows (PM12) without ad-hoc assembly.
  const scope = await getActiveRoundScope(prisma, transactionId);
  const completions = await prisma.milestoneCompletion.findMany({
    where: {
      transactionId,
      state: { in: ["complete", "not_required"] },
      milestoneDefinitionId: { in: prereqDefs.map((p) => p.id) },
      ...milestoneScopeWhere(scope),
    },
    select: { milestoneDefinitionId: true },
  });

  const doneIds = new Set(completions.map((c) => c.milestoneDefinitionId));
  return prereqDefs.filter((p) => !doneIds.has(p.id));
}

// ── completeMilestone ────────────────────────────────────────────────────────

// Confirmer identity for a milestone completion. Either an authenticated
// User (agent / progressor / director / negotiator) or a Contact (vendor /
// purchaser / solicitor / broker confirming via the portal). The discriminator
// drives:
//   - completedById foreign key: set to User.id only when kind === "user";
//     null for contact confirms (the FK targets the User table).
//   - confirmedByPortal flag: true when kind === "contact"; false otherwise.
//   - summary template substitution: confirmer.name fills the {agent} token.
export type Confirmer =
  | { kind: "user"; id: string; name: string }
  | { kind: "contact"; id: string; name: string };

export type CompleteMilestoneInput = {
  transactionId: string;
  milestoneDefinitionId: string;
  confirmer: Confirmer;
  eventDate?: Date | null;
  completedAt?: Date;
};

export async function completeMilestone(
  input: CompleteMilestoneInput,
  // 2026-07-07: widened from Prisma.TransactionClient to also accept a
  // standalone PrismaClient. scripts/seed-demo.ts passes its cross-env
  // client (STAGING_DATABASE_URL) here so milestone writes land in the
  // same DB as the parent PropertyTransaction row.
  tx?: Prisma.TransactionClient | PrismaClient,
) {
  const db = tx ?? prisma;

  const def = await db.milestoneDefinition.findUnique({
    where: { id: input.milestoneDefinitionId },
    select: { code: true, summaryTemplate: true, side: true },
  });
  if (!def) throw new Error("Milestone definition not found");

  // Round-scoped: PM12-⊃-VM9 cross-side prereq handled by the OR in
  // forRound. The same scope is reused below for the row find + the
  // out-of-order rows read + the allCurrentCompletions read.
  // Round id retained explicitly so the create-branch can stamp
  // buyerRoundId on purchaser-side new rows.
  const txRowForScope = await db.propertyTransaction.findUnique({
    where: { id: input.transactionId },
    select: { activeBuyerRoundId: true },
  });
  const activeBuyerRoundId = txRowForScope?.activeBuyerRoundId ?? null;
  const scope = forRound(activeBuyerRoundId, input.transactionId);

  // Prerequisite guard. When prereqs aren't met we throw a structured
  // error so the UI (the ReminderCard Done button) can surface a toast
  // naming the specific missing milestone instead of silently failing
  // and looping (the original bug behind the 46 Ramilles Close
  // "kept clicking Done" report).
  const prereqCodes = DIRECT_PREREQUISITES[def.code] ?? [];
  if (prereqCodes.length > 0) {
    const prereqDefs = await db.milestoneDefinition.findMany({
      where: { code: { in: prereqCodes } },
      select: { id: true, code: true, name: true },
    });
    const satisfiedRows = await db.milestoneCompletion.findMany({
      where: {
        transactionId: input.transactionId,
        milestoneDefinitionId: { in: prereqDefs.map((d) => d.id) },
        state: { in: ["complete", "not_required"] },
        ...milestoneScopeWhere(scope),
      },
      select: { milestoneDefinitionId: true },
    });
    const satisfiedIds = new Set(satisfiedRows.map((r) => r.milestoneDefinitionId));
    const missing = prereqDefs
      .filter((d) => !satisfiedIds.has(d.id))
      .map((d) => ({ code: d.code, name: d.name }));
    if (missing.length > 0) {
      throw Object.assign(new Error("PREREQUISITES_NOT_COMPLETE"), {
        targetCode: def.code,
        missing,
      });
    }
  }

  const summaryText = def.summaryTemplate
    ? await generateSummaryText(input.transactionId, def.summaryTemplate, input.confirmer.name)
    : null;

  // Derive provenance from the confirmer.
  // - completedById: User.id when an agent confirms; null when a contact
  //   confirms via portal (the FK targets the User table, not Contact).
  // - confirmedByPortal: true for contact confirms; false otherwise.
  const completedById = input.confirmer.kind === "user" ? input.confirmer.id : null;
  const confirmedByPortal = input.confirmer.kind === "contact";

  // Find-then-update-or-create: see comment above initializeMilestoneCompletions
  // for why the compound upsert key no longer exists.
  //
  // 2026-07-13 fix (Chunk 1c): first-writer-wins on concurrent confirms.
  // When two agents click Done on the same milestone within a fraction
  // of a second, both findFirst calls used to see the same
  // pre-completion row, then both would update it - the LATER writer's
  // completedById + completedAt would silently overwrite the earlier
  // one, leading to wrong attribution in the activity feed and downstream
  // side effects firing twice.
  //
  // Now: the update path uses updateMany with a state filter so only
  // one call actually writes. The other call's updateMany returns
  // count=0 and we return early with the row as it stands (side effects
  // already ran for the winner). The create path catches P2002
  // (unique-constraint violation) and treats it as "someone else won".
  const existingForComplete = await db.milestoneCompletion.findFirst({
    where: {
      transactionId: input.transactionId,
      milestoneDefinitionId: input.milestoneDefinitionId,
      ...milestoneScopeWhere(scope),
    },
    select: { id: true },
  });

  let completion: Awaited<ReturnType<typeof db.milestoneCompletion.update>>;
  let wonRace = true;

  if (existingForComplete) {
    // Update path: conditional write via updateMany. Only lands the
    // write if the row is NOT already in "complete" state - so the
    // second concurrent confirmer's updateMany matches 0 rows.
    const updateResult = await db.milestoneCompletion.updateMany({
      where: {
        id: existingForComplete.id,
        state: { not: "complete" },
      },
      data: {
        state: "complete",
        completedAt: input.completedAt ?? new Date(),
        eventDate: input.eventDate ?? null,
        completedById,
        confirmedByPortal,
        summaryText,
        notRequiredReason: null,
      },
    });
    wonRace = updateResult.count > 0;
    completion = await db.milestoneCompletion.findUniqueOrThrow({
      where: { id: existingForComplete.id },
    });
  } else {
    // Create path: try to create; if the partial unique index catches
    // a concurrent create (P2002) we lost the race and re-fetch the
    // existing row.
    try {
      completion = await db.milestoneCompletion.create({
        data: {
          transactionId: input.transactionId,
          milestoneDefinitionId: input.milestoneDefinitionId,
          state: "complete",
          completedAt: input.completedAt ?? new Date(),
          eventDate: input.eventDate ?? null,
          completedById,
          confirmedByPortal,
          summaryText,
          // Stamp the active round on purchaser-side rows; vendor rows
          // stay file-level (NULL). Same attribution rule as
          // initializeMilestoneCompletions + Phase 0 backfill.
          buyerRoundId: def.side === "purchaser" ? activeBuyerRoundId : null,
        },
      });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== "P2002") throw err;
      // Concurrent create won the race. Re-fetch and return early.
      completion = await db.milestoneCompletion.findFirstOrThrow({
        where: {
          transactionId: input.transactionId,
          milestoneDefinitionId: input.milestoneDefinitionId,
          ...milestoneScopeWhere(scope),
        },
      });
      wonRace = false;
    }
  }

  if (!wonRace) {
    // Another concurrent completeMilestone call already wrote this row.
    // Side effects (unlockDirectDependents, autoCompleteRemindersForMilestone,
    // maybeStampExchange etc.) have already run for the winner - skip
    // them here so they don't fire twice.
    return completion;
  }

  // Post-state-write side effects (lines 641-738).
  //
  // CRITICAL: the MilestoneCompletion row was written above at 598-639. Every
  // call below runs inside the same ptx transaction context — if ANY of them
  // throws, the transaction rolls back and the milestone save is lost.
  //
  // Each call is therefore wrapped in its own narrow try/catch with
  // console.error so:
  //   - The milestone state row stays committed.
  //   - completeMilestone returns the row to the caller.
  //   - confirmMilestoneAction / confirmExchangeReconciliationAction return
  //     their success payload and the client fires the confetti.
  //   - The actual stack lives in Vercel runtime logs for root-cause work.
  //
  // The cost when a side effect fails: a chase reminder that doesn't auto-clear,
  // an exchange that doesn't get exchangedAt stamped, or a missing Command
  // Centre event log. All are recoverable and visible in logs; none break the
  // user-facing flow.
  //
  // Added 2026-06-07 after the staging deploy 500'd on VM19 confirmations
  // (drawer-fills-then-fails sequence). Throw was inside this side-effect
  // chain; the surgical wraps isolate side effects from the row save.

  // Cast tx to Prisma.TransactionClient when passing to helpers that
  // haven't been widened to accept a full PrismaClient. A standalone
  // PrismaClient structurally satisfies the TransactionClient surface
  // for CRUD ops, so this cast is safe at runtime.
  const txForHelpers = tx as Prisma.TransactionClient | undefined;

  try {
    await unlockDirectDependents(input.transactionId, def.code, txForHelpers);
  } catch (err) {
    console.error("[completeMilestone] unlockDirectDependents failed:", err);
  }

  try {
    await autoCompleteRemindersForMilestone(input.transactionId, def.code, "Milestone completed", txForHelpers);
  } catch (err) {
    console.error("[completeMilestone] autoCompleteRemindersForMilestone failed:", err);
  }

  // Cancel any active ClientChaseState rows for this milestone. Without this,
  // the "chase X of 2" record survives after the milestone completes and the
  // /agent/transactions/[id] "Upcoming (predicted)" list keeps showing ghost
  // chases for a milestone that's already done. Third stale-CCS case after
  // withdrawn-file + old-buyer-round (see scripts/sweep-stale-ccs.ts).
  try {
    await db.clientChaseState.updateMany({
      where: { transactionId: input.transactionId, milestoneCode: def.code, status: "active" },
      data: { status: "cancelled" },
    });
  } catch (err) {
    console.error("[completeMilestone] cancel ClientChaseState failed:", err);
  }

  try {
    await maybeUnlockExchangeGate(input.transactionId, def.side, completedById, txForHelpers);
  } catch (err) {
    console.error("[completeMilestone] maybeUnlockExchangeGate failed:", err);
  }

  // Self-resolve outOfOrderCompletion flags: clear them when their full prereq
  // chain is now satisfied (the agent re-confirmed the missing upstream milestone).
  // Round-scoped: the active round's PMs + vendor file-level. Archived
  // rounds' out-of-order flags stay frozen.
  try {
    const outOfOrderRows = await db.milestoneCompletion.findMany({
      where: {
        transactionId: input.transactionId,
        outOfOrderCompletion: true,
        ...milestoneScopeWhere(scope),
      },
      select: { milestoneDefinitionId: true },
    });
    if (outOfOrderRows.length > 0) {
      const allCurrentCompletions = await db.milestoneCompletion.findMany({
        where: { transactionId: input.transactionId, ...milestoneScopeWhere(scope) },
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
            ...milestoneScopeWhere(scope),
          },
          data: { outOfOrderCompletion: false },
        });
      }
    }
  } catch (err) {
    console.error("[completeMilestone] out-of-order resolution failed:", err);
  }

  touchLastActivity(input.transactionId).catch(() => {});

  // Payments: stamp exchangedAt + (for non-trial files) billedAtExchange + priceAtExchange.
  // Runs inside the same tx as the completion write so the stamp is atomic with the
  // milestone state change. Bilateral-safe: confirmMilestoneAction fires completeMilestone
  // twice for VM19/PM26 (primary + counterpart) on the SAME PropertyTransaction; the
  // helper's NULL-guarded updateMany ensures only the first call writes billedAtExchange.
  // See lib/services/billing-trigger.ts for the full reasoning.
  try {
    await maybeStampExchange(input.transactionId, def.code, txForHelpers);
  } catch (err) {
    console.error("[completeMilestone] maybeStampExchange failed:", err);
  }

  // Chain milestone notifications (fire-and-forget; deduped via OutboundEmailQueue)
  if (def.code === "VM19" || def.code === "PM26") {
    enqueueChainMilestoneNotifications(input.transactionId, "EXCHANGE").catch(console.error);
  } else if (def.code === "VM20" || def.code === "PM27") {
    enqueueChainMilestoneNotifications(input.transactionId, "COMPLETION").catch(console.error);
    maybeEnqueueCelebration(input.transactionId).catch(console.error);
  }

  // Command Centre event log. Fires for EVERY completion (including bilateral
  // counterpart auto-confirms — each side IS a milestone confirmation per DECISION 4).
  // contracts_exchanged / sale_completed are gated to the vendor-side code only to
  // ensure each real-world occurrence emits exactly once across the bilateral pair.
  try {
    await recordEvent({
      type: "milestone_confirmed",
      userId: completedById ?? undefined,
      entityType: "PropertyTransaction",
      entityId: input.transactionId,
      metadata: { code: def.code, side: def.side, confirmedByPortal },
    });
  } catch (err) {
    console.error("[completeMilestone] recordEvent(milestone_confirmed) failed:", err);
  }
  if (def.code === "VM19") {
    try {
      await recordEvent({
        type: "contracts_exchanged",
        userId: completedById ?? undefined,
        entityType: "PropertyTransaction",
        entityId: input.transactionId,
        metadata: { eventDate: input.eventDate?.toISOString() ?? null },
      });
    } catch (err) {
      console.error("[completeMilestone] recordEvent(contracts_exchanged) failed:", err);
    }
  } else if (def.code === "VM20") {
    try {
      await recordEvent({
        type: "sale_completed",
        userId: completedById ?? undefined,
        entityType: "PropertyTransaction",
        entityId: input.transactionId,
        metadata: { eventDate: input.eventDate?.toISOString() ?? null },
      });
    } catch (err) {
      console.error("[completeMilestone] recordEvent(sale_completed) failed:", err);
    }
  }

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

  // Round-scoped throughout: fetched once, reused for prereq guard, the
  // find-by-(tx, def) inside the upsert, and the create-branch stamp.
  const txRowForScope = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { activeBuyerRoundId: true },
  });
  const activeBuyerRoundId = txRowForScope?.activeBuyerRoundId ?? null;
  const scope = forRound(activeBuyerRoundId, transactionId);

  // Prerequisite guard: each milestone's direct prereqs must be complete/NR in the
  // DB or also present in this batch (batch items satisfy each other).
  const batchCodes = new Set(defs.map((d) => d.code));
  for (const def of defs) {
    const prereqCodes = (DIRECT_PREREQUISITES[def.code] ?? []).filter((c) => !batchCodes.has(c));
    if (prereqCodes.length === 0) continue;
    const prereqDefs = await prisma.milestoneDefinition.findMany({
      where: { code: { in: prereqCodes } },
      select: { id: true },
    });
    const satisfied = await prisma.milestoneCompletion.count({
      where: {
        transactionId,
        milestoneDefinitionId: { in: prereqDefs.map((d) => d.id) },
        state: { in: ["complete", "not_required"] },
        ...milestoneScopeWhere(scope),
      },
    });
    if (satisfied < prereqDefs.length) {
      throw new Error(`Prerequisites not complete for milestone ${def.code} — confirm earlier milestones first`);
    }
  }

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

  // Wrapped in $transaction so the find-then-(update|create) sequence
  // for each row is atomic; the partial unique index (purchaser:
  // (buyerRoundId, milestoneDefinitionId); vendor: (transactionId,
  // milestoneDefinitionId) WHERE buyerRoundId IS NULL) catches any
  // concurrent-create race with a P2002 error rather than letting two
  // rows land for the same (tx, def) pair.
  const results = await prisma.$transaction(async (ptx) =>
    Promise.all(
      milestoneDefinitionIds.map(async (defId, i) => {
        const existing = await ptx.milestoneCompletion.findFirst({
          where: { transactionId, milestoneDefinitionId: defId, ...milestoneScopeWhere(scope) },
          select: { id: true },
        });
        if (existing) {
          return ptx.milestoneCompletion.update({
            where: { id: existing.id },
            data: {
              state: "complete",
              completedAt: new Date(baseTime.getTime() + i),
              completedById,
              summaryText: summaryTexts[i],
              notRequiredReason: null,
            },
          });
        }
        const def = defMap.get(defId);
        return ptx.milestoneCompletion.create({
          data: {
            transactionId,
            milestoneDefinitionId: defId,
            state: "complete",
            completedAt: new Date(baseTime.getTime() + i),
            completedById,
            summaryText: summaryTexts[i],
            buyerRoundId: def?.side === "purchaser" ? activeBuyerRoundId : null,
          },
        });
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

  const scope = await getActiveRoundScope(db, transactionId);
  const row = await db.milestoneCompletion.findFirst({
    where: { transactionId, milestoneDefinitionId, ...milestoneScopeWhere(scope) },
    select: { id: true },
  });
  if (!row) {
    throw new Error(`MilestoneCompletion not found for tx=${transactionId} def=${milestoneDefinitionId}`);
  }
  // 2026-07-13 fix (Chunk 2c): also clear reconciledAtExchange and
  // reconciledAtClaim + outOfOrderCompletion. Without this, undoing a
  // milestone that was previously reconciled at exchange or claim left
  // those flags TRUE with state=available. Downstream logic that reads
  // the flag (progress %, phase detection, risk scoring) then behaves
  // as if the milestone was still past-exchange even after the undo.
  await db.milestoneCompletion.update({
    where: { id: row.id },
    data: {
      state: "available",
      completedAt: null,
      completedById: null,
      summaryText: null,
      reconciledAtExchange: false,
      reconciledAtClaim: false,
      outOfOrderCompletion: false,
    },
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
  completedByName: string,
  tx?: Prisma.TransactionClient
) {
  if (milestoneDefinitionIds.length === 0) return;

  const db = tx ?? prisma;

  const defs = await db.milestoneDefinition.findMany({
    where: { id: { in: milestoneDefinitionIds } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(defs.map((d) => [d.id, d.name]));

  // Bulk reverse: find each (tx, def) row and update by id. Behaviour
  // preserved — caller's expectation is that every supplied defId has a
  // corresponding completion row already; an updateMany filtered by
  // milestoneDefinitionId IN (...) AND transactionId would do the same
  // write in a single round-trip, but the parallel find→update style
  // preserves the existing per-row error semantics (throws if a row
  // is missing, which has never been hit because callers compute the
  // list from existing rows). Used by both the undo flow and (in
  // Phase 1 commit 6) the relist action's vendor reset.
  //
  // Round-scoped: forRound's OR picks vendor file-level OR active-round
  // purchaser per def. For relist's vendor reset (commit 6) the
  // milestoneDefinitionIds are VM codes; the OR still works because
  // forRound returns vendor file-level rows alongside the active round.
  const scope = await getActiveRoundScope(db, transactionId);
  await Promise.all(
    milestoneDefinitionIds.map(async (defId) => {
      const row = await db.milestoneCompletion.findFirst({
        where: { transactionId, milestoneDefinitionId: defId, ...milestoneScopeWhere(scope) },
        select: { id: true },
      });
      if (!row) {
        throw new Error(`MilestoneCompletion not found for tx=${transactionId} def=${defId}`);
      }
      // 2026-07-13 fix (Chunk 2c): clear reconciled flags on cascade
      // reversals too - matches the primary reverse path in
      // reverseMilestone. Same reasoning: state=locked with
      // reconciledAtExchange=true would mislead every downstream
      // reader that keys off the flag.
      await db.milestoneCompletion.update({
        where: { id: row.id },
        data: {
          state: "locked",
          completedAt: null,
          completedById: null,
          summaryText: null,
          reconciledAtExchange: false,
          reconciledAtClaim: false,
          outOfOrderCompletion: false,
        },
      });
    })
  );

  await Promise.all(
    milestoneDefinitionIds.map((defId) =>
      db.outboundMessage.create({
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

  // $transaction wraps the find→(update|create) so the read and the
  // write are atomic; partial unique index catches concurrent-create
  // races. Replaces the prior `prisma.milestoneCompletion.upsert` whose
  // compound key (transactionId_milestoneDefinitionId) no longer exists.
  const completion = await prisma.$transaction(async (ptx) => {
    const txRowForScope = await ptx.propertyTransaction.findUnique({
      where: { id: transactionId },
      select: { activeBuyerRoundId: true },
    });
    const activeBuyerRoundId = txRowForScope?.activeBuyerRoundId ?? null;
    const scope = forRound(activeBuyerRoundId, transactionId);
    const existing = await ptx.milestoneCompletion.findFirst({
      where: { transactionId, milestoneDefinitionId, ...milestoneScopeWhere(scope) },
      select: { id: true },
    });
    if (existing) {
      return ptx.milestoneCompletion.update({
        where: { id: existing.id },
        data: {
          state: "not_required",
          completedAt: null,
          summaryText: null,
          completedById,
          notRequiredReason: reason,
        },
      });
    }
    // Round-stamp purchaser-side new rows; vendor stays file-level.
    const newDef = await ptx.milestoneDefinition.findUnique({
      where: { id: milestoneDefinitionId },
      select: { side: true },
    });
    return ptx.milestoneCompletion.create({
      data: {
        transactionId,
        milestoneDefinitionId,
        state: "not_required",
        completedById,
        notRequiredReason: reason,
        buyerRoundId: newDef?.side === "purchaser" ? activeBuyerRoundId : null,
      },
    });
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

  // Re-evaluate reminders synchronously so any active reminder log whose
  // target milestone is this one gets deactivated immediately (its target
  // is now "not_required" — the engine's target-state check at
  // reminders.ts:267-272 handles deactivation). Previously this waited for
  // the next cron pass, which meant N/R'd milestones could leave active
  // reminders visible on the property file for hours.
  await evaluateTransactionReminders(transactionId).catch((err) => {
    console.error(`[markNotRequired] evaluateTransactionReminders failed for ${transactionId}:`, err);
  });

  // Command Centre event log — fires for the primary NR mark only.
  // bulkMarkNotRequired (cascade) intentionally does NOT emit: one user action
  // = one event. Cascade NRs are deterministic consequences of the primary mark.
  await recordEvent({
    type: "milestone_marked_not_required",
    userId: completedById,
    entityType: "PropertyTransaction",
    entityId: transactionId,
    metadata: { code: def?.code, side: def?.side, reason },
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

  await prisma.$transaction(async (ptx) => {
    const txRowForScope = await ptx.propertyTransaction.findUnique({
      where: { id: transactionId },
      select: { activeBuyerRoundId: true },
    });
    const activeBuyerRoundId = txRowForScope?.activeBuyerRoundId ?? null;
    const scope = forRound(activeBuyerRoundId, transactionId);
    const defs = await ptx.milestoneDefinition.findMany({
      where: { id: { in: milestoneDefinitionIds } },
      select: { id: true, side: true },
    });
    const sideMap = new Map(defs.map((d) => [d.id, d.side]));
    // 2026-07-13 fix (Chunk 2d): serialise the writes inside the
    // transaction. Prisma over PgBouncer transaction pooling can
    // interleave parallel operations from Promise.all across backend
    // connections, weakening the isolation the outer $transaction is
    // supposed to give us. A milestone completion created BY ANOTHER
    // PROCESS between the parallel find phase and the parallel update
    // phase gets missed. Sequential guarantees each find→(update|create)
    // observes the state produced by the previous iteration.
    for (const defId of milestoneDefinitionIds) {
      const existing = await ptx.milestoneCompletion.findFirst({
        where: { transactionId, milestoneDefinitionId: defId, ...milestoneScopeWhere(scope) },
        select: { id: true },
      });
      if (existing) {
        await ptx.milestoneCompletion.update({
          where: { id: existing.id },
          data: {
            state: "not_required",
            completedAt: null,
            summaryText: null,
            notRequiredReason: reason,
          },
        });
      } else {
        await ptx.milestoneCompletion.create({
          data: {
            transactionId,
            milestoneDefinitionId: defId,
            state: "not_required",
            completedById,
            notRequiredReason: reason,
            buyerRoundId: sideMap.get(defId) === "purchaser" ? activeBuyerRoundId : null,
          },
        });
      }
    }
  });
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

  const getUndoImpactScope = await getActiveRoundScope(prisma, transactionId);
  const reconciledCompletions = allDownstreamIds.length > 0
    ? await prisma.milestoneCompletion.findMany({
        where: {
          transactionId,
          milestoneDefinitionId: { in: allDownstreamIds },
          reconciledAtExchange: true,
          ...milestoneScopeWhere(getUndoImpactScope),
        },
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
      where: { transactionId, ...milestoneScopeWhere(getUndoImpactScope) },
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

  const undoScope = await getActiveRoundScope(prisma, transactionId);
  const allCompletions = await prisma.milestoneCompletion.findMany({
    where: { transactionId, ...milestoneScopeWhere(undoScope) },
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
    // Reverse primary milestones (target + bilateral partner). Compound
    // upsert key (transactionId_milestoneDefinitionId) was dropped in
    // commit 1 of Phase 1; find-by-(tx, def) + update-by-id matches the
    // single existing row (vendor: file-level; purchaser: active round).
    const primaryRows = await ptx.milestoneCompletion.findMany({
      where: { transactionId, milestoneDefinitionId: { in: primaryIds }, ...milestoneScopeWhere(undoScope) },
      select: { id: true, milestoneDefinitionId: true },
    });
    for (const row of primaryRows) {
      await ptx.milestoneCompletion.update({
        where: { id: row.id },
        data: {
          state: computeNewState(row.milestoneDefinitionId),
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
    const cascadeRows = await ptx.milestoneCompletion.findMany({
      where: { transactionId, milestoneDefinitionId: { in: cascadeIds }, ...milestoneScopeWhere(undoScope) },
      select: { id: true, milestoneDefinitionId: true },
    });
    for (const row of cascadeRows) {
      await ptx.milestoneCompletion.update({
        where: { id: row.id },
        data: {
          state: computeNewState(row.milestoneDefinitionId),
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
        where: { transactionId, milestoneDefinitionId: { in: availableToRelock }, ...milestoneScopeWhere(undoScope) },
        data: { state: "locked" },
      });
    }

    // target_only: flag still-complete downstream with outOfOrderCompletion
    if (mode === "target_only" && cascadeItems.length > 0) {
      await ptx.milestoneCompletion.updateMany({
        where: { transactionId, milestoneDefinitionId: { in: cascadeItems.map((m) => m.id) }, ...milestoneScopeWhere(undoScope) },
        data: { outOfOrderCompletion: true },
      });
    }

    // Re-evaluate exchange gate (re-lock if a blocker was undone)
    for (const side of affectedSides) {
      await maybeLockExchangeGate(transactionId, side, ptx);
    }

    // Cancel active reminder logs + pending chase tasks where EITHER the
    // rule's target OR its anchor is one of the reversed codes.
    //
    // Target-side: the reminder was chasing the agent to mark this step
    // done; the step is now un-done so the row is moot.
    //
    // Anchor-side: the reminder was created because its anchor step had
    // been completed (anchor.completedAt + graceDays = first chase). The
    // anchor is now un-done, so the schedule origin no longer exists. If
    // we leave the log active, it shows in the work queue as a "due now"
    // row the agent can't legitimately action until the anchor is re-done.
    // The daily 04:00 engine run does deactivate it eventually with reason
    // "Anchor milestone not yet confirmed", but that's a several-hour
    // window of confusing rows. Closing it synchronously here removes the
    // gap.
    //
    // The next engine run will recreate the log fresh if/when the anchor
    // is confirmed again — log creation is idempotent on (transactionId,
    // reminderRuleId).
    const logs = await ptx.reminderLog.findMany({
      where: {
        transactionId,
        status: "active",
        OR: [
          { reminderRule: { targetMilestoneCode: { in: cancelReminderCodes } } },
          { reminderRule: { anchorMilestone: { code: { in: cancelReminderCodes } } } },
        ],
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
          content: `${completedByName} undid "${defName}".${modeNote}`,
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
            content: `"${item.name}" reset — cascaded from ${completedByName}'s undo of "${targetDef.name}".`,
            createdById: completedById,
          },
        });
      }
    }

    // Payments: reverse the exchange stamp / write a CreditNote if invoice issued.
    // Fires for every reversed milestone code; the helper short-circuits for
    // non-VM19/PM26 codes. Bilateral-safe: VM19+PM26 both fire here in the same
    // ptx, second call is a no-op via the helper's NULL guard (branch a) or
    // existing-credit lookup (branch b). See lib/services/billing-reversal.ts.
    for (const defId of allReverseIds) {
      const code = idToCode.get(defId);
      if (code) await handleExchangeReversal(transactionId, code, ptx);
    }
  });

  touchLastActivity(transactionId).catch(() => {});

  // Command Centre event log — one event per user undo action. Bilateral partner
  // + cascade are downstream effects of the single user action; they don't emit.
  await recordEvent({
    type: "milestone_reversed",
    userId: completedById,
    entityType: "PropertyTransaction",
    entityId: transactionId,
    metadata: { code: targetDef.code, side: targetDef.side, mode },
  });
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
  // ── Reads (before transaction to avoid holding the connection open) ─────────
  const def = await prisma.milestoneDefinition.findUnique({
    where: { id: input.milestoneDefinitionId },
    select: { code: true, side: true },
  });

  let nrCascadedIds: string[] = [];
  if (def?.code && NR_CASCADE[def.code]) {
    const cascadeCodes = NR_CASCADE[def.code];
    const cascadeDefs = await prisma.milestoneDefinition.findMany({
      where: { code: { in: cascadeCodes } },
      select: { id: true },
    });
    const nrCascadedScope = await getActiveRoundScope(prisma, input.transactionId);
    const nrCascaded = await prisma.milestoneCompletion.findMany({
      where: {
        transactionId: input.transactionId,
        milestoneDefinitionId: { in: cascadeDefs.map((d) => d.id) },
        state: "not_required",
        ...milestoneScopeWhere(nrCascadedScope),
      },
      select: { milestoneDefinitionId: true },
    });
    nrCascadedIds = nrCascaded.map((c) => c.milestoneDefinitionId);
  }

  // ── All writes in a single atomic transaction ─────────────────────────────
  await prisma.$transaction(async (tx) => {
    if (nrCascadedIds.length > 0) {
      await bulkReverseMilestones(nrCascadedIds, input.transactionId, input.completedById, input.completedByName, tx);
    }

    if (input.newPurchaseType) {
      await tx.propertyTransaction.update({
        where: { id: input.transactionId },
        data: { purchaseType: input.newPurchaseType },
      });
    }

    if (input.downstreamIds && input.downstreamIds.length > 0) {
      await bulkReverseMilestones(input.downstreamIds, input.transactionId, input.completedById, input.completedByName, tx);
    }

    await reverseMilestone(input.transactionId, input.milestoneDefinitionId, input.completedById, input.completedByName, input.reason, tx);

    if (def?.side) {
      await maybeLockExchangeGate(input.transactionId, def.side, tx);
    }

    // Cancel reminders affected by this reverse, same scheme as
    // executeUndoMilestone: any active log whose rule TARGETS or
    // ANCHORS on a reversed milestone gets closed out synchronously
    // so the work queue doesn't show rows waiting on conditions that
    // no longer hold. The daily 04:00 engine run would catch the
    // anchor side eventually, but it leaves a several-hour window of
    // stale rows. Recreation is idempotent on (transactionId,
    // reminderRuleId) so if the milestone is later re-confirmed, the
    // engine spins up a fresh log.
    const reversedIds = [
      input.milestoneDefinitionId,
      ...nrCascadedIds,
      ...(input.downstreamIds ?? []),
    ];
    const reversedDefs = await tx.milestoneDefinition.findMany({
      where: { id: { in: reversedIds } },
      select: { code: true },
    });
    const reversedCodes = reversedDefs.map((d) => d.code);
    if (reversedCodes.length > 0) {
      const logs = await tx.reminderLog.findMany({
        where: {
          transactionId: input.transactionId,
          status: "active",
          OR: [
            { reminderRule: { targetMilestoneCode: { in: reversedCodes } } },
            { reminderRule: { anchorMilestone: { code: { in: reversedCodes } } } },
          ],
        },
        select: { id: true },
      });
      if (logs.length > 0) {
        const logIds = logs.map((l) => l.id);
        await tx.chaseTask.updateMany({
          where: { reminderLogId: { in: logIds }, status: "pending" },
          data: { status: "cancelled" },
        });
        await tx.reminderLog.updateMany({
          where: { id: { in: logIds } },
          data: { status: "cancelled", statusReason: "Milestone reversed" },
        });
      }
    }
  });

  // Command Centre event log — one event per user undo action. The cascade and
  // bilateral helpers above are downstream effects of the single user action
  // and intentionally don't emit on their own.
  await recordEvent({
    type: "milestone_reversed",
    userId: input.completedById,
    entityType: "PropertyTransaction",
    entityId: input.transactionId,
    metadata: { code: def?.code, side: def?.side, viaCascade: true },
  });
}
