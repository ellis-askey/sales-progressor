"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Agent = {
  id: string;
  name: string;
  email: string;
  firmName: string | null;
  progressorId: string | null;
  _count: { agentFiles: number };
};

type Progressor = { id: string; name: string };

type Props = {
  agents: Agent[];
  progressors: Progressor[];
  agencyId: string;
};

export function AgentManager({ agents, progressors, agencyId }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [firmName, setFirmName] = useState("");
  const [progressorId, setProgressorId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function createAgent() {
    if (!name.trim() || !email.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), firmName: firmName.trim() || null }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create account");
      setSaving(false);
      return;
    }
    // Assign progressor if selected
    if (progressorId) {
      const { id: newUserId } = await res.json().catch(() => ({})) || {};
      if (newUserId) {
        await fetch("/api/admin/agents", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: newUserId, progressorId }),
        });
      }
    }
    setSaving(false);
    setCreating(false);
    setName(""); setEmail(""); setFirmName(""); setProgressorId("");
    router.refresh();
  }

  async function assignProgressor(agentId: string, pid: string) {
    await fetch("/api/admin/agents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, progressorId: pid || null }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Agent list */}
      {agents.length > 0 && (
        <div className="glass-card" style={{ clipPath: "inset(0 round 20px)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/20 bg-white/10">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-900/40">Agent</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-900/40">Firm</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-900/40">Assigned progressor</th>
                <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-900/40">Files</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/15">
              {agents.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-900/90">{a.name}</p>
                    <p className="text-xs text-slate-900/40">{a.email}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900/60">{a.firmName ?? <span className="text-slate-900/30 italic">—</span>}</td>
                  <td className="px-4 py-3">
                    <select
                      value={a.progressorId ?? ""}
                      onChange={(e) => assignProgressor(a.id, e.target.value)}
                      className="text-sm border border-white/30 rounded-lg px-2 py-1 bg-white/40 focus:outline-none focus:border-blue-400 text-slate-900/80"
                    >
                      <option value="">Unassigned</option>
                      {progressors.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3 text-center text-sm text-slate-900/60">{a._count.agentFiles}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {agents.length === 0 && !creating && (
        <p className="text-sm text-slate-900/40 italic">No agent accounts yet.</p>
      )}

      {/* Create form */}
      {creating ? (
        <div className="glass-card p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-900/80">Create agent account</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-900/40 mb-1 block">Full name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sarah Jones"
                className="w-full px-3 py-2 text-sm border border-white/30 rounded-lg bg-white/40 focus:outline-none focus:border-blue-400 text-slate-900/80 placeholder:text-slate-900/30" />
            </div>
            <div>
              <label className="text-xs text-slate-900/40 mb-1 block">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sarah@agency.co.uk"
                className="w-full px-3 py-2 text-sm border border-white/30 rounded-lg bg-white/40 focus:outline-none focus:border-blue-400 text-slate-900/80 placeholder:text-slate-900/30" />
            </div>
            <div>
              <label className="text-xs text-slate-900/40 mb-1 block">Estate agency</label>
              <input type="text" value={firmName} onChange={(e) => setFirmName(e.target.value)} placeholder="Hartwell & Partners"
                className="w-full px-3 py-2 text-sm border border-white/30 rounded-lg bg-white/40 focus:outline-none focus:border-blue-400 text-slate-900/80 placeholder:text-slate-900/30" />
            </div>
            {progressors.length > 0 && (
              <div>
                <label className="text-xs text-slate-900/40 mb-1 block">Assign progressor</label>
                <select value={progressorId} onChange={(e) => setProgressorId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-white/30 rounded-lg bg-white/40 focus:outline-none focus:border-blue-400 text-slate-900/80">
                  <option value="">— select —</option>
                  {progressors.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex items-center gap-2 pt-1">
            <button onClick={createAgent} disabled={saving || !name.trim() || !email.trim()}
              className="px-4 py-2 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 transition-colors">
              {saving ? "Creating…" : "Create account"}
            </button>
            <button onClick={() => { setCreating(false); setError(""); }}
              className="text-xs text-slate-900/40 hover:text-slate-900/70">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)}
          className="text-xs font-medium text-blue-500 hover:text-blue-700 transition-colors">
          + Create agent account
        </button>
      )}
    </div>
  );
}
