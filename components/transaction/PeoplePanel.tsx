"use client";

// PeoplePanel — one card that carousels between the Clients (contacts) and
// Professionals (solicitors) views via a header toggle, so the solicitor is
// one tap away instead of a scroll down. Both views render "embedded" (no own
// card) inside this shared glass shell. 2026-08-10.

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { HouseSimple, Scales } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";

type Tab = "clients" | "professionals";

// useLayoutEffect on the client, useEffect on the server (dodges the SSR
// warning) — measures the active tab so the sliding pill lands exactly on it.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function PeoplePanel({
  clients,
  professionals,
}: {
  clients: React.ReactNode;
  professionals: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("clients");
  const railRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ clients: null, professionals: null });
  const [pill, setPill] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const [animate, setAnimate] = useState(false);
  const measuredRef = useRef(false);

  const measure = useCallback(() => {
    const btn = btnRefs.current[tab];
    if (!btn || btn.offsetWidth === 0) return; // not laid out yet — wait
    setPill({ left: btn.offsetLeft, width: btn.offsetWidth });
    if (!measuredRef.current) {
      measuredRef.current = true;
      // Enable the slide only after the first correct placement, so the pill
      // doesn't visibly slide in from the left edge on load.
      requestAnimationFrame(() => setAnimate(true));
    }
  }, [tab]);

  useIsomorphicLayoutEffect(() => { measure(); }, [measure]);

  // Re-measure when the rail resizes — catches the first proper layout, font
  // swaps and width changes the mount-time measure misses (the pill landed
  // wrong on first file load before this).
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(rail);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <GlassCard glassId="overview-people" label="Overview · People" defaultVariant="v05" style={{ borderRadius: 12, overflow: "hidden" }}>
      {/* Toggle header */}
      <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "0.5px solid var(--agent-border-default)" }}>
        <div ref={railRef} style={{ position: "relative", display: "inline-flex", padding: 3, borderRadius: 10, gap: 2, background: "rgba(15,23,42,0.05)", border: "0.5px solid var(--agent-border-default)" }}>
          {/* Sliding highlight (the carousel motion across the tabs). */}
          <span
            aria-hidden
            style={{
              position: "absolute", top: 3, bottom: 3,
              left: pill.left, width: pill.width,
              borderRadius: 8, background: "var(--agent-coral-deep)",
              transition: animate ? "left 260ms cubic-bezier(0.4, 0, 0.2, 1), width 260ms cubic-bezier(0.4, 0, 0.2, 1)" : "none",
              pointerEvents: "none",
            }}
          />
          {([["clients", HouseSimple, "Clients"], ["professionals", Scales, "Professionals"]] as const).map(([id, Icon, label]) => {
            const on = tab === id;
            return (
              <button
                key={id}
                ref={(el) => { btnRefs.current[id] = el; }}
                type="button"
                onClick={() => setTab(id)}
                aria-pressed={on}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.color = "var(--agent-text-primary)"; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.color = "var(--agent-text-secondary)"; }}
                style={{
                  position: "relative", zIndex: 1,
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                  background: "transparent",
                  color: on ? "var(--agent-text-on-coral)" : "var(--agent-text-secondary)",
                  transition: "color 200ms ease",
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
