// The "finish line" band at the top of Completions — the payoff, not a nag.
// Four cards via the shared StatCards primitive (components/ui/StatCards.tsx),
// with the audience-aware "fees due" line as its own note card below. Figures
// come from getCompletionsMomentum + the page's in-flight totals.

import { Trophy, Timer, CheckCircle, Airplane } from "@phosphor-icons/react/dist/ssr";
import { StatCards, type StatCardSpec } from "@/components/ui/StatCards";

function fmtCompact(pence: number): string {
  const pounds = pence / 100;
  if (pounds >= 1_000_000) return "£" + (pounds / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (pounds >= 1_000) return "£" + Math.round(pounds / 1_000) + "k";
  return "£" + pounds.toLocaleString("en-GB");
}

function fmtFull(pence: number): string {
  return "£" + Math.round(pence / 100).toLocaleString("en-GB");
}

export function CompletionsMomentum({
  completed30dCount,
  completed30dValuePence,
  avgExchangeToCompletionDays,
  onTimePct,
  inFlightCount,
  inFlightValuePence,
  feesPence,
  feeLabel,
  feeNote,
}: {
  completed30dCount: number;
  completed30dValuePence: number;
  avgExchangeToCompletionDays: number | null;
  onTimePct: number | null;
  inFlightCount: number;
  inFlightValuePence: number;
  // Audience-aware fees due on the in-flight completions — the fee THIS viewer
  // earns, resolved server-side. No switcher: one fixed line per login.
  feesPence: number;
  feeLabel: string;
  feeNote: string;
}) {
  const cells: StatCardSpec[] = [
    {
      key: "completed",
      icon: <Trophy size={22} weight="fill" />,
      tone: "success",
      label: "Completed · 30 days",
      value: String(completed30dCount),
      sub: completed30dValuePence > 0 ? `${fmtCompact(completed30dValuePence)} crossed the line` : "Nothing landed yet",
    },
    {
      key: "avg",
      icon: <Timer size={22} weight="regular" />,
      tone: "info",
      label: "Avg exchange → completion",
      value: avgExchangeToCompletionDays != null ? `${avgExchangeToCompletionDays}d` : "—",
      sub: avgExchangeToCompletionDays != null ? "Your typical turnaround" : "No completions to measure yet",
    },
    {
      key: "ontime",
      icon: <CheckCircle size={22} weight="regular" />,
      tone: onTimePct == null ? "neutral" : onTimePct >= 70 ? "success" : "warning",
      label: "Completed on time",
      value: onTimePct != null ? `${onTimePct}%` : "—",
      sub: onTimePct != null ? "On or before target" : "No target dates set",
    },
    {
      key: "inflight",
      icon: <Airplane size={22} weight="regular" />,
      tone: "coral",
      label: "In flight",
      value: String(inFlightCount),
      sub: inFlightValuePence > 0 ? `${fmtCompact(inFlightValuePence)} still to complete` : "Nothing in flight",
    },
  ];

  return (
    <div>
      <StatCards cards={cells} ariaLabel="Completions finish line" />

      {/* Fees due — one fixed line, resolved from who's logged in. No switcher.
          Its own note card below the tiles; audience label/note unchanged. */}
      {feesPence > 0 && (
        <div className="statcards-note">
          <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <span className="statcards-note-val">{fmtFull(feesPence)}</span>
            <span className="statcards-note-sub">
              <b>{feeLabel}</b> · {feeNote}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
