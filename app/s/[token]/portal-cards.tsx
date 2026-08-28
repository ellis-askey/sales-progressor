import Link from "next/link";
import { Check, House, FileText, MagnifyingGlass, ChatText, ArrowsLeftRight, Key, CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { ResolvedStage, DisplayStageKey } from "@/lib/milestones/display-stages";
import { S } from "./ui";

// Shared white card matching the client portal's card feel (radius + soft
// shadow), in the professional blue palette.
export function PortalCard({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div
      className={className}
      style={{ background: S.cardFrostBg, backdropFilter: S.cardFrostBlur, WebkitBackdropFilter: S.cardFrostBlur, border: `1px solid ${S.cardFrostBorder}`, borderRadius: S.radiusMd, boxShadow: S.shadowCard, padding: "18px", ...style }}
    >
      {children}
    </div>
  );
}

export function CardKicker({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
      <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: S.muted }}>{children}</p>
      {right}
    </div>
  );
}

const STAGE_ICON: Record<DisplayStageKey, React.ReactNode> = {
  instructed: <House size={15} weight="regular" />,
  draft_pack: <FileText size={15} weight="regular" />,
  searches: <MagnifyingGlass size={15} weight="regular" />,
  enquiries: <ChatText size={15} weight="regular" />,
  exchange: <ArrowsLeftRight size={15} weight="regular" />,
  completion: <Key size={15} weight="regular" />,
};

function fmtShort(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// The 6-stage "Progress overview" strip — a horizontal row of stage nodes with
// connectors, scrollable on narrow screens. Clones the portal's ProgressTile.
export function ProgressOverviewCard({ stages, timelineHref }: { stages: ResolvedStage[]; timelineHref: string }) {
  return (
    <PortalCard>
      <CardKicker
        right={
          <Link href={timelineHref} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 600, color: S.accent, textDecoration: "none", background: S.accentBg, padding: "5px 10px", borderRadius: 999 }}>
            View full timeline <CaretRight size={12} weight="bold" />
          </Link>
        }
      >
        Progress overview
      </CardKicker>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 0, overflowX: "auto", paddingBottom: 2 }}>
        {stages.map((s, i) => (
          <div key={s.key} style={{ display: "flex", alignItems: "flex-start", flex: "1 0 auto" }}>
            <StageNode stage={s} />
            {i < stages.length - 1 && (
              <div style={{ width: 16, height: 2, marginTop: 16, background: s.status === "complete" ? S.successRing : "rgba(15,39,64,0.12)", flexShrink: 0, alignSelf: "flex-start" }} />
            )}
          </div>
        ))}
      </div>
    </PortalCard>
  );
}

function StageNode({ stage }: { stage: ResolvedStage }) {
  const st = stage.status;
  const ring =
    st === "complete" ? S.successRing : st === "in_progress" ? S.accent : "rgba(15,39,64,0.18)";
  const iconColor = st === "complete" ? "#ffffff" : st === "in_progress" ? S.accent : S.muted;
  const sub =
    st === "complete"
      ? "Complete"
      : st === "in_progress"
        ? "In progress"
        : st === "up_next"
          ? "Up next"
          : st === "skipped"
            ? "Skipped"
            : stage.key === "exchange" && stage.forecastDate
              ? `Target ~ ${fmtShort(stage.forecastDate)}`
              : stage.key === "completion"
                ? "TBC"
                : "Not started";
  const subColor = st === "complete" ? S.successRing : st === "in_progress" ? S.accent : S.faint;
  return (
    <div style={{ width: 76, minWidth: 76, textAlign: "center", flexShrink: 0 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `2px solid ${ring}`,
          background: st === "complete" ? S.successRing : "#ffffff",
          color: iconColor,
        }}
      >
        {st === "complete" ? <Check size={15} weight="bold" /> : STAGE_ICON[stage.key]}
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 11, fontWeight: 600, color: st === "skipped" ? S.faint : S.ink, lineHeight: 1.25, textDecoration: st === "skipped" ? "line-through" : "none" }}>{stage.name}</p>
      <p style={{ margin: "3px 0 0", fontSize: 10, color: subColor, fontWeight: st === "in_progress" ? 600 : 400, lineHeight: 1.3 }}>{sub}</p>
    </div>
  );
}
