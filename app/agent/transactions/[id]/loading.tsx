export default function AgentTransactionLoading() {
  return (
    <div className="min-h-screen" style={{ background: "rgba(241,245,249,0.6)" }}>
      <div className="h-14 bg-white/70 border-b border-white/30" />
      <div className="h-24 animate-pulse" style={{ background: "rgba(148,163,184,0.12)" }} />
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        {[160, 200, 140].map((h, i) => (
          <div key={i} className="rounded-2xl animate-pulse bg-white/60" style={{ height: h }} />
        ))}
      </div>
    </div>
  );
}
