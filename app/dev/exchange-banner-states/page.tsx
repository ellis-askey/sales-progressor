"use client";

// /dev/exchange-banner-states — review page for critique #293.
//
// Renders the REAL <ExchangeStageBanner> (the component the Steps tab uses) in
// every state, so what you approve here is byte-for-byte what ships. Each
// specimen is annotated with exactly when it shows on a live file. Dev-only.

import { notFound } from "next/navigation";
import { ExchangeStageBanner, type ExchangeStage } from "@/components/milestones/ExchangeStageBanner";

type Specimen = {
  name: string;
  when: string;
  stage: ExchangeStage;
  completionDateLabel: string | null;
};

const SPECIMENS: Specimen[] = [
  {
    name: "1 · Ready to exchange (unchanged)",
    when: "Every exchange-blocking step is complete on both sides, and exchange (VM19 + PM26) has not yet been confirmed.",
    stage: "ready",
    completionDateLabel: null,
  },
  {
    name: "2 · Exchanged, completion date set",
    when: "Exchange confirmed on both sides (VM19 + PM26) and the file has a completion date. Replaces the stuck Ready to exchange banner.",
    stage: "exchanged",
    completionDateLabel: "28 October",
  },
  {
    name: "3 · Exchanged, no completion date yet",
    when: "Exchange confirmed on both sides but no completion date has been captured.",
    stage: "exchanged",
    completionDateLabel: null,
  },
  {
    name: "4 · Completed",
    when: "Completion confirmed on both sides (VM20 + PM27). Terminal state, never changes again.",
    stage: "completed",
    completionDateLabel: null,
  },
];

export default function DevExchangeBannerStatesPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px 80px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--agent-text-primary)", margin: 0 }}>
        Steps-tab late-stage banner states
      </h1>
      <p style={{ fontSize: 13, color: "var(--agent-text-secondary)", margin: "6px 0 0", lineHeight: 1.5 }}>
        Critique #293. The one banner at the top of the Steps tab, in its three states.
        These render the exact component the live page uses. Before exchange-ready, the
        progress-bar card shows instead (unchanged, not pictured).
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 28, marginTop: 32 }}>
        {SPECIMENS.map((s) => (
          <div key={s.name}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--agent-text-primary)", marginBottom: 2 }}>{s.name}</div>
            <div style={{ fontSize: 11.5, color: "var(--agent-text-muted)", marginBottom: 10, lineHeight: 1.45 }}>Shows when: {s.when}</div>
            <ExchangeStageBanner stage={s.stage} completionDateLabel={s.completionDateLabel} />
          </div>
        ))}
      </div>
    </div>
  );
}
