// All Files → Pipeline board. Places each file in its live conveyancing
// stage (the six DISPLAY_STAGES) so the board reads as a map of the whole
// book. Derived truth: the stage comes straight from the milestone engine
// via resolveDisplayStages — the same resolver that powers the file-page
// journey strip — so there is no new state to keep in sync. See
// lib/milestones/display-stages.ts.

import { prisma } from "@/lib/prisma";
import { roundScopedOR, loadActiveRoundIds } from "@/lib/services/round-scope";
import {
  resolveDisplayStages,
  currentBoardStage,
  type DisplayStageKey,
  type MilestoneRowForStages,
} from "@/lib/milestones/display-stages";

// Only the codes that bound a display stage matter for placement — entry +
// exit codes across the six stages (see DISPLAY_STAGES). Querying just these
// keeps the board scan light even across a full book.
const STAGE_CODES = [
  "VM1", "PM1",   // instructed
  "VM7", "PM7",   // draft pack
  "PM8", "PM13",  // searches
  "PM14", "PM20", // enquiries
  "VM18", "PM25", "VM19", // exchange
  "VM20",         // completion
] as const;

// Map of transactionId → the board column it currently sits in. Round-scoped
// to the active buyer round (a relisted file's archived-round completions
// don't drag it forward) exactly as listTransactions / work-queue do.
export async function getPipelineStageMap(
  txIds: string[],
): Promise<Map<string, DisplayStageKey>> {
  if (txIds.length === 0) return new Map();

  const activeRoundIds = await loadActiveRoundIds({ id: { in: txIds } });

  const rows = await prisma.milestoneCompletion.findMany({
    where: {
      transactionId: { in: txIds },
      milestoneDefinition: { code: { in: [...STAGE_CODES] } },
      // complete drives placement; not_required lets a skipped stage settle
      // rather than pin the file back. Other states (locked/available) are
      // irrelevant to stage resolution, so don't fetch them.
      state: { in: ["complete", "not_required"] },
      OR: roundScopedOR(activeRoundIds),
    },
    select: {
      transactionId: true,
      state: true,
      milestoneDefinition: { select: { code: true } },
    },
  });

  const byTx = new Map<string, MilestoneRowForStages[]>();
  for (const r of rows) {
    const list = byTx.get(r.transactionId) ?? [];
    list.push({
      code: r.milestoneDefinition.code,
      isComplete: r.state === "complete",
      isNotRequired: r.state === "not_required",
    });
    byTx.set(r.transactionId, list);
  }

  // Forecast dates don't affect placement (only the strip's date labels), so
  // pass empties — currentBoardStage reads status alone.
  const emptyForecast = {
    expectedExchangeDate: null,
    overridePredictedDate: null,
    targetCompletionDate: null,
  };

  const out = new Map<string, DisplayStageKey>();
  for (const id of txIds) {
    const resolved = resolveDisplayStages(byTx.get(id) ?? [], emptyForecast);
    out.set(id, currentBoardStage(resolved));
  }
  return out;
}
