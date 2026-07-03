// Overview restyle 2026-07-03 — groups the 47 milestone codes into the
// 6 display stages shown on the MilestoneTimelineStrip. The strip is a
// summary read for the Overview tab; the Steps tab still lists every
// underlying milestone.
//
// Design principles:
//   - Each stage has ONE anchor milestone code. Stage is "complete"
//     when the anchor is complete. This keeps the summary honest — a
//     stage is done when the observable-to-the-agent milestone is
//     done, not when every underlying code has ticked.
//   - Only the first non-complete stage is "active"; every subsequent
//     stage is "pending". Never more than one active at a time.
//   - Forecast dates come from tx-level fields (expectedExchangeDate /
//     overridePredictedDate / completionDate), not from the milestone
//     engine.
//
// Anchor rationale (per docs/MILESTONES_SPEC_v1.md):
//   - Instructed = VM1 (seller has instructed their solicitor). Both
//     sides typically instruct on/near day 1 so this is the earliest
//     observable milestone.
//   - Draft pack = VM7 (seller's solicitor issued the draft contract
//     pack). This is the milestone that unblocks the buyer side.
//   - Searches  = PM8 (buyer's solicitor ordered searches). Once
//     ordered, the wait shifts to the search authority. PM13 (received)
//     could be an alternative but PM8 fires earlier and marks entry to
//     the stage.
//   - Enquiries = PM14 (buyer's solicitor raised initial enquiries).
//     Fires once enquiries are in the seller's court.
//   - Exchange  = VM19 (seller received exchange confirmation). Both
//     sides fire on the same event; using VM19 keeps the anchor on the
//     vendor timeline (mirrors the Steps tab convention).
//   - Completion = VM20 (seller received completion confirmation).

// Icons are NOT stored here so this module stays server-serializable.
// Passing a React component from a Server Component to a Client
// Component fails at render (2026-07-03 outage). The client-side strip
// looks up the icon from its own map keyed by DisplayStageKey.

export type DisplayStageKey = "instructed" | "draft_pack" | "searches" | "enquiries" | "exchange" | "completion";

export type DisplayStageDef = {
  key: DisplayStageKey;
  name: string;
  anchorCode: string;
};

export const DISPLAY_STAGES: DisplayStageDef[] = [
  { key: "instructed", name: "Instructed", anchorCode: "VM1"  },
  { key: "draft_pack", name: "Draft pack", anchorCode: "VM7"  },
  { key: "searches",   name: "Searches",   anchorCode: "PM8"  },
  { key: "enquiries",  name: "Enquiries",  anchorCode: "PM14" },
  { key: "exchange",   name: "Exchange",   anchorCode: "VM19" },
  { key: "completion", name: "Completion", anchorCode: "VM20" },
];

export type MilestoneRowForStages = {
  code: string;
  isComplete: boolean;
  completion?: { completedAt: Date | null } | null;
};

export type ResolvedStage = {
  key: DisplayStageKey;
  name: string;
  status: "complete" | "active" | "pending";
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
 * forecast dates. The first non-complete stage is marked active; the rest
 * are pending. Uses vendor + purchaser milestones combined so an anchor on
 * either side flips complete when hit.
 */
export function resolveDisplayStages(
  milestones: MilestoneRowForStages[],
  forecast: ForecastInputs,
): ResolvedStage[] {
  const byCode = new Map<string, MilestoneRowForStages>();
  for (const m of milestones) byCode.set(m.code, m);

  const rows = DISPLAY_STAGES.map((def) => {
    const m = byCode.get(def.anchorCode);
    const isComplete = !!m?.isComplete;
    const completedAt = m?.completion?.completedAt ?? null;

    let forecastDate: Date | null = null;
    if (def.key === "exchange") {
      forecastDate = forecast.overridePredictedDate ?? forecast.expectedExchangeDate ?? null;
    } else if (def.key === "completion") {
      forecastDate = forecast.targetCompletionDate ?? null;
    }

    return {
      def,
      isComplete,
      completedAt,
      forecastDate,
    };
  });

  // Active = first non-complete stage; every stage after is pending.
  let activeIndex = rows.findIndex((r) => !r.isComplete);
  if (activeIndex === -1) activeIndex = rows.length; // everything done

  return rows.map((r, i) => ({
    key: r.def.key,
    name: r.def.name,
    status: r.isComplete ? "complete" : i === activeIndex ? "active" : "pending",
    completedAt: r.completedAt,
    forecastDate: r.forecastDate,
  }));
}
