"use client";

import { useRouter } from "next/navigation";
import { ArrowsClockwise } from "@phosphor-icons/react";
import type { WeekBucket } from "@/lib/services/hub";
import { fmtCurrencyPence } from "@/lib/utils";
import { Donut } from "@/components/ui/Donut";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { HeatBand } from "@/components/ui/HeatBand";
import { buttonClasses } from "@/components/arc/button/button";

// ── Refresh button ─────────────────────────────────────────────────────────────

export function RefreshButton({ updatedLabel }: { updatedLabel: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.refresh()}
      title="Refresh data"
      className={buttonClasses({ variant: "ghost", size: "sm" })}
      style={{ gap: 5, color: "var(--agent-text-muted)", fontSize: 11 }}
    >
      <ArrowsClockwise size={13} />
      {updatedLabel}
    </button>
  );
}

// ── Momentum ring ─────────────────────────────────────────────────────────────

export function MomentumRing({ percent }: { percent: number | null }) {
  if (percent === null) {
    return (
      <div style={{ textAlign: "center", maxWidth: 160, padding: "4px 0" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
          No comparison yet
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
          Check back after your first full month.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <ProgressRing value={percent} />
    </div>
  );
}

// ── Exchange forecast heat band ───────────────────────────────────────────────
// F6 glass band (Ellis pick, 2026-09-18) — replaced the recharts bar chart +
// house glyphs. Five glass cells, coral intensity scaled to the week's count,
// count + week label printed IN the cell (so no hover needed for the number).
// The hover popup keeps the frosty-glass recipe (same family as
// PipelineStageHover) but now shows what the chart can't: the properties due
// that week (biggest first) and their combined value.

// Popup week phrase: "this week", "+1 week", "+4 weeks" (never the cell's
// terse "+4w" — Ellis, 2026-09-18).
function weekPhrase(w: WeekBucket): string {
  if (w.isCurrentWeek) return "this week";
  const n = parseInt(w.label.replace(/\D/g, ""), 10) || 0;
  return n === 1 ? "+1 week" : `+${n} weeks`;
}

export function ForecastHeatBand({ data }: { data: WeekBucket[] }) {
  return (
    <HeatBand
      cells={data.map((w) => ({
        label: w.label,
        value: w.count,
        strong: w.isCurrentWeek,
        ariaLabel: `${w.label}: ${w.count} ${w.count === 1 ? "exchange" : "exchanges"} due${w.feesPence > 0 ? `, ${fmtCurrencyPence(w.feesPence)} in fees` : ""}`,
      }))}
      tooltip={(i) => {
        const open = data[i];
        return (
          <>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>
              {open.feesPence > 0
                ? `${fmtCurrencyPence(open.feesPence)} in fees due ${weekPhrase(open)}`
                : `${open.count} ${open.count === 1 ? "exchange" : "exchanges"} ${weekPhrase(open)}`}
            </p>
            {open.files.slice(0, 3).map((f) => (
              <p key={f.address} style={{ margin: "4px 0 0", fontSize: 11.5, opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.address}
                {f.feePence > 0 && ` · ${fmtCurrencyPence(f.feePence)}`}
              </p>
            ))}
            {open.files.length > 3 && (
              <p style={{ margin: "4px 0 0", fontSize: 11, opacity: 0.6 }}>
                +{open.files.length - 3} more
              </p>
            )}
          </>
        );
      }}
    />
  );
}

// ── Service split donut ───────────────────────────────────────────────────────

export function ServiceSplitDonut({
  selfManaged,
  outsourced,
}: {
  selfManaged: number;
  outsourced: number;
}) {
  return (
    <Donut
      size={92}
      thickness={10}
      segments={[
        { value: selfManaged, color: "var(--agent-coral)" },
        { value: outsourced, color: "var(--agent-warning)" },
      ]}
    />
  );
}
