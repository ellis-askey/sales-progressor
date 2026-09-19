// A file's position along the six conveyancing stages, as a thin six-segment
// bar. Stages before the current one read done (green), the current one reads
// live (coral), the rest pending. Fed by the same board stage the Pipeline
// view places the file at, so the bar and the board never disagree. See
// lib/milestones/display-stages.ts.

import { DISPLAY_STAGES, type DisplayStageKey } from "@/lib/milestones/display-stages";

export function JourneyBar({ stage }: { stage: DisplayStageKey }) {
  const idx = DISPLAY_STAGES.findIndex((s) => s.key === stage);
  const name = DISPLAY_STAGES[idx]?.name ?? "";
  return (
    <span className="jbar" title={`Stage: ${name}`} aria-label={`Stage: ${name}`}>
      {DISPLAY_STAGES.map((s, i) => (
        <span key={s.key} className={`jbar-seg${i < idx ? " done" : i === idx ? " cur" : ""}`} aria-hidden />
      ))}
    </span>
  );
}
