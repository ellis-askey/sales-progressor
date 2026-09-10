import {
  getStageTimeframes, SEGMENTS, parseSegment,
  type SegmentKey, type MeasureResult,
} from "@/lib/command/timeframes";
import { parseMode, parseAgencies, type CommandMode } from "@/lib/command/scope";
import {
  Section, KpiCard, ParamTabs, TableShell, Tr, Td, CardEmpty,
} from "@/components/command/ui/primitives";

// Command Centre → Timeframes. Live median/mean/n for the time between milestone
// steps across real sales, next to the app's current per-step assumptions, so
// the founder can tell when those assumptions are about right. Superadmin-gated
// by the (protected) layout. Service: lib/command/timeframes.ts.

export const dynamic = "force-dynamic";

const LOW_N = 3; // below this, treat a cell as too thin to trust

function fmtDays(n: number | null): string {
  return n == null ? "—" : `${n}d`;
}

// Δ vs assumed — only meaningful once we have a few data points. Positive means
// slower than assumed (amber), negative faster (emerald), near-zero neutral.
function DeltaVsAssumed({ actual, assumed, n }: { actual: number | null; assumed: number | null; n: number }) {
  if (actual == null || assumed == null || n < LOW_N) return <span className="text-neutral-700">—</span>;
  const diff = actual - assumed;
  if (diff === 0) return <span className="text-neutral-500 tabular-nums">0d</span>;
  const near = Math.abs(diff) <= Math.max(2, Math.round(assumed * 0.25));
  const color = near ? "text-neutral-400" : diff > 0 ? "text-amber-400" : "text-emerald-400";
  return <span className={`${color} tabular-nums`}>{diff > 0 ? "+" : ""}{diff}d</span>;
}

function nCell(n: number) {
  const thin = n < LOW_N;
  return <span className={thin ? "text-neutral-600" : "text-neutral-400"} title={thin ? "Too few to trust yet" : undefined}>{n}{thin && n > 0 ? " ⚠" : ""}</span>;
}

function MeasureTable({ measures }: { measures: MeasureResult[] }) {
  if (measures.length === 0) return <CardEmpty>No measures apply to this segment.</CardEmpty>;
  return (
    <TableShell head={["Stage", "Assumed", "Median", "Mean", "Δ vs assumed", "n"]}>
      {measures.map((m) => (
        <Tr key={m.key}>
          <Td first>{m.label}</Td>
          <Td muted>{fmtDays(m.assumed)}</Td>
          <Td>{m.n < LOW_N ? <span className="text-neutral-600">{fmtDays(m.median)}</span> : fmtDays(m.median)}</Td>
          <Td muted>{fmtDays(m.mean)}</Td>
          <Td><DeltaVsAssumed actual={m.median} assumed={m.assumed} n={m.n} /></Td>
          <Td>{nCell(m.n)}</Td>
        </Tr>
      ))}
    </TableShell>
  );
}

type SP = { segment?: string; source?: string; held?: string; mode?: string; agency?: string };

