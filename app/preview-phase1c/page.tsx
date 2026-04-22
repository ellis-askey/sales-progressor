// THROWAWAY — Phase 1c screenshot preview. Delete after approval.
"use client";

import { useState } from "react";

// ── ProgressRing (copy of TransactionSidebar's inner component) ────────────
function ProgressRing({ percent, onTrack }: { percent: number; onTrack: string }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const filled = circ * (percent / 100);
  const gap = circ - filled;
  const stroke =
    onTrack === "on_track" ? "#10b981" :
    onTrack === "at_risk"  ? "#f59e0b" :
    onTrack === "off_track"? "#ef4444" : "#3b82f6";
  return (
    <div className="relative flex-shrink-0 w-20 h-20">
      <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
        {/* Track — was rgba(15,23,42,0.08), now rgba(255,255,255,0.12) */}
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
        <circle
          cx="40" cy="40" r={r} fill="none"
          stroke={stroke} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${gap}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-slate-900/80 leading-none">{percent}</span>
        <span className="text-[10px] text-slate-900/40 font-medium">%</span>
      </div>
    </div>
  );
}

// ── Mock milestone row with flash demo ────────────────────────────────────
function MockMilestoneRow({ name, done, gate }: { name: string; done: boolean; gate?: boolean }) {
  const [flashing, setFlashing] = useState(false);
  const [isDone, setIsDone] = useState(done);

  function complete() {
    setFlashing(true);
    setTimeout(() => setFlashing(false), 750);
    setTimeout(() => setIsDone(true), 200); // simulate router.refresh() delay
  }

  let rowBg = "";
  if (flashing) rowBg = "bg-emerald-400/15";
  else if (isDone) rowBg = "bg-green-50/40";
  else if (gate) rowBg = "bg-amber-50/60";

  return (
    <div className={`flex items-start gap-3 pl-4 pr-5 py-3.5 border-b border-white/15 last:border-0 transition-colors duration-[150ms] ${rowBg}`}>
      <div className="mt-0.5 flex-shrink-0 z-10">
        {isDone ? (
          <div className="ms-node-pop w-6 h-6 rounded-full bg-emerald-500 border-2 border-emerald-400 flex items-center justify-center shadow-sm">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : gate ? (
          <div className="w-6 h-6 rounded-full bg-white border-2 border-amber-400 flex items-center justify-center shadow-sm">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full bg-white border-2 border-blue-300 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-300" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${isDone ? "text-slate-900/50" : "text-slate-900/90"} ${gate ? "font-semibold" : ""}`}>
          {name}
          {gate && <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Exchange gate</span>}
        </p>
        {isDone && <p className="text-xs text-slate-900/40 mt-0.5">Completed today</p>}
      </div>
      {!isDone && (
        <button onClick={complete} className="px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
          Confirm
        </button>
      )}
    </div>
  );
}

export default function PreviewPhase1cPage() {
  return (
    <>
      <style>{`
        @keyframes ms-node-pop {
          0%   { transform: scale(0.4); opacity: 0; }
          55%  { transform: scale(1.12); opacity: 1; }
          75%  { transform: scale(0.96); }
          100% { transform: scale(1); }
        }
        .ms-node-pop { animation: ms-node-pop 360ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        @media (prefers-reduced-motion: reduce) { .ms-node-pop { animation: none; } }
      `}</style>

      <div className="fixed inset-0 -z-10" style={{
        background: "linear-gradient(rgba(8,12,25,0.52), rgba(6,10,22,0.58)), url('/hero-bg.jpg') center center / cover no-repeat",
      }} />

      <div className="flex min-h-screen glass-page">
        <main className="flex-1 p-8">
          <h1 className="text-white/70 text-sm font-semibold uppercase tracking-widest mb-8">Phase 1c — Sidebar + Milestones preview</h1>

          <div className="flex gap-7 items-start">

            {/* ── Sidebar ──────────────────────────────────────────────── */}
            <div className="w-72 flex-shrink-0 space-y-4">

              {/* Progress card */}
              <div className="glass-card p-5 rounded-[20px]">
                {/* Section label: 0.6875rem / 0.07em tracking — was text-xs tracking-wide */}
                <p className="text-[0.6875rem] font-semibold text-slate-900/40 uppercase tracking-[0.07em] mb-4">Progress</p>
                <div className="flex items-center gap-4">
                  <ProgressRing percent={68} onTrack="on_track" />
                  <div className="flex-1 space-y-2">
                    <span className="inline-flex text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">On track</span>
                    <p className="text-xs text-slate-900/40">8 weeks elapsed</p>
                  </div>
                </div>
              </div>

              {/* Exchange forecast card */}
              <div className="glass-card p-5 rounded-[20px]">
                <p className="text-[0.6875rem] font-semibold text-slate-900/40 uppercase tracking-[0.07em] mb-4">Exchange Forecast</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-900/40 mb-0.5">12-week target</p>
                    <p className="text-sm font-semibold text-slate-900/90">12 July 2025</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-900/40 mb-0.5">Predicted exchange</p>
                    <p className="text-sm font-semibold text-slate-900/90">8 July 2025</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-900/40 mb-0.5">Weeks to exchange</p>
                    <p className="text-sm font-semibold text-slate-900/90">~4 weeks</p>
                  </div>
                </div>
              </div>

              {/* Price card */}
              <div className="glass-card p-5 rounded-[20px]">
                <p className="text-[0.6875rem] font-semibold text-slate-900/40 uppercase tracking-[0.07em] mb-4">Price & Fees</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-900/40 mb-1">Purchase price</p>
                    <p className="text-sm font-bold text-slate-900/90">£750,000</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="glass-subtle text-xs text-slate-900/70 px-2.5 py-0.5 font-medium rounded-lg">Leasehold</span>
                    <span className="glass-subtle text-xs text-slate-900/70 px-2.5 py-0.5 font-medium rounded-lg">Mortgage</span>
                  </div>
                  <div className="pt-2 border-t border-white/20">
                    <p className="text-xs text-slate-900/40 mb-0.5">Our fee</p>
                    <p className="text-sm font-bold text-slate-900/90">£1,200</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Milestones ───────────────────────────────────────────── */}
            <div className="flex-1 min-w-0 space-y-4">

              {/* Exchange-ready banner — was bg-emerald-50/60 border-emerald-200/60 */}
              <div className="px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-400/25 flex items-center gap-3 animate-enter">
                <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-800">Ready to exchange</p>
                  <p className="text-xs text-green-600">All blocking milestones are complete on both sides</p>
                </div>
              </div>

              {/* Conveyancing section — dot is sole color signal, text neutral */}
              <div>
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl">
                  <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                  {/* Text neutral: was text-amber-700, now text-slate-900/60 */}
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-slate-900/60">Conveyancing</span>
                  <div className="flex-1 h-px bg-white/30" />
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/30 text-slate-900/40">2/4</span>
                </div>
                <div className="glass-card relative mt-1 rounded-[20px]" style={{ clipPath: "inset(0 round 20px)" }}>
                  <div className="absolute left-[26px] top-6 bottom-6 w-px bg-white/30" />
                  <MockMilestoneRow name="Instruct solicitors" done={true} />
                  <MockMilestoneRow name="ID checks completed" done={true} />
                  <MockMilestoneRow name="Draft contract received" done={false} />
                  <MockMilestoneRow name="Searches ordered" done={false} gate={true} />
                </div>
              </div>

              {/* Exchange & Completion — all done */}
              <div>
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-emerald-50/60 border border-emerald-100/60">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-slate-900/60">Onboarding</span>
                  <div className="flex-1" />
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-700">All done</span>
                </div>
              </div>

              <p className="text-white/40 text-xs mt-2">↑ Click "Confirm" on any incomplete milestone to see the 600ms flash + circle spring animation</p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
