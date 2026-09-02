// Chase email overrides — the store behind "edit / skip the upcoming chase"
// from the Chase timeline (chase-consolidation D2/D3, 2026-09).
//
// One ChaseEmailOverride row per (file, chase target, milestone). The agent
// sets it from the timeline; the client + solicitor cron builds read it at fire
// time via getChaseOverridesForBuild():
//   - skipNext  → the builder drops that step from the next chase and advances
//     the clock without counting (skip-semantics A: one occurrence, cadence
//     resumes), then consumes the skip (consumeSkip).
//   - subject/body → the builder sends the edited copy instead of the generated
//     copy. Persistent until the agent changes/clears it.
//
// Dormant until an override exists: with no rows, getChaseOverridesForBuild
// returns an empty map and both builders behave exactly as before.
//
// See docs/active/chase-consolidation/00-spec.md.

import { prisma } from "@/lib/prisma";

export type ChaseOverrideTarget =
  | { kind: "client"; contactId: string }
  | { kind: "solicitor"; side: "vendor" | "purchaser" };

// The stable per-target discriminator stored on the row.
export function targetKeyFor(t: ChaseOverrideTarget): string {
  return t.kind === "client" ? `contact:${t.contactId}` : `sol:${t.side}`;
}

export type BuildOverride = {
  subjectOverride: string | null;
  bodyOverride: string | null;
  skipNext: boolean;
};

// Build-time read: every override for a file, keyed `${targetKey}|${code}`.
// Both crons load this once per file and look up per (target, milestone).
export async function getChaseOverridesForBuild(
  transactionId: string,
): Promise<Map<string, BuildOverride>> {
  const rows = await prisma.chaseEmailOverride.findMany({
    where: { transactionId },
    select: { targetKey: true, milestoneCode: true, subjectOverride: true, bodyOverride: true, skipNext: true },
  });
  const map = new Map<string, BuildOverride>();
  for (const r of rows) {
    map.set(`${r.targetKey}|${r.milestoneCode}`, {
      subjectOverride: r.subjectOverride,
      bodyOverride: r.bodyOverride,
      skipNext: r.skipNext,
    });
  }
  return map;
}

// One-shot skip consumed at fire time (skip-semantics A). Clears skipNext but
// keeps any subject/body edit. The builder advances the chase clock separately
// so the next chase lands one repeat-interval later, not immediately.
export async function consumeSkip(
  transactionId: string,
  targetKey: string,
  milestoneCode: string,
): Promise<void> {
  await prisma.chaseEmailOverride.updateMany({
    where: { transactionId, targetKey, milestoneCode, skipNext: true },
    data: { skipNext: false },
  });
}

// ── Timeline UI (Phase 5) read/write ─────────────────────────────────────────

export type ChaseOverrideRow = {
  targetKey: string;
  milestoneCode: string;
  subjectOverride: string | null;
  bodyOverride: string | null;
  skipNext: boolean;
  editedById: string | null;
  updatedAt: Date;
};

// All overrides for a file, for the timeline to reflect current edits/skips.
export async function getChaseOverridesForTimeline(
  transactionId: string,
): Promise<ChaseOverrideRow[]> {
  return prisma.chaseEmailOverride.findMany({
    where: { transactionId },
    select: {
      targetKey: true, milestoneCode: true, subjectOverride: true,
      bodyOverride: true, skipNext: true, editedById: true, updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}

// Upsert an override from the timeline. Passing a field leaves it; passing
// null on subject/body clears that edit. skipNext toggles the one-shot skip.
export async function setChaseOverride(args: {
  transactionId: string;
  target: ChaseOverrideTarget;
  milestoneCode: string;
  subjectOverride?: string | null;
  bodyOverride?: string | null;
  skipNext?: boolean;
  editedById: string;
}): Promise<void> {
  const targetKey = targetKeyFor(args.target);
  const recipientKind = args.target.kind;
  await prisma.chaseEmailOverride.upsert({
    where: {
      transactionId_targetKey_milestoneCode: {
        transactionId: args.transactionId,
        targetKey,
        milestoneCode: args.milestoneCode,
      },
    },
    create: {
      transactionId: args.transactionId,
      recipientKind,
      targetKey,
      milestoneCode: args.milestoneCode,
      subjectOverride: args.subjectOverride ?? null,
      bodyOverride: args.bodyOverride ?? null,
      skipNext: args.skipNext ?? false,
      editedById: args.editedById,
    },
    update: {
      ...(args.subjectOverride !== undefined ? { subjectOverride: args.subjectOverride } : {}),
      ...(args.bodyOverride !== undefined ? { bodyOverride: args.bodyOverride } : {}),
      ...(args.skipNext !== undefined ? { skipNext: args.skipNext } : {}),
      editedById: args.editedById,
    },
  });
}

// Remove an override entirely (revert to the generated copy + no skip).
export async function clearChaseOverride(
  transactionId: string,
  target: ChaseOverrideTarget,
  milestoneCode: string,
): Promise<void> {
  await prisma.chaseEmailOverride.deleteMany({
    where: { transactionId, targetKey: targetKeyFor(target), milestoneCode },
  });
}
