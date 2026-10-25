"use client";

// Topbar control (all users) for the moving-background intensity. An icon
// button opens a small glass popover with a slider that fades the aurora from
// full to off. Dragging updates the --aurora-opacity CSS var live (smooth, no
// WebGL re-init) and persists the value (debounced) so it survives reloads.
// Rides the canonical Popover primitive (portal + flip/shift + edge gutter +
// locked glass). 2026-08-11.

import { useState, useRef, useCallback } from "react";
import { Contrast } from "lucide-react";
import { Popover } from "@/components/ui/Popover";
import { updateAuroraOpacityAction } from "@/app/actions/agent-preferences";

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function AuroraOpacityControl({ initialOpacity = 100 }: { initialOpacity?: number }) {
  const [value, setValue] = useState(() => clamp(initialOpacity));
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback((v: number) => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      updateAuroraOpacityAction(v).catch((e) => console.error("[aurora] persist failed", e));
    }, 400);
  }, []);

  function apply(v: number) {
    const c = clamp(v);
    setValue(c);
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--aurora-opacity", String(c / 100));
    }
    persist(c);
  }

  return (
    <Popover
      preset="popover"
      placement="bottom-end"
      width={240}
      trigger={(open) => (
        <button
          type="button"
          title="Moving background"
          aria-label="Adjust the moving background"
          aria-expanded={open}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 8,
            border: "1px solid var(--agent-border-default)",
            background: open ? "rgba(var(--agent-coral-rgb), 0.10)" : "transparent",
            color: "var(--agent-text-secondary)",
            cursor: "pointer",
            transition: "background 120ms ease",
          }}
          onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = "var(--agent-hover-shade)"; }}
          onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = "transparent"; }}
        >
          <Contrast size={15} />
        </button>
      )}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)" }}>Moving background</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--agent-coral-deep)", fontVariantNumeric: "tabular-nums" }}>{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => apply(Number(e.target.value))}
        aria-label="Moving background intensity"
        style={{ width: "100%", accentColor: "var(--agent-coral-deep)", cursor: "pointer" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "var(--agent-text-muted)" }}>
        <span>Off</span>
        <span>Full</span>
      </div>
    </Popover>
  );
}
