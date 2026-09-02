"use client";

// A subtle, persistent "Demo sale" pill on a demo showcase file, alongside a
// "Replay walkthrough" trigger that (re)starts the guided tour. The tour itself
// is the first-run intro (it auto-starts once per teammate, decided server-side
// and mounted by DemoTourMount), so this component no longer pops its own
// sample-data explainer — it just keeps the demo clearly labelled and gives an
// always-available way back into the walkthrough.
// See lib/services/demo-sale.ts and docs/DEMO_SALE_GUIDED_EXPERIENCE_PLAN.md.

import { Sparkle, Play } from "@phosphor-icons/react";
import { DEMO_TOUR_EVENTS } from "@/components/transaction/demo-tour/types";

export function DemoFileMarker({ transactionId: _transactionId }: { transactionId: string }) {
  function replay() {
    try { window.dispatchEvent(new Event(DEMO_TOUR_EVENTS.start)); } catch { /* no-op */ }
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
      <span
        style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "5px 12px", borderRadius: 999,
          fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
          color: "var(--agent-coral-deep)",
          background: "rgba(var(--agent-coral-rgb), 0.12)",
          border: "1px solid rgba(var(--agent-coral-rgb), 0.28)",
        }}
      >
        <Sparkle size={13} weight="fill" />
        Demo sale
      </span>
      <button
        onClick={replay}
        className="agent-btn agent-btn-ghost"
        style={{ fontSize: 12.5, fontWeight: 600, padding: "5px 10px", gap: 6 }}
      >
        <Play size={13} weight="fill" aria-hidden />
        Replay walkthrough
      </button>
    </div>
  );
}
