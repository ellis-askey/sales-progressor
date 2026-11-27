"use client";

import { Check, X } from "@phosphor-icons/react";
import { AgencyMeshMark } from "@/components/progression/AgencyMeshMark";
import { Button } from "@/components/ui/Button";

// The progressor's side: an incoming request from an agency, to accept or decline.
// Mirrors components/progression/ConnectionRequestCard (the existing agency-accepts-
// business card), reversed so the PROGRESSOR is the one accepting an agency.
// Presentational — the caller owns accept/decline.

export function IncomingRequestCard({
  agencyName,
  note,
  onAccept,
  onDecline,
}: {
  agencyName: string;
  note?: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div
      className="agent-glass"
      style={{ borderRadius: "var(--agent-radius-xl)", padding: 18, display: "flex", gap: 14, alignItems: "flex-start" }}
    >
      <span
        aria-hidden
        style={{ width: 46, height: 46, flexShrink: 0, borderRadius: "var(--agent-radius-md)", overflow: "hidden", border: "0.5px solid var(--agent-border-subtle)" }}
      >
        <AgencyMeshMark name={agencyName} size={46} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14.5, color: "var(--agent-text-primary)", lineHeight: 1.4 }}>
          <strong style={{ fontWeight: 700 }}>{agencyName}</strong> would like you to progress their sales
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
          They&apos;ll only share the sales they hand to you — nothing moves until you accept.
        </p>
        {note && (
          <p
            style={{ margin: "10px 0 0", fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.5, fontStyle: "italic", padding: "8px 12px", background: "var(--agent-surface-glass)", borderRadius: "var(--agent-radius-md)", borderLeft: "2px solid var(--agent-coral-deep)" }}
          >
            &ldquo;{note}&rdquo;
          </p>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Button variant="secondary" size="sm" onClick={onDecline}>
            <X size={14} weight="bold" /> Decline
          </Button>
          <Button variant="primary" size="sm" onClick={onAccept}>
            <Check size={14} weight="bold" /> Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
