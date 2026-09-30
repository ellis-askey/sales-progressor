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
import { Buildings, UserPlus, Clock, FolderSimple, X, Plus } from "@phosphor-icons/react";
import { useAddClientForm } from "./useAddClientForm";

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
  const [showAdd, setShowAdd] = useState(clients.length === 0);
  const f = useAddClientForm(() => setShowAdd(false));

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
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "#111827" }}>Add a client</span>
            {clients.length > 0 && (
              <button
                type="button"
                className="pc-cancel-btn"
                onClick={() => { setShowAdd(false); f.reset(); }}
                aria-label="Cancel"
                style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", padding: 2, display: "inline-flex" }}
              >
                <X size={16} weight="bold" />
              </button>
            )}
          </div>

          <div>
            <label style={labelStyle} htmlFor="pc-agent-name">Contact name</label>
            <input id="pc-agent-name" className="pc-input" style={inputStyle} value={f.agentName} onChange={(e) => f.setAgentName(e.target.value)} onBlur={f.blurName} placeholder="e.g. Sophie Bennett" maxLength={100} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="pc-agent-email">Email address</label>
            <input id="pc-agent-email" className="pc-input" style={inputStyle} type="email" value={f.agentEmail} onChange={(e) => f.setAgentEmail(e.target.value)} onBlur={f.blurEmail} placeholder="sophie@oakandkey.co.uk" maxLength={255} aria-invalid={f.emailInvalid || undefined} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="pc-agency-name">Agency name</label>
            <input id="pc-agency-name" className="pc-input" style={inputStyle} value={f.agencyName} onChange={(e) => f.setAgencyName(e.target.value)} onBlur={f.blurAgency} placeholder="e.g. Oak & Key" maxLength={120} />
          </div>

          {f.emailInvalid && (
            <p style={{ margin: 0, fontSize: 12.5, color: "#dc2626" }}>Enter a valid email address.</p>
          )}
          {f.error && (
            <p style={{ margin: 0, fontSize: 12.5, color: "#dc2626" }}>{f.error}</p>
          )}

          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "#9ca3af" }}>
            We&apos;ll email them an invite to set up their login. They&apos;ll only have access to their own sales.
          </p>

          <button
            type="button"
            className="pc-add-btn"
            onClick={f.submit}
            disabled={!f.canSubmit || f.adding}
            style={{
              alignSelf: "flex-start",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "10px 16px",
              fontSize: 13.5,
              fontWeight: 700,
              color: "#fff",
              background: f.canSubmit && !f.adding ? "var(--agent-coral-deep, #E2452A)" : "#d1cfcd",
              border: "none",
              borderRadius: 10,
              cursor: f.canSubmit && !f.adding ? "pointer" : "default",
            }}
          >
            <UserPlus size={15} weight="bold" />
            {f.adding ? "Adding…" : "Add client"}
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
