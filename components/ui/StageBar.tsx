// Canonical conveyancing-stage bar — the current stage name + "N of 6" above a
// segmented bar (done = green, current = coral, upcoming = neutral). The
// `reached` variant renders the withdrawn "how far it got" look (faded fill,
// muted label). Renders the shipped .jrn-* classes so the per-context width
// overrides (.files-row-card / .files-stagecell) still apply. Extracted from
// JourneyBar + TransactionRowView's ReachedCell at the 2026-11-23 All Files pass.

import { DISPLAY_STAGES, type DisplayStageKey } from "@/lib/milestones/display-stages";

export function StageBar({
  stage,
  complete = false,
  reached = false,
}: {
  stage: DisplayStageKey;
  /** Whole journey done — every segment green. */
  complete?: boolean;
  /** Withdrawn "reached" look — faded fill up to the furthest stage, muted label. */
  reached?: boolean;
}) {
  const idx = DISPLAY_STAGES.findIndex((s) => s.key === stage);
  const name = DISPLAY_STAGES[idx]?.name ?? "";
  const total = DISPLAY_STAGES.length;
  return (
    <span className={`jrn${reached ? " jrn-reached" : ""}`}>
      <span className="jrn-top">
        <span className="jrn-stage">{name}</span>
        <span className="jrn-count tabnum">{idx + 1} of {total}</span>
      </span>
      <span className="jrn-bar">
        {DISPLAY_STAGES.map((s, i) => {
          const cls = reached
            ? (i <= idx ? " reached" : "")
            : (complete || i < idx ? " done" : i === idx ? " cur" : "");
          return <span key={s.key} className={`jrn-seg${cls}`} aria-hidden />;
        })}
      </span>
    </span>
  );
}
