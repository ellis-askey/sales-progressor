"use client";

// A persistent "Demo sale" pill on a demo showcase file, alongside a "Replay
// walkthrough" trigger that (re)starts the guided tour. The tour is the
// first-run intro (auto-starts once per teammate, mounted by DemoTourMount), so
// this just keeps the demo clearly labelled and offers a way back in.
// See lib/services/demo-sale.ts and docs/DEMO_SALE_GUIDED_EXPERIENCE_PLAN.md.

import { Play } from "@phosphor-icons/react";
import { Pill } from "@/components/ui/Pill";
import { DEMO_TOUR_EVENTS } from "@/components/transaction/demo-tour/types";

export function DemoFileMarker({ transactionId: _transactionId }: { transactionId: string }) {
  function replay() {
    try { window.dispatchEvent(new Event(DEMO_TOUR_EVENTS.start)); } catch { /* no-op */ }
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
      <style>{`
        .demo-replay-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 6px 13px; border-radius: 10px;
          font-size: 12.5px; font-weight: 600;
          color: var(--agent-coral-deep);
          background: rgba(var(--agent-coral-rgb), 0.08);
          border: 1px solid rgba(var(--agent-coral-rgb), 0.30);
          cursor: pointer;
          transition: background 160ms ease, border-color 160ms ease, transform 120ms ease, box-shadow 160ms ease;
        }
        .demo-replay-btn:hover {
          background: rgba(var(--agent-coral-rgb), 0.16);
          border-color: rgba(var(--agent-coral-rgb), 0.48);
          box-shadow: 0 3px 12px rgba(var(--agent-coral-rgb), 0.20);
        }
        .demo-replay-btn:active { transform: scale(0.97); }
        .demo-replay-btn:focus-visible { outline: 2px solid var(--agent-coral); outline-offset: 2px; }
        .demo-replay-btn svg { transition: transform 160ms ease; }
        .demo-replay-btn:hover svg { transform: translateX(1px); }
        @media (prefers-reduced-motion: reduce) {
          .demo-replay-btn, .demo-replay-btn svg { transition: none; }
          .demo-replay-btn:active { transform: none; }
        }
      `}</style>

      <Pill tone="brand" glass dot>Demo sale</Pill>

      <button type="button" onClick={replay} className="demo-replay-btn">
        <Play size={13} weight="fill" aria-hidden />
        Replay walkthrough
      </button>
    </div>
  );
}
