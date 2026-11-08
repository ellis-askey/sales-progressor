"use client";

// Sliding-indicator segmented switch — the Clients/Professionals toggle pattern
// (PeoplePanel) as a reusable primitive. A measured coral pill animates to the
// selected option. Theme-token based (light + dark). `size="sm"` is the compact
// inline variant (e.g. the chain card's Buyer's/Seller's steps toggle).

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function SegmentedSwitch<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  ariaLabel,
  fullWidth = false,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  size?: "sm" | "md";
  ariaLabel?: string;
  // Stretch the rail to its container and split the options evenly — e.g. the
  // Fees card's Fixed/Percentage and +VAT/Inc toggles, which fill the card.
  fullWidth?: boolean;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const [animate, setAnimate] = useState(false);
  const measuredRef = useRef(false);

  const measure = useCallback(() => {
    const btn = btnRefs.current[value];
    if (!btn || btn.offsetWidth === 0) return; // not laid out yet
    setPill({ left: btn.offsetLeft, width: btn.offsetWidth });
    if (!measuredRef.current) {
      measuredRef.current = true;
      // Enable the slide only after the first correct placement.
      requestAnimationFrame(() => setAnimate(true));
    }
  }, [value]);

  useIsoLayoutEffect(() => { measure(); }, [measure]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(rail);
    return () => ro.disconnect();
  }, [measure]);

  const sm = size === "sm";
  const inset = 3;
  const radius = sm ? 9 : 10;
  const btnRadius = sm ? 7 : 8;

  return (
    <div
      ref={railRef}
      role="tablist"
      aria-label={ariaLabel}
      style={{ position: "relative", display: fullWidth ? "flex" : "inline-flex", width: fullWidth ? "100%" : undefined, padding: inset, borderRadius: radius, gap: 2, background: "rgba(15,23,42,0.05)", border: "0.5px solid var(--agent-border-default)" }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute", top: inset, bottom: inset, left: pill.left, width: pill.width,
          borderRadius: btnRadius, background: "var(--agent-coral-deep)",
          transition: animate ? "left 260ms cubic-bezier(0.4, 0, 0.2, 1), width 260ms cubic-bezier(0.4, 0, 0.2, 1)" : "none",
          pointerEvents: "none",
        }}
      />
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            ref={(el) => { btnRefs.current[o.id] = el; }}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.id)}
            onMouseEnter={(e) => { if (!on) e.currentTarget.style.color = "var(--agent-text-primary)"; }}
            onMouseLeave={(e) => { if (!on) e.currentTarget.style.color = "var(--agent-text-secondary)"; }}
            style={{
              position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center",
              flex: fullWidth ? "1 1 0" : undefined, justifyContent: fullWidth ? "center" : undefined,
              padding: sm ? "4px 12px" : "6px 16px", borderRadius: btnRadius, border: "none", cursor: "pointer",
              fontSize: sm ? 12 : 13, fontWeight: 600, fontFamily: "inherit", whiteSpace: "nowrap",
              background: "transparent",
              color: on ? "var(--agent-text-on-coral)" : "var(--agent-text-secondary)",
              transition: "color 200ms ease",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
