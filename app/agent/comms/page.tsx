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
    <>
      <div className="glass-panel-dark relative overflow-hidden">
        <div className="relative px-8 pt-6 pb-7">
          <p className="glass-section-label text-label-secondary-on-dark mb-4">Agent Portal</p>
          <h1 className="text-2xl font-bold text-white leading-tight tracking-tight">Updates</h1>
          <p className="text-sm text-slate-400 mt-1">Updates from your sales progressor on your files.</p>
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
