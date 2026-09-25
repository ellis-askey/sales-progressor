// The "steps done" header at the top of the client's Progress tab: how many
// steps are complete, an optional completion percentage + bar, and the next
// step. The percentage + bar are gated by the agency's "Progress figure"
// display setting (showPortalProgressPercent) so a client can be shown the
// qualitative "X of Y steps done" without a percentage that can mislead.
//
// Lifted into its own component so the director's Client-portal settings preview
// renders exactly what buyers/sellers see, in both the on (with %) and off
// (steps only) states.

import { P } from "./portal-ui";
import { PortalGlassCard } from "./PortalGlassCard";

export function PortalProgressHeader({
  completed,
  total,
  percent,
  showPercent = true,
  hasExchanged = false,
  nextLabel = null,
}: {
  completed: number;
  total: number;
  percent: number;
  showPercent?: boolean;
  hasExchanged?: boolean;
  nextLabel?: string | null;
}) {
  return (
    <PortalGlassCard glassId="progress-header" label="Progress: steps-done header" defaultVariant="v25" className="px-5 py-4">
      <div className="flex items-center justify-between" style={{ marginBottom: showPercent ? 12 : 0 }}>
        <p className="text-[15px] font-semibold" style={{ color: P.textPrimary }}>
          {completed} of {total} steps done
        </p>
        {showPercent && <p className="text-[15px] font-bold" style={{ color: P.accent }}>{percent}%</p>}
      </div>
      {showPercent && (
        <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: P.border }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${percent}%`, background: percent >= 80 ? P.success : P.accent }}
          />
        </div>
      )}
      {hasExchanged ? (
        <p className="text-[12px] mt-3 font-semibold" style={{ color: P.success }}>Contracts exchanged</p>
      ) : nextLabel ? (
        <p className="text-[12px] mt-3" style={{ color: P.textMuted }}>
          Next: <span style={{ color: P.textSecondary }}>{nextLabel}</span>
        </p>
      ) : null}
    </PortalGlassCard>
  );
}
