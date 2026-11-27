"use client";

import { useState } from "react";
import { ArrowLeft, Check, MapPinLine, ShieldCheck } from "@phosphor-icons/react";
import { AgencyMeshMark } from "@/components/progression/AgencyMeshMark";
import { GlassTabs } from "@/components/ui/GlassTabs";
import { StatNumber } from "@/components/ui/StatNumber";
import { Button } from "@/components/ui/Button";
import { ContactAvatar } from "@/components/ui/Avatar";
import type { ProgressorFixture, RelState } from "./fixtures";

// The business storefront: a header band (brand + identity + availability +
// connect action) over canonical section tabs. Overview / Performance / Team —
// no tab is added just to look substantial, and nothing claims to be "verified"
// unless it's computed from TSP sales.

type Tab = "overview" | "performance" | "team";

export function BusinessProfile({
  business,
  relState,
  onBack,
  onConnect,
}: {
  business: ProgressorFixture;
  relState: RelState;
  onBack: () => void;
  onConnect: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const b = business;
  const accepting = b.availability === "accepting";

  return (
    <div>
      <button type="button" onClick={onBack} className="bp-back">
        <ArrowLeft size={15} weight="bold" /> Back to network
      </button>

      {/* Header */}
      <div style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden", marginTop: 14, border: "1px solid var(--agent-border-subtle)" }}>
        <div style={{ background: b.brandColor, padding: "26px 28px", display: "flex", gap: 18, alignItems: "center" }}>
          <span aria-hidden style={{ width: 64, height: 64, borderRadius: 16, overflow: "hidden", flexShrink: 0, boxShadow: "0 2px 12px rgba(0,0,0,0.25)" }}>
            <AgencyMeshMark name={b.name} size={64} />
          </span>
          <div style={{ flex: 1, minWidth: 0, color: "#fff" }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15 }}>{b.name}</h1>
            <p style={{ margin: "5px 0 0", fontSize: 14, color: "rgba(255,255,255,0.72)" }}>{b.positioning}</p>
          </div>
        </div>
        <div className="agent-glass-strong" style={{ padding: "13px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 0 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: accepting ? "var(--agent-success)" : "var(--agent-text-muted)" }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: accepting ? "var(--agent-success)" : "var(--agent-text-muted)" }}>
              {accepting ? "Accepting new instructions" : "Not taking new work"}
            </span>
          </span>
          <ConnectAction relState={relState} onConnect={onConnect} />
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <GlassTabs
          tabs={[
            { value: "overview", label: "Overview" },
            { value: "performance", label: "Performance" },
            { value: "team", label: "Team" },
          ]}
          current={tab}
          onSelect={(v) => setTab(v as Tab)}
          ariaLabel="Profile sections"
        />
      </div>

      <div style={{ marginTop: 22, maxWidth: 680 }}>
        {tab === "overview" && <Overview b={b} />}
        {tab === "performance" && <Performance b={b} />}
        {tab === "team" && <Team b={b} />}
      </div>

      <style>{`
        .bp-back{display:inline-flex;align-items:center;gap:6px;border:none;background:transparent;cursor:pointer;color:var(--agent-text-muted);font-size:13px;font-weight:600;padding:2px;transition:color .15s ease}
        .bp-back:hover{color:var(--agent-text-primary)}
        .bp-h{margin:0 0 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--agent-text-muted)}
      `}</style>
    </div>
  );
}

function ConnectAction({ relState, onConnect }: { relState: RelState; onConnect: () => void }) {
  if (relState === "pending") return <Button variant="secondary" size="sm" disabled>Request sent</Button>;
  if (relState === "connected") return <Button variant="primary" size="sm">Assign a sale</Button>;
  return (
    <Button variant="primary" size="sm" onClick={onConnect}>
      {relState === "declined" ? "Request again" : "Request connection"}
    </Button>
  );
}

function Overview({ b }: { b: ProgressorFixture }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <section>
        <p className="bp-h">About</p>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "var(--agent-text-secondary)" }}>{b.about}</p>
      </section>
      <section>
        <p className="bp-h">Coverage</p>
        <p style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 7, fontSize: 14, color: "var(--agent-text-primary)" }}>
          <MapPinLine size={16} style={{ color: "var(--agent-text-muted)" }} /> {b.coverage}
        </p>
      </section>
      <section>
        <p className="bp-h">Specialisms</p>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
          {b.specialisms.map((s) => (
            <li key={s} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--agent-text-primary)" }}>
              <Check size={15} weight="bold" style={{ color: "var(--agent-coral-deep)", flexShrink: 0 }} /> {s}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Performance({ b }: { b: ProgressorFixture }) {
  const warming = b.stats.completionRate == null;
  if (warming) {
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
        <Big value={`${b.stats.completionRate}%`} label="Completion rate" />
        <Big value={`${b.stats.exchanges12mo}`} label="Exchanges, last 12 months" />
        <Big value={`${b.stats.avgWeeks} wks`} label="Average time to exchange" />
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

function Team({ b }: { b: ProgressorFixture }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
      {b.team.map((m) => (
        <div key={m.name} className="agent-glass" style={{ borderRadius: "var(--agent-radius-lg)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <ContactAvatar contact={{ name: m.name, roleType: "agent" }} size={40} />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--agent-text-muted)" }}>{m.role}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
