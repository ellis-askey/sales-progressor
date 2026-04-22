import { requireSession } from "@/lib/session";
import { getAgentTransactions } from "@/lib/services/agent";

function fmt(n: number) { return "£" + n.toLocaleString("en-GB"); }

export default async function AgentAnalyticsPage() {
  const session = await requireSession();
  const transactions = await getAgentTransactions(session.user.id);

  const now = new Date();
  const months: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    months[key] = 0;
  }
  for (const tx of transactions) {
    const key = new Date(tx.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    if (key in months) months[key]++;
  }

  const exchanged = transactions.filter((t) => t.hasExchanged);
  const totalValue = transactions
    .filter((t) => t.purchasePrice)
    .reduce((sum, t) => sum + (t.purchasePrice! / 100), 0);
  const exchangedValue = exchanged
    .filter((t) => t.purchasePrice)
    .reduce((sum, t) => sum + (t.purchasePrice! / 100), 0);

  const maxBar = Math.max(...Object.values(months), 1);

  return (
    <div className="space-y-5">
      <div className="mb-2">
        <h1 className="text-xl font-extrabold text-slate-900/90 mb-1">Your analytics</h1>
        <p className="text-sm text-slate-900/50">An overview of your sales pipeline.</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total files submitted", value: transactions.length },
          { label: "Exchanged", value: exchanged.length },
          { label: "Completed", value: transactions.filter((t) => t.hasCompleted).length },
        ].map(({ label, value }) => (
          <div key={label} className="glass-card px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-900/40 mb-2">{label}</p>
            <p className="text-3xl font-extrabold text-slate-900/90">{value}</p>
          </div>
        ))}
      </div>

      {/* Value metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-900/40 mb-2">Total pipeline value</p>
          <p className="text-2xl font-bold text-slate-900/90">{fmt(totalValue)}</p>
        </div>
        <div className="glass-card px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-900/40 mb-2">Value exchanged</p>
          <p className="text-2xl font-bold text-emerald-600">{fmt(exchangedValue)}</p>
        </div>
      </div>

      {/* Service split */}
      <div className="glass-card px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-900/40 mb-4">Service split</p>
        <div className="flex gap-8">
          {[
            { label: "Self-managed (£59/mo)", value: transactions.filter((t) => t.serviceType === "self_managed").length, color: "text-blue-600" },
            { label: "Outsourced to us", value: transactions.filter((t) => t.serviceType === "outsourced").length, color: "text-emerald-600" },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <p className={`text-3xl font-bold mb-1 ${color}`}>{value}</p>
              <p className="text-sm text-slate-900/50">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Files per month chart */}
      <div className="glass-card px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-900/40 mb-4">Files submitted (last 6 months)</p>
        <div className="flex items-end gap-3 h-28">
          {Object.entries(months).map(([month, count]) => (
            <div key={month} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-900/60">{count || ""}</span>
              <div
                className="w-full rounded-t-sm transition-[height] duration-300"
                style={{
                  height: `${count > 0 ? Math.max((count / maxBar) * 80, 8) : 4}px`,
                  background: count > 0 ? "rgba(37,99,235,0.75)" : "rgba(255,255,255,0.15)",
                }}
              />
              <span className="text-[10px] text-slate-900/40 text-center">{month}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
