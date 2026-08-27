// Overview restyle 2026-07-03 — groups the 47 milestone codes into the
// 6 display stages shown on the MilestoneTimelineStrip. The strip is a
// summary read for the Overview tab; the Steps tab still lists every
// underlying milestone.
//
// 2026-08-11 honesty rework (file-page feedback, item 3). The original
// model gave each stage ONE anchor and ticked the stage when the anchor
// fired — but the anchors were ENTRY events (enquiries raised, searches
// ordered), so a stage ticked the moment it began and the strip ran one
// stage ahead of reality ("Exchange in progress" while enquiries were
// still being answered).
//
// New model — each stage has entry codes and exit codes:
//   - complete     → every exit code is complete
//   - in_progress  → any entry code fired, exits not all complete.
//     SEVERAL stages can be in progress at once, because conveyancing is
//     parallel: searches awaited while enquiries are raised and answered
//     is normal (and best practice). The strip shows that honestly.
//   - up_next      → nothing is in progress anywhere and this is the
//     earliest non-complete stage (the file is between stages).
//   - pending      → everything else.
//
// Stage boundaries (per docs/MILESTONES_SPEC_v1.md codes):
//   - Instructed  = begins when either side instructs (VM1 / PM1),
//                   done when BOTH have.
//   - Draft pack  = begins when the seller's solicitor issues it (VM7),
//                   done when the buyer's solicitor has it (PM7).
//   - Searches    = begins at ordering (PM8), done when results are
//                   back with the buyer's solicitor (PM13).
//   - Enquiries   = begins when initial enquiries are raised (PM14),
//                   done when the buyer's solicitor confirms ALL
//                   enquiries satisfied (PM20, covers follow-up rounds).
//   - Exchange    = begins when either solicitor confirms readiness
//                   (VM18 / PM25), done on exchange (VM19).
//   - Completion  = the completion event itself (VM20).
//
// Forecast dates come from tx-level fields (expectedExchangeDate /
// overridePredictedDate / completionDate), not from the milestone
// engine.

// Icons are NOT stored here so this module stays server-serializable.
// Passing a React component from a Server Component to a Client
// Component fails at render (2026-07-03 outage). The client-side strip
// looks up the icon from its own map keyed by DisplayStageKey.

export type DisplayStageKey = "instructed" | "draft_pack" | "searches" | "enquiries" | "exchange" | "completion";

export type DisplayStageDef = {
  key: DisplayStageKey;
  name: string;
  /** Stage has begun when ANY of these codes is complete. */
  entryCodes: string[];
  /** Stage is done when ALL of these codes are complete. */
  exitCodes: string[];
};

export const DISPLAY_STAGES: DisplayStageDef[] = [
  { key: "instructed", name: "Instructed", entryCodes: ["VM1", "PM1"],   exitCodes: ["VM1", "PM1"] },
  { key: "draft_pack", name: "Draft pack", entryCodes: ["VM7"],          exitCodes: ["PM7"]  },
  { key: "searches",   name: "Searches",   entryCodes: ["PM8"],          exitCodes: ["PM13"] },
  { key: "enquiries",  name: "Enquiries",  entryCodes: ["PM14"],         exitCodes: ["PM20"] },
  { key: "exchange",   name: "Exchange",   entryCodes: ["VM18", "PM25"], exitCodes: ["VM19"] },
  { key: "completion", name: "Completion", entryCodes: ["VM20"],         exitCodes: ["VM20"] },
];

export type MilestoneRowForStages = {
  code: string;
  isComplete: boolean;
  // 2026-08-27 (Note C): a step marked "not required" (skipped). The resolver
  // treats a stage's exit as settled when every exit code is complete OR
  // not_required, so a skipped stage stops pinning the file to "Up next".
  isNotRequired?: boolean;
  completion?: { completedAt: Date | null } | null;
};

// "skipped" — the stage's exit was reached by skipping (not_required), not by
// genuine completion. Rendered muted/struck on the strip; the real next stage
// takes "up_next".
export type StageStatus = "complete" | "skipped" | "in_progress" | "up_next" | "pending";

export type ResolvedStage = {
  key: DisplayStageKey;
  name: string;
  status: StageStatus;
  completedAt: Date | null;
  forecastDate: Date | null;
};

export type ForecastInputs = {
  expectedExchangeDate: Date | null;
  overridePredictedDate: Date | null;
  targetCompletionDate: Date | null;
};

/**
 * Resolve each display stage against the current milestone state + tx-level
 * forecast dates. Statuses are per-stage and independent (see module
 * header): more than one stage can be in_progress at once; up_next only
 * appears when nothing anywhere is in progress.
 */
export function resolveDisplayStages(
  milestones: MilestoneRowForStages[],
  forecast: ForecastInputs,
): ResolvedStage[] {
  const byCode = new Map<string, MilestoneRowForStages>();
  for (const m of milestones) byCode.set(m.code, m);

  const isCodeComplete = (code: string) => !!byCode.get(code)?.isComplete;
  const isCodeNotRequired = (code: string) => !!byCode.get(code)?.isNotRequired;
  // A code no longer blocks its stage once it's either genuinely complete or
  // marked not-required (skipped).
  const isCodeSettled = (code: string) => isCodeComplete(code) || isCodeNotRequired(code);
  const completedAtOf = (code: string) => byCode.get(code)?.completion?.completedAt ?? null;

  const rows = DISPLAY_STAGES.map((def) => {
    const isComplete = def.exitCodes.every(isCodeComplete);
    // Settled = every exit code is complete OR skipped. A stage that's settled
    // but not fully complete was skipped (at least one exit was not_required).
    const isSettled = def.exitCodes.every(isCodeSettled);
    const isSkipped = isSettled && !isComplete;
    // "Begun" only counts genuine completion of an entry code — a skipped entry
    // never lights the stage up as in-progress (it settles instead).
    const hasBegun = def.entryCodes.some(isCodeComplete);

    // completedAt = the LATEST exit completion (multi-exit stages finish
    // when the last code lands).
    let completedAt: Date | null = null;
    if (isComplete) {
      for (const code of def.exitCodes) {
        const at = completedAtOf(code);
        if (at && (!completedAt || at > completedAt)) completedAt = at;
      }
    }

    let forecastDate: Date | null = null;
    if (def.key === "exchange") {
      forecastDate = forecast.overridePredictedDate ?? forecast.expectedExchangeDate ?? null;
    } else if (def.key === "completion") {
      forecastDate = forecast.targetCompletionDate ?? null;
    }

    return { def, isComplete, isSettled, isSkipped, hasBegun, completedAt, forecastDate };
  });

  // A skipped stage is settled, so it neither blocks "up_next" nor counts as
  // in-progress — the file advances to the real next stage.
  const anyInProgress = rows.some((r) => !r.isSettled && r.hasBegun);
  const firstNotSettled = rows.findIndex((r) => !r.isSettled);

  return rows.map((r, i) => {
    let status: StageStatus;
    if (r.isComplete) {
      status = "complete";
    } else if (r.isSkipped) {
      status = "skipped";
    } else if (r.hasBegun) {
      status = "in_progress";
    } else if (!anyInProgress && i === firstNotSettled) {
      status = "up_next";
    } else {
      status = "pending";
    }
    return {
      key: r.def.key,
      name: r.def.name,
      status,
      completedAt: r.completedAt,
      forecastDate: r.forecastDate,
    };
  });
}