export default async function TimeframesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const segment = parseSegment(sp.segment);
  const includeEstimated = sp.source !== "organic"; // default = all data
  const excludeHeld = sp.held === "exclude";
  const mode: CommandMode = parseMode(sp.mode);
  const agencyIds = parseAgencies(sp.agency);

  const d = await getStageTimeframes({ segment, includeEstimated, excludeHeld, mode, agencyIds });

  function href(over: Partial<{ segment: SegmentKey; source: string; held: string }>): string {
    const p = new URLSearchParams();
    const seg = over.segment ?? segment;
    const src = over.source ?? (includeEstimated ? "all" : "organic");
    const hld = over.held ?? (excludeHeld ? "exclude" : "include");
    if (seg !== "all") p.set("segment", seg);
    if (src !== "all") p.set("source", src);
    if (hld !== "include") p.set("held", hld);
    if (mode !== "combined") p.set("mode", mode);
    if (agencyIds.length > 0) p.set("agency", agencyIds.join(","));
    const qs = p.toString();
    return `/command/timeframes${qs ? `?${qs}` : ""}`;
  }

  const saleExchange = d.headline.find((m) => m.key === "sale_exchange");
  const saleCompletion = d.headline.find((m) => m.key === "sale_completion");

  return (
    <div className="space-y-8">
      {/* Header + controls */}
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Timeframes</h1>
          <p className="text-sm text-neutral-400 mt-1">
            How long each stage actually takes, live from your sales, next to what the app currently assumes. When the numbers line up and n is healthy, the assumption is about right.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ParamTabs options={SEGMENTS.map((s) => ({ key: s.key, label: s.label }))} active={segment} hrefFor={(k) => href({ segment: k as SegmentKey })} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ParamTabs
            options={[{ key: "all", label: "All data" }, { key: "organic", label: "Organic only" }]}
            active={includeEstimated ? "all" : "organic"}
            hrefFor={(k) => href({ source: k })}
          />
          <ParamTabs
            options={[{ key: "include", label: "Include held" }, { key: "exclude", label: "Exclude ever-held" }]}
            active={excludeHeld ? "exclude" : "include"}
            hrefFor={(k) => href({ held: k })}
          />
        </div>
      </div>

      {/* Headline */}
      <Section
        title="Headline"
        tip="Median calendar days from the sale being added (anchored on its true start, so claimed/migrated sales count from the beginning) to that milestone. 'All data' includes migrated and claimed sales; switch to 'Organic only' to see real-time files alone."
        subtitle={`${SEGMENTS.find((s) => s.key === segment)?.label} · ${d.usableSales} of ${d.totalSales} sales contributed data`}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Sale → exchange" value={fmtDays(saleExchange?.median ?? null)} accent sub={`median · n=${saleExchange?.n ?? 0}`} tip="Median days from sale added to contracts exchanged." />
          <KpiCard label="Sale → completion" value={fmtDays(saleCompletion?.median ?? null)} sub={`median · n=${saleCompletion?.n ?? 0}`} tip="Median days from sale added to completion." />
          <KpiCard label="Sales in view" value={String(d.totalSales)} sub={SEGMENTS.find((s) => s.key === segment)?.label ?? ""} />
          <KpiCard label="With usable dates" value={String(d.usableSales)} sub="contributed ≥1 stage gap" />
        </div>
      </Section>

      {/* Stage measures, grouped */}
      {d.totalSales === 0 ? (
        <CardEmpty>No sales match this segment and filter yet.</CardEmpty>
      ) : (
        d.groups.map((g) => (
          <Section key={g.group} title={g.group}>
            <MeasureTable measures={g.measures} />
          </Section>
        ))
      )}

      {/* Per-step calibration grid — this is what the app's predictions run on */}
      <Section
        title="Per-step calibration"
        tip="Every live step vs its direct predecessor (or the sale start when it has none). This is the exact unit the app's predicted-exchange engine uses (MILESTONE_DURATION_MEDIANS). When you trust these actuals, they can replace the hardcoded assumptions."
        subtitle="Assumed = what the app uses today. Median/Mean = your real data."
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">Seller side</p>
            <PerStepTable rows={d.perStep.filter((r) => r.side === "vendor")} />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">Buyer side</p>
            <PerStepTable rows={d.perStep.filter((r) => r.side === "purchaser")} />
          </div>
        </div>
      </Section>

      <p className="text-[11px] text-neutral-600">
        Excludes internal agencies, demo files and drafts. Uses each step&rsquo;s real event date where entered, otherwise the confirmation date. Steps reconciled at claim with no date are skipped (their date is unknowable), as are negative out-of-order gaps. Paused (on-hold) time is included in the gap; use &ldquo;Exclude ever-held&rdquo; to drop files that were ever paused.
      </p>
    </div>
  );
}

function PerStepTable({ rows }: { rows: { code: string; name: string; assumed: number | null; median: number | null; mean: number | null; n: number }[] }) {
  if (rows.length === 0) return <CardEmpty>No steps.</CardEmpty>;
  return (
    <TableShell head={["Step", "Assumed", "Median", "Mean", "n"]}>
      {rows.map((r) => (
        <Tr key={r.code}>
          <Td first><span className="text-neutral-500 tabular-nums mr-1.5">{r.code}</span>{r.name}</Td>
          <Td muted>{fmtDays(r.assumed)}</Td>
          <Td>{r.n < LOW_N ? <span className="text-neutral-600">{fmtDays(r.median)}</span> : fmtDays(r.median)}</Td>
          <Td muted>{fmtDays(r.mean)}</Td>
          <Td>{nCell(r.n)}</Td>
        </Tr>
      ))}
    </TableShell>
  );
}
