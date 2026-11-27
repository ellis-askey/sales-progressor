"use client";

import { useState } from "react";
import { ArrowLeft, Check, MapPinLine, ShieldCheck, UsersThree, BookmarkSimple, PaperPlaneTilt } from "@phosphor-icons/react";
import { GlassTabs } from "@/components/ui/GlassTabs";
import { StatNumber } from "@/components/ui/StatNumber";
import { Button } from "@/components/ui/Button";
import type { ProgressorNetworkBusiness } from "@/lib/services/progressor-network";
import type { ProgressorRelationshipStats } from "@/lib/services/progressor-network-relationship";
import { readableOn, formatAvgExchange } from "./shared";

// The business storefront: a brand header band (identity + availability + the
// action that fits the current relationship) over Overview / Performance tabs.
// Everything is real — About/Coverage/Specialisms from the declared profile,
// Performance from VERIFIED platform sales (with a warm-up state), team shown as
// an honest count (a named roster is a separate, consent-led decision). Shown
// in-page in place of the grid; the connect / withdraw / assign actions are the
// same wired handlers the grid uses, so no state lives here.

type Tab = "overview" | "performance";

export function ProgressorStorefront({
  business,
  relationship,
  onBack,
  onConnect,
  onWithdraw,
  onToggleSave,
  onAssign,
}: {
  business: ProgressorNetworkBusiness;
  relationship?: ProgressorRelationshipStats | null;
  onBack: () => void;
  onConnect: (id: string) => void;
  onWithdraw: (id: string) => void;
  onToggleSave: (id: string) => void;
  onAssign: (id: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const b = business;
  const accepting = b.availability === "accepting";
  const headText = readableOn(b.brandColor);
  const subColor = headText === "#ffffff" ? "rgba(255,255,255,0.74)" : "rgba(0,0,0,0.6)";

  const availLabel = accepting ? "Accepting new instructions" : b.availability === "limited" ? "Limited availability" : "Not taking new work";

  return (
    <div data-bloom>
      <button type="button" onClick={onBack} className="sf-back">
        <ArrowLeft size={15} weight="bold" /> Back to network
      </button>

      {/* Header band */}
      <div className="sf-card" style={{ marginTop: 14 }}>
        <div style={{ background: b.brandColor, padding: "26px 28px", display: "flex", gap: 18, alignItems: "center" }}>
          {b.logoPath ? (
            <span aria-hidden className="sf-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.logoPath} alt="" />
            </span>
          ) : (
            <span aria-hidden className="sf-mono" style={{ color: readableOn(b.brandColor) === "#ffffff" ? b.brandColor : "#fff", background: readableOn(b.brandColor) === "#ffffff" ? "#fff" : "rgba(0,0,0,0.25)" }}>
              {b.monogram}
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0, color: headText }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 750, letterSpacing: "-0.02em", lineHeight: 1.15 }}>{b.name}</h1>
            <p style={{ margin: "5px 0 0", fontSize: 14, color: subColor }}>{b.kind}</p>
          </div>
        </div>
        <div className="agent-glass-strong sf-bar">
          <span className="sf-avail">
            <span className="sf-dot" style={{ background: accepting ? "var(--agent-success)" : "var(--agent-text-muted)" }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: accepting ? "var(--agent-success)" : "var(--agent-text-muted)" }}>{availLabel}</span>
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Button variant="secondary" size="sm" onClick={() => onToggleSave(b.id)}>
              <BookmarkSimple size={15} weight={b.saved ? "fill" : "regular"} /> {b.saved ? "Saved" : "Save"}
            </Button>
            <StorefrontAction business={b} onConnect={onConnect} onWithdraw={onWithdraw} onAssign={onAssign} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <GlassTabs
          tabs={[
            { value: "overview", label: "Overview" },
            { value: "performance", label: "Performance" },
          ]}
          current={tab}
          onSelect={(v) => setTab(v as Tab)}
          ariaLabel="Profile sections"
        />
      </div>

      <div style={{ marginTop: 22, maxWidth: 720 }}>
        {tab === "overview" ? <Overview b={b} relationship={relationship} /> : <Performance b={b} />}
      </div>

      <style>{`
        .sf-back{display:inline-flex;align-items:center;gap:6px;border:none;background:transparent;cursor:pointer;color:var(--agent-text-muted);font-size:13px;font-weight:600;padding:2px;transition:color .15s ease}
        .sf-back:hover{color:var(--agent-text-primary)}
        .sf-card{border-radius:var(--agent-radius-xl);overflow:hidden;border:1px solid var(--agent-border-subtle)}
        .sf-logo{width:64px;height:64px;border-radius:16px;overflow:hidden;flex-shrink:0;background:#fff;border:1px solid rgba(255,255,255,0.5);display:grid;place-items:center;box-shadow:0 2px 12px rgba(0,0,0,0.22)}
        .sf-logo img{max-width:82%;max-height:82%;object-fit:contain}
        .sf-mono{width:64px;height:64px;border-radius:16px;flex-shrink:0;display:grid;place-items:center;font-size:24px;font-weight:700;letter-spacing:-0.01em;box-shadow:0 2px 12px rgba(0,0,0,0.22)}
        .sf-bar{padding:13px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-radius:0;flex-wrap:wrap}
        .sf-avail{display:inline-flex;align-items:center;gap:7px}
        .sf-dot{width:7px;height:7px;border-radius:999px;flex-shrink:0}
        .sf-h{margin:0 0 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--agent-text-muted)}
      `}</style>
    </div>
  );
}

