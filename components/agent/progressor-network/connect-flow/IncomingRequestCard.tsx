"use client";

import { Check, Info } from "@phosphor-icons/react";
import { AgencyMeshMark } from "@/components/progression/AgencyMeshMark";
import { Button } from "@/components/ui/Button";

// The progressor's side: an incoming request from an agency with enough context
// to make a real decision — who they are, where, their introduction — then a
// confident accept and a neutral decline.

export function IncomingRequestCard({
  agencyName,
  agencyDescriptor,
  agencyRegion,
  date = "Today",
  note,
  onAccept,
  onDecline,
  onViewAgency,
}: {
  agencyName: string;
  agencyDescriptor: string;
  agencyRegion?: string;
  date?: string;
  note?: string;
  onAccept: () => void;
  onDecline: () => void;
  onViewAgency?: () => void;
}) {
  return (
    <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-xl)", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--agent-text-muted)" }}>Incoming connection request</span>
        <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>{date}</span>
      </div>

      <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
        <span aria-hidden style={{ width: 46, height: 46, borderRadius: "var(--agent-radius-md)", overflow: "hidden", flexShrink: 0 }}>
          <AgencyMeshMark name={agencyName} size={46} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>{agencyName}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--agent-text-muted)" }}>
            {agencyDescriptor}
            {agencyRegion ? ` · ${agencyRegion}` : ""}
          </p>
        </div>
      </div>

      <p style={{ margin: "14px 0 0", fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
        {agencyName} would like to establish a working relationship with your business.
      </p>

      {note && (
        <div style={{ margin: "14px 0 0", padding: "12px 14px", background: "var(--agent-surface-glass)", borderRadius: "var(--agent-radius-md)", border: "1px solid var(--agent-border-subtle)" }}>
          <p style={{ margin: "0 0 5px", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--agent-text-muted)" }}>Personal introduction</p>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--agent-text-secondary)", lineHeight: 1.55 }}>{note}</p>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 0", fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
        <Info size={15} style={{ flexShrink: 0 }} /> Accepting establishes a connection, not a commitment to take on any sales.
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--agent-border-subtle)" }}>
        {onViewAgency ? (
          <button type="button" className="irc-viewlink" onClick={onViewAgency}>
            View agency profile
          </button>
        ) : (
          <span />
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" size="md" onClick={onDecline}>
            Decline
          </Button>
          <Button variant="primary" size="md" onClick={onAccept}>
            <Check size={15} weight="bold" /> Accept connection
          </Button>
        </div>
      </div>

      <style>{`.irc-viewlink{border:none;background:transparent;cursor:pointer;color:var(--agent-text-secondary);font-size:13px;font-weight:600;padding:2px;transition:color .15s ease}.irc-viewlink:hover{color:var(--agent-coral-deep)}`}</style>
    </div>
  );
}
