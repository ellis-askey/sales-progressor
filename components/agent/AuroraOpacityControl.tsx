"use client";

// Topbar control (all users) for the moving-background intensity. An icon
// button opens a small glass popover with a slider that fades the aurora from
// full to off. Dragging updates the --aurora-opacity CSS var live (smooth, no
// WebGL re-init) and persists the value (debounced) so it survives reloads.
// 2026-08-11.

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Contrast } from "lucide-react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { updateAuroraOpacityAction } from "@/app/actions/agent-preferences";

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function AuroraOpacityControl({ initialOpacity = 100 }: { initialOpacity?: number }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(() => clamp(initialOpacity));
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { theme, isNight } = usePortalTheme();

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

  function openPopover() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const W = 240;
      const SAFE = 12;
      const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
      let left = r.right - W;
      if (left < SAFE) left = SAFE;
      if (left + W + SAFE > vw) left = Math.max(SAFE, vw - W - SAFE);
      setPos({ top: r.bottom + 8, left });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const glassBg = isNight ? "rgba(24,28,38,0.90)" : "rgba(255,255,255,0.86)";
  const glassBorder = isNight ? "0.5px solid rgba(255,255,255,0.14)" : "0.5px solid rgba(255,255,255,0.65)";
  const glassShadow = isNight ? "0 12px 48px rgba(0,0,0,0.5)" : "0 12px 48px rgba(0,0,0,0.16)";
  const textPrimary = isNight ? "#f1f5f9" : "var(--agent-text-primary)";
  const textMuted = isNight ? "rgba(226,232,240,0.60)" : "var(--agent-text-muted)";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPopover())}
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
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = "rgba(var(--agent-coral-rgb), 0.06)"; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = "transparent"; }}
      >
        <Contrast size={15} />
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={popRef}
          data-theme={theme}
          data-night={isNight ? "" : undefined}
          className="agent-dropdown-in"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            zIndex: 9999,
            width: 240,
            background: glassBg,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: glassBorder,
            borderRadius: 14,
            padding: 14,
            boxShadow: glassShadow,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>Moving background</span>
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
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: textMuted }}>
            <span>Off</span>
            <span>Full</span>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
