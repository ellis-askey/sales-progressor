"use client";

// components/account/v2/TeamManagementPlain.tsx
//
// Team roster management for the Account/Team tab. Same wiring as the
// original TeamManagement — same /api/agent/team and /pending fetches,
// same inviteNegotiator / resendNegotiatorInvitation /
// cancelNegotiatorInvitation server actions, same toast behaviour, same
// optimistic add/remove on team list, same confirm() prompts on remove
// + cancel-invitation. The presentation layer changes — uses
// TeamListViewPlain (hairline rows) and an un-carded inline invite form.
//
// The original TeamManagement + TeamListView remain in use on the
// legacy /agent/settings page until Stage 4 retire.

import { useState, useEffect, useCallback } from "react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import {
  TeamListViewPlain,
  type PendingNegotiatorInvitation,
} from "@/components/account/v2/TeamListViewPlain";
import {
  inviteNegotiator,
  resendNegotiatorInvitation,
  cancelNegotiatorInvitation,
} from "@/app/actions/invite-negotiator";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  canViewAllFiles: boolean;
};

export function TeamManagementPlain({
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

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  async function toggleViewAll(member: TeamMember) {
    const res = await fetch(`/api/agent/team/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canViewAllFiles: !member.canViewAllFiles }),
    });
    if (res.ok) {
      setTeam((prev) =>
        prev.map((m) =>
          m.id === member.id ? { ...m, canViewAllFiles: !m.canViewAllFiles } : m,
        ),
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
      setName("");
      setEmail("");
      toast.success("Invite sent", { description: name.trim() });
      await refreshPending();
    }
  }

  async function handleResend(id: string) {
    const result = await resendNegotiatorInvitation(id);
    if (result.ok) {
      toast.success("Invite resent");
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
      toast.info(`Invite for ${memberName} cancelled`);
    } else {
      toast.error(result.error);
    }
  }

  const negotiators = team.filter((m) => m.role === "negotiator");
  const directors = team.filter((m) => m.role === "director");

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    fontSize: 13,
    color: "#111827",
    background: "#fff",
    border: "0.5px solid rgba(0,0,0,0.18)",
    borderRadius: 8,
    outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <TeamListViewPlain
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
        <div
          style={{
            padding: "16px 18px",
            background: "#fff",
            border: "0.5px solid rgba(0,0,0,0.10)",
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>
            Invite a negotiator
          </p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            autoFocus
            style={fieldStyle}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            onKeyDown={(e) => e.key === "Enter" && sendInvite()}
            style={fieldStyle}
          />
          <p style={{ margin: 0, fontSize: 11.5, color: "#9ca3af" }}>
            They&apos;ll receive an email with a link to set up their own account.
          </p>
          {addError && (
            <p style={{ margin: 0, fontSize: 12, color: "#dc2626" }}>{addError}</p>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={sendInvite}
              disabled={adding || !name.trim() || !email.trim()}
              style={{
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 500,
                color: "#fff",
                background: "var(--agent-coral, #FF6B4A)",
                border: "none",
                borderRadius: 8,
                cursor: adding || !name.trim() || !email.trim() ? "default" : "pointer",
                opacity: adding || !name.trim() || !email.trim() ? 0.45 : 1,
              }}
            >
              {adding ? "Sending…" : "Send invitation"}
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setAddError(null);
                setName("");
                setEmail("");
              }}
              style={{
                padding: "8px 14px",
                fontSize: 13,
                color: "#6b7280",
                background: "transparent",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
              }}
              className="hover:bg-black/[0.04]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ paddingTop: 14, borderTop: "0.5px solid rgba(0,0,0,0.06)" }}>
        <p style={{ margin: 0, fontSize: 11.5, color: "#9ca3af", lineHeight: 1.6 }}>
          <strong style={{ color: "#374151", fontWeight: 600 }}>Own files</strong> — negotiator
          can only see their own files.
          <br />
          <strong style={{ color: "#374151", fontWeight: 600 }}>All files</strong> — negotiator
          can see all files in the agency (same as director).
        </p>
      </div>
    </div>
  );
}
