"use client";

export function EmailParseWidget({ transactionId: _ }: { transactionId: string }) {
  return (
    <div
      className="glass-card"
      style={{ clipPath: "inset(0 round 20px)", opacity: 0.6, pointerEvents: "none", userSelect: "none", position: "relative" }}
    >
      {/* Coming soon badge */}
      <div
        style={{
          position: "absolute", top: 12, right: 12,
          background: "rgba(139,92,246,0.12)",
          border: "0.5px solid rgba(139,92,246,0.30)",
          borderRadius: 99,
          padding: "2px 9px",
          fontSize: 10,
          fontWeight: 700,
          color: "rgba(109,40,217,0.80)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        Coming soon
      </div>

      {/* Header row — matches original layout */}
      <div className="w-full px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-900/60">Email milestone parser — coming soon</p>
            <p className="text-xs text-slate-900/35">
              Paste an email and we&apos;ll suggest milestone updates. We&apos;re refining this feature — check back soon.
            </p>
          </div>
        </div>
        <svg className="w-4 h-4 text-slate-900/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
    </div>
  );
}
