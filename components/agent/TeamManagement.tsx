"use client";

import { useState, useEffect, useCallback } from "react";
import { UserPlus, Trash, Eye, EyeSlash, Crown } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  canViewAllFiles: boolean;
};

export function TeamManagement({ currentUserId }: { currentUserId: string }) {
  const { toast } = useAgentToast();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    const res = await fetch("/api/agent/team");
    if (res.ok) setTeam(await res.json());
  }, []);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  async function toggleViewAll(member: TeamMember) {
    const res = await fetch(`/api/agent/team/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canViewAllFiles: !member.canViewAllFiles }),
    });
    if (res.ok) {
      setTeam((prev) =>
        prev.map((m) => m.id === member.id ? { ...m, canViewAllFiles: !m.canViewAllFiles } : m)
      );
    }
  }

  async function removeMember(id: string, name: string) {
    if (!confirm(`Remove ${name} from the team? They will no longer be able to log in.`)) return;
    const res = await fetch(`/api/agent/team/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTeam((prev) => prev.filter((m) => m.id !== id));
      toast.info(`${name} removed from team`);
    }
  }

  async function addMember() {
    if (!name.trim() || !email.trim() || !password) return;
    setAdding(true);
    setAddError(null);
    const res = await fetch("/api/agent/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
    });
    const data = await res.json();
    setAdding(false);
    if (!res.ok) {
      setAddError(data.error ?? "Failed to create account");
    } else {
      setTeam((prev) => [...prev, data]);
      setShowAdd(false);
      setName(""); setEmail(""); setPassword("");
      toast.success("Negotiator account created", { description: name.trim() });
    }
  }

  const negotiators = team.filter((m) => m.role === "negotiator");
  const directors = team.filter((m) => m.role === "director");

  return (
    <div className="space-y-4">
      {/* Director row */}
      {directors.map((m) => (
        <div key={m.id} className="glass-card px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
               style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}>
            <Crown className="w-4 h-4 text-white" weight="fill" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900/90">{m.name}</p>
            <p className="text-xs text-slate-900/40">{m.email}</p>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            Director
          </span>
        </div>
      ))}

      {/* Negotiators */}
      {negotiators.length === 0 && !showAdd && (
        <div className="glass-card px-5 py-8 text-center">
          <p className="text-sm text-slate-900/50">No negotiators yet.</p>
          <p className="text-xs text-slate-900/35 mt-1">Add a negotiator below to give them access to the portal.</p>
        </div>
      )}

      {negotiators.map((m) => (
        <div key={m.id} className="glass-card px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
               style={{ background: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)" }}>
            <span className="text-xs font-semibold text-blue-700">{m.name.charAt(0)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900/90">{m.name}</p>
            <p className="text-xs text-slate-900/40">{m.email}</p>
          </div>

          {/* See all files toggle */}
          <button
            onClick={() => toggleViewAll(m)}
            title={m.canViewAllFiles ? "Can see all agency files — click to restrict" : "Can only see own files — click to allow all"}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              m.canViewAllFiles
                ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                : "bg-white/30 text-slate-900/50 hover:bg-white/60"
            }`}
          >
            {m.canViewAllFiles
              ? <><Eye className="w-3.5 h-3.5" /> All files</>
              : <><EyeSlash className="w-3.5 h-3.5" /> Own files</>
            }
          </button>

          {m.id !== currentUserId && (
            <button
              onClick={() => removeMember(m.id, m.name)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-900/30 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Remove from team"
            >
              <Trash className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}

      {/* Add form */}
      {showAdd ? (
        <div className="glass-card p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-900/80">Add a negotiator</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="glass-input w-full px-3 py-2 text-sm"
            autoFocus
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="glass-input w-full px-3 py-2 text-sm"
          />
          <div className="space-y-1">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Temporary password"
              className="glass-input w-full px-3 py-2 text-sm"
              onKeyDown={(e) => e.key === "Enter" && addMember()}
            />
            <p className="text-[11px] text-slate-900/40">Share this with them — they can change it after logging in.</p>
          </div>
          {addError && <p className="text-xs text-red-500">{addError}</p>}
          <div className="flex gap-2">
            <button
              onClick={addMember}
              disabled={adding || !name.trim() || !email.trim() || !password}
              className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-sm font-medium text-white transition-colors"
            >
              {adding ? "Creating…" : "Create account"}
            </button>
            <button
              onClick={() => { setShowAdd(false); setAddError(null); setName(""); setEmail(""); setPassword(""); }}
              className="px-4 py-2 rounded-lg text-sm text-slate-900/50 hover:text-slate-900/80 hover:bg-white/20 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-blue-300/60 text-sm font-medium text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add a negotiator
        </button>
      )}

      <div className="pt-2 border-t border-white/20">
        <p className="text-xs text-slate-900/40 leading-relaxed">
          <strong className="text-slate-900/60">Own files</strong> — negotiator can only see their own files.<br />
          <strong className="text-slate-900/60">All files</strong> — negotiator can see all files in the agency (same as director).
        </p>
      </div>
    </div>
  );
}
