export default function DashboardLoading() {
  return (
    <div className="min-h-screen" style={{ background: "rgba(241,245,249,0.6)" }}>
      <div className="h-14 bg-white/70 border-b border-white/30" />
      <div className="max-w-7xl mx-auto px-8 py-7 space-y-5">
        {/* Stats strip */}
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 flex-1 rounded-2xl animate-pulse bg-white/60" />
          ))}
        </div>
        {/* Filter tabs */}
        <div className="flex gap-2">
          {[80, 90, 80, 100, 75].map((w, i) => (
            <div key={i} className="h-8 rounded-xl animate-pulse bg-white/60" style={{ width: w }} />
          ))}
        </div>
        {/* Transaction rows */}
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl animate-pulse bg-white/60" />
          ))}
        </div>
      </div>
    </div>
  );
}
