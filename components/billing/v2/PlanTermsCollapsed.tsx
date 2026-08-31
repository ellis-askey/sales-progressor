"use client";

// components/billing/v2/PlanTermsCollapsed.tsx
//
// Plan summary always visible (2 columns: Self-progress / Outsourced),
// agreed-terms behind the canonical .agent-acc accordion. Acknowledged
// date appears in the header summary so the director sees it without
// having to expand. (Pricing migration 2026-08: self-progress is free and
// there is no trial, so the old In-house £59 + Trial columns are gone.)

import { useState } from "react";
import { termsDisplayName, type TermsSection } from "@/lib/billing/terms-sections";
import { CaretDown } from "@phosphor-icons/react";
import { AnimatedTick } from "@/components/ui/AnimatedTick";

export type PlanTermsCollapsedProps = {
  agreed: {
    versionTag: string;
    sections: TermsSection[];
    acknowledgedAt: Date | null;
  } | null;
};

export function PlanTermsCollapsed({ agreed }: PlanTermsCollapsedProps) {
  const [open, setOpen] = useState(false);

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
            Self-progress
          </div>
          <div style={{ marginTop: 4, color: "#1f9d6b", fontWeight: 600 }}>Free</div>
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
          <div style={{ marginTop: 2, fontSize: 11.5, color: "#6b7280" }}>First sale free</div>
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
              flexDirection: "column",
              alignItems: "stretch",
              gap: 7,
              width: "100%",
              padding: "12px 4px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#374151" }}>
                View your agreed terms ({termsDisplayName(agreed.versionTag)})
              </span>
              {/* Canonical chevron: right-aligned, 0 -> 180deg rotation
                  (2026-08-11 drawer-consistency pass; was left-aligned
                  with a -90deg "pointer" rotation). */}
              <CaretDown
                weight="bold"
                aria-hidden
                style={{
                  width: 12,
                  height: 12,
                  flexShrink: 0,
                  color: "#6b7280",
                  transition: "transform 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: open ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </span>
            {agreed.acknowledgedAt && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#9ca3af" }}>
                <AnimatedTick size={13} color="#1f9d6b" />
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
