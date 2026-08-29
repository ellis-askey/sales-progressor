import Link from "next/link";
import { getProspects, getProspectSummary, PROSPECT_STATUSES, PROSPECT_SOURCES, STATUS_LABEL, SOURCE_LABEL, type ProspectFilter } from "@/lib/command/prospects";
import { ProspectsBoard } from "@/components/command/prospects/ProspectsBoard";
import InfoTip from "@/components/command/shared/InfoTip";
import type { ProspectStatus, ProspectSource } from "@prisma/client";

// Command Centre → Prospects. A lightweight acquisition tracker: find an agent →
// contact → follow up → first sale → active agency. Phase 1: list + add + detail
// drawer. See docs/active/prospects/00-implementation-plan.md.

export const dynamic = "force-dynamic";

type SP = { q?: string; status?: string; source?: string };

function parseStatus(raw: string | undefined): ProspectStatus | null {
  return PROSPECT_STATUSES.includes(raw as ProspectStatus) ? (raw as ProspectStatus) : null;
}
function parseSource(raw: string | undefined): ProspectSource | null {
  return PROSPECT_SOURCES.includes(raw as ProspectSource) ? (raw as ProspectSource) : null;
}

export default async function ProspectsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const filter: ProspectFilter = { q: sp.q, status: parseStatus(sp.status), source: parseSource(sp.source) };
  const [summary, rows] = await Promise.all([getProspectSummary(), getProspects(filter)]);

  function href(over: Partial<SP>): string {
    const p = new URLSearchParams();
    const merged = { q: sp.q, status: sp.status, source: sp.source, ...over };
    if (merged.q) p.set("q", merged.q);
    if (merged.status) p.set("status", merged.status);
    if (merged.source) p.set("source", merged.source);
    const qs = p.toString();
    return `/command/prospects${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">Prospects</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Estate agencies to win: contact, follow up, land a first sale, watch them become active.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Total" value={summary.total} />
        <Stat label="Follow-ups due" value={summary.followUpsDue} accent tip="Prospects whose next follow-up date is today or overdue (and not yet active or lost)." />
        <Stat label="Interested" value={summary.interested} />
        <Stat label="Trial / first sale" value={summary.trial} />
        <Stat label="Active" value={summary.active} />
      </div>

      {/* Controls */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <form method="GET" className="flex-1 min-w-[220px]">
            {sp.status && <input type="hidden" name="status" value={sp.status} />}
            {sp.source && <input type="hidden" name="source" value={sp.source} />}
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Search agency, location or contact…"
              className="w-full text-sm bg-[#0a0a0a] border border-[#262626] rounded-lg px-3 py-2 text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-[#2563eb]"
            />
          </form>
        </div>
        {/* Status filter chips */}
        <div className="flex flex-wrap gap-1.5">
          <Link href={href({ status: undefined })} className={chip(!filter.status)}>All statuses</Link>
          {PROSPECT_STATUSES.map((s) => (
            <Link key={s} href={href({ status: filter.status === s ? undefined : s })} className={chip(filter.status === s)}>{STATUS_LABEL[s]}</Link>
          ))}
        </div>
        {/* Source filter chips */}
        <div className="flex flex-wrap gap-1.5">
          <Link href={href({ source: undefined })} className={chip(!filter.source, true)}>All sources</Link>
          {PROSPECT_SOURCES.map((s) => (
            <Link key={s} href={href({ source: filter.source === s ? undefined : s })} className={chip(filter.source === s, true)}>{SOURCE_LABEL[s]}</Link>
          ))}
        </div>
      </div>

      <ProspectsBoard rows={rows} />
    </div>
  );
}

function chip(active: boolean, muted = false): string {
  return `px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors ${
    active
      ? muted ? "bg-neutral-700 text-white border-neutral-600" : "bg-blue-600/20 text-blue-300 border-blue-600/40"
      : "bg-neutral-900 text-neutral-500 border-neutral-800 hover:text-neutral-300 hover:border-neutral-700"
  }`;
}

function Stat({ label, value, accent, tip }: { label: string; value: number; accent?: boolean; tip?: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${accent ? "border-blue-900/70 bg-blue-950/30" : "border-neutral-800 bg-neutral-900"}`}>
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">
        {label}
        {tip && <span className="ml-1"><InfoTip label={label}>{tip}</InfoTip></span>}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${accent ? "text-blue-300" : "text-neutral-100"}`}>{value}</p>
    </div>
  );
}
