import Link from "next/link";
import {
  getProspects, getProspectSummary, getPipeline, getFollowUpQueue, getFollowUpCounts,
  getAcquisitionFunnel, getChainLeads,
  PROSPECT_STATUSES, PROSPECT_SOURCES, STATUS_LABEL, SOURCE_LABEL, type ProspectFilter, type FollowUpBucket,
} from "@/lib/command/prospects";
import { ProspectsBoard } from "@/components/command/prospects/ProspectsBoard";
import { ProspectPipeline } from "@/components/command/prospects/ProspectPipeline";
import { FollowUpQueue } from "@/components/command/prospects/FollowUpQueue";
import { ProspectInsights } from "@/components/command/prospects/ProspectInsights";
import { ProspectImport } from "@/components/command/prospects/ProspectImport";
import InfoTip from "@/components/command/shared/InfoTip";
import type { ProspectStatus, ProspectSource } from "@prisma/client";

// Command Centre → Prospects. Lightweight acquisition tracker. Views: All
// prospects (list), Pipeline (status columns), Follow-ups (the work queue).

export const dynamic = "force-dynamic";
// Web research (Sonnet + web search) can take up to ~a minute; give server
// actions triggered from this page room to finish.
export const maxDuration = 60;

type View = "all" | "pipeline" | "followups" | "insights" | "import";
type SP = { q?: string; status?: string; source?: string; view?: string; bucket?: string };

const parseView = (v: string | undefined): View => (v === "pipeline" || v === "followups" || v === "insights" || v === "import" ? v : "all");
const parseBucket = (b: string | undefined): FollowUpBucket => (b === "overdue" || b === "upcoming" || b === "all" ? b : "today");
const parseStatus = (r: string | undefined): ProspectStatus | null => (PROSPECT_STATUSES.includes(r as ProspectStatus) ? (r as ProspectStatus) : null);
const parseSource = (r: string | undefined): ProspectSource | null => (PROSPECT_SOURCES.includes(r as ProspectSource) ? (r as ProspectSource) : null);

export default async function ProspectsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const view = parseView(sp.view);
  const bucket = parseBucket(sp.bucket);
  const filter: ProspectFilter = { q: sp.q, status: parseStatus(sp.status), source: parseSource(sp.source) };

  const summary = await getProspectSummary();

  function href(over: Partial<SP>): string {
    const p = new URLSearchParams();
    const m = { q: sp.q, status: sp.status, source: sp.source, view: sp.view, bucket: sp.bucket, ...over };
    if (m.q) p.set("q", m.q);
    if (m.status) p.set("status", m.status);
    if (m.source) p.set("source", m.source);
    if (m.view && m.view !== "all") p.set("view", m.view);
    if (m.bucket && m.bucket !== "today") p.set("bucket", m.bucket);
    const qs = p.toString();
    return `/command/prospects${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">Prospects</h1>
        <p className="text-sm text-neutral-400 mt-1">Estate agencies to win: contact, follow up, land a first sale, watch them become active.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Total" value={summary.total} />
        <Stat label="Follow-ups due" value={summary.followUpsDue} accent tip="Prospects whose next follow-up date is today or overdue (and not yet active or lost)." />
        <Stat label="Interested" value={summary.interested} />
        <Stat label="Trial / first sale" value={summary.trial} />
        <Stat label="Active" value={summary.active} />
      </div>

      {/* View tabs */}
      <div className="flex flex-wrap gap-1.5">
        {(["all", "pipeline", "followups", "insights", "import"] as View[]).map((v) => (
          <Link key={v} href={href({ view: v === "all" ? undefined : v })} className={pill(v === view)}>
            {v === "all" ? "All prospects" : v === "pipeline" ? "Pipeline" : v === "followups" ? "Follow-ups" : v === "insights" ? "Insights" : "Import"}
          </Link>
        ))}
      </div>

      {view === "all" && (
        <>
          <div className="space-y-3">
            <form method="GET" className="max-w-md">
              {sp.status && <input type="hidden" name="status" value={sp.status} />}
              {sp.source && <input type="hidden" name="source" value={sp.source} />}
              <input name="q" defaultValue={sp.q ?? ""} placeholder="Search agency, location or contact…" className="w-full text-sm bg-[#0a0a0a] border border-[#262626] rounded-lg px-3 py-2 text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-[#2563eb]" />
            </form>
            <div className="flex flex-wrap gap-1.5">
              <Link href={href({ status: undefined })} className={chip(!filter.status)}>All statuses</Link>
              {PROSPECT_STATUSES.map((s) => <Link key={s} href={href({ status: filter.status === s ? undefined : s })} className={chip(filter.status === s)}>{STATUS_LABEL[s]}</Link>)}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Link href={href({ source: undefined })} className={chip(!filter.source, true)}>All sources</Link>
              {PROSPECT_SOURCES.map((s) => <Link key={s} href={href({ source: filter.source === s ? undefined : s })} className={chip(filter.source === s, true)}>{SOURCE_LABEL[s]}</Link>)}
            </div>
          </div>
          <ProspectsBoard rows={await getProspects(filter)} />
        </>
      )}

      {view === "pipeline" && <ProspectPipeline columns={await getPipeline()} />}

      {view === "followups" && (
        <>
          <FollowUpBuckets href={href} bucket={bucket} counts={await getFollowUpCounts()} />
          <FollowUpQueue rows={await getFollowUpQueue(bucket)} />
        </>
      )}

      {view === "insights" && <ProspectInsights funnel={await getAcquisitionFunnel()} chainLeads={await getChainLeads()} />}

      {view === "import" && <ProspectImport />}
    </div>
  );
}

async function FollowUpBuckets({ href, bucket, counts }: { href: (o: Partial<SP>) => string; bucket: FollowUpBucket; counts: { today: number; overdue: number; upcoming: number } }) {
  const tabs: { key: FollowUpBucket; label: string; count?: number }[] = [
    { key: "today", label: "Today", count: counts.today },
    { key: "overdue", label: "Overdue", count: counts.overdue },
    { key: "upcoming", label: "Upcoming", count: counts.upcoming },
    { key: "all", label: "All" },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {tabs.map((t) => (
        <Link key={t.key} href={href({ bucket: t.key })} className={chip(t.key === bucket)}>
          {t.label}{t.count != null && <span className="ml-1.5 text-[10px] opacity-70 tabular-nums">{t.count}</span>}
        </Link>
      ))}
    </div>
  );
}

function pill(active: boolean): string {
  return `px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors ${active ? "bg-blue-600/20 text-blue-300 border-blue-600/40" : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:border-neutral-700"}`;
}
function chip(active: boolean, muted = false): string {
  return `px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors ${active ? (muted ? "bg-neutral-700 text-white border-neutral-600" : "bg-blue-600/20 text-blue-300 border-blue-600/40") : "bg-neutral-900 text-neutral-500 border-neutral-800 hover:text-neutral-300 hover:border-neutral-700"}`;
}
function Stat({ label, value, accent, tip }: { label: string; value: number; accent?: boolean; tip?: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${accent ? "border-blue-900/70 bg-blue-950/30" : "border-neutral-800 bg-neutral-900"}`}>
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">{label}{tip && <span className="ml-1"><InfoTip label={label}>{tip}</InfoTip></span>}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${accent ? "text-blue-300" : "text-neutral-100"}`}>{value}</p>
    </div>
  );
}
