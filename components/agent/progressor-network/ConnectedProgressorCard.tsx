"use client";

import { Check, PaperPlaneTilt } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { StatNumber } from "@/components/ui/StatNumber";
import type { ProgressorNetworkBusiness } from "@/lib/services/progressor-network";
import type { ProgressorRelationshipStats } from "@/lib/services/progressor-network-relationship";
import { readableOn } from "./shared";

// A connected progressor as a working-relationship card (the "My progressors"
// tab), not a badge: identity + the relationship's own figures (sales THIS agency
// has with them) + the two actions that matter now — open the storefront, or hand
// a sale over. Mirrors the density of the discover card so the grid stays even.

export function ConnectedProgressorCard({
  business,
  relationship,
  onView,
  onAssign,
}: {
  business: ProgressorNetworkBusiness;
  relationship: ProgressorRelationshipStats;
  onView: (id: string) => void;
  onAssign: (id: string) => void;
}) {
  const b = business;
  const tileText = readableOn(b.brandColor);
  const accepting = b.availability === "accepting";

  const metrics: { value: string; label: string }[] = [
    { value: `${relationship.activeSales}`, label: "Active with you" },
    { value: `${relationship.exchanged}`, label: "Exchanged" },
    { value: b.stats.completionRatePct == null ? "–" : `${b.stats.completionRatePct}%`, label: "Completion rate" },
  ];

  return (
    <div className="agent-glass-strong pn-card" data-bloom style={{ borderRadius: "var(--agent-radius-xl)", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {b.logoPath ? (
          <div aria-hidden style={{ width: 46, height: 46, flexShrink: 0, borderRadius: "var(--agent-radius-md)", background: "#fff", border: "1px solid var(--agent-border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.logoPath} alt="" style={{ maxWidth: "82%", maxHeight: "82%", objectFit: "contain" }} />
          </div>
        ) : (
          <div aria-hidden style={{ width: 46, height: 46, flexShrink: 0, borderRadius: "var(--agent-radius-md)", background: b.brandColor, color: tileText, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>
            {b.monogram}
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)", lineHeight: 1.25 }}>{b.name}</p>
          <p style={{ margin: "2px 0 0", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--agent-text-muted)" }}>
            <Check size={12} weight="bold" style={{ color: "var(--agent-coral-deep)" }} />
            {b.viaNetwork ? "Connected via network" : "Connected"}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, padding: "14px 0", borderTop: "1px solid var(--agent-border-subtle)", borderBottom: "1px solid var(--agent-border-subtle)" }}>
        {metrics.map((m) => (
          <div key={m.label} style={{ minWidth: 0 }}>
            <StatNumber size="sm">{m.value}</StatNumber>
            <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.3 }}>{m.label}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: accepting ? "var(--agent-success)" : "var(--agent-text-muted)" }} />
        <span style={{ fontSize: 12.5, fontWeight: 500, color: accepting ? "var(--agent-success)" : "var(--agent-text-muted)" }}>
          {accepting ? "Accepting new instructions" : b.availability === "limited" ? "Limited availability" : "Not taking new work"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
        <Button variant="secondary" size="sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => onView(b.id)}>
          View profile
        </Button>
        <Button variant="primary" size="sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => onAssign(b.id)}>
          <PaperPlaneTilt size={14} weight="bold" /> Assign a sale
        </Button>
      </div>
    </div>
  );
}
