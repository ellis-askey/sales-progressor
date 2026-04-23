export default function DashboardLoading() {
  return (
    <div className="glass-page-bg min-h-screen">
      <div className="h-14 bg-white/70 border-b border-slate-200/60" />
      <div className="max-w-7xl mx-auto px-8 py-7 space-y-5">
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 flex-1 rounded-2xl animate-pulse bg-white/80 border border-slate-200/60" />
          ))}
        </div>
        <div className="flex gap-2">
          {[80, 90, 80, 100, 75].map((w, i) => (
            <div key={i} className="h-8 rounded-xl animate-pulse bg-slate-200/80" style={{ width: w }} />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl animate-pulse bg-white/80 border border-slate-200/60" />
          ))}
        </div>
      </div>
    </div>
  );
}
