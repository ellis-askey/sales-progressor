"use client";

import { Clock, ChatCircle } from "@phosphor-icons/react";
import { AgencyMeshMark } from "@/components/progression/AgencyMeshMark";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { StatNumber } from "@/components/ui/StatNumber";

// Connected-state surfaces. Once connected the card is a working-relationship
// card, not a badge: identity + the relationship's own figures + the actions that
// matter now (message / view sales / assign). Mirrors the density of the existing
// progression Clients rows.

function Mark({ name, size = 46 }: { name: string; size?: number }) {
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: "var(--agent-radius-md)", overflow: "hidden", flexShrink: 0, display: "inline-flex" }}>
      <AgencyMeshMark name={name} size={size} />
    </span>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <StatNumber size="sm">{value}</StatNumber>
      <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "var(--agent-text-muted)", lineHeight: 1.3 }}>{label}</p>
    </div>
  );
}

/** Agency view — a progressor's outgoing request, awaiting their acceptance. */
export function SentRequestRow({ name, onWithdraw }: { name: string; onWithdraw: () => void }) {
  return (
    <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-lg)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
      <Mark name={name} size={42} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
        <div style={{ fontSize: 12.5, color: "var(--agent-text-muted)", display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
          <Clock size={12} weight="bold" /> Request sent · waiting to accept
        </div>
      </div>
      <Button variant="secondary" size="sm" onClick={onWithdraw}>
        Withdraw
      </Button>
    </div>
  );
}

/** Agency view — a connected progressor, as a working-relationship card. */
export function ConnectedRelationshipCard({
  name,
  metrics,
  accepting = true,
}: {
  name: string;
  metrics: { activeSales: number; exchanged: number; completionRate: number };
  accepting?: boolean;
}) {
  return (
    <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", padding: 20 }}>
      <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
        <Mark name={name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>{name}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--agent-text-muted)" }}>Connected progression partner</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, margin: "18px 0", paddingTop: 16, borderTop: "1px solid var(--agent-border-subtle)" }}>
        <Metric value={`${metrics.activeSales}`} label="Active sales" />
        <Metric value={`${metrics.exchanged}`} label="Exchanged" />
        <Metric value={`${metrics.completionRate}%`} label="Completion rate" />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 16 }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: accepting ? "var(--agent-success)" : "var(--agent-text-muted)" }} />
        <span style={{ fontSize: 12.5, fontWeight: 500, color: accepting ? "var(--agent-success)" : "var(--agent-text-muted)" }}>
          {accepting ? "Accepting new instructions" : "Not taking new work"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Button variant="secondary" size="md" style={{ flex: 1, justifyContent: "center" }}>
          <ChatCircle size={15} weight="bold" /> Message
        </Button>
        <Button variant="secondary" size="md" style={{ flex: 1, justifyContent: "center" }}>
          View sales
        </Button>
        <Button variant="primary" size="md" style={{ flex: 1, justifyContent: "center" }}>
          Assign a sale
        </Button>
      </div>
    </div>
  );
}

/** Progressor view — a connected agency, now one of their clients. */
export function ConnectedAgencyCard({
  name,
  descriptor,
  region,
  activeInstructions,
}: {
  name: string;
  descriptor: string;
  region?: string;
  activeInstructions: number;
}) {
  return (
    <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", padding: 20 }}>
      <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
        <Mark name={name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>{name}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--agent-text-muted)" }}>
            {descriptor}
            {region ? ` · ${region}` : ""}
          </p>
        </div>
        <Pill tone="success" size="sm">Active client</Pill>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, margin: "18px 0", paddingTop: 16, borderTop: "1px solid var(--agent-border-subtle)" }}>
        <Metric value={`${activeInstructions}`} label="Active instructions" />
        <Metric value="–" label="Exchanged this month" />
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Button variant="secondary" size="md" style={{ flex: 1, justifyContent: "center" }}>
          <ChatCircle size={15} weight="bold" /> Message
        </Button>
        <Button variant="primary" size="md" style={{ flex: 1, justifyContent: "center" }}>
          View sales
        </Button>
      </div>
    </div>
  );
}
