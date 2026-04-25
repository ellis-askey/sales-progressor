import { SpLoadingShell } from "@/components/layout/SpLoadingShell";

export default function TasksLoading() {
  return (
    <SpLoadingShell>
      <div className="max-w-7xl mx-auto px-8 py-7 space-y-5">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-lg animate-pulse bg-slate-200/80" />
          <div className="h-4 w-64 rounded-lg animate-pulse bg-slate-200/60" />
        </div>
        <div className="flex gap-2">
          {[80, 60, 80, 90, 75].map((w, i) => (
            <div key={i} className="h-8 rounded-xl animate-pulse bg-slate-200/80" style={{ width: w }} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl animate-pulse bg-white/80 border border-slate-200/60" />
          ))}
        </div>
      </div>
    </SpLoadingShell>
  );
}
