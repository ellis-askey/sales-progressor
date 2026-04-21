"use client";

import { calculateRiskScore, RISK_CONFIG, type RiskInput, type RiskFactor } from "@/lib/services/risk";

const IMPACT_DOT: Record<RiskFactor["impact"], string> = {
  high:   "bg-red-400",
  medium: "bg-amber-400",
  low:    "bg-blue-300",
};

export function RiskScoreWidget({ input }: { input: RiskInput }) {
  const { level, score, factors } = calculateRiskScore(input);
  const cfg = RISK_CONFIG[level];

  const triggered = factors.filter((f) => f.triggered);
  const clear = factors.filter((f) => !f.triggered);

  return (
    <div className="glass-card">

      {/* Header */}
      <div className="px-5 py-4 border-b border-white/20 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900/90">Fall-through risk</p>
          <p className="text-xs text-slate-900/40 mt-0.5">Based on live file data — not a guess</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${cfg.bg} ${cfg.border}`}>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
          <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
        </div>
      </div>

      <div className="px-5 py-4">
        {/* Score bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-slate-900/40">Risk score</p>
            <p className="text-xs font-semibold text-slate-900/70">{score} / 100</p>
          </div>
          <div className="h-2 bg-slate-900/8 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                level === "high" ? "bg-red-500" : level === "medium" ? "bg-amber-400" : "bg-emerald-400"
              }`}
              style={{ width: `${Math.max(score, 3)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-slate-900/30">Low</span>
            <span className="text-[10px] text-slate-900/30">High</span>
          </div>
        </div>

        {/* Active risk factors */}
        {triggered.length > 0 && (
          <div className="space-y-2 mb-3">
            <p className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide">
              Active risk factors
            </p>
            {triggered.map((f, i) => (
              <div key={i} className="flex items-start gap-2.5 py-2 px-3 rounded-xl glass-subtle border-red-200/60">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${IMPACT_DOT[f.impact]}`} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900/90">{f.label}</p>
                  <p className="text-xs text-slate-900/50 mt-0.5 leading-snug">{f.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Clear factors */}
        {clear.length > 0 && (
          <div className="border-t border-white/20 pt-3">
            <p className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide mb-2">Not flagged</p>
            <div className="space-y-1">
              {clear.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span className="text-xs text-slate-900/50">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
