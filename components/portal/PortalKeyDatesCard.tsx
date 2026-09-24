// The "Expected exchange" card on the client portal Overview: the fixed 12-week
// target, the firm planned date (or the soft month-level estimate), and the
// "You're in good hands" reassurance band. Lifted out of PortalOverviewHero so
// the same card renders verbatim in the director's Client-portal settings
// preview (Account -> Client portal) as it does for buyers/sellers.

import { Shield } from "@phosphor-icons/react/dist/ssr";
import { P } from "./portal-ui";
import { PortalGlassCard } from "./PortalGlassCard";

function fmtDateLong(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
// Soft, month-level rendering for the ESTIMATE so a small shift doesn't read as
// a broken promise. Early (1-10) / mid (11-20) / late (21+) of the month.
function fmtMonthLevel(d: Date | string): string {
  const dt = new Date(d);
  const day = dt.getDate();
  const tier = day <= 10 ? "early" : day <= 20 ? "mid" : "late";
  const month = dt.toLocaleDateString("en-GB", { month: "long" });
  return `${tier} ${month}`;
}

export function PortalKeyDatesCard({
  targetDate,
  estimateDate,
  plannedDate,
  daysUntilPredicted,
}: {
  targetDate: Date | null;
  estimateDate: Date | null;
  plannedDate: Date | null;
  daysUntilPredicted: number | null;
}) {
  if (!targetDate && !estimateDate && !plannedDate) return null;
  return (
    <PortalGlassCard glassId="expected-exchange" label="Expected exchange" className="portal-reveal-up" style={{ overflow: "hidden" }}>
      {/* Top: two date columns. Left = the FIXED 12-week target (the aim,
          never moves). Right = either a firm PLANNED date, or the soft,
          month-level ESTIMATE. Keeping both visible stops the estimate
          being read as a broken promise when it shifts. */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
        gap: 0,
      }}>
        {/* Left: 12-week target */}
        <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: P.primaryBg, color: P.primary,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8"  y1="2" x2="8"  y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 11, color: P.textSecondary, fontWeight: 500 }}>
              12-week target
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: P.textPrimary, lineHeight: 1.2 }}>
              {targetDate ? `by ${fmtDateLong(targetDate)}` : "To be confirmed"}
            </p>
          </div>
        </div>
        {/* Right: firm planned date, else the soft month-level estimate */}
        <div style={{
          padding: "16px 18px",
          display: "flex", alignItems: "center", gap: 12,
          borderLeft: `0.5px solid ${P.border}`,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: plannedDate ? P.primaryBg : "rgba(15,23,42,0.06)",
            color: plannedDate ? P.primary : P.textMuted,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8"  y1="2" x2="8"  y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 11, color: P.textSecondary, fontWeight: 500 }}>
              {plannedDate ? "Planned exchange" : "Estimated exchange"}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: P.textPrimary, lineHeight: 1.2 }}>
              {plannedDate
                ? fmtDateLong(plannedDate)
                : estimateDate
                  ? `around ${fmtMonthLevel(estimateDate)}`
                  : "To be confirmed"}
            </p>
            {typeof daysUntilPredicted === "number" && daysUntilPredicted >= 0 && (
              <p style={{ margin: "2px 0 0", fontSize: 11, color: P.textMuted }}>
                {daysUntilPredicted === 0
                  ? "today"
                  : daysUntilPredicted === 1
                    ? (plannedDate ? "1 day to go" : "about 1 day to go")
                    : `${plannedDate ? "" : "about "}${daysUntilPredicted} days to go`}
              </p>
            )}
          </div>
        </div>
      </div>
      {/* Bottom: full-width reassurance band */}
      <div style={{
        padding: "14px 18px",
        display: "flex", alignItems: "center", gap: 12,
        background: P.successBg,
        borderTop: `0.5px solid ${P.border}`,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "rgba(16,185,129,0.15)", color: P.success,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Shield size={18} weight="regular" />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#065F46", lineHeight: 1.2 }}>
            You&apos;re in good hands
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#047857", lineHeight: 1.35 }}>
            We&apos;ll keep you updated at every important step.
          </p>
        </div>
      </div>
    </PortalGlassCard>
  );
}
