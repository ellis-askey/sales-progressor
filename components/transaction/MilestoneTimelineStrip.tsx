"use client";

// Overview restyle 2026-07-03 — 6-stage summary of a file's journey.
// One row of coloured circles: Instructed / Draft pack / Searches /
// Enquiries / Exchange / Completion. Each stage carries:
//   - complete  → filled emerald circle + white tick + real completedAt date
//   - active    → white circle with coral ring + stage icon + "In progress"
//   - pending   → hollow slate outline + muted stage icon + forecast date (if any)
//
// Data feeds from the milestone engine via a small mapping constant
// (see lib/milestones/display-stages.ts). Full detailed milestone list
// stays on the Steps tab, untouched — this is a summary read.

import type { ReactNode } from "react";
import { Check, HouseSimple, FileText, MagnifyingGlass, ChatCircleText, Handshake, Key } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { formatDate } from "@/lib/utils";
import type { DisplayStageKey } from "@/lib/milestones/display-stages";

export type StageStatus = "complete" | "active" | "pending";

// Icons are looked up here rather than passed in, so the resolved stage
// data can flow from a Server Component to this Client Component without
// crossing the RSC serialisation boundary (2026-07-03 outage fix).
const STAGE_ICON: Record<DisplayStageKey, Icon> = {
  instructed: HouseSimple,
  draft_pack: FileText,
  searches:   MagnifyingGlass,
  enquiries:  ChatCircleText,
  exchange:   Handshake,
  completion: Key,
};

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
  return "–";
}

export function MilestoneTimelineStrip({ stages }: { stages: MilestoneStage[] }) {
  if (stages.length === 0) return null;

  return (
    <div
      role="list"
      aria-label="File progress stages"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 4,
        overflowX: "auto",
        overflowY: "visible",
        padding: "4px 4px 4px",
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
          <StageNode stage={stage} />
          {i < stages.length - 1 && <StageConnector prevComplete={stage.status === "complete"} />}
        </div>
      ))}
    </div>
  );
}

function StageNode({ stage }: { stage: MilestoneStage }): ReactNode {
  const tone = STAGE_TONES[stage.status];
  const Icon = STAGE_ICON[stage.key];
  const size = 44;
  const ringWidth = stage.status === "active" ? 2 : 1.5;

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
          <Check size={20} weight="bold" />
        ) : (
          <Icon size={18} weight="regular" />
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
      marginTop: 22, // circle centre = size/2 = 22
      height: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{
        width: "100%",
        borderTop: prevComplete
          ? "1px solid rgba(16, 185, 129, 0.35)"
          : "1px dashed rgba(15, 23, 42, 0.15)",
      }} />
    </div>
  );
}
