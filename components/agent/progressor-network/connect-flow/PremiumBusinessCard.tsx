"use client";

import { BookmarkSimple, MapPinLine, UsersThree, SealCheck, ArrowRight, Check } from "@phosphor-icons/react";
import { AgencyMeshMark } from "@/components/progression/AgencyMeshMark";
import { StatNumber } from "@/components/ui/StatNumber";
import { Button } from "@/components/ui/Button";
import type { ProgressorFixture, RelState } from "./fixtures";

// Premium marketplace card. Hierarchy: identity + the three headline metrics are
// the stars; availability, coverage, specialisms and team recede into quiet
// supporting lines. Coral is reserved for the one primary action. No pills,
// no icon-circle clutter, no gradients.

export function PremiumBusinessCard({
  business,
  relState,
  saved,
  onToggleSave,
  onViewProfile,
  onConnect,
}: {
  business: ProgressorFixture;
  relState: RelState;
  saved: boolean;
  onToggleSave: () => void;
  onViewProfile: () => void;
  onConnect: () => void;
}) {
  const b = business;
  const warming = b.stats.completionRate == null;
  const accepting = b.availability === "accepting";

  return (
    <article
      className="agent-glass-strong pbc"
      style={{ borderRadius: "var(--agent-radius-xl)", padding: 22, display: "flex", flexDirection: "column" }}
    >
      <header style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <span aria-hidden style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 14, overflow: "hidden" }}>
          <AgencyMeshMark name={b.name} size={52} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--agent-text-primary)", lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {b.name}
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--agent-text-muted)" }}>{b.descriptor}</p>
        </div>
        <button
          type="button"
          className="pbc-save"
          aria-pressed={saved}
          aria-label={saved ? "Remove from saved" : "Save"}
          onClick={onToggleSave}
          style={{ color: saved ? "var(--agent-coral-deep)" : "var(--agent-text-muted)" }}
        >
          <BookmarkSimple size={18} weight={saved ? "fill" : "regular"} />
        </button>
      </header>

      {/* Availability — a quiet dot + label, not a pill */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 14 }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: accepting ? "var(--agent-success)" : "var(--agent-text-muted)", flexShrink: 0 }} />
        <span style={{ fontSize: 12.5, fontWeight: 500, color: accepting ? "var(--agent-success)" : "var(--agent-text-muted)" }}>
          {accepting ? "Accepting new instructions" : "Not taking new work"}
        </span>
      </div>

      <p style={{ margin: "14px 0 0", fontSize: 14, lineHeight: 1.5, color: "var(--agent-text-secondary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 42 }}>
        {b.blurb}
      </p>

      {/* Headline metrics */}
      <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--agent-border-subtle)" }}>
        {warming ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
            Building a verified track record. Stats appear as sales complete on the platform.
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            <Metric value={`${b.stats.completionRate}%`} label="Completion rate" />
            <Metric value={`${b.stats.exchanges12mo}`} label="Exchanges, 12m" />
            <Metric value={`${b.stats.avgWeeks} wks`} label="Avg. to exchange" />
          </div>
        )}
      </div>

      {/* Supporting info — one quiet line */}
      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", fontSize: 12.5, color: "var(--agent-text-muted)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <MapPinLine size={14} /> {b.coverage}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <SealCheck size={14} /> {b.specialisms[0]}
          {b.specialisms.length > 1 ? ` +${b.specialisms.length - 1}` : ""}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <UsersThree size={14} /> Team of {b.stats.teamSize}
        </span>
      </div>

      {/* Actions — adapt to relationship state */}
      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <Button variant="secondary" size="md" style={{ flex: 1, justifyContent: "center" }} onClick={onViewProfile}>
          View profile
        </Button>
        {relState === "pending" ? (
          <Button variant="secondary" size="md" style={{ flex: 1, justifyContent: "center" }} disabled>
            Request sent
          </Button>
        ) : relState === "connected" ? (
          <Button variant="primary" size="md" style={{ flex: 1, justifyContent: "center" }}>
            Assign a sale
          </Button>
        ) : relState === "declined" ? (
          <Button variant="primary" size="md" style={{ flex: 1, justifyContent: "center" }} onClick={onConnect}>
            Request again
          </Button>
        ) : (
          <Button variant="primary" size="md" style={{ flex: 1, justifyContent: "center" }} onClick={onConnect}>
            Connect <ArrowRight size={15} weight="bold" />
          </Button>
        )}
      </div>

      <style>{`
        .pbc{transition:box-shadow .2s ease,border-color .2s ease}
        .pbc:hover{box-shadow:0 12px 32px rgba(15,23,42,0.10);border-color:rgba(var(--agent-coral-rgb),0.22)}
        .pbc-save{border:none;background:transparent;cursor:pointer;padding:4px;border-radius:8px;flex-shrink:0;display:inline-flex;transition:background .15s ease,color .15s ease}
        .pbc-save:hover{background:var(--agent-surface-glass)}
      `}</style>
    </article>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <StatNumber size="md">{value}</StatNumber>
      <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.3 }}>{label}</p>
    </div>
  );
}
