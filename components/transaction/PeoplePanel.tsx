"use client";

// PeoplePanel — one card that carousels between the Clients (contacts) and
// Professionals (solicitors) views via a header toggle, so the solicitor is
// one tap away instead of a scroll down. Both views render "embedded" (no own
// card) inside this shared glass shell. 2026-08-10.

import { useState } from "react";
import { HouseSimple, Scales } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";

type Tab = "clients" | "professionals";

export function PeoplePanel({
  clients,
  professionals,
}: {
  clients: React.ReactNode;
  professionals: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("clients");

  return (
    <GlassCard glassId="overview-people" label="Overview · People" defaultVariant="v05" style={{ borderRadius: 12, overflow: "hidden" }}>
      {/* Toggle header */}
      <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "0.5px solid var(--agent-border-default)" }}>
        <div style={{ display: "inline-flex", padding: 3, borderRadius: 10, gap: 2, background: "rgba(15,23,42,0.05)", border: "0.5px solid var(--agent-border-default)" }}>
          {([["clients", HouseSimple, "Clients"], ["professionals", Scales, "Professionals"]] as const).map(([id, Icon, label]) => {
            const on = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-pressed={on}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                  background: on ? "var(--agent-coral-deep)" : "transparent",
                  color: on ? "var(--agent-text-on-coral)" : "var(--agent-text-secondary)",
                  transition: "background 140ms ease, color 140ms ease",
                }}
              >
                <Icon size={14} weight="regular" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliding body — keyed on the tab so it re-animates on switch. The
          transform only exists during the ~240ms slide, so it doesn't linger
          as a backdrop root and starve nested glass of the aurora. */}
      <div key={tab} className="people-pane-in">
        {tab === "clients" ? clients : professionals}
      </div>

      <style>{`
        .people-pane-in { animation: people-pane-in 240ms cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes people-pane-in {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) { .people-pane-in { animation: none; } }
      `}</style>
    </GlassCard>
  );
}
