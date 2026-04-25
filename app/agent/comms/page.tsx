import { requireSession } from "@/lib/session";
import { getAgentComms, resolveAgentVisibility } from "@/lib/services/agent";
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
  const vis = await resolveAgentVisibility(session.user.id, session.user.agencyId);
  const comms = await getAgentComms(vis);

  // Group by transaction
  const byTx: Record<string, typeof comms> = {};
  for (const c of comms) {
    const key = c.transaction.id;
    if (!byTx[key]) byTx[key] = [];
    byTx[key].push(c);
  }

  return (
    <>
      <div style={{
        background: "rgba(255,255,255,0.52)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        borderBottom: "0.5px solid rgba(255,255,255,0.70)",
        boxShadow: "0 4px 24px rgba(255,138,101,0.07), 0 1px 0 rgba(255,255,255,0.80) inset",
        position: "relative",
        overflow: "hidden",
      }}>
        <div aria-hidden="true" style={{ position: "absolute", top: -60, right: -40, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,138,101,0.13) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div aria-hidden="true" style={{ position: "absolute", bottom: -40, left: 60, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,220,100,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", padding: "24px 32px 28px" }}>
          <p className="agent-eyebrow" style={{ marginBottom: 12 }}>Agent Portal</p>
          <h1 style={{ margin: 0, fontSize: "var(--agent-text-h1)", fontWeight: "var(--agent-weight-semibold)", color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: "var(--agent-line-tight)" }}>Updates</h1>
          <p style={{ margin: "4px 0 0", fontSize: "var(--agent-text-body-sm)", color: "var(--agent-text-tertiary)" }}>Updates from your sales progressor on your files.</p>
        </div>
      </div>

      <div className="px-8 py-7 space-y-7">

      {comms.length === 0 && (
        <div className="text-center py-16">
          <p className="text-base text-slate-900/50 mb-1">No updates yet</p>
          <p className="text-sm text-slate-900/40">Your progressor will post updates here as your sales progress.</p>
        </div>
      )}

      {Object.entries(byTx).map(([txId, entries]) => (
        <div key={txId}>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-sm font-bold text-slate-900/80">{entries[0].transaction.propertyAddress}</p>
            <AgentFlagButton transactionId={txId} address={entries[0].transaction.propertyAddress} />
          </div>

          <div className="space-y-2">
            {entries.map((c) => (
              <div key={c.id} className="glass-card px-4 py-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-[0.05em] px-2 py-0.5 rounded-full ${
                      c.type === "inbound"
                        ? "bg-emerald-50/60 text-emerald-600"
                        : "bg-blue-50/60 text-blue-600"
                    }`}>
                      {c.type === "inbound" ? "Received" : "Sent"}
                    </span>
                    {c.method && (
                      <span className="text-[11px] text-slate-900/40">{METHOD_LABEL[c.method] ?? c.method}</span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-900/40">{fmtDate(c.createdAt)}</span>
                </div>
                <p className="text-sm text-slate-900/80 leading-relaxed">{c.content}</p>
                {c.createdBy && (
                  <p className="text-[11px] text-slate-900/40 mt-2">— {c.createdBy.name}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      </div>
    </>
  );
}
