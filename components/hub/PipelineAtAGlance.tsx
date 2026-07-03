"use client";

// Hub polish PR 2 — Pipeline at a glance visualization.
//
// Five connected stage circles: New → Legals → Ready → Exchanging → Completed.
// Each shows the count for that bucket per getHubPipelineStages(vis), and on
// hover / focus / tap reveals a glass bubble with per-stage stats (medians,
// value locked, overdue counts, SLA hit rate). Data is already scoped to the
// viewer's visibility upstream, so nothing role-specific in this component.
//
// Card lives in the "attention side" column on desktop; collapses to a
// horizontal-scroll pill strip on mobile via the built-in overflow-x rule
// on the outer container.

import { useEffect, useRef, useState } from "react";
import { HouseSimple, FileText, Handshake, ArrowsClockwise, Key } from "@phosphor-icons/react/dist/ssr";
import type { HubPipelineStages } from "@/lib/services/hub";
import { PipelineStageHover, type StageKey } from "./PipelineStageHover";

type Stage = {
  key: StageKey;
  label: string;
  Icon: typeof HouseSimple;
  iconBg: string;
  iconColor: string;
  ringColor: string;
};

const STAGES: Stage[] = [
  { key: "new",        label: "New",        Icon: HouseSimple,      iconBg: "rgba(16, 185, 129, 0.10)", iconColor: "#047857", ringColor: "rgba(16, 185, 129, 0.35)" },
  { key: "legals",     label: "Legals",     Icon: FileText,          iconBg: "rgba(59, 130, 246, 0.10)", iconColor: "#1d4ed8", ringColor: "rgba(59, 130, 246, 0.35)" },
  { key: "ready",      label: "Ready",      Icon: Handshake,         iconBg: "rgba(245, 158, 11, 0.10)", iconColor: "#b45309", ringColor: "rgba(245, 158, 11, 0.35)" },
  { key: "exchanging", label: "Exchanged",  Icon: ArrowsClockwise,   iconBg: "rgba(139, 92, 246, 0.10)", iconColor: "#6d28d9", ringColor: "rgba(139, 92, 246, 0.35)" },
  { key: "completed",  label: "Completed",  Icon: Key,               iconBg: "rgba(16, 185, 129, 0.12)", iconColor: "#065f46", ringColor: "rgba(16, 185, 129, 0.35)" },
];

export function PipelineAtAGlance({ stages }: { stages: HubPipelineStages }) {
  const totalActive = stages.new.count + stages.legals.count + stages.ready.count + stages.exchanging.count;
  const anyProgress = totalActive > 0 || stages.completed.count > 0;

  // Which stage's bubble is currently open. On desktop, mouseover sets it,
  // mouseout clears. On mobile / keyboard, tap or focus sets it and Escape
  // / outside-tap clears.
  const [openKey, setOpenKey] = useState<StageKey | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openKey === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenKey(null);
    };
    const onOutside = (e: Event) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenKey(null);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onOutside);
    window.addEventListener("touchstart", onOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onOutside);
      window.removeEventListener("touchstart", onOutside);
    };
  }, [openKey]);

  return (
    <div className="agent-glass" style={{ padding: "20px 24px" }}>
      <div className="agent-card-hdr-internal" style={{ marginBottom: 18 }}>
        <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Pipeline at a glance</p>
        <p className="agent-card-subtitle">
          Where every file sits right now.
        </p>
      </div>

      {!anyProgress ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)", lineHeight: 1.55 }}>
          Add your first sale and it will land in the <strong style={{ color: "var(--agent-text-primary)" }}>New</strong> column here.
        </p>
      ) : (
        <div
          ref={containerRef}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 4,
            overflowX: "auto",
            overflowY: "visible",
            paddingBottom: 4,
          }}
        >
          {STAGES.map((stage, i) => (
            <div
              key={stage.key}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 4,
                flex: 1,
                minWidth: 0,
              }}
            >
              <StageNode
                stage={stage}
                stages={stages}
                open={openKey === stage.key}
                onOpen={() => setOpenKey(stage.key)}
                onClose={() => setOpenKey(null)}
                onToggle={() => setOpenKey(openKey === stage.key ? null : stage.key)}
              />
              {i < STAGES.length - 1 && <StageConnector />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StageNode({
  stage, stages, open, onOpen, onClose, onToggle,
}: {
  stage: Stage;
  stages: HubPipelineStages;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggle: () => void;
}) {
  const stats = stages[stage.key];
  const count = stats.count;
  const dim = count === 0;
  const Icon = stage.Icon;

  const nodeRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (nodeRef.current) setAnchor(nodeRef.current.getBoundingClientRect());
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  return (
    <div
      ref={nodeRef}
      role="button"
      tabIndex={0}
      aria-expanded={open}
      aria-label={`${stage.label}: ${count}`}
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
      onFocus={onOpen}
      onBlur={onClose}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        flex: "0 0 auto",
        minWidth: 78,
        opacity: dim ? 0.6 : 1,
        transition: "opacity 200ms ease",
        cursor: "pointer",
        outline: "none",
      }}
    >
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        background: stage.iconBg,
        border: `1.5px solid ${stage.ringColor}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: stage.iconColor,
        // Strip has overflow-x: auto (mobile scroll), which per CSS spec
        // implicitly clips the vertical axis too. A translateY affordance
        // would clip the top of the circle — swap for a shadow bump.
        boxShadow: dim
          ? "none"
          : open
            ? "0 4px 12px rgba(15,23,42,0.14), 0 1px 3px rgba(15,23,42,0.06)"
            : "0 1px 3px rgba(15,23,42,0.06)",
        transition: "box-shadow 160ms ease",
      }}>
        <Icon size={22} weight="regular" />
      </div>
      <p style={{
        margin: 0,
        fontSize: 20,
        fontWeight: 700,
        color: "var(--agent-text-primary)",
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.01em",
      }}>
        {count}
      </p>
      <p style={{
        margin: 0,
        fontSize: 11,
        color: "var(--agent-text-muted)",
        fontWeight: 500,
        textAlign: "center",
      }}>
        {stage.label}
      </p>
      {open && renderHover(stage.key, stages, anchor)}
    </div>
  );
}

function renderHover(key: StageKey, stages: HubPipelineStages, anchor: DOMRect | null) {
  if (key === "new")        return <PipelineStageHover stage="new"        stats={stages.new}        anchor={anchor} />;
  if (key === "legals")     return <PipelineStageHover stage="legals"     stats={stages.legals}     anchor={anchor} />;
  if (key === "ready")      return <PipelineStageHover stage="ready"      stats={stages.ready}      anchor={anchor} />;
  if (key === "exchanging") return <PipelineStageHover stage="exchanging" stats={stages.exchanging} anchor={anchor} />;
  return                          <PipelineStageHover stage="completed"  stats={stages.completed}  anchor={anchor} />;
}

function StageConnector() {
  return (
    <div style={{
      flex: 1,
      minWidth: 12,
      marginTop: 28, // vertical align with circle midpoint (56/2)
      height: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{
        width: "100%",
        borderTop: "1px dashed rgba(15,23,42,0.15)",
      }} />
    </div>
  );
}
