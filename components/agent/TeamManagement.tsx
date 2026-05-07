"use client";

import { useState, useEffect, useCallback } from "react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { TeamListView, type PendingNegotiatorInvitation } from "@/components/agent/TeamListView";
import { inviteNegotiator, resendNegotiatorInvitation, cancelNegotiatorInvitation } from "@/app/actions/invite-negotiator";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  canViewAllFiles: boolean;
};

export function TeamManagement({
  currentUserId,
  pendingInvitations: initialPending = [],
}: {
  currentUserId: string;
  pendingInvitations?: PendingNegotiatorInvitation[];
}) {
  const { toast } = useAgentToast();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [pending, setPending] = useState<PendingNegotiatorInvitation[]>(initialPending);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    const res = await fetch("/api/agent/team");
    if (res.ok) setTeam(await res.json());
  }, []);

  const refreshPending = useCallback(async () => {
    const res = await fetch("/api/agent/team/pending");
    if (res.ok) setPending(await res.json());
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

  async function sendInvite() {
    if (!name.trim() || !email.trim()) return;
    setAdding(true);
    setAddError(null);

    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("email", email.trim());

    const result = await inviteNegotiator(fd);
    setAdding(false);

    if (!result.ok) {
      setAddError(result.error);
    } else {
      setShowAdd(false);
      setName(""); setEmail("");
      toast.success("Invitation sent", { description: name.trim() });
      await refreshPending();
    }
  }

  async function handleResend(id: string) {
    const result = await resendNegotiatorInvitation(id);
    if (result.ok) {
      toast.success("Invitation resent");
      await refreshPending();
    } else {
      toast.error(result.error);
    }
  }

  async function handleCancel(id: string, memberName: string) {
    if (!confirm(`Cancel the invitation for ${memberName}? The link will stop working.`)) return;
    const result = await cancelNegotiatorInvitation(id);
    if (result.ok) {
      setPending((prev) => prev.filter((inv) => inv.id !== id));
      toast.info(`Invitation for ${memberName} cancelled`);
    } else {
      toast.error(result.error);
    }
  }

  const negotiators = team.filter((m) => m.role === "negotiator");
  const directors   = team.filter((m) => m.role === "director");

  return (
    <div className="space-y-4">
      <TeamListView
        directors={directors}
        negotiators={negotiators}
        currentUserId={currentUserId}
        onToggleViewAll={toggleViewAll}
        onRemove={removeMember}
        onAddClick={() => setShowAdd(true)}
        pendingInvitations={pending}
        onResendInvitation={handleResend}
        onCancelInvitation={handleCancel}
      />

      {showAdd && (
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
            onKeyDown={(e) => e.key === "Enter" && sendInvite()}
          />
          <p className="text-[11px] text-slate-900/40">
            They&apos;ll receive an email with a link to set up their own account.
          </p>
          {addError && <p className="text-xs text-red-500">{addError}</p>}
          <div className="flex gap-2">
            <button
              onClick={sendInvite}
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
