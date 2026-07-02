// Hub polish PR 2 — Pipeline at a glance visualization.
//
// Five connected stage circles: New → Legals → Ready → Exchanging → Completed.
// Each shows the count for that bucket per getHubPipelineStages(vis).
//
// Card lives in the "attention side" column on desktop; collapses to a
// horizontal-scroll pill strip on mobile via the built-in overflow-x rule
// on the outer container.

import { HouseSimple, FileText, Handshake, ArrowsClockwise, Key } from "@phosphor-icons/react/dist/ssr";
import type { HubPipelineStages } from "@/lib/services/hub";

type Stage = {
  key: keyof HubPipelineStages;
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
  { key: "exchanging", label: "Exchanging", Icon: ArrowsClockwise,   iconBg: "rgba(139, 92, 246, 0.10)", iconColor: "#6d28d9", ringColor: "rgba(139, 92, 246, 0.35)" },
  { key: "completed",  label: "Completed",  Icon: Key,               iconBg: "rgba(16, 185, 129, 0.12)", iconColor: "#065f46", ringColor: "rgba(16, 185, 129, 0.35)" },
];

export function PipelineAtAGlance({ stages }: { stages: HubPipelineStages }) {
  const totalActive = stages.new + stages.legals + stages.ready + stages.exchanging;
  const anyProgress = totalActive > 0 || stages.completed > 0;

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
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 4,
          overflowX: "auto",
          paddingBottom: 4,
        }}>
          {STAGES.map((stage, i) => (
            <div key={stage.key} style={{ display: "flex", alignItems: "flex-start", gap: 4, flex: 1, minWidth: 0 }}>
              <StageNode
                Icon={stage.Icon}
                label={stage.label}
                count={stages[stage.key]}
                iconBg={stage.iconBg}
                iconColor={stage.iconColor}
                ringColor={stage.ringColor}
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
  Icon, label, count, iconBg, iconColor, ringColor,
}: {
  Icon: typeof HouseSimple;
  label: string;
  count: number;
  iconBg: string;
  iconColor: string;
  ringColor: string;
}) {
  const dim = count === 0;
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8,
      flex: "0 0 auto",
      minWidth: 78,
      opacity: dim ? 0.6 : 1,
      transition: "opacity 200ms ease",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        background: iconBg,
        border: `1.5px solid ${ringColor}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: iconColor,
        boxShadow: dim ? "none" : "0 1px 3px rgba(15,23,42,0.06)",
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
        {label}
      </p>
    </div>
  );
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
