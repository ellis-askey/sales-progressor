// components/transactions/ForecastStrip.tsx
// Compact exchange forecast strip — single-row month-pill summary above the
// transaction-list status tabs. Each pill is a filter affordance that updates
// ?exchanging=YYYY-MM on /agent/transactions; the table below re-filters via
// getMonthExchangingIds (lib/services/hub.ts).
//
// Refactored 2026-05-12 from a tall card showing month-by-month file rows to
// a compact navigation strip. The previous shape competed visually with the
// table for the same data; this shape repositions the forecast as a filter
// tool and lets the table own the file rows.
//
// Visual contract:
//   - tl-filter-banner outer (matches hub-filter banner weight — single-row,
//     above status tabs, glass↔solid pair already wired)
//   - "Exchanging soon →" label in agent-text-secondary
//   - Month pills: agent-segment-pill + agent-segment-pill-sm (canonical
//     hover/focus/active states; .on modifier when filter is applied)
//   - Year-suffix rule: bare label when month.year === earliestYear,
//     two-digit year suffix otherwise (e.g. "Jun" / "Jul" / "Jan 27")

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

  // Year-suffix rule: render bare when this month's year equals the earliest
  // year in the forecast; annotate with two-digit year suffix otherwise.
  // Handles: in-year forecast (all bare), one boundary crossing (later year
  // annotated), wholly-next-year forecast (still works — earliestYear is the
  // single year present and all pills render bare).
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
      }}>
        Exchanging soon
        <span aria-hidden style={{ color: "var(--agent-text-muted)" }}>→</span>
      </span>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {months.map((m) => {
          const key = urlKey(m);
          const isActive = key === activeMonthKey;
          return (
            <Link
              key={key}
              // Active pill click clears the filter — same self-toggle pattern
              // as the status tabs (page.tsx:226-230 "Active" tab → bare route).
              href={isActive ? basePath : `${basePath}?exchanging=${key}`}
              scroll={false}
              className={`agent-segment-pill agent-segment-pill-sm${isActive ? " on" : ""}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
              aria-pressed={isActive}
            >
              {pillLabel(m)}
              <span style={{
                fontSize: 10, fontWeight: 500,
                padding: "1px 7px", borderRadius: 99,
                background: isActive ? "rgba(var(--agent-coral-rgb), 0.12)" : "rgba(0,0,0,0.06)",
                color: isActive ? "var(--agent-coral-deep)" : "var(--agent-text-muted)",
              }}>
                {m.transactions.length}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
