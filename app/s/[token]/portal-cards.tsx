import Link from "next/link";
import { Check, House, FileText, MagnifyingGlass, ChatText, ArrowsLeftRight, Key, CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { ResolvedStage, DisplayStageKey } from "@/lib/milestones/display-stages";
import { PortalGlassCard } from "@/components/portal/PortalGlassCard";
import { ProgressStripScroller } from "./ProgressStripScroller";
import { S } from "./ui";

// Shared card, tagged as a Design-Lab surface (glassId/label) so the founder can
// swap its glass variant live. Default is a light frost over the cool gradient.
export function PortalCard({ glassId, label, children, style, className }: { glassId: string; label: string; children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <PortalGlassCard glassId={glassId} label={label} defaultVariant="v03" radius={16} className={className} style={{ padding: "18px", ...style }}>
      {children}
    </PortalGlassCard>
  );
}

// Exchanged / completed status strip, shown above the hero when relevant.
export function StatusBanner({ exchanged, completed, completionDate }: { exchanged: boolean; completed: boolean; completionDate: Date | null }) {
  if (!exchanged && !completed) return null;
  const text = completed ? "Completed" : "Exchanged";
  const sub = completed
    ? "This matter has completed."
    : completionDate
      ? `Completion on ${new Date(completionDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
      : "Contracts are exchanged.";
  return (
    <div style={{ background: S.successBg, border: "1px solid rgba(31,157,85,0.3)", borderRadius: S.radiusMd, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: S.shadowCard }}>
      <span style={{ width: 32, height: 32, borderRadius: 16, background: S.successRing, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Check size={17} weight="bold" />
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1a6b3f", lineHeight: 1.3 }}>{text}</p>
        <p style={{ margin: "1px 0 0", fontSize: 13, color: "#2f7d4f", lineHeight: 1.35 }}>{sub}</p>
      </div>
    </div>
  );
}

// A gentle "here's what's next on your side" look-ahead.
export function ComingUpCard({ labels }: { labels: string[] }) {
  if (!labels.length) return null;
  return (
    <PortalCard glassId="sol-coming-up" label="Coming up">
      <CardKicker>Coming up</CardKicker>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {labels.map((l, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(15,39,64,0.22)", flexShrink: 0 }} />
            <span style={{ fontSize: 14, color: S.inkSoft }}>{l}</span>
          </div>
        ))}
      </div>
      <p style={{ margin: "13px 0 0", fontSize: 12, color: S.faint, lineHeight: 1.5 }}>We&rsquo;ll ask you to confirm these when they&rsquo;re due.</p>
    </PortalCard>
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
    <PortalCard glassId="sol-progress-overview" label="Progress overview">
      <CardKicker
        right={
          <Link href={timelineHref} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 600, color: S.accent, textDecoration: "none", background: S.accentBg, padding: "5px 10px", borderRadius: 999 }}>
            View full timeline <CaretRight size={12} weight="bold" />
          </Link>
        }
      >
        Progress overview
      </CardKicker>
      <ProgressStripScroller>
        {stages.map((s, i) => (
          <div key={s.key} style={{ display: "flex", alignItems: "flex-start", flex: "1 0 auto" }}>
            <StageNode stage={s} />
            {i < stages.length - 1 && (
              <div style={{ width: 16, height: 2, marginTop: 16, background: s.status === "complete" ? S.successRing : "rgba(15,39,64,0.12)", flexShrink: 0, alignSelf: "flex-start" }} />
            )}
          </div>
        ))}
      </ProgressStripScroller>
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
