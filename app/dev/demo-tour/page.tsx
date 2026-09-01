"use client";

// Dev harness for the demo guided-walkthrough (docs/DEMO_SALE_GUIDED_EXPERIENCE_PLAN.md).
// Renders mock cards carrying the same stable anchors the real file uses
// (data-glass-id / data-tour / id), so the spotlight, veil, guide card, scroll,
// reduced-motion and finish flow can be exercised without standing up a demo.
// Disposable — delete once the tour is verified on the real file. NOT linked
// from anywhere. Visit /dev/demo-tour.

import { useState } from "react";
import { TabContext } from "@/components/transaction/TabContext";
import { DemoTourController } from "@/components/transaction/demo-tour/DemoTourController";
import { DEMO_TOUR_EVENTS } from "@/components/transaction/demo-tour/types";

const TARGETS: { anchor: Record<string, string>; label: string }[] = [
  { anchor: { "data-glass-id": "property-hero" }, label: "Property hero (step 1)" },
  { anchor: { "data-glass-id": "milestone-timeline" }, label: "6-stage strip (step 2)" },
  { anchor: { "data-glass-id": "overview-next-action" }, label: "Next-action card (step 3, click me)" },
  { anchor: { "data-tour": "chase-threads" }, label: "Chase threads (step 4)" },
  { anchor: { id: "risk-score" }, label: "Risk widget (step 5)" },
  { anchor: { "data-tour": "people-clients" }, label: "People / clients (step 6)" },
];

export default function DemoTourHarness() {
  const [tab, setTab] = useState("overview");

  return (
    <TabContext.Provider value={{ setActiveTab: setTab }}>
      <div className="agent-page" style={{ maxWidth: 880, margin: "0 auto", padding: "32px 20px 640px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Demo tour harness</h1>
        <p style={{ fontSize: 13, color: "var(--agent-text-muted)", marginBottom: 8 }}>
          Active tab (mock): <strong>{tab}</strong>. Toggle OS reduced-motion to test that path.
        </p>
        <button
          onClick={() => window.dispatchEvent(new Event(DEMO_TOUR_EVENTS.start))}
          className="agent-btn agent-btn-color-primary"
          style={{ padding: "10px 18px", fontSize: 14, fontWeight: 700, marginBottom: 28 }}
        >
          Start walkthrough
        </button>

        <div style={{ display: "flex", flexDirection: "column", gap: 420 }}>
          {TARGETS.map((t, i) => (
            <div
              key={i}
              {...t.anchor}
              className="agent-glass"
              style={{ padding: 28, borderRadius: "var(--agent-radius-lg)", minHeight: 120 }}
            >
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>{t.label}</p>
              <p style={{ fontSize: 13, color: "var(--agent-text-secondary)", marginTop: 6 }}>
                Mock target. Spaced far apart on purpose so each step has to scroll.
              </p>
            </div>
          ))}
        </div>
      </div>
      <DemoTourController />
    </TabContext.Provider>
  );
}
