"use client";

// Animated segmented tabs for the To-Do page (critique #261). A pill-style
// toggle whose active highlight slides with a spring "overstretch" (overshoot
// easing + a brief horizontal stretch while it travels), and the panel below
// cross-fades as the tab changes. Role decides the tab set; this component is
// purely presentational — the parent owns the content per tab.

import { useRef, useState, type ReactNode, type CSSProperties } from "react";

export type TodoTab = {
  key: string;
  label: string;
  count?: number;
  // Shorter label shown on phones (<=480px) where the full one is too wide
  // (critique #273). Falls back to `label` when omitted.
  shortLabel?: string;
};

export function TodoTabs({
  tabs,
  active,
  onChange,
  action,
  children,
}: {
  tabs: TodoTab[];
  active: string;
  onChange: (key: string) => void;
  // Optional right-aligned action on the tab row (e.g. the Add button). Drops
  // onto its own line, still right-aligned, when the row is too narrow.
  action?: ReactNode;
  // The panel for the active tab. Keyed by `active` so it re-mounts (and
  // fade-animates in) on every change.
  children: ReactNode;
}) {
  const activeIdx = Math.max(0, tabs.findIndex((t) => t.key === active));
  // Briefly stretch the sliding pill while it travels between tabs.
  const [travelling, setTravelling] = useState(false);
  const travelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function select(key: string) {
    if (key === active) return;
    setTravelling(true);
    if (travelTimer.current) clearTimeout(travelTimer.current);
    travelTimer.current = setTimeout(() => setTravelling(false), 260);
    onChange(key);
  }

  return (
    <div className="todotabs">
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", rowGap: 10 }}>
        <div
          className="todotabs-bar"
          role="tablist"
          style={{ "--tt-count": tabs.length, "--tt-idx": activeIdx, flex: "1 1 300px" } as CSSProperties}
        >
          <span className={`todotabs-pill${travelling ? " travelling" : ""}`} aria-hidden />
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={t.key === active}
              className={`todotabs-tab${t.key === active ? " on" : ""}`}
              onClick={() => select(t.key)}
            >
              {t.shortLabel && t.shortLabel !== t.label ? (
                // Full label above 480px, short one on phones (critique #273).
                <>
                  <span className="todotabs-lbl-full">{t.label}</span>
                  <span className="todotabs-lbl-short">{t.shortLabel}</span>
                </>
              ) : (
                t.label
              )}
              {t.count != null && t.count > 0 && <span className="todotabs-count">{t.count}</span>}
            </button>
          ))}
        </div>
        {action && <div style={{ marginLeft: "auto", flexShrink: 0 }}>{action}</div>}
      </div>

      {/* Keyed so the panel re-mounts and fades in on each tab change. */}
      <div key={active} className="todotabs-panel" role="tabpanel">
        {children}
      </div>
    </div>
  );
}
