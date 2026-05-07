"use client";

import { useState, useEffect, useCallback } from "react";
import { UserPlus, Trash, Eye, EyeSlash, Crown, Clock, ArrowClockwise } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { UserAvatar } from "@/components/ui/Avatar";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  canViewAllFiles: boolean;
  invitationPending?: boolean;
};

export function TeamManagement({ currentUserId }: { currentUserId: string }) {
  const { toast } = useAgentToast();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);

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

  async function removeMember(id: string, memberName: string) {
    if (!confirm(`Remove ${memberName} from the team? They will no longer be able to log in.`)) return;
    const res = await fetch(`/api/agent/team/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTeam((prev) => prev.filter((m) => m.id !== id));
      toast.info(`${memberName} removed from team`);
    }
  }

  async function resendInvite(member: TeamMember) {
    setResending(member.id);
    const res = await fetch("/api/agent/team/resend-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: member.id }),
    });
    setResending(null);
    if (res.ok) {
      toast.success("Invitation resent", { description: member.email });
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Failed to resend invitation");
    }
  }

  async function addMember() {
    if (!name.trim() || !email.trim()) return;
    setAdding(true);
    setAddError(null);
    const res = await fetch("/api/agent/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim() }),
    });
    const data = await res.json();
    setAdding(false);
    if (!res.ok) {
      setAddError(data.error ?? "Failed to send invitation");
    } else {
      setTeam((prev) => [...prev, data]);
      setShowAdd(false);
      setName(""); setEmail("");
      toast.success("Invitation sent", { description: `${name.trim()} will receive an email to set their password` });
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
            <p className="text-sm font-semibold text-slate-900/90 truncate">{m.name}</p>
            <p className="text-xs text-slate-900/40 truncate">{m.email}</p>
          </div>
          <span className="flex-shrink-0 text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            Director
          </span>
        </div>
      ))}

      {/* Negotiators */}
      {negotiators.length === 0 && !showAdd && (
        <div className="glass-card px-5 py-8 text-center">
          <p className="text-sm text-slate-900/50">No negotiators yet.</p>
          <p className="text-xs text-slate-900/35 mt-1">Add a negotiator below to invite them to the portal.</p>
        </div>
      )}

      {negotiators.map((m) => (
        <div key={m.id} className="glass-card px-4 py-3 flex items-center gap-3">
          <UserAvatar user={{ name: m.name }} size={32} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900/90 truncate">{m.name}</p>
            <p className="text-xs text-slate-900/40 truncate">{m.email}</p>
            {m.invitationPending && (
              <p className="text-xs text-amber-600 font-medium mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Invitation pending
              </p>
            )}
          </div>

          <div className="flex-shrink-0 flex items-center gap-1.5">
            {m.invitationPending ? (
              <button
                onClick={() => resendInvite(m)}
                disabled={resending === m.id}
                title="Resend invitation email"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/30 text-slate-900/50 hover:bg-white/60 transition-colors disabled:opacity-40"
              >
                <ArrowClockwise className={`w-3.5 h-3.5 ${resending === m.id ? "animate-spin" : ""}`} />
                Resend
              </button>
            ) : (
              <button
                onClick={() => toggleViewAll(m)}
                title={m.canViewAllFiles ? "Can see all agency files — click to restrict" : "Can only see own files — click to allow all"}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  m.canViewAllFiles
                    ? "agent-badge-brand"
                    : "bg-white/30 text-slate-900/50 hover:bg-white/60"
                }`}
              >
                {m.canViewAllFiles
                  ? <><Eye className="w-3.5 h-3.5" /> All files</>
                  : <><EyeSlash className="w-3.5 h-3.5" /> Own files</>
                }
              </button>
            )}

            {m.id !== currentUserId && (
              <button
                onClick={() => removeMember(m.id, m.name)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-900/30 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Remove from team"
              >
                <Trash className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Add form */}
      {showAdd ? (
        <div className="glass-card p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-900/80">Invite a negotiator</p>
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
            onKeyDown={(e) => e.key === "Enter" && addMember()}
          />
          <p className="text-[11px] text-slate-900/40">
            They will receive an email to set their own password.
          </p>
          {addError && <p className="text-xs text-red-500">{addError}</p>}
          <div className="flex gap-2">
            <button
              onClick={addMember}
              disabled={adding || !name.trim() || !email.trim()}
              className="px-4 py-2 rounded-lg agent-btn-color-primary text-sm font-medium transition-colors disabled:opacity-40"
            >
              {adding ? "Sending…" : "Send invitation"}
            </button>
            <button
              onClick={() => { setShowAdd(false); setAddError(null); setName(""); setEmail(""); }}
              className="px-4 py-2 rounded-lg text-sm text-slate-900/50 hover:text-slate-900/80 hover:bg-white/20 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed text-sm font-medium hover:bg-black/[0.03] transition-colors"
          style={{ borderColor: "rgba(var(--agent-coral-base-rgb),0.45)", color: "var(--agent-coral-deep)" }}
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
