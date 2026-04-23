export default function TasksLoading() {
  return (
    <div className="min-h-screen" style={{ background: "rgba(241,245,249,0.6)" }}>
      <div className="h-14 bg-white/70 border-b border-white/30" />
      <div className="max-w-7xl mx-auto px-8 py-7 space-y-5">
        {/* Page header */}
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-lg animate-pulse bg-white/60" />
          <div className="h-4 w-64 rounded-lg animate-pulse bg-white/50" />
        </div>
        {/* Filter tabs */}
        <div className="flex gap-2">
          {[80, 60, 80, 90, 75].map((w, i) => (
            <div key={i} className="h-8 rounded-xl animate-pulse bg-white/60" style={{ width: w }} />
          ))}
        </div>
        {/* Task cards grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl animate-pulse bg-white/60" />
          ))}
        </div>
      </div>
    </div>
  );
}
