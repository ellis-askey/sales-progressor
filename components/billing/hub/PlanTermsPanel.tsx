// components/billing/polish/PlanTermsPanel.tsx
//
// Plan summary + the agreed terms, viewable in place. Server component —
// pure render from passed-in data. The disclosure body is structured
// sections; this renderer mirrors the headed-blocks layout used inside
// RedesignedDisclosure but in a quieter mode (collapsed under a heading
// the director can scroll into when they want to re-read).

import type { TermsSection } from "@/lib/billing/terms-sections";
import type { TrialState } from "@/lib/billing/trial-state";

export type PlanTermsPanelProps = {
  vatActive: boolean;
  trialState: TrialState;
  agreed: {
    versionTag: string;
    sections: TermsSection[];
    /** When the current director's agency last acknowledged. Null if never. */
    acknowledgedAt: Date | null;
  } | null;
};

export function PlanTermsPanel({ vatActive, trialState, agreed }: PlanTermsPanelProps) {
  const trialLine =
    trialState.kind === "in_trial"
      ? `${trialState.daysLeft} day${trialState.daysLeft === 1 ? "" : "s"} left of your free trial`
      : trialState.kind === "trial_ended"
      ? "Trial ended"
      : "Trial begins on your first sale";

  return (
    <div
      className="agent-glass"
      style={{
        borderRadius: "var(--agent-radius-xl, 14px)",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>
        Plan &amp; terms
      </h2>

      {/* Plan summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          fontSize: 13,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: 0.6 }}>
            In-house
          </div>
          <div style={{ marginTop: 4, color: "var(--agent-text-primary)" }}>£59 per exchange</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: 0.6 }}>
            Outsourced
          </div>
          <div style={{ marginTop: 4, color: "var(--agent-text-primary)" }}>£250 / £300 / £350 by band</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: 0.6 }}>
            Trial
          </div>
          <div
            style={{
              marginTop: 4,
              color: trialState.kind === "in_trial" ? "var(--agent-coral)" : "var(--agent-text-primary)",
              fontWeight: trialState.kind === "in_trial" ? 600 : 400,
            }}
          >
            {trialLine}
          </div>
        </div>
      </div>

      {/* Agreed terms — collapsible reading area */}
      {agreed && (
        <details
          style={{
            borderTop: "1px solid var(--agent-border-subtle, rgba(0,0,0,0.06))",
            paddingTop: 12,
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--agent-text-secondary)",
              listStyle: "none",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <span>What you agreed to ({agreed.versionTag})</span>
            {agreed.acknowledgedAt && (
              <span style={{ fontSize: 11, color: "var(--agent-text-muted)", fontWeight: 400 }}>
                Acknowledged {agreed.acknowledgedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </summary>
          <div
            style={{
              marginTop: 12,
              padding: "14px 16px",
              background: "var(--agent-readonly-bg, rgba(0,0,0,0.025))",
              borderRadius: 8,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              maxHeight: 360,
              overflowY: "auto",
            }}
          >
            {agreed.sections.map((s, i) => (
              <div key={i}>
                <h4
                  style={{
                    margin: "0 0 4px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--agent-text-primary)",
                  }}
                >
                  {s.heading}
                </h4>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.55 }}>
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}

      {!agreed && (
        <div style={{ fontSize: 12, color: "var(--agent-text-muted)", fontStyle: "italic", paddingTop: 4 }}>
          You haven't accepted the pricing terms yet — they'll appear here once you do.
        </div>
      )}
    </div>
  );
}
