import Link from "next/link";
import { parseMode, parseAgencies } from "@/lib/command/scope";
import InfoTip from "@/components/command/shared/InfoTip";
import {
  getFeatureUsage,
  getFeatureDetail,
  adopterNoun,
  SURFACE_LABELS,
  type Surface,
  type CommandPeriod,
  type FeatureRow,
} from "@/lib/command/feature-usage";

// Command Centre → Feature usage. Whole-platform view of which product features
// are actually getting used, ranked most-used to least-used, on surface tabs.
// (Was "Follow-up usage" — that single feature is now one row here.)

export const dynamic = "force-dynamic";

const SURFACES: Surface[] = ["portal", "agent", "solicitor", "internal"];
const PERIODS: { key: CommandPeriod; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
];
const SORTS = [
  { key: "most", label: "Most used" },
  { key: "least", label: "Least used" },
  { key: "recent", label: "Most recent" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

type SP = {
  mode?: string;
  agency?: string;
  period?: string;
  surface?: string;
  sort?: string;
  feature?: string;
};

function parsePeriod(raw: string | undefined): CommandPeriod {
  return raw === "30d" || raw === "90d" ? raw : "all";
}
function parseSurface(raw: string | undefined): Surface {
  return SURFACES.includes(raw as Surface) ? (raw as Surface) : "portal";
}
function parseSort(raw: string | undefined): SortKey {
  return raw === "least" || raw === "recent" ? raw : "most";
}

// Build a URL for this page preserving scope + view state, applying overrides.
function href(base: SP, over: Partial<SP>): string {
  const merged = { ...base, ...over };
  const p = new URLSearchParams();
  if (merged.mode && merged.mode !== "combined") p.set("mode", merged.mode);
  if (merged.agency) p.set("agency", merged.agency);
  if (merged.period && merged.period !== "all") p.set("period", merged.period);
  if (merged.surface && merged.surface !== "portal") p.set("surface", merged.surface);
  if (merged.sort && merged.sort !== "most") p.set("sort", merged.sort);
  if (merged.feature) p.set("feature", merged.feature);
  const qs = p.toString();
  return `/command/followup-usage${qs ? `?${qs}` : ""}`;
}

function fmtWhen(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
}
function agoDays(d: Date | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400_000);
}

export default async function FeatureUsagePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  const agencyIds = parseAgencies(sp.agency);
  const period = parsePeriod(sp.period);
  const surface = parseSurface(sp.surface);
  const sort = parseSort(sp.sort);
  const base: SP = { mode: sp.mode, agency: sp.agency, period, surface, sort };

  // Drill-down view.
  if (sp.feature) {
    const detail = await getFeatureDetail(sp.feature, { mode, agencyIds }, period);
    if (!detail) {
      return (
        <div className="space-y-4">
          <Link href={href(base, { feature: undefined })} className="text-[13px] text-blue-400 hover:text-blue-300">← Back to all features</Link>
          <p className="text-sm text-neutral-500">That feature could not be found.</p>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <Link href={href({ ...base, surface: detail.surface }, { feature: undefined })} className="text-[13px] text-blue-400 hover:text-blue-300">← Back to all features</Link>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-neutral-500">{SURFACE_LABELS[detail.surface]}</p>
          <h1 className="text-2xl font-semibold text-neutral-100">{detail.name}</h1>
          <p className="mt-1 text-sm text-neutral-400">{detail.blurb}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label={`Adopters (${period === "all" ? "all time" : period})`} value={String(detail.metric.adoptersInPeriod)} sub={`${detail.metric.adoptersAllTime} all time · ${adopterNoun(detail.adopterUnit, detail.metric.adoptersAllTime)}`} />
          <Stat label="Uses (period)" value={String(detail.metric.usesInPeriod)} sub={`${detail.metric.usesAllTime} all time`} />
          <Stat label="First used" value={fmtWhen(detail.metric.firstAt)} />
          <Stat label="Last used" value={fmtWhen(detail.metric.lastAt)} />
        </div>

        {detail.funnel && (
          <Section title="Funnel" tip="How far uses of this feature progress.">
            <div className="flex flex-wrap gap-3">
              {detail.funnel.map((s, i) => (
                <div key={i} className="flex-1 min-w-[120px] bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wider text-neutral-500">{s.label}</p>
                  <p className="mt-1 text-2xl font-semibold text-neutral-100 tabular-nums">{s.value}</p>
                  {s.hint && <p className="text-[11px] text-neutral-600 mt-0.5">{s.hint}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title="By agency" tip="Which agencies' files see this feature used.">
          {detail.byAgency.length === 0 ? (
            <Empty>No usage recorded in the current scope.</Empty>
          ) : (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-neutral-600">
                    <Th>Agency</Th><Th>Uses</Th><Th>Adopters</Th>
                  </tr>
                </thead>
                <tbody>
                  {detail.byAgency.map((r) => (
                    <tr key={r.agencyId}>
                      <Td className="text-neutral-200">{r.agencyName}</Td>
                      <Td className="text-neutral-300 tabular-nums">{r.uses}</Td>
                      <Td className="text-neutral-400 tabular-nums">{r.adopters}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Recent activity" tip="The most recent times this feature was used.">
          {detail.recent.length === 0 ? (
            <Empty>Nothing recorded yet.</Empty>
          ) : (
            <ul className="space-y-1.5">
              {detail.recent.map((r, i) => (
                <li key={i} className="flex items-center justify-between text-[13px] border-b border-neutral-800/60 pb-1.5">
                  <span className="text-neutral-400">{r.agencyName}</span>
                  <span className="text-neutral-500 text-[12px]">{fmtWhen(r.at)}</span>
                </li>
              ))}
            </ul>
          )}
          {detail.metric.undated && (
            <p className="mt-2 text-[12px] text-neutral-600">This feature stores a setting with no timestamp, so we can show who has it on but not when they turned it on.</p>
          )}
        </Section>
      </div>
    );
  }

  // League table view.
  const data = await getFeatureUsage({ mode, agencyIds }, period);
  const forSurface = data.features.filter((f) => f.surface === surface);
  const ranked = sortFeatures(forSurface, sort);

  // Summary across every tracked feature (all surfaces), for the top strip.
  const usedInPeriod = data.features.filter((f) => f.metric.usesInPeriod > 0).length;
  const neverUsed = data.features.filter((f) => f.metric.usesAllTime === 0).length;
  const busiest = [...data.features].sort((a, b) => b.metric.usesInPeriod - a.metric.usesInPeriod)[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">Feature usage</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Every product feature that records its use, ranked most-used to least-used. Pick a surface, sort by what
          you want to see, and open any feature for the detail behind it.
        </p>
        <p className="mt-1 text-[12px] text-neutral-600">
          {data.scopeLabel} · {data.transactionCount} live {data.transactionCount === 1 ? "file" : "files"} · reads
          your own data (not PostHog). App adoption and the enquiries chase have their own pages, so we don&rsquo;t
          repeat them here.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Features tracked" value={String(data.features.length)} />
        <Stat label={`Used in ${period === "all" ? "all time" : period}`} value={String(usedInPeriod)} sub={`of ${data.features.length}`} />
        <Stat label="Never used" value={String(neverUsed)} sub="built but no signal yet" />
        <Stat label="Busiest" value={busiest && busiest.metric.usesInPeriod > 0 ? busiest.name : "—"} sub={busiest && busiest.metric.usesInPeriod > 0 ? `${busiest.metric.usesInPeriod} uses` : "no usage in period"} small />
      </div>

      {/* Controls */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {SURFACES.map((s) => (
            <Link key={s} href={href(base, { surface: s, feature: undefined })} className={pill(s === surface)}>
              {SURFACE_LABELS[s]}
              <span className="ml-1.5 text-[10px] opacity-70 tabular-nums">{data.features.filter((f) => f.surface === s).length}</span>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <Link key={p.key} href={href(base, { period: p.key })} className={chip(p.key === period)}>{p.label}</Link>
            ))}
          </div>
          <div className="flex gap-1">
            {SORTS.map((s) => (
              <Link key={s.key} href={href(base, { sort: s.key })} className={chip(s.key === sort)}>{s.label}</Link>
            ))}
          </div>
        </div>
      </div>

      {/* League table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-neutral-600">
                <Th>Feature</Th>
                <Th>Adopters<InfoTip label="What adopters means">Distinct {surface === "portal" ? "clients" : surface === "agent" ? "agents" : surface === "solicitor" ? "firms or files" : "files"} who used it. Headline number for the selected period; all-time in grey.</InfoTip></Th>
                <Th>Uses</Th>
                <Th>Trend<InfoTip label="Trend">Uses per week over the last 12 weeks.</InfoTip></Th>
                <Th>Last used</Th>
              </tr>
            </thead>
            <tbody>
              {ranked.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-[13px] text-neutral-500">No features on this surface yet.</td></tr>
              ) : (
                ranked.map((f) => <FeatureLeagueRow key={f.id} f={f} base={base} />)
              )}
            </tbody>
          </table>
        </div>
      </div>

      {surface === "internal" && (
        <p className="text-[12px] text-neutral-600 leading-relaxed">
          Internal-tool tracking is thin for now. WhatsApp capture, sale migration and other back-office tools get
          their own signal in the next build, alongside the features that only report to the (dormant) analytics tool
          today.
        </p>
      )}
    </div>
  );
}

// ─── Sorting ──────────────────────────────────────────────────────────────────

function sortFeatures(features: FeatureRow[], sort: SortKey): FeatureRow[] {
  const arr = [...features];
  if (sort === "least") {
    // Least-adopted first, so never-used features surface at the top.
    return arr.sort(
      (a, b) => a.metric.adoptersInPeriod - b.metric.adoptersInPeriod || a.metric.usesAllTime - b.metric.usesAllTime,
    );
  }
  if (sort === "recent") {
    return arr.sort((a, b) => (b.metric.lastAt?.getTime() ?? 0) - (a.metric.lastAt?.getTime() ?? 0));
  }
  // most
  return arr.sort(
    (a, b) => b.metric.adoptersInPeriod - a.metric.adoptersInPeriod || b.metric.usesInPeriod - a.metric.usesInPeriod,
  );
}

// ─── Row + bits ───────────────────────────────────────────────────────────────

function FeatureLeagueRow({ f, base }: { f: FeatureRow; base: SP }) {
  const m = f.metric;
  const cold = m.usesAllTime === 0;
  const days = agoDays(m.lastAt);
  const stale = !cold && !m.undated && days != null && days > 30;
  return (
    <tr className="hover:bg-neutral-800/40 transition-colors">
      <Td className="text-neutral-200 font-medium">
        <Link href={href(base, { feature: f.id })} className="hover:text-white">
          {f.name}
        </Link>
        <div className="text-[11px] text-neutral-500 font-normal">{f.category}</div>
      </Td>
      <Td>
        {cold ? (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-neutral-800 text-neutral-500 border-neutral-700">Never used</span>
        ) : (
          <>
            <span className="text-neutral-100 tabular-nums text-[15px] font-semibold">{m.undated ? m.adoptersAllTime : m.adoptersInPeriod}</span>
            <span className="text-neutral-500 text-[12px]"> {adopterNoun(f.adopterUnit, m.undated ? m.adoptersAllTime : m.adoptersInPeriod)}</span>
            {!m.undated && m.adoptersAllTime !== m.adoptersInPeriod && (
              <span className="text-neutral-600 text-[11px]"> · {m.adoptersAllTime} all time</span>
            )}
            {m.undated && <span className="text-neutral-600 text-[11px]"> · total</span>}
          </>
        )}
      </Td>
      <Td className="text-neutral-300 text-[13px] tabular-nums">{m.undated ? m.usesAllTime : m.usesInPeriod}</Td>
      <Td>{m.undated ? <span className="text-neutral-700 text-[12px]">—</span> : <Sparkline weekly={m.weekly} />}</Td>
      <Td className="text-[12px]">
        {cold ? (
          <span className="text-neutral-600">—</span>
        ) : (
          <span className={stale ? "text-amber-500/80" : "text-neutral-400"}>
            {m.undated ? "on file" : fmtWhen(m.lastAt)}
            {stale && <span className="ml-1 text-[10px]">cold</span>}
          </span>
        )}
      </Td>
    </tr>
  );
}

function Sparkline({ weekly }: { weekly: number[] }) {
  const max = Math.max(1, ...weekly);
  return (
    <span className="inline-flex items-end gap-[2px] h-6" aria-hidden>
      {weekly.map((v, i) => (
        <span
          key={i}
          className={`w-[4px] rounded-sm ${v > 0 ? "bg-blue-500/70" : "bg-neutral-800"}`}
          style={{ height: `${Math.max(2, Math.round((v / max) * 24))}px` }}
        />
      ))}
    </span>
  );
}

function pill(active: boolean): string {
  return `px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors ${
    active
      ? "bg-blue-600/20 text-blue-300 border-blue-600/40"
      : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:border-neutral-700"
  }`;
}
function chip(active: boolean): string {
  return `px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors ${
    active
      ? "bg-neutral-100 text-neutral-900 border-neutral-100"
      : "bg-neutral-900 text-neutral-500 border-neutral-800 hover:text-neutral-300 hover:border-neutral-700"
  }`;
}

function Stat({ label, value, sub, small }: { label: string; value: string; sub?: string; small?: boolean }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 font-semibold text-neutral-100 ${small ? "text-base leading-tight" : "text-2xl tabular-nums"}`}>{value}</p>
      {sub && <p className="text-[11px] text-neutral-600 mt-0.5">{sub}</p>}
    </div>
  );
}
function Section({ title, tip, children }: { title: string; tip?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-neutral-300">
        {title}
        {tip && <span className="ml-1.5"><InfoTip label={title}>{tip}</InfoTip></span>}
      </h2>
      {children}
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-neutral-500 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-6 text-center">{children}</p>;
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 border-b border-neutral-800/70 text-[13px] ${className}`}>{children}</td>;
}
