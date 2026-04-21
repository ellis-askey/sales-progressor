import { requireSession } from "@/lib/session";
import { getAgentComms } from "@/lib/services/agent";
import { AgentFlagButton } from "@/components/agent/AgentFlagButton";

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const METHOD_LABEL: Record<string, string> = {
  email: "Email",
  phone: "Phone",
  sms: "SMS",
  voicemail: "Voicemail",
  whatsapp: "WhatsApp",
  post: "Post",
};

export default async function AgentCommsPage() {
  const session = await requireSession();
  const comms = await getAgentComms(session.user.id);

  // Group by transaction
  const byTx: Record<string, typeof comms> = {};
  for (const c of comms) {
    const key = c.transaction.id;
    if (!byTx[key]) byTx[key] = [];
    byTx[key].push(c);
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: "0 0 4px" }}>Updates</h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
          Updates from your sales progressor on your files.
        </p>
      </div>

      {comms.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 0", color: "#9ca3af" }}>
          <p style={{ fontSize: 16, marginBottom: 4 }}>No updates yet</p>
          <p style={{ fontSize: 14 }}>Your progressor will post updates here as your sales progress.</p>
        </div>
      )}

      {Object.entries(byTx).map(([txId, entries]) => (
        <div key={txId} style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: 0 }}>
              {entries[0].transaction.propertyAddress}
            </p>
            <AgentFlagButton transactionId={txId} address={entries[0].transaction.propertyAddress} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {entries.map((c) => (
              <div key={c.id} style={{ background: "#fff", borderRadius: 10, padding: "14px 16px", border: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                      padding: "2px 7px", borderRadius: 20,
                      background: c.type === "inbound" ? "#f0fdf4" : "#eff6ff",
                      color: c.type === "inbound" ? "#059669" : "#2563eb",
                    }}>
                      {c.type === "inbound" ? "Received" : "Sent"}
                    </span>
                    {c.method && (
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{METHOD_LABEL[c.method] ?? c.method}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>{fmtDate(c.createdAt)}</span>
                </div>
                <p style={{ fontSize: 14, color: "#374151", margin: 0, lineHeight: 1.5 }}>{c.content}</p>
                {c.createdBy && (
                  <p style={{ fontSize: 11, color: "#9ca3af", margin: "8px 0 0" }}>— {c.createdBy.name}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
