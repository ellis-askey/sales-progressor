import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrialConfig, trialClock, resolveTrialAgency } from "@/lib/command/trials";
import { getTrialOverview, getTrialTeam, type TrialKpi, type TrialDayPoint } from "@/lib/command/trial-cockpit";
import { KpiCard, DeltaPill, Section, ParamTabs, CardEmpty, InsightCard, fmtInt } from "@/components/command/ui/primitives";
import { fmtHoursShort, fmtRelative, initials, avColor } from "@/lib/command/format";
import { TeamTab } from "@/components/command/trials/TeamTab";

export const dynamic = "force-dynamic";

// The trial cockpit — a command centre within the Command Centre for one key
// agency on a commercial trial (first: Boardwalk Property Co, 6 months from
// 2026-11-10). Read-only aggregation of already-collected signals; the trial
// itself is defined in lib/command/trials.ts (no schema trial concept exists).
// Tabs are added as they are built — never a dead tab (Law 13).

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "team", label: "Team" },
];

function fmtKpiValue(k: TrialKpi): string {
  return k.format === "hours" ? (k.current > 0 ? fmtHoursShort(k.current) : "0h") : fmtInt(k.current);
}

function fmtDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Daily pulse: one bar per trial day. Bars scale to the busiest day; the
// active-staff count renders as a dot row beneath so both read at a glance.
function DailyPulse({ days }: { days: TrialDayPoint[] }) {
  const shown = days.slice(-42); // last 6 weeks once the trial matures
  const max = Math.max(1, ...shown.map((d) => d.logins));
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-4">
      <div className="flex items-end gap-[3px] h-24">
        {shown.map((d) => (
          <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1 group relative">
            <div
              className="w-full rounded-sm bg-blue-600/50 border-t border-blue-500/60 transition-colors group-hover:bg-blue-500/70"
              style={{ height: `${Math.max(d.logins > 0 ? 6 : 2, Math.round((d.logins / max) * 100))}%`, opacity: d.logins > 0 ? 1 : 0.25 }}
            />
            <div className="absolute bottom-full mb-1.5 hidden group-hover:block z-10 whitespace-nowrap rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-[10px] text-neutral-300 shadow-lg">
              {fmtDay(d.date)} · {d.logins} login{d.logins === 1 ? "" : "s"} · {d.activeUsers} active · {d.milestones} steps · {d.chases} chases
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-neutral-600 tabular-nums">
        <span>{fmtDay(shown[0].date)}</span>
        <span>logins per day · hover for detail</span>
        <span>{fmtDay(shown[shown.length - 1].date)}</span>
      </div>
    </div>
  );
}

export default async function TrialCockpitPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab } = await searchParams;
  const trial = getTrialConfig(slug);
  if (!trial) notFound();

  const agency = await resolveTrialAgency(trial);
  const clock = trialClock(trial);
  const activeTab = TABS.some((t) => t.key === tab) ? (tab as string) : "overview";

  if (!agency) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-neutral-100">{trial.label} · trial</h1>
        <InsightCard tone="watch">
          No agency named &ldquo;{trial.agencyName}&rdquo; exists in this environment&rsquo;s database, so there is nothing to show.
          The trial registry lives in lib/command/trials.ts.
        </InsightCard>
      </div>
    );
  }

  // Fetch only the active tab's data — each tab is its own query set.
  const data = activeTab === "overview" ? await getTrialOverview(agency.id, trial) : null;
  const team = activeTab === "team" ? await getTrialTeam(agency.id, trial) : null;

  return (
    <div className="space-y-8">
      {/* ── Header: who + the trial clock ───────────────────────── */}
      <div>
        <Link href="/command/agencies" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
          ← Agencies
        </Link>
        <div className="flex items-baseline justify-between mt-2 gap-4 flex-wrap">
          <h1 className="text-2xl font-semibold text-neutral-100">
            {agency.name}
            <span className="ml-2.5 text-[11px] uppercase tracking-wider text-blue-400 border border-blue-900/70 bg-blue-950/30 rounded px-1.5 py-0.5 align-middle">6-month trial</span>
          </h1>
          <div className="flex items-center gap-4">
            <Link href={`/command/agency/${agency.id}`} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Agency File →</Link>
            <Link href={`/command/revenue/${agency.id}`} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Revenue →</Link>
          </div>
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          {clock.ended ? (
            <span className="text-amber-400">Trial ended {clock.endsAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
          ) : (
            <>
              Day <span className="text-neutral-300 font-medium tabular-nums">{clock.dayNumber}</span> of {clock.totalDays}
              {" · "}{clock.daysLeft} days left
              {" · "}ends {clock.endsAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </>
          )}
        </p>
        {/* Trial progress bar */}
        <div className="mt-2.5 h-1.5 w-full max-w-md rounded-full bg-neutral-800 overflow-hidden">
          <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(1, clock.pctThrough)}%` }} />
        </div>
      </div>

      <ParamTabs options={TABS} active={activeTab} hrefFor={(k) => `/command/trials/${slug}?tab=${k}`} />

      {data && (<>

      {/* ── The headline: who's aboard + the book ───────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Staff aboard"
          value={trial.staffTarget ? `${data.staffCount} of ${trial.staffTarget}` : String(data.staffCount)}
          sub={`${data.activatedCount} signed in at least once`}
          tip="Live logins on the roster (deactivated members and TSP oversight accounts excluded)."
          accent
        />
        <KpiCard label="Active this week" value={fmtInt(data.activeStaff7d)} sub={data.staffCount > 0 ? `${Math.round((data.activeStaff7d / data.staffCount) * 100)}% of the team` : undefined} tip="Staff with any tracked action or real file time in the last 7 days." />
        <KpiCard label="Live files" value={fmtInt(data.activeFiles)} sub={`${fmtInt(data.migratedFiles)} migrated in`} tip="Active and on-hold files right now. The migrated count is their imported book." />
        <KpiCard label="New instructions" value={fmtInt(data.newFilesSinceTrial)} sub="since the trial began" tip="Files created since the trial start date, excluding the migrated book and demo files." />
      </div>

      {/* ── 7-day KPI wall vs the week before ───────────────────── */}
      <Section title="Last 7 days" subtitle="Each versus the 7 days before." tip="The adoption dashboard: is usage deepening week on week?">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {data.kpis.map((k) => (
            <KpiCard
              key={k.key}
              label={k.label}
              value={fmtKpiValue(k)}
              tip={k.tip}
              delta={<DeltaPill current={k.current} previous={k.previous} suffix={k.format === "hours" ? "s" : ""} />}
            />
          ))}
        </div>
      </Section>

      {/* ── Momentum: the daily pulse across the trial ───────────── */}
      <Section title="Trial pulse" subtitle="Logins per day across the trial so far." tip="Built from the nightly per-agency rollups plus a live count for today.">
        {data.days.length === 0 ? (
          <CardEmpty>The trial starts today. The pulse builds from here.</CardEmpty>
        ) : (
          <DailyPulse days={data.days} />
        )}
      </Section>

      {/* ── Watch list ──────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        <Section title={`Staff to nudge · ${data.quietStaff.length}`} tip="Never signed in, or no activity for 7+ days. The people to chase if adoption is to stick.">
          {data.quietStaff.length === 0 ? (
            <CardEmpty>Everyone has been active in the last 7 days.</CardEmpty>
          ) : (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 divide-y divide-neutral-800/70">
              {data.quietStaff.slice(0, 10).map((s) => (
                <Link key={s.userId} href={`/command/agencies/${s.userId}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-800/30 transition-colors">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-neutral-950 shrink-0" style={{ background: avColor(s.name) }}>
                    {initials(s.name)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-neutral-200 truncate">{s.name}</span>
                    <span className="block text-[11px] text-neutral-600 capitalize">{s.role}</span>
                  </span>
                  <span className={`text-[11px] tabular-nums ${s.lastActive ? "text-amber-400" : "text-red-400"}`}>
                    {s.lastActive ? fmtRelative(s.lastActive) : "never signed in"}
                  </span>
                </Link>
              ))}
              {data.quietStaff.length > 10 && (
                <p className="px-4 py-2 text-[11px] text-neutral-600">and {data.quietStaff.length - 10} more</p>
              )}
            </div>
          )}
        </Section>

        <Section title={`Files going quiet · ${data.idleFiles.length}`} tip="Live files with no real work logged for 14+ days.">
          {data.idleFiles.length === 0 ? (
            <CardEmpty>No live files are sitting idle.</CardEmpty>
          ) : (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 divide-y divide-neutral-800/70">
              {data.idleFiles.map((f) => (
                <Link key={f.id} href={`/command/files?tx=${f.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-800/30 transition-colors">
                  <span className="flex-1 min-w-0 text-sm text-neutral-200 truncate">{f.address}</span>
                  <span className="text-[11px] text-amber-400 tabular-nums shrink-0">{f.idleDays}d idle</span>
                </Link>
              ))}
            </div>
          )}
        </Section>
      </div>

      </>)}

      {team && <TeamTab team={team} staffTarget={trial.staffTarget} />}
    </div>
  );
}
