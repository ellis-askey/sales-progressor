"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { calculateRiskScore, RISK_CONFIG } from "@/lib/services/risk";
import type { HealthRaw } from "@/components/transactions/TransactionTable";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

function buildInput(raw: HealthRaw) {
  return {
    onTrack: raw.onTrack ?? "unknown",
    escalatedTaskCount: raw.escalatedTasks,
    overdueTaskCount: raw.pendingOverdueTasks,
    daysSinceLastActivity: raw.lastActivityAt
      ? Math.floor((Date.now() - new Date(raw.lastActivityAt).getTime()) / 86400000)
      : null,
    daysStuckOnMilestone: raw.daysStuckOnMilestone,
  } as const;
}

export function RiskBadgeWithPopover({ raw }: { raw: HealthRaw }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { theme } = usePortalTheme();

  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 100);
  }
  function cancelClose() {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }
  function openPopover() {
    cancelClose();
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      const above = r.top > 250;
      // Clamp left so the popover stays in-viewport when the trigger sits in
      // the rightmost column of the table. The popover is 230–270px wide; if
      // anchoring to r.left would push it off the viewport's right edge,
      // right-anchor it to r.right - popoverWidth instead. 12px safe margin
      // from either edge.
      const POPOVER_MAX_W = 270;
      const SAFE = 12;
      const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
      let left = r.left;
      if (left + POPOVER_MAX_W + SAFE > vw) {
        left = Math.max(SAFE, r.right - POPOVER_MAX_W);
      }
      setPos({
        top: above ? r.top - 4 : r.bottom + 4,
        left,
        above,
      });
    }
    setOpen(true);
  }

  useEffect(() => {
    function handle(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpen(false);
    }
    function handleScroll() { setOpen(false); }
    document.addEventListener("mousedown", handle);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handle);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  const risk = calculateRiskScore(buildInput(raw));
  const cfg = RISK_CONFIG[risk.level];
  const triggered = risk.factors.filter((f) => f.triggered);

  return (
    <div
      ref={ref}
      className="relative inline-block"
      onMouseEnter={openPopover}
      onMouseLeave={scheduleClose}
    >
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); openPopover(); }}
        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium transition-colors ${cfg.bg} ${cfg.border} ${cfg.color}`}
        style={{ cursor: "default" }}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
        {cfg.label}
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          data-theme={theme}
          className="agent-dropdown-in"
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          style={{
            position: "fixed",
            top: pos.top, left: pos.left,
            transform: pos.above ? "translateY(-100%)" : "none",
            zIndex: 9999,
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: 12,
            padding: 12,
            boxShadow: "0 8px 40px rgba(0,0,0,0.14)",
            border: "0.5px solid rgba(255,255,255,0.60)",
            minWidth: 230, maxWidth: 270,
          }}
        >
          {/* Score header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span className={cfg.color} style={{ fontSize: 12, fontWeight: 600 }}>{cfg.label}</span>
            <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{risk.score}/100</span>
          </div>

          {triggered.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: "var(--agent-success)", display: "flex", alignItems: "center", gap: 6 }}>
              <span>✓</span>
              No flags. All checks healthy.
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {risk.factors.map((f) => (
                <li key={f.label} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <span style={{
                    marginTop: 2, flexShrink: 0,
                    fontSize: 11, fontWeight: 700,
                    color: f.triggered ? "var(--agent-danger)" : "var(--agent-success)",
                  }}>
                    {f.triggered ? "✗" : "✓"}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: 11, fontWeight: 500, lineHeight: 1.35,
                      color: f.triggered ? "var(--agent-text-primary)" : "var(--agent-text-muted)",
                    }}>
                      {f.label}
                    </p>
                    <p style={{
                      margin: "2px 0 0", fontSize: 10, lineHeight: 1.35,
                      color: f.triggered ? "var(--agent-text-secondary)" : "var(--agent-text-muted)",
                    }}>
                      {f.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
