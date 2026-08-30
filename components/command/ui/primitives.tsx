import Link from "next/link";
import InfoTip from "@/components/command/shared/InfoTip";

// Shared Command Centre UI primitives. Extracted 2026-08-30 for the Website &
// Growth page (docs/GROWTH_ANALYTICS_FORENSIC_AUDIT.md §13). Presentational and
// server-safe (no client state). The existing Growth pages keep their local
// copies untouched — this kit is for NEW surfaces only. Dark CC visual system:
// neutral-900 surfaces, neutral-800 hairlines, blue-400 accent, tabular-nums.

export function fmtGBP(pence: number): string {
  const p = pence / 100;
  if (Math.abs(p) >= 1_000_000) return `£${(p / 1_000_000).toFixed(2)}m`;
  if (Math.abs(p) >= 10_000) return `£${Math.round(p / 1000)}k`;
  return `£${Math.round(p).toLocaleString("en-GB")}`;
}
export function fmtInt(n: number): string {
  return n.toLocaleString("en-GB");
}
export function fmtPct(n: number | null): string {
  return n == null ? "—" : `${Math.round(n)}%`;
}

export function Section({ title, subtitle, tip, right, children }: {
  title: string; subtitle?: string; tip?: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
            {title}{tip && <InfoTip label={title}>{tip}</InfoTip>}
          </h2>
          {subtitle && <p className="text-[12px] text-neutral-600 mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

// A change vs the previous comparable period. Direction-aware colour; "up" is
// good by default, pass invert for metrics where down is good.
export function DeltaPill({ current, previous, invert = false, suffix = "" }: {
  current: number; previous: number; invert?: boolean; suffix?: string;
}) {
  if (previous === 0 && current === 0) return <span className="text-[11px] text-neutral-600">no prior data</span>;
  const diff = current - previous;
  const pct = previous === 0 ? null : Math.round((diff / previous) * 100);
  const up = diff > 0;
  const good = invert ? !up : up;
  const flat = diff === 0;
  const color = flat ? "text-neutral-500" : good ? "text-emerald-400" : "text-amber-400";
  const arrow = flat ? "·" : up ? "↑" : "↓";
  return (
    <span className={`text-[11px] font-medium ${color} tabular-nums`}>
      {arrow} {pct == null ? `${Math.abs(diff)}${suffix}` : `${Math.abs(pct)}%`} <span className="text-neutral-600">vs prev</span>
    </span>
  );
}

export function KpiCard({ label, value, tip, delta, sub, accent = false }: {
  label: string; value: string; tip?: string; delta?: React.ReactNode; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${accent ? "border-blue-900/70 bg-blue-950/20" : "border-neutral-800 bg-neutral-900"}`}>
      <p className="text-[10px] uppercase tracking-wider text-neutral-500 flex items-center gap-1">
        {label}{tip && <InfoTip label={label}>{tip}</InfoTip>}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${accent ? "text-blue-300" : "text-neutral-100"}`}>{value}</p>
      {sub && <p className="text-[11px] text-neutral-600 mt-0.5">{sub}</p>}
      {delta && <div className="mt-1">{delta}</div>}
    </div>
  );
}

// Horizontal funnel: each stage a bar scaled to the first stage, with the
// carry-through % to the next stage.
export function FunnelBars({ stages }: { stages: Array<{ label: string; value: number; tip?: string; disabled?: boolean }> }) {
  const base = Math.max(1, ...stages.filter((s) => !s.disabled).map((s) => s.value));
  return (
    <div className="space-y-1.5">
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1] : null;
        const rate = prev && !prev.disabled && !s.disabled && prev.value > 0 ? Math.round((s.value / prev.value) * 100) : null;
        return (
          <div key={s.label}>
            {i > 0 && (
              <div className="flex items-center gap-2 pl-1 py-0.5">
                <span className="text-[10px] text-neutral-600">↳</span>
                <span className="text-[10px] text-neutral-500 tabular-nums">{rate == null ? "—" : `${rate}%`} carried through</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-xs text-neutral-400 flex items-center gap-1">
                {s.label}{s.tip && <InfoTip label={s.label}>{s.tip}</InfoTip>}
              </div>
              <div className="flex-1 h-6 rounded bg-neutral-900 overflow-hidden border border-neutral-800">
                {!s.disabled && <div className="h-full bg-blue-600/40 border-r border-blue-500/50" style={{ width: `${Math.round((s.value / base) * 100)}%`, minWidth: s.value > 0 ? "2px" : "0" }} />}
              </div>
              <div className="w-16 shrink-0 text-right text-sm font-semibold text-neutral-200 tabular-nums">
                {s.disabled ? <span className="text-[11px] text-neutral-600">n/a</span> : fmtInt(s.value)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// URL-param tabs (period, tier, section). Server-safe; each tab is a Link.
export function ParamTabs({ options, active, hrefFor }: {
  options: Array<{ key: string; label: string }>; active: string; hrefFor: (key: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.key === active;
        return (
          <Link key={o.key} href={hrefFor(o.key)} className={`px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors ${on ? "bg-blue-600/20 text-blue-300 border-blue-600/40" : "bg-neutral-900 text-neutral-500 border-neutral-800 hover:text-neutral-300 hover:border-neutral-700"}`}>
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

export function TableShell({ head, children, widths }: { head: string[]; children: React.ReactNode; widths?: string[] }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-800/40">
              {head.map((h, i) => (
                <th key={h} className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 ${i === 0 ? "text-left" : "text-right"} ${widths?.[i] ?? ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}
export function Tr({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-neutral-900 last:border-0 hover:bg-neutral-800/30 transition-colors">{children}</tr>;
}
export function Td({ children, first = false, muted = false }: { children: React.ReactNode; first?: boolean; muted?: boolean }) {
  return <td className={`px-3 py-2 ${first ? "text-left text-neutral-200" : "text-right tabular-nums"} ${muted ? "text-neutral-500" : first ? "" : "text-neutral-300"}`}>{children}</td>;
}

export function CardEmpty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-6 text-center text-sm text-neutral-600">{children}</div>;
}

// The intentional "tracking not connected" state — never a fake zero.
export function TrackingDisabled({ what, why, action }: { what: string; why?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-700 bg-neutral-900/40 px-4 py-6 text-center">
      <p className="text-sm text-neutral-300 font-medium">{what} isn&rsquo;t connected yet</p>
      {why && <p className="text-[12px] text-neutral-600 mt-1 max-w-md mx-auto">{why}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function InsightCard({ tone = "neutral", children }: { tone?: "neutral" | "good" | "watch"; children: React.ReactNode }) {
  const cls = tone === "good" ? "border-emerald-900/60 bg-emerald-950/20" : tone === "watch" ? "border-amber-900/60 bg-amber-950/20" : "border-neutral-800 bg-neutral-900";
  return <div className={`rounded-lg border px-3.5 py-2.5 text-[13px] text-neutral-300 ${cls}`}>{children}</div>;
}