function StorefrontAction({
  business: b,
  onConnect,
  onWithdraw,
  onAssign,
}: {
  business: ProgressorNetworkBusiness;
  onConnect: (id: string) => void;
  onWithdraw: (id: string) => void;
  onAssign: (id: string) => void;
}) {
  if (b.connectionStatus === "connected") {
    return (
      <Button variant="primary" size="sm" onClick={() => onAssign(b.id)}>
        Assign a sale
      </Button>
    );
  }
  if (b.connectionStatus === "requested") {
    return (
      <Button variant="secondary" size="sm" onClick={() => onWithdraw(b.id)}>
        Withdraw request
      </Button>
    );
  }
  return (
    <Button variant="primary" size="sm" onClick={() => onConnect(b.id)}>
      <PaperPlaneTilt size={14} weight="bold" /> Request to connect
    </Button>
  );
}

function Overview({ b, relationship }: { b: ProgressorNetworkBusiness; relationship?: ProgressorRelationshipStats | null }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      {b.connectionStatus === "connected" && relationship && (relationship.activeSales > 0 || relationship.exchanged > 0) && (
        <section className="agent-glass" style={{ borderRadius: "var(--agent-radius-lg)", padding: "14px 18px" }}>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
            You have <strong style={{ color: "var(--agent-text-primary)" }}>{relationship.activeSales}</strong> active {relationship.activeSales === 1 ? "sale" : "sales"} with {b.name}
            {relationship.exchanged > 0 ? <> and <strong style={{ color: "var(--agent-text-primary)" }}>{relationship.exchanged}</strong> exchanged.</> : "."}
          </p>
        </section>
      )}

      {b.blurb && b.blurb.trim() !== "" && (
        <section>
          <p className="sf-h">About</p>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "var(--agent-text-secondary)" }}>{b.blurb}</p>
        </section>
      )}

      {b.regions.length > 0 && (
        <section>
          <p className="sf-h">Coverage</p>
          <p style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--agent-text-primary)" }}>
            <MapPinLine size={16} style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} /> {b.regions.join(" · ")}
          </p>
        </section>
      )}

      {b.specialisms.length > 0 && (
        <section>
          <p className="sf-h">Specialisms</p>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
            {b.specialisms.map((s) => (
              <li key={s} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--agent-text-primary)" }}>
                <Check size={15} weight="bold" style={{ color: "var(--agent-coral-deep)", flexShrink: 0 }} /> {s}
              </li>
            ))}
          </ul>
        </section>
      )}

      {b.stats.teamSize > 0 && (
        <section>
          <p className="sf-h">Team</p>
          <p style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--agent-text-primary)" }}>
            <UsersThree size={16} style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} /> A team of {b.stats.teamSize}
          </p>
        </section>
      )}
    </div>
  );
}

function Performance({ b }: { b: ProgressorNetworkBusiness }) {
  if (b.stats.completionRatePct == null) {
    return (
      <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-lg)", padding: "18px 20px" }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--agent-text-secondary)" }}>
          {b.name} is building a verified track record. Performance stats appear here once they&apos;ve completed enough sales on the platform.
        </p>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        <Big value={`${b.stats.completionRatePct}%`} label="Completion rate" />
        <Big value={b.stats.exchangedFiles12mo == null ? "–" : `${b.stats.exchangedFiles12mo}`} label="Exchanges, last 12 months" />
        <Big value={formatAvgExchange(b.stats.avgTimeToExchangeWeeks)} label="Average time to exchange" />
      </div>
      <p style={{ margin: 0, display: "inline-flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
        <ShieldCheck size={15} style={{ color: "var(--agent-text-muted)", flexShrink: 0, marginTop: 1 }} />
        Verified from completed sales on The Sales Progressor over the last 12 months. Figures update as sales complete.
      </p>
    </div>
  );
}

function Big({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <StatNumber size="md">{value}</StatNumber>
      <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.35 }}>{label}</p>
    </div>
  );
}
