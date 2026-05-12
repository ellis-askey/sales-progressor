// components/transactions/ForecastStrip.tsx
// Rolling 12-month exchange forecast strip — fixed-width filter affordance
// above the transaction-list status tabs. Always renders 12 pills (current
// month through current+11). Populated months are clickable filters that
// update ?exchanging=YYYY-MM on /agent/transactions; empty months render
// as disabled placeholders so the agent sees the full horizon at a glance.
//
// Refactored 2026-05-12:
//   - Compact summary card → tall card replaced (commit 696fea0 → 1b905ae → 1f14afe)
//   - Variable-pill summary → rolling 12-month window with disabled empty pills
//
// Visual contract:
//   - tl-filter-banner outer (matches hub-filter banner weight — single-row,
//     above status tabs, glass↔solid pair already wired)
//   - "Exchanging soon →" label in agent-text-secondary
//   - Populated pills: agent-segment-pill + agent-segment-pill-sm; .on
//     modifier when activeMonthKey matches
//   - Empty pills: same canonical class with inline opacity 0.45 +
//     pointer-events none + aria-disabled; no count badge, "—" placeholder
//   - Year-suffix rule: bare label when month.year === earliestYear,
//     two-digit year suffix otherwise ("Jun" / "Jul" / "Jan 27")
//   - Mobile (<640px): pill row scrolls horizontally with scroll-snap
//     (see .forecast-pill-row in app/globals.css)

import Link from "next/link";
import type { ForecastMonth } from "@/lib/services/transactions";

type Props = {
  months: ForecastMonth[];
  basePath?: string;
  // URL-form month key ("YYYY-MM", 1-indexed month, zero-padded) so the
  // component compares against the URL param shape directly without conversion.
  activeMonthKey?: string | null;
};

function urlKey(m: ForecastMonth): string {
  // URL is 1-indexed (human convention) so the regex stays readable
  return `${m.year}-${String(m.month + 1).padStart(2, "0")}`;
}

export function ForecastStrip({ months, basePath = "/transactions", activeMonthKey = null }: Props) {
  if (months.length === 0) return null;
  // All-empty 12-month horizon: don't waste the agent's screen on 12 grey pills.
  const totalFiles = months.reduce((n, m) => n + m.transactions.length, 0);
  if (totalFiles === 0) return null;

  // Year-suffix rule: render bare when this month's year equals the earliest
  // year in the forecast; annotate with two-digit year suffix otherwise.
  // With a rolling 12-month window, this means the leading year is always bare
  // and the trailing year is annotated whenever the window crosses a boundary.
  const earliestYear = months[0].year;

  function pillLabel(m: ForecastMonth): string {
    const short = new Date(m.year, m.month, 1)
      .toLocaleDateString("en-GB", { month: "short" });
    if (m.year === earliestYear) return short;
    const yearSuffix = String(m.year).slice(-2);
    return `${short} ${yearSuffix}`;
  }

  return (
    <div
      className="tl-filter-banner"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: 10,
        flexWrap: "wrap",
      }}
      role="navigation"
      aria-label="Exchange forecast by month"
    >
      <span style={{
        fontSize: 12, fontWeight: 600,
        color: "var(--agent-text-secondary)",
        display: "inline-flex", alignItems: "center", gap: 6,
        flexShrink: 0,
      }}>
        Exchanging soon
        <span aria-hidden style={{ color: "var(--agent-text-muted)" }}>→</span>
      </span>

      <div className="forecast-pill-row" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {months.map((m) => {
          const key = urlKey(m);
          const isActive = key === activeMonthKey;
          const count = m.transactions.length;
          const label = pillLabel(m);

          // Empty month — disabled placeholder. Not in tab order, no click
          // handler, no hover state, no count badge. Reduced opacity reads as
          // unavailable. aria-disabled communicates state to AT.
          if (count === 0) {
            return (
              <span
                key={key}
                className="agent-segment-pill agent-segment-pill-sm"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  opacity: 0.45,
                  pointerEvents: "none",
                  cursor: "default",
                }}
                aria-disabled="true"
                title={`No files exchanging in ${m.label}`}
              >
                {label}
                <span aria-hidden style={{ color: "var(--agent-text-muted)", fontSize: 10 }}>—</span>
              </span>
            );
          }

          // Populated month — full canonical filter affordance.
          // Active pill click clears the filter (self-toggle, mirrors
          // status-tab "Active" behaviour at page.tsx:226-230).
          return (
            <Link
              key={key}
              href={isActive ? basePath : `${basePath}?exchanging=${key}`}
              scroll={false}
              className={`agent-segment-pill agent-segment-pill-sm${isActive ? " on" : ""}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
              aria-pressed={isActive}
            >
              {label}
              <span style={{
                fontSize: 10, fontWeight: 500,
                padding: "1px 7px", borderRadius: 99,
                background: isActive ? "rgba(var(--agent-coral-rgb), 0.12)" : "rgba(0,0,0,0.06)",
                color: isActive ? "var(--agent-coral-deep)" : "var(--agent-text-muted)",
              }}>
                {count}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
