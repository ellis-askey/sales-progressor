// A file's position along the six conveyancing stages, labelled so it's
// readable at a glance: the current stage name + "N of 6" above a six-segment
// bar (done = green, current = coral). Hovering the bar reveals the full
// journey (see JourneyHover in TransactionRowView). Fed by the file's board
// stage (the same engine as the Pipeline view). See display-stages.ts.

import { DISPLAY_STAGES, type DisplayStageKey } from "@/lib/milestones/display-stages";

export function JourneyBar({ stage, complete }: { stage: DisplayStageKey; complete?: boolean }) {
  const idx = DISPLAY_STAGES.findIndex((s) => s.key === stage);
  const name = DISPLAY_STAGES[idx]?.name ?? "";
  const total = DISPLAY_STAGES.length;
  return (
    <span className="jrn">
      <span className="jrn-top">
        <span className="jrn-stage">{name}</span>
        <span className="jrn-count tabnum">{idx + 1} of {total}</span>
      </span>
      <span className="jrn-bar">
        {DISPLAY_STAGES.map((s, i) => (
          // complete = the whole journey is done, so every segment is green.
          <span key={s.key} className={`jrn-seg${complete || i < idx ? " done" : i === idx ? " cur" : ""}`} aria-hidden />
        ))}
      </span>
    </span>
  );
}
