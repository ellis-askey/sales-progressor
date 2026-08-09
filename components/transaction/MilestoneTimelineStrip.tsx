"use client";

// 6-stage summary of a file's journey: Instructed / Draft pack /
// Searches / Enquiries / Exchange / Completion.
//
// 2026-08-08 hero redesign: stage circles now carry their number rather
// than an icon (mock direction) —
//   - complete  → emerald ring + tick + real completedAt date
//   - active    → coral ring + coral stage number + "In progress"
//   - pending   → slate outline + muted number + forecast date or "Pending"
// plus a "View timeline" button on the right that switches to the Steps
// tab via TabContext (the strip renders inside PropertyFileTabs'
// beforeContent slot, so the context is always live on this page).
//
// Data feeds from the milestone engine via lib/milestones/display-stages.
// Full detailed milestone list stays on the Steps tab — this is a
// summary read.

import type { ReactNode } from "react";
import { Check, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { formatDate } from "@/lib/utils";
import type { DisplayStageKey } from "@/lib/milestones/display-stages";
import { useTabContext } from "./TabContext";

export type StageStatus = "complete" | "active" | "pending";

export type MilestoneStage = {
  key: DisplayStageKey;
  name: string;
  status: StageStatus;
  completedAt?: Date | null;
  forecastDate?: Date | null;
};

const STAGE_TONES: Record<StageStatus, {
  ring: string;
  bg: string;
  iconColor: string;
  labelColor: string;
  dateColor: string;
}> = {
  complete: {
    ring: "rgba(16, 185, 129, 0.35)",
    bg: "rgba(16, 185, 129, 0.14)",
    iconColor: "#047857",
    labelColor: "var(--agent-text-primary)",
    dateColor: "var(--agent-text-muted)",
  },
  active: {
    ring: "var(--agent-coral)",
    bg: "rgba(var(--agent-coral-rgb), 0.10)",
    iconColor: "var(--agent-coral-deep)",
    labelColor: "var(--agent-text-primary)",
    dateColor: "var(--agent-coral-deep)",
  },
  pending: {
    ring: "rgba(15, 23, 42, 0.15)",
    bg: "transparent",
    iconColor: "var(--agent-text-muted)",
    labelColor: "var(--agent-text-secondary)",
    dateColor: "var(--agent-text-muted)",
  },
};

function formatStageDate(stage: MilestoneStage): string {
  if (stage.status === "complete" && stage.completedAt) {
    return formatDate(stage.completedAt);
  }
  if (stage.status === "active") {
    return "In progress";
  }
  if (stage.forecastDate) {
    return `~ ${formatDate(stage.forecastDate)}`;
  }
  return "Pending";
}

export function MilestoneTimelineStrip({ stages }: { stages: MilestoneStage[] }) {
  const { setActiveTab } = useTabContext();
  if (stages.length === 0) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        role="list"
        aria-label="File progress stages"
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "flex-start",
          gap: 4,
          overflowX: "auto",
          overflowY: "visible",
          padding: "4px 4px 4px",
          // Soft fade at the right edge so the scrolling strip dissolves into
          // the "View timeline" button instead of ending on a hard cut.
          maskImage: "linear-gradient(to right, #000 calc(100% - 32px), transparent 100%)",
          WebkitMaskImage: "linear-gradient(to right, #000 calc(100% - 32px), transparent 100%)",
        }}
      >
        {stages.map((stage, i) => (
          <div
            key={stage.key}
            role="listitem"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 4,
              // 2026-07-06: was `flex: 1, minWidth: 0` which let stages
              // shrink below their content on narrow viewports, causing
              // the stage names + dates to overlap. `flex: 1 0 92px`
              // keeps them growing to fill on desktop but never lets
              // them shrink below 92px, so overflow-x: auto on the
              // container properly kicks in and the strip becomes
              // horizontally-scrollable on mobile.
              flex: "1 0 92px",
            }}
          >
            <StageNode stage={stage} index={i + 1} />
            {i < stages.length - 1 && <StageConnector prevComplete={stage.status === "complete"} />}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setActiveTab("milestones")}
        className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
        style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, alignSelf: "center" }}
      >
        View timeline
        <CaretRight size={12} weight="bold" />
      </button>
    </div>
  );
}

function StageNode({ stage, index }: { stage: MilestoneStage; index: number }): ReactNode {
  const tone = STAGE_TONES[stage.status];
  const size = 40;
  const ringWidth = 2;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        flex: "0 0 auto",
        minWidth: 74,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: tone.bg,
          border: `${ringWidth}px solid ${tone.ring}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: tone.iconColor,
          boxShadow: stage.status === "active"
            ? "0 2px 8px rgba(var(--agent-coral-rgb), 0.20)"
            : stage.status === "complete"
              ? "0 1px 3px rgba(15,23,42,0.06)"
              : "none",
        }}
      >
        {stage.status === "complete" ? (
          <Check size={18} weight="bold" />
        ) : (
          <span style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {index}
          </span>
        )}
      </div>
      <div style={{ textAlign: "center", minWidth: 0, maxWidth: 92, overflow: "hidden" }}>
        <p style={{
          margin: 0,
          fontSize: 12,
          fontWeight: 600,
          color: tone.labelColor,
          lineHeight: 1.3,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>{stage.name}</p>
        <p style={{
          margin: "2px 0 0",
          fontSize: 11,
          color: tone.dateColor,
          lineHeight: 1.3,
          fontWeight: stage.status === "active" ? 600 : 400,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>{formatStageDate(stage)}</p>
      </div>
    </div>
  );
}

function StageConnector({ prevComplete }: { prevComplete: boolean }) {
  return (
    <div style={{
      flex: 1,
      minWidth: 12,
      marginTop: 20, // circle centre = size/2 = 20
      height: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{
        width: "100%",
        borderTop: prevComplete
          ? "2px solid rgba(16, 185, 129, 0.45)"
          : "2px dashed rgba(15, 23, 42, 0.12)",
      }} />
    </div>
  );
}
