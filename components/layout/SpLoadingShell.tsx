// Persistent sidebar skeleton for SP/admin loading states.
// Mirrors the AppShell sidebar structure so the nav doesn't vanish during navigation.
export function SpLoadingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Fixed photo backdrop */}
      <div className="fixed inset-0 -z-10" style={{
        background: "linear-gradient(rgba(8,12,25,0.52), rgba(6,10,22,0.58)), url('/hero-bg.jpg') center center / cover no-repeat",
      }} />

      {/* Sidebar skeleton */}
      <aside className="glass-sidebar w-56 flex-shrink-0 flex flex-col border-r border-white/10 sticky top-0 h-screen overflow-y-auto">
        {/* Logo row */}
        <div className="px-5 py-5 border-b border-white/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex-shrink-0" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }} />
            <div className="h-4 flex-1 rounded-md animate-pulse bg-white/20" />
          </div>
        </div>
        {/* Search placeholder */}
        <div className="px-3 py-2 border-b border-white/10">
          <div className="h-8 rounded-lg animate-pulse bg-white/10" />
        </div>
        {/* Nav item skeletons */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {[80, 100, 70, 90, 80, 85, 75, 90, 80, 95].map((w, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <div className="w-4 h-4 rounded animate-pulse bg-white/15 flex-shrink-0" />
              <div className="h-3 rounded animate-pulse bg-white/15" style={{ width: w }} />
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
