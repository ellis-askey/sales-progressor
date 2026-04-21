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
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>Your analytics</h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>An overview of your sales pipeline.</p>
      </div>

      {/* Key metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Total files submitted", value: transactions.length },
          { label: "Exchanged", value: exchanged.length },
          { label: "Completed", value: transactions.filter((t) => t.hasCompleted).length },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: "#fff", borderRadius: 12, padding: "18px 20px", border: "1px solid #e5e7eb" }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af", margin: "0 0 8px" }}>{label}</p>
            <p style={{ fontSize: 32, fontWeight: 800, color: "#111827", margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Value metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: "18px 20px", border: "1px solid #e5e7eb" }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af", margin: "0 0 8px" }}>Total pipeline value</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: "#111827", margin: 0 }}>{fmt(totalValue)}</p>
        </div>
        <div style={{ background: "#fff", borderRadius: 12, padding: "18px 20px", border: "1px solid #e5e7eb" }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af", margin: "0 0 8px" }}>Value exchanged</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: "#059669", margin: 0 }}>{fmt(exchangedValue)}</p>
        </div>
      </div>

      {/* Service split */}
      <div style={{ background: "#fff", borderRadius: 12, padding: "18px 20px", border: "1px solid #e5e7eb", marginBottom: 28 }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af", margin: "0 0 14px" }}>Service split</p>
        <div style={{ display: "flex", gap: 32 }}>
          {[
            { label: "Self-managed (£59/mo)", value: transactions.filter((t) => t.serviceType === "self_managed").length, color: "#2563eb" },
            { label: "Outsourced to us", value: transactions.filter((t) => t.serviceType === "outsourced").length, color: "#059669" },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <p style={{ fontSize: 28, fontWeight: 700, color, margin: "0 0 4px" }}>{value}</p>
              <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Files per month chart */}
      <div style={{ background: "#fff", borderRadius: 12, padding: "18px 20px", border: "1px solid #e5e7eb" }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af", margin: "0 0 16px" }}>Files submitted (last 6 months)</p>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 120 }}>
          {Object.entries(months).map(([month, count]) => (
            <div key={month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{count || ""}</span>
              <div style={{
                width: "100%",
                height: `${count > 0 ? Math.max((count / maxBar) * 80, 8) : 4}px`,
                background: count > 0 ? "#2563eb" : "#f1f5f9",
                borderRadius: "4px 4px 0 0",
                transition: "height 0.3s ease",
              }} />
              <span style={{ fontSize: 10, color: "#9ca3af", textAlign: "center" }}>{month}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
