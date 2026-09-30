"use client";

// components/progression/ClientsManager.tsx
//
// The interactive body of /agent/clients: a progression business owner's list
// of client agents, plus an inline "add a client" form. Adding a client creates
// the agent's own agency + a pending login (emailed a set-password link) and the
// client link — it grants NO access to that agency's transactions. Mirrors the
// team-management form/toast pattern (components/account/v2/TeamManagementPlain).

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Buildings, UserPlus, Clock, FolderSimple, X, Plus } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { addClientAgencyAction } from "@/app/actions/progression-clients";

export type ClientRow = {
  linkId: string;
  agencyId: string;
  agencyName: string;
  agent: { id: string; name: string; email: string; pending: boolean } | null;
  fileCount: number;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  border: "0.5px solid rgba(0,0,0,0.14)",
  borderRadius: 10,
  background: "#fff",
  color: "#111827",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 600,
  color: "#6b7280",
  marginBottom: 5,
};

export function ClientsManager({ clients }: { clients: ClientRow[] }) {
  const { toast } = useAgentToast();
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(clients.length === 0);
  const [agentName, setAgentName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!agentName.trim() && !!agentEmail.trim() && !!agencyName.trim();

  async function addClient() {
    if (!canSubmit || adding) return;
    setAdding(true);
    setError(null);

    const fd = new FormData();
    fd.set("agentName", agentName.trim());
    fd.set("agentEmail", agentEmail.trim());
    fd.set("agencyName", agencyName.trim());

    const res = await addClientAgencyAction(fd);
    setAdding(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success("Client added", { description: `We've emailed ${agentName.trim()} a link to set their password.` });
    setAgentName("");
    setAgentEmail("");
    setAgencyName("");
    setShowAdd(false);
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Client list ─────────────────────────────────────────────── */}
      {clients.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
          {clients.map((c, i) => (
            <li
              key={c.linkId}
              className="pc-row"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "13px 6px",
                borderRadius: 8,
                borderTop: i === 0 ? "none" : "0.5px solid rgba(0,0,0,0.07)",
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background: "rgba(226,69,42,0.09)",
                  color: "var(--agent-coral-deep, #E2452A)",
                  flexShrink: 0,
                }}
              >
                <Buildings size={17} weight="bold" />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.agent?.name ?? "Agent"}
                </div>
                <div style={{ fontSize: 12.5, color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.agencyName}
                  {c.agent?.email ? ` · ${c.agent.email}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                {c.agent?.pending && (
                  <span
                    title="Waiting for this agent to set their password"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 11.5, fontWeight: 600, color: "#9a6b00",
                      background: "rgba(245,180,30,0.14)", padding: "3px 8px", borderRadius: 999,
                    }}
                  >
                    <Clock size={12} weight="bold" /> Invite sent
                  </span>
                )}
                <span
                  title="Sales you're progressing for this agent"
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, color: "#6b7280" }}
                >
                  <FolderSimple size={14} weight="bold" /> {c.fileCount}
                </span>
                <Link
                  href={`/agent/transactions/new?clientAgencyId=${c.agencyId}`}
                  className="pc-addsale"
                  title={`Create a sale for ${c.agencyName}`}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    fontSize: 12.5, fontWeight: 600, textDecoration: "none",
                    color: "var(--agent-coral-deep, #E2452A)",
                    padding: "5px 10px", borderRadius: 8,
                    border: "0.5px solid rgba(226,69,42,0.22)",
                  }}
                >
                  <Plus size={12} weight="bold" /> Sale
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ── Add form / toggle ───────────────────────────────────────── */}
      {showAdd ? (
        <div
          style={{
            border: "0.5px solid rgba(0,0,0,0.1)",
            borderRadius: 12,
            background: "rgba(255,255,255,0.6)",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "#111827" }}>Add a client agent</span>
            {clients.length > 0 && (
              <button
                type="button"
                className="pc-cancel-btn"
                onClick={() => { setShowAdd(false); setError(null); }}
                aria-label="Cancel"
                style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", padding: 2, display: "inline-flex" }}
              >
                <X size={16} weight="bold" />
              </button>
            )}
          </div>

          <div>
            <label style={labelStyle} htmlFor="pc-agent-name">Agent name</label>
            <input id="pc-agent-name" className="pc-input" style={inputStyle} value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="e.g. Donna Smith" maxLength={100} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="pc-agent-email">Agent email</label>
            <input id="pc-agent-email" className="pc-input" style={inputStyle} type="email" value={agentEmail} onChange={(e) => setAgentEmail(e.target.value)} placeholder="donna@example.com" maxLength={255} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="pc-agency-name">Agency name</label>
            <input id="pc-agency-name" className="pc-input" style={inputStyle} value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="e.g. Donna Smith, eXp" maxLength={120} />
          </div>

          {error && (
            <p style={{ margin: 0, fontSize: 12.5, color: "#dc2626" }}>{error}</p>
          )}

          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "#9ca3af" }}>
            We'll set up their own login and email them a link to choose a password. They'll only ever see the sales you progress for them.
          </p>

          <button
            type="button"
            className="pc-add-btn"
            onClick={addClient}
            disabled={!canSubmit || adding}
            style={{
              alignSelf: "flex-start",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "10px 16px",
              fontSize: 13.5,
              fontWeight: 700,
              color: "#fff",
              background: canSubmit && !adding ? "var(--agent-coral-deep, #E2452A)" : "#d1cfcd",
              border: "none",
              borderRadius: 10,
              cursor: canSubmit && !adding ? "pointer" : "default",
            }}
          >
            <UserPlus size={15} weight="bold" />
            {adding ? "Adding…" : "Add client"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="pc-toggle-btn"
          onClick={() => setShowAdd(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            alignSelf: "flex-start",
            padding: "9px 14px",
            fontSize: 13.5,
            fontWeight: 600,
            color: "var(--agent-coral-deep, #E2452A)",
            background: "rgba(226,69,42,0.08)",
            border: "0.5px solid rgba(226,69,42,0.22)",
            borderRadius: 10,
            cursor: "pointer",
          }}
        >
          <UserPlus size={15} weight="bold" /> Add a client
        </button>
      )}

      <style>{`
        .pc-input, .pc-add-btn, .pc-toggle-btn, .pc-cancel-btn, .pc-row, .pc-addsale {
          transition: box-shadow 140ms ease, filter 140ms ease, opacity 140ms ease, background 140ms ease;
        }
        .pc-addsale:hover { background: rgba(226,69,42,0.09); box-shadow: 0 2px 8px rgba(226,69,42,0.14); }
        .pc-input:focus { box-shadow: 0 0 0 3px rgba(226,69,42,0.14); }
        .pc-add-btn:not(:disabled):hover { filter: brightness(1.06); box-shadow: 0 5px 14px rgba(226,69,42,0.3); }
        .pc-add-btn:not(:disabled):active { filter: brightness(0.97); }
        .pc-toggle-btn:hover { box-shadow: 0 3px 10px rgba(226,69,42,0.16); filter: brightness(0.99); }
        .pc-cancel-btn:hover { opacity: 0.6; }
        .pc-row:hover { background: rgba(0,0,0,0.025); }
        @media (prefers-reduced-motion: reduce) {
          .pc-input, .pc-add-btn, .pc-toggle-btn, .pc-cancel-btn, .pc-row { transition: none; }
        }
      `}</style>
    </div>
  );
}
