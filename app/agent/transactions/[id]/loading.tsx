export default function AgentTransactionLoading() {
  return (
    <div className="glass-page-bg min-h-screen">
      <div className="h-14 bg-white/80 border-b border-slate-200/60" />
      <div className="h-24 animate-pulse bg-slate-700/80" />
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        {[160, 200, 140].map((h, i) => (
          <div key={i} className="rounded-2xl animate-pulse bg-white/80 border border-slate-200/60" style={{ height: h }} />
        ))}
      </div>
    </div>
  );
}
