// Bespoke "between exchange and completion" block for a file's Reminders tab.
// Completion is no longer a reminder (it's owned by the Completions page), so a
// file that has exchanged but not yet completed would otherwise show an empty
// Reminders tab. This card fills that window: it states where the file is on the
// run-in to completion and points at the Completions page, which owns the action.
// Shown only when the file has exchanged and is still active.

import Link from "next/link";
import { CalendarCheck, ArrowRight } from "@phosphor-icons/react/dist/ssr";

function fmt(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "to be confirmed";
}

// Whole-day difference in UK calendar days (today = 0), tz-safe via date strings.
function daysUntil(d: Date): number {
  const uk = (x: Date) => new Date(x.toLocaleString("en-GB", { timeZone: "Europe/London" }));
  const a = uk(new Date()); a.setHours(0, 0, 0, 0);
  const b = uk(new Date(d)); b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function ExchangeToCompletionCard({
  exchangedAt,
  completionDate,
}: {
  exchangedAt: Date | null;
  completionDate: Date | null;
}) {
  const days = completionDate ? daysUntil(completionDate) : null;
  const countdown =
    completionDate == null ? "Completion date still to be confirmed"
    : days === 0 ? "Completing today"
    : days != null && days < 0 ? "Completion date has passed"
    : `${days} day${days === 1 ? "" : "s"} to go`;
  const isToday = days === 0;
  const isPast = days != null && days < 0;
  const accent = isPast ? "var(--agent-danger)" : isToday ? "var(--agent-coral-deep)" : "var(--agent-success)";

  return (
    <div
      style={{
        borderRadius: "var(--agent-radius-lg, 14px)",
        border: "1px solid var(--agent-border-default)",
        background: "var(--agent-surface-elevated, #fff)",
        boxShadow: "0 1px 2px rgba(45,24,16,.03), 0 8px 22px rgba(45,24,16,.05)",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px 11px" }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(var(--agent-success-rgb, 31,138,74),0.12)", color: "var(--agent-success)" }}>
          <CalendarCheck size={17} weight="fill" />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 680, color: "var(--agent-text-primary)", letterSpacing: "-0.01em" }}>Heading to completion</div>
          <div style={{ fontSize: 11.5, color: "var(--agent-text-muted)", marginTop: 1 }}>Contracts have exchanged. This sale is on the run-in to completion.</div>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 700, color: accent, background: "color-mix(in srgb, " + accent + " 12%, transparent)", border: "0.5px solid color-mix(in srgb, " + accent + " 30%, transparent)", borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap" }}>
          {countdown}
        </span>
      </div>

      {/* Exchanged → Completing timeline */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 0, borderTop: "1px solid var(--agent-border-subtle)" }}>
        <div style={{ flex: 1, padding: "11px 16px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>Exchanged</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", marginTop: 2 }}>{fmt(exchangedAt)}</div>
        </div>
        <div style={{ display: "grid", placeItems: "center", color: "var(--agent-text-ghost, #B8ABA1)", padding: "0 2px" }}>
          <ArrowRight size={15} weight="bold" />
        </div>
        <div style={{ flex: 1, padding: "11px 16px", borderLeft: "1px solid var(--agent-border-subtle)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>Completing</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", marginTop: 2 }}>{fmt(completionDate)}</div>
        </div>
      </div>

      <div style={{ padding: "10px 16px", borderTop: "1px solid var(--agent-border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>Readiness and completing-day actions live on the Completions page.</span>
        <Link href="/agent/completions" className="agent-link" style={{ fontSize: 12, fontWeight: 650, display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
          Track on Completions <ArrowRight size={13} weight="bold" />
        </Link>
      </div>
    </div>
  );
}
