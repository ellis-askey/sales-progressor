"use client";

// Agent-demo hero controls: Replay walkthrough (primary) + Start over (secondary),
// shown in the hero's top gap above the status. Replay restarts the guided tour;
// Start over wipes the sandbox and re-enters the launcher for a fresh file.
// Canonical flat buttons (.agent-canon-cta). Agent demo only.

import { DEMO_TOUR_EVENTS } from "@/components/transaction/demo-tour/types";

export function AgentDemoHeroControls() {
  function replay() {
    try { window.dispatchEvent(new Event(DEMO_TOUR_EVENTS.start)); } catch { /* no-op */ }
  }
  return (
    <div className="agent-canon-cta" style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button" onClick={replay} className="agent-btn agent-btn-sm agent-btn-primary">
        Replay walkthrough
      </button>
      <a href="/agent-demo/restart" className="agent-btn agent-btn-sm agent-btn-secondary">
        Start over
      </a>
    </div>
  );
}
