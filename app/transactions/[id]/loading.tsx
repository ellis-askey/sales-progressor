export default function TransactionLoading() {
  return (
    <div className="min-h-screen" style={{ background: "rgba(241,245,249,0.6)" }}>
      {/* Nav bar placeholder */}
      <div className="h-14 bg-white/70 border-b border-white/30" />

      {/* Hero */}
      <div className="h-32 animate-pulse" style={{ background: "rgba(148,163,184,0.15)" }} />

      <div className="max-w-7xl mx-auto px-8 py-7">
        <div className="flex gap-7">
          {/* Main column */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Tab bar */}
            <div className="flex gap-2">
              {[80, 100, 90, 110, 85].map((w, i) => (
                <div key={i} className="h-8 rounded-xl animate-pulse bg-white/60" style={{ width: w }} />
              ))}
            </div>
            {/* Cards */}
            {[180, 240, 160].map((h, i) => (
              <div key={i} className="rounded-2xl animate-pulse bg-white/60" style={{ height: h }} />
            ))}
          </div>
          {/* Sidebar */}
          <div className="w-72 flex-shrink-0 space-y-4">
            {[140, 200, 120].map((h, i) => (
              <div key={i} className="rounded-2xl animate-pulse bg-white/60" style={{ height: h }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
