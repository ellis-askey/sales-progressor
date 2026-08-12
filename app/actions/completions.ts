"use server";

// Quick-confirm "Mark completed" for the /agent/completions page.
//
// Reuses the EXACT mechanism the milestone row's reconciliation drawer uses —
// no new business logic. It sweeps any earlier un-ticked steps closed, confirms
// completion (VM20, which auto-completes its bilateral partner PM27), syncs the
// completion date, flips the file to "completed", and fires the usual
// completion notifications. Scope is re-derived from the session inside those
// actions, so this is permission-safe.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getExchangeReconciliationList, confirmExchangeReconciliationAction } from "@/app/actions/milestones";

export type CompleteFileResult = { ok: true } | { ok: false; error: string };

export async function completeFileAction(transactionId: string, dateStr: string): Promise<CompleteFileResult> {
  if (!dateStr) return { ok: false, error: "Pick a completion date first." };

  const def = await prisma.milestoneDefinition.findFirst({ where: { code: "VM20" }, select: { id: true } });
  if (!def) return { ok: false, error: "Completion milestone not found." };

  try {
    // Any earlier steps still un-ticked get tied off (dated null — we don't
    // invent dates for steps we don't have; completion itself is dated).
    const { outstanding } = await getExchangeReconciliationList({ transactionId, milestoneDefinitionId: def.id });
    const outstandingIds = outstanding.map((o) => o.id);

    await confirmExchangeReconciliationAction({
      transactionId,
      milestoneDefinitionId: def.id,
      eventDate: dateStr,
      outstandingIds,
      outstandingDates: {},
    });
    revalidatePath("/agent/completions");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Could not complete this file.";
    // Don't leak internals to the UI.
    return { ok: false, error: msg.includes("not found") ? "You don't have access to this file." : "Could not complete this file. Try again." };
  }
}
