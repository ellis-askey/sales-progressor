"use client";

// components/billing/v2/PlanTermsCollapsed.tsx
//
// Plan summary always visible (3 columns: In-house / Outsourced / Trial),
// agreed-terms behind the canonical .agent-acc accordion. Acknowledged
// date appears in the header summary so the director sees it without
// having to expand.

import { useState } from "react";
import type { TermsSection } from "@/lib/billing/terms-sections";
import type { TrialState } from "@/lib/billing/trial-state";
import { CaretDown } from "@phosphor-icons/react";

export type PlanTermsCollapsedProps = {
  trialState: TrialState;
  agreed: {
    versionTag: string;
    sections: TermsSection[];
    acknowledgedAt: Date | null;
  } | null;
};

export function PlanTermsCollapsed({ trialState, agreed }: PlanTermsCollapsedProps) {
  const [open, setOpen] = useState(false);
  const trialLine =
    trialState.kind === "in_trial"
      ? `${trialState.daysLeft} day${trialState.daysLeft === 1 ? "" : "s"} left of your free trial`
      : trialState.kind === "trial_ended"
      ? "Trial ended"
      : "Trial begins on your first sale";

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>
        Plan &amp; terms
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          fontSize: 13,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              color: "#9ca3af",
              textTransform: "uppercase",
              letterSpacing: 0.7,
              fontWeight: 500,
            }}
          >
            In-house
          </div>
          <div style={{ marginTop: 4, color: "#111827" }}>£59 per exchange</div>
        </div>
        <div>
          <div
            style={{
              fontSize: 10,
              color: "#9ca3af",
              textTransform: "uppercase",
              letterSpacing: 0.7,
              fontWeight: 500,
            }}
          >
            Outsourced
          </div>
          <div style={{ marginTop: 4, color: "#111827" }}>£250 / £300 / £350 by band</div>
        </div>
        <div>
          <div
            style={{
              fontSize: 10,
              color: "#9ca3af",
              textTransform: "uppercase",
              letterSpacing: 0.7,
              fontWeight: 500,
            }}
          >
            Trial
          </div>
          <div
            style={{
              marginTop: 4,
              color: trialState.kind === "in_trial" ? "var(--agent-coral, #FF6B4A)" : "#111827",
              fontWeight: trialState.kind === "in_trial" ? 600 : 400,
            }}
          >
            {trialLine}
          </div>
        </div>
      </div>

      {agreed && (
        <div
          style={{
            borderTop: "0.5px solid rgba(0,0,0,0.08)",
            paddingTop: 4,
          }}
        >
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: "12px 4px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <CaretDown
                weight="bold"
                style={{
                  width: 11,
                  height: 11,
                  color: "#6b7280",
                  transition: "transform 180ms",
                  transform: open ? "rotate(0deg)" : "rotate(-90deg)",
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
                View your agreed terms ({agreed.versionTag})
              </span>
            </span>
            {agreed.acknowledgedAt && (
              <span style={{ fontSize: 11, color: "#9ca3af" }}>
                Acknowledged{" "}
                {agreed.acknowledgedAt.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
          </button>
          <div className={`agent-acc${open ? " open" : ""}`}>
            <div className="agent-acc-in">
              <div
                style={{
                  padding: "8px 4px 4px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                {agreed.sections.map((s, i) => (
                  <div key={i}>
                    <h4
                      style={{
                        margin: "0 0 4px",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#111827",
                      }}
                    >
                      {s.heading}
                    </h4>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12.5,
                        color: "#374151",
                        lineHeight: 1.6,
                      }}
                    >
                      {s.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!agreed && (
        <div style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>
          You haven&apos;t accepted the pricing terms yet — they&apos;ll appear here once you do.
        </div>
      )}
    </section>
  );
}
