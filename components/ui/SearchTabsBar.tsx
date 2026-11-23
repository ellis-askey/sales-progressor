"use client";

// Canonical "search + tabs" paired card — a white search top half and a lighter
// status-tab bottom half inside one GlassCard, hairline divider at the seam.
// The search box is the canonical agent-input with a real magnifier + X clear;
// the tabs are the canonical agent-tab-bar-static underline tabs with CountBadge
// counts. Extracted from the All Files list (TransactionListWithSearch) at the
// 2026-11-23 pass; Completions' tl-card toolbar is the same pattern and can adopt
// it next. Presentation only — the parent owns query/tab state.

import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";
import { CountBadge } from "@/components/ui/CountBadge";

export type SearchTab = { value: string; label: string; count?: number };

export function SearchTabsBar({
  query,
  onQueryChange,
  searchPlaceholder = "Search…",
  tabs,
  activeTab,
  onTabChange,
  glassId = "search-tabs",
  glassLabel = "Search & tabs",
}: {
  query: string;
  onQueryChange: (value: string) => void;
  searchPlaceholder?: string;
  /** Omit (or empty) to render a search-only bar. */
  tabs?: SearchTab[];
  activeTab?: string;
  onTabChange?: (value: string) => void;
  glassId?: string;
  glassLabel?: string;
}) {
  return (
    <GlassCard glassId={glassId} label={glassLabel} defaultVariant="v25" data-bloom style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
      <div className="tl-card-search tl-search-row">
        <div className="tl-search-input" style={{ flex: 1 }}>
          <MagnifyingGlass size={14} weight="regular" aria-hidden style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--agent-text-muted)", pointerEvents: "none" }} />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="agent-input agent-input-sm"
            style={{ width: "100%", paddingLeft: 34, paddingRight: 34, fontSize: 13 }}
          />
          {query && (
            <button
              onClick={() => onQueryChange("")}
              className="agent-icon-btn agent-icon-btn-sm"
              style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              aria-label="Clear search"
            ><X size={12} weight="bold" /></button>
          )}
        </div>
      </div>

      {tabs && tabs.length > 0 && (
        <div className="tl-card-tabs">
          <div className="agent-tab-bar agent-tab-bar-static tl-bar-row">
            <div className="tl-bar-tabs">
              {tabs.map((t) => {
                const isActive = activeTab === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => onTabChange?.(t.value)}
                    className="agent-tab"
                    aria-current={isActive ? "true" : undefined}
                    style={{ background: "none", border: "none", cursor: "pointer" }}
                  >
                    {t.label}
                    {t.count != null && <CountBadge count={t.count} tone={isActive ? "accent" : "muted"} soft hideZero={false} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
