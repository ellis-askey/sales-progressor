"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { CountBadge } from "@/components/ui/CountBadge";

// Canonical glass tab bar — a glass track holding quiet tab chips; the selected
// chip sits on an elevated surface, the rest hover to a subtle tint, and each
// count rides as a CountBadge. Built for the Automated-emails tabs and promoted
// to a shared component so other pages can reuse it. The chip look lives in
// .agent-tab-chip (app/agent/styles/agent-system.css).
//
// Link-routed (pass hrefFor) OR button-driven (pass onSelect).

const CHIP: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 9, textDecoration: "none", fontSize: 12.5, fontWeight: 600 };

export function GlassTabs({
  tabs,
  current,
  hrefFor,
  onSelect,
  ariaLabel,
}: {
  tabs: { value: string; label: string; count?: number | null }[];
  current: string;
  /** Link-routed tabs — return the href for a tab value. */
  hrefFor?: (value: string) => string;
  /** Button-driven tabs — called with the picked value. */
  onSelect?: (value: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="flex" role="tablist" aria-label={ariaLabel}>
      <div style={{ display: "inline-flex", gap: 3, padding: 4, borderRadius: 12, background: "var(--agent-surface-glass)", border: "1px solid var(--agent-border-subtle)", flexWrap: "wrap", maxWidth: "100%" }}>
        {tabs.map((t) => {
          const sel = t.value === current;
          const inner = <>{t.label}{t.count != null && <CountBadge count={t.count} tone={sel ? "accent" : "muted"} soft={!sel} hideZero={false} />}</>;
          if (hrefFor) {
            return <Link key={t.value} href={hrefFor(t.value)} role="tab" aria-selected={sel} className="agent-tab-chip" data-on={sel} style={CHIP}>{inner}</Link>;
          }
          return <button key={t.value} type="button" role="tab" aria-selected={sel} className="agent-tab-chip" data-on={sel} onClick={() => onSelect?.(t.value)} style={{ ...CHIP, border: "none", background: "none", cursor: "pointer", fontFamily: "inherit" }}>{inner}</button>;
        })}
      </div>
    </div>
  );
}
