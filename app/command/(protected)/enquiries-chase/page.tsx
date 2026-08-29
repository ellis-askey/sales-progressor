import Link from "next/link";
import { getChasingData, getChaseTabCounts, type ChaseType } from "@/lib/command/chasing";
import { ChaseHubTable } from "@/components/command/ChaseHubTable";
import InfoTip from "@/components/command/shared/InfoTip";

export const dynamic = "force-dynamic";

const TABS: { key: ChaseType; label: string }[] = [
  { key: "enquiries", label: "Enquiries chase" },
  { key: "solicitor", label: "Solicitor chase" },
  { key: "client", label: "Client chase" },
];

function parseTab(raw: string | undefined): ChaseType {
  return raw === "solicitor" || raw === "client" ? raw : "enquiries";
}

export default async function ChasingHubPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const [data, counts] = await Promise.all([getChasingData(tab), getChaseTabCounts()]);
  const s = data.summary;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-2 text-[11px] uppercase tracking-widest text-neutral-500 font-mono">Chasing</div>
      <h1 className="text-2xl font-semibold text-neutral-100">Is our chasing working?</h1>
      <p className="mt-2 text-sm text-neutral-400 max-w-2xl leading-relaxed">
        Every automated chase we send, across all three systems, and what came back. Click any row to see exactly what
        was sent.
      </p>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 mt-5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/command/enquiries-chase${t.key === "enquiries" ? "" : `?tab=${t.key}`}`}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors ${
              t.key === tab
                ? "bg-blue-600/20 text-blue-300 border-blue-600/40"
                : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:border-neutral-700"
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-[10px] opacity-70 tabular-nums">{counts[t.key]}</span>
          </Link>
        ))}
      </div>

      {/* Tab intro */}
      <p className="mt-4 text-[13px] text-neutral-400 max-w-2xl leading-relaxed">
        {data.blurb}
        {data.sinceLabel ? ` Tracking since ${data.sinceLabel}.` : ""}
      </p>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
        <Stat label="Chases sent" value={s.sent} sub="in the last 8 weeks" />
        {s.opensTracked ? (
          <Stat label="Response rate" value={`${s.responseRate ?? 0}%`} sub={`${s.responded} of ${s.sent} acted`} accent />
        ) : (
          <Stat
            label={data.type === "client" ? "Delivered" : "Confirmed"}
            value={s.responded}
            sub={`of ${s.sent}`}
            accent
            tip={data.type === "client" ? "We can confirm delivery, but opens aren't tracked yet." : "The step was confirmed after chasing. Whether the email was opened isn't tracked yet."}
          />
        )}
        <Stat label={s.extraLabel} value={s.extra} sub="" />
        <Stat label="Opens tracked" value={s.opensTracked ? "Yes" : "Not yet"} sub={s.opensTracked ? "via the link" : "coming soon"} />
      </div>

      {/* Table */}
      <div className="mt-8">
        <ChaseHubTable type={data.type} rows={data.rows} />
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent, tip }: { label: string; value: string | number; sub: string; accent?: boolean; tip?: string }) {
  return (
    <div className={`rounded-lg border p-3.5 ${accent ? "border-blue-900/70 bg-blue-950/30" : "border-neutral-800 bg-neutral-900/40"}`}>
      <div className="text-[11px] uppercase tracking-wider text-neutral-500">
        {label}
        {tip && <span className="ml-1 normal-case tracking-normal"><InfoTip label={label}>{tip}</InfoTip></span>}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${accent ? "text-blue-300" : "text-neutral-100"}`}>{value}</div>
      {sub && <div className="text-[11px] text-neutral-500 mt-0.5">{sub}</div>}
    </div>
  );
}
