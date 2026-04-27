"use client";

import { useState, useRef, useEffect } from "react";
import { calculateRiskScore, RISK_CONFIG } from "@/lib/services/risk";
import type { HealthRaw } from "@/components/transactions/TransactionTable";

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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const risk = calculateRiskScore(buildInput(raw));
  const cfg = RISK_CONFIG[risk.level];
  const triggered = risk.factors.filter((f) => f.triggered);

  return (
    <div
      ref={ref}
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium transition-colors ${cfg.bg} ${cfg.border} ${cfg.color}`}
        style={{ cursor: "default" }}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
        {cfg.label}
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-full mb-2 left-0 z-40 bg-white rounded-xl shadow-xl border border-slate-100 p-3"
          style={{ minWidth: 230, maxWidth: 270 }}
        >
          {/* Score header */}
          <div className="flex items-center justify-between mb-2.5">
            <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
            <span className="text-xs text-slate-900/40">{risk.score}/100</span>
          </div>

          {triggered.length === 0 ? (
            <p className="text-xs text-emerald-700 flex items-center gap-1.5">
              <span className="text-emerald-500">✓</span>
              No flags. All checks healthy.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {risk.factors.map((f) => (
                <li key={f.label} className="flex items-start gap-2">
                  <span className={`mt-0.5 flex-shrink-0 text-xs font-bold ${f.triggered ? "text-red-500" : "text-emerald-500"}`}>
                    {f.triggered ? "✗" : "✓"}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium leading-snug ${f.triggered ? "text-slate-900/80" : "text-slate-900/40"}`}>
                      {f.label}
                    </p>
                    <p className={`text-[10px] leading-snug mt-0.5 ${f.triggered ? "text-slate-900/55" : "text-slate-900/30"}`}>
                      {f.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
