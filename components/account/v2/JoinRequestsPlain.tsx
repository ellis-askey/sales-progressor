"use client";

import { useState, useTransition } from "react";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { approveJoinRequestAction, rejectJoinRequestAction } from "@/app/actions/join-requests";
import { UserPlus } from "@phosphor-icons/react/dist/ssr";

type Req = {
  id: string;
  requesterName: string;
  requesterEmail: string;
  requestedRole: "director" | "negotiator";
  createdAt: string;
};

export function JoinRequestsPlain({ requests }: { requests: Req[] }) {
  const [rows, setRows] = useState(requests);
  const [roleById, setRoleById] = useState<Record<string, "director" | "negotiator">>(
    () => Object.fromEntries(requests.map((r) => [r.id, r.requestedRole])),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function decide(id: string, action: "approve" | "reject") {
    setBusy(id);
    setError(null);
    startTransition(async () => {
      const res =
        action === "approve"
          ? await approveJoinRequestAction(id, roleById[id] ?? "negotiator")
          : await rejectJoinRequestAction(id);
      if (res.ok) {
        setRows((rs) => rs.filter((r) => r.id !== id));
      } else {
        setError(res.error ?? "Something went wrong. Please try again.");
      }
      setBusy(null);
    });
  }

  if (rows.length === 0) return null;

  return (
    <AccountCard
      icon={<UserPlus size={18} weight="bold" />}
      title="Requests to join"
      subtitle="People who signed up with your agency's email domain and are waiting to be let in. Approving one adds them to your team."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map((r) => (
          <div
            key={r.id}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
              padding: "12px 14px", border: "1px solid var(--agent-border-default)", borderRadius: 12,
              background: "var(--agent-surface-subtle)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>{r.requesterName}</p>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--agent-text-muted)" }}>{r.requesterEmail}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <select
                value={roleById[r.id]}
                onChange={(e) => setRoleById((m) => ({ ...m, [r.id]: e.target.value as "director" | "negotiator" }))}
                disabled={busy === r.id}
                aria-label="Role"
                className="glass-input agent-focus"
                style={{ fontSize: 13, padding: "7px 10px" }}
              >
                <option value="negotiator">Negotiator</option>
                <option value="director">Director</option>
              </select>
              <button
                type="button"
                onClick={() => decide(r.id, "approve")}
                disabled={busy === r.id}
                className="agent-btn agent-btn-xs agent-btn-primary disabled:opacity-50"
              >
                {busy === r.id ? "Working…" : "Approve"}
              </button>
              <button
                type="button"
                onClick={() => decide(r.id, "reject")}
                disabled={busy === r.id}
                className="agent-btn agent-btn-xs disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        ))}
        {error && <p className="agent-helper-error">{error}</p>}
      </div>
    </AccountCard>
  );
}
