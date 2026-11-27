"use client";

import { Clock, Check, Plus, CaretRight } from "@phosphor-icons/react";
import { AgencyMeshMark } from "@/components/progression/AgencyMeshMark";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";

// Small presentational rows for the connect flow, mirroring the existing
// progression surfaces: the agency's sent/connected rows (progressor shown as a
// monogram tile, like the network card) and the progressor's connected-agency
// row (agency shown as an AgencyMeshMark, like ClientsWorkspace).

function Monogram({ text }: { text: string }) {
  return (
    <span
      aria-hidden
      style={{ width: 44, height: 44, flexShrink: 0, borderRadius: "var(--agent-radius-md)", background: "#334155", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, letterSpacing: "-0.01em" }}
    >
      {text}
    </span>
  );
}

function AgencyTile({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      style={{ width: 44, height: 44, flexShrink: 0, borderRadius: "var(--agent-radius-md)", overflow: "hidden", border: "0.5px solid var(--agent-border-subtle)" }}
    >
      <AgencyMeshMark name={name} size={44} />
    </span>
  );
}

function RowShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-lg)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
      {children}
    </div>
  );
}

const NAME: React.CSSProperties = { fontWeight: 700, fontSize: 14, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const META: React.CSSProperties = { fontSize: 12.5, color: "var(--agent-text-muted)", display: "flex", alignItems: "center", gap: 5, marginTop: 2 };

/** Agency view — a request it sent to a progressor, awaiting acceptance. */
export function SentRequestRow({ name, monogram, onWithdraw }: { name: string; monogram: string; onWithdraw: () => void }) {
  return (
    <RowShell>
      <Monogram text={monogram} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={NAME}>{name}</div>
        <div style={META}>
          <Clock size={12} weight="bold" /> Request sent · waiting to accept
        </div>
      </div>
      <Button variant="secondary" size="sm" onClick={onWithdraw}>
        Withdraw
      </Button>
    </RowShell>
  );
}

/** Agency view — a connected progressor it can now hand sales to. */
export function ConnectedProgressorRow({ name, monogram }: { name: string; monogram: string }) {
  return (
    <RowShell>
      <Monogram text={monogram} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={NAME}>{name}</div>
        <div style={{ marginTop: 3 }}>
          <Pill tone="success" size="sm">
            <Check size={11} weight="bold" /> Connected
          </Pill>
        </div>
      </div>
      <Button variant="primary" size="sm">
        <Plus size={14} weight="bold" /> Hand a sale
      </Button>
    </RowShell>
  );
}

/** Progressor view — a connected agency, now one of its clients. */
export function ClientAgencyRow({ name }: { name: string }) {
  return (
    <RowShell>
      <AgencyTile name={name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={NAME}>{name}</div>
        <div style={META}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--agent-success)" }} /> Active client
        </div>
      </div>
      <CaretRight size={16} weight="bold" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />
    </RowShell>
  );
}
