"use client";

import { Check, PaperPlaneTilt, BookmarkSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import type { ProgressorNetworkBusiness } from "@/lib/services/progressor-network";
import { tagIcon, readableOn, formatAvgExchange } from "./shared";

// One business card in the network grid: brand tile (logo or monogram) +
// availability + four headline stats + specialism chips + view / connect / save.
//
// Type + spacing follow the canonical scale; stat numerals follow the StatNumber
// family (750 / -0.02em / tabular) at a dense 17 for the 4-up. A business with no
// VERIFIED performance data yet shows a "new to the network" line in place of the
// stat grid — we never fabricate figures.

export function ProgressorCard({
  business,
  onView,
  onConnect,
  onToggleSave,
}: {
  business: ProgressorNetworkBusiness;
  onView: (id: string) => void;
  onConnect: (id: string) => void;
  onToggleSave: (id: string) => void;
}) {
  const b = business;
  const tileText = readableOn(b.brandColor);
  const hasStats =
    b.stats.exchangeRatePct != null || (b.stats.exchangedFiles12mo ?? 0) > 0 || b.stats.teamSize > 0;

  const stats: { value: string; label: string }[] = [
    { value: b.stats.exchangeRatePct == null ? "–" : `${b.stats.exchangeRatePct}%`, label: "Exchange rate" },
    { value: b.stats.exchangedFiles12mo == null ? "–" : `${b.stats.exchangedFiles12mo}`, label: "Exchanged files (12 months)" },
    { value: formatAvgExchange(b.stats.avgTimeToExchangeWeeks), label: "Avg. time to exchange" },
    { value: `${b.stats.teamSize}`, label: "Team size" },
  ];

  return (
    <div
      className="agent-glass-strong pn-card"
      data-bloom
      style={{ borderRadius: "var(--agent-radius-xl)", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}
    >
      {/* Header: brand tile (logo or monogram) + name + save */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {b.logoPath ? (
          <div
            aria-hidden
            style={{ width: 46, height: 46, flexShrink: 0, borderRadius: "var(--agent-radius-md)", background: "#fff", border: "1px solid var(--agent-border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.logoPath} alt="" style={{ maxWidth: "82%", maxHeight: "82%", objectFit: "contain" }} />
          </div>
        ) : (
          <div
            aria-hidden
            style={{ width: 46, height: 46, flexShrink: 0, borderRadius: "var(--agent-radius-md)", background: b.brandColor, color: tileText, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}
          >
            {b.monogram}
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)", lineHeight: 1.25 }}>{b.name}</p>
            <button
              type="button"
              onClick={() => onToggleSave(b.id)}
              aria-pressed={b.saved}
              aria-label={b.saved ? "Remove from saved" : "Save"}
              className="pn-save"
              style={{ color: b.saved ? "var(--agent-coral-deep)" : "var(--agent-text-muted)" }}
            >
              <BookmarkSimple size={17} weight={b.saved ? "fill" : "regular"} />
            </button>
          </div>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-muted)" }}>{b.kind}</p>
        </div>
      </div>

      {/* Availability / connection status — outlined, not faded fills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {b.availability === "accepting" && (
          <Pill tone="success" glass size="md"><Check size={12} weight="bold" /> Accepting new instructions</Pill>
        )}
        {b.availability === "limited" && <Pill tone="warning" outline size="md">Limited availability</Pill>}
        {b.availability === "closed" && <Pill tone="default" outline size="md">Not taking new work</Pill>}
        {b.connectionStatus === "connected" && (
          <Pill tone="brand" outline size="md">{b.viaNetwork ? "Connected via network" : "Connected"}</Pill>
        )}
        {b.connectionStatus === "requested" && <Pill tone="info" outline size="md">Request sent</Pill>}
      </div>

      {/* Blurb */}
      <p style={{ margin: 0, fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>{b.blurb}</p>

      {/* Stats — dense 4-up on the StatNumber family, or a "new to the network"
          line when there's no verified performance data yet. */}
      {hasStats ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, padding: "12px 0", borderTop: "1px solid var(--agent-border-subtle)", borderBottom: "1px solid var(--agent-border-subtle)" }}>
          {stats.map((s) => (
            <div key={s.label} style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 750, letterSpacing: "-0.02em", color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums", lineHeight: 1.05 }}>{s.value}</p>
              <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.3 }}>{s.label}</p>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: "12px 0", borderTop: "1px solid var(--agent-border-subtle)", borderBottom: "1px solid var(--agent-border-subtle)" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)", lineHeight: 1.45 }}>New to the network. Verified performance stats appear as sales complete.</p>
        </div>
      )}

      {/* Specialism / coverage chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {b.tags.map((t) => {
          const Icon = tagIcon(t);
          return (
            <Pill key={t} tone="default" size="sm"><Icon size={11} weight="bold" /> {t}</Pill>
          );
        })}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
        <Button variant="secondary" size="sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => onView(b.id)}>
          View profile
        </Button>
        {b.connectionStatus === "none" ? (
          <Button variant="primary" size="sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => onConnect(b.id)}>
            <PaperPlaneTilt size={14} weight="bold" /> Request to connect
          </Button>
        ) : b.connectionStatus === "requested" ? (
          <Button variant="secondary" size="sm" style={{ flex: 1, justifyContent: "center" }} disabled>
            Request sent
          </Button>
        ) : (
          <Button variant="secondary" size="sm" style={{ flex: 1, justifyContent: "center" }} disabled>
            <Check size={14} weight="bold" /> Connected
          </Button>
        )}
      </div>
    </div>
  );
}
