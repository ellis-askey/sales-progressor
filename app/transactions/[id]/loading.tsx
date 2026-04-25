import { SpLoadingShell } from "@/components/layout/SpLoadingShell";

export default function TransactionLoading() {
  return (
    <SpLoadingShell>
      <div className="h-36 animate-pulse bg-slate-700/80" />
      <div className="h-10 bg-white/80 border-b border-slate-200/60" />
      <div className="max-w-7xl mx-auto px-8 py-7">
        <div className="flex gap-7">
          <div className="flex-1 min-w-0 space-y-5">
            <div className="flex gap-2">
              {[80, 100, 90, 110, 85].map((w, i) => (
                <div key={i} className="h-8 rounded-xl animate-pulse bg-slate-200/80" style={{ width: w }} />
              ))}
            </div>
            {[180, 240, 160].map((h, i) => (
              <div key={i} className="rounded-2xl animate-pulse bg-white/80 border border-slate-200/60" style={{ height: h }} />
            ))}
          </div>
          <div className="w-72 flex-shrink-0 space-y-4">
            {[140, 200, 120].map((h, i) => (
              <div key={i} className="rounded-2xl animate-pulse bg-white/80 border border-slate-200/60" style={{ height: h }} />
            ))}
          </div>
        </div>
      </div>
    </SpLoadingShell>
  );
}
