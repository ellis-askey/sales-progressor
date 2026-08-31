import Link from "next/link";
import { parseMode, parseAgencies } from "@/lib/command/scope";
import { getRetention, getTransactionRetention, getFreeModelSignals, type DriftUser } from "@/lib/command/retention";
import InfoTip from "@/components/command/shared/InfoTip";

// Command Centre → Repeat use. Are people coming back, and who's drifting away?
// Focused on retention: coming-back trend, returning-user rate, how often people
// return, and a named churn-risk list. The event-type breakdown lives on
// Activity; the agency leaderboard + cohorts live on Trends. We link, not repeat.

export const dynamic = "force-dynamic";

function pctChange(curr: number, prev: number): string {
  if (!prev) return "—";
  const v = Math.round(((curr - prev) / prev) * 100);
  return v >= 0 ? `+${v}%` : `${v}%`;
}
function pctColor(curr: number, prev: number): string {
  if (!prev) return "text-neutral-600";
  return curr >= prev ? "text-emerald-400" : "text-red-400";
}
function fmtHours(h: number | null): string {
  if (h === null) return "—";
  if (h < 24) return `${Math.round(h)}h`;
  return `${(h / 24).toFixed(1)}d`;
}
function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function fmtDays(d: number): string {
  if (d <= 0) return "same day";
  if (d < 60) return `${d}d`;
  return `${Math.round(d / 30)}mo`;
}
function milestoneLabel(threshold: number): string {
  if (threshold === 1) return "Created a first sale";
  if (threshold === 2) return "Reached a 2nd sale";
  return `Reached ${threshold} sales`;
}
function fmtGBP(pence: number): string {
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}

export default async function RetentionPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; agency?: string }>;
}) {
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  const agencyIds = parseAgencies(sp.agency);
  const [{ cards, returning, gaps, driftUsers, driftAgencies, scopeLabel }, tx, free] = await Promise.all([
    getRetention(mode, agencyIds),
    getTransactionRetention(mode, agencyIds),
    getFreeModelSignals(mode, agencyIds),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">Repeat use</h1>
        <p className="text-sm text-neutral-400 mt-1">Are people coming back, and who&rsquo;s drifting away?</p>
        <p className="text-[12px] text-neutral-600 mt-1">
          {scopeLabel} · excludes internal, test, and demo accounts. For what people do and the agency leaderboard, see{" "}
          <Link href="/command/activity" className="text-neutral-400 hover:text-neutral-200 underline">Activity</Link> and{" "}
          <Link href="/command/growth" className="text-neutral-400 hover:text-neutral-200 underline">Trends</Link>.
        </p>
      </div>

      {/* Free-model signals — the two numbers the free pricing model needs */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Free model
          <span className="ml-1.5 normal-case tracking-normal"><InfoTip label="Free model">Self-progress is free, so the old &ldquo;trial value&rdquo; number no longer describes anything. These are the two signals that matter now: what the first-outsourced-free giveaway costs, and how many free agencies go on to pay for outsourcing.</InfoTip></span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
            <p className="text-xs text-neutral-400 mb-1">
              Free → outsourced
              <span className="ml-1"><InfoTip label="Free to outsourced conversion">Of agencies with at least one self-progress sale, the share who have also sent at least one sale to us. The core monetisation signal under the free model.</InfoTip></span>
            </p>
            <p className="text-2xl font-bold text-white tabular-nums">{free.conversionPct == null ? "—" : `${free.conversionPct}%`}</p>
            <p className="text-[11px] text-neutral-600 mt-0.5 tabular-nums">
              {free.convertedToOutsourced} of {free.selfProgressAgencies} self-progress {free.selfProgressAgencies === 1 ? "agency" : "agencies"}
            </p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
            <p className="text-xs text-neutral-400 mb-1">
              First-file giveaway
              <span className="ml-1"><InfoTip label="First outsourced file free">What the first-outsourced-free files would have billed at their band. The real cost of the acquisition offer, distinct from the free self-progress product.</InfoTip></span>
            </p>
            <p className="text-2xl font-bold text-white tabular-nums">{fmtGBP(free.firstFreeValuePence)}</p>
            <p className="text-[11px] text-neutral-600 mt-0.5 tabular-nums">
              {free.firstFreeCount} free {free.firstFreeCount === 1 ? "file" : "files"} given
            </p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
            <p className="text-xs text-neutral-400 mb-1">Self-progress agencies</p>
            <p className="text-2xl font-bold text-white tabular-nums">{free.selfProgressAgencies.toLocaleString()}</p>
            <p className="text-[11px] text-neutral-600 mt-0.5">on the free product</p>
          </div>
        </div>
      </section>

      {/* Coming back — cards + returning-user rate */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Are people coming back? Last 30 days vs the 30 before
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {cards.map((card) => (
            <div key={card.label} className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
              <p className="text-xs text-neutral-400 mb-1">{card.label}</p>
              <p className="text-2xl font-bold text-white tabular-nums">{card.curr.toLocaleString()}</p>
              <p className={`text-xs tabular-nums mt-0.5 ${pctColor(card.curr, card.prev)}`}>
                {pctChange(card.curr, card.prev)} vs prev 30d
              </p>
            </div>
          ))}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
            <p className="text-xs text-neutral-400 mb-1">
              Returning-user rate
              <span className="ml-1"><InfoTip label="Returning-user rate">Of the people who used it in the 30 days before last, the share who came back and used it again in the last 30 days. The core retention number.</InfoTip></span>
            </p>
            <p className="text-2xl font-bold text-white tabular-nums">{returning.pct == null ? "—" : `${returning.pct}%`}</p>
            <p className="text-[11px] text-neutral-600 mt-0.5 tabular-nums">
              {returning.returned} of {returning.priorActives} came back
            </p>
          </div>
        </div>
      </section>

      {/* Second sale and beyond — agency transaction retention */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
          Second sale and beyond
          <span className="ml-1.5 normal-case tracking-normal"><InfoTip label="Second sale and beyond">The first sale can be a trial. A second is real evidence an agency found this useful enough to come back, and 2 to 5 to 10 shows where use turns habitual. Drafts and bulk-imported files are excluded.</InfoTip></span>
        </h2>
        <p className="text-[11px] text-neutral-600 mb-4">
          Of the {tx.starters} {tx.starters === 1 ? "agency" : "agencies"} that created a first sale, how many came back to create more.
        </p>

        {tx.starters === 0 ? (
          <p className="text-sm text-neutral-600">No agency has created a first sale in this view yet.</p>
        ) : (
          <div className="space-y-4">
            {/* 1 → 2 → 5 → 10 funnel */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {tx.milestones.map((m) => (
                <div key={m.threshold} className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
                  <p className="text-xs text-neutral-400 mb-1">{milestoneLabel(m.threshold)}</p>
                  <p className="text-2xl font-bold text-white tabular-nums">{m.agencies}</p>
                  {m.threshold === 1 ? (
                    <p className="text-[11px] text-neutral-600 mt-0.5">created a first sale</p>
                  ) : (
                    <p className="text-[11px] text-neutral-500 mt-0.5 tabular-nums">
                      {m.stepPct == null ? "—" : `${m.stepPct}%`} of the step before
                      {m.pctOfStarters != null && <span className="text-neutral-600"> · {m.pctOfStarters}% of starters</span>}
                    </p>
                  )}
                  {m.medianDaysFromFirst != null && (
                    <p className="text-[10px] text-neutral-600 mt-0.5 tabular-nums">median {fmtDays(m.medianDaysFromFirst)} from first</p>
                  )}
                </div>
              ))}
            </div>

            {/* How quickly the second comes */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
              <p className="text-[11px] text-neutral-500 uppercase tracking-wider mb-3">How quickly the second sale comes</p>
              {tx.timeToSecond.n === 0 ? (
                <p className="text-xs text-neutral-600">No agency has reached a second sale in this view yet.</p>
              ) : (
                <div className="grid grid-cols-3 gap-6">
                  {[
                    { label: "Fastest quarter", v: tx.timeToSecond.p25 },
                    { label: "Typical", v: tx.timeToSecond.median },
                    { label: "Slowest quarter", v: tx.timeToSecond.p75 },
                  ].map(({ label, v }) => (
                    <div key={label} className="text-center">
                      <p className="text-[11px] text-neutral-500 mb-1">{label}</p>
                      <p className="text-2xl font-bold text-white tabular-nums">{v == null ? "—" : fmtDays(Math.round(v))}</p>
                      <p className="text-[10px] text-neutral-600 mt-0.5">after the first</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recently activated — reached their second in the last 90 days */}
            {tx.recentSecond.length > 0 && (
              <div>
                <p className="text-[11px] text-neutral-500 uppercase tracking-wider mb-2">Recently reached their second sale · last 90 days</p>
                <div className="flex flex-wrap gap-2">
                  {tx.recentSecond.map((r) => (
                    <span key={r.agencyId} className="inline-flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-full px-3 py-1 text-[11px] text-neutral-300">
                      {r.agencyName}
                      <span className="text-neutral-500">{fmtDate(r.secondAt)} · {fmtDays(r.daysFromFirst)} after first</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* How often people come back */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          How often people come back, last 90 days
          <span className="ml-1.5 normal-case tracking-normal"><InfoTip label="How often people come back">The typical gap between one sign-in and the next, per person. Most engaged = the quarter who return fastest; least engaged = the quarter who leave the longest gap.</InfoTip></span>
        </h2>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
          {gaps.n === 0 ? (
            <p className="text-xs text-neutral-600">Not enough sign-in history in this scope yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-6">
              {[
                { label: "Most engaged", v: gaps.p25 },
                { label: "Typical", v: gaps.median },
                { label: "Least engaged", v: gaps.p75 },
              ].map(({ label, v }) => (
                <div key={label} className="text-center">
                  <p className="text-[11px] text-neutral-500 mb-1">{label}</p>
                  <p className="text-2xl font-bold text-white tabular-nums">{fmtHours(v)}</p>
                  <p className="text-[10px] text-neutral-600 mt-0.5">between sign-ins</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Who's drifting — the actionable churn-risk list */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
          Who&rsquo;s drifting away
        </h2>
        <p className="text-[11px] text-neutral-600 mb-4">
          People who used it a month or two ago but haven&rsquo;t been back in the last 30 days. Freshest drift first, so
          the most winnable are at the top.
        </p>

        {driftAgencies.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {driftAgencies.map((a) => (
              <span key={a.agencyName} className="inline-flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-full px-3 py-1 text-[11px] text-neutral-300">
                {a.agencyName}
                <span className="text-neutral-500">{a.users} {a.users === 1 ? "person" : "people"} quiet</span>
              </span>
            ))}
          </div>
        )}

        {driftUsers.length === 0 ? (
          <p className="text-sm text-neutral-600">No one has drifted in this window. Everyone active a month ago is still active.</p>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-800/50 text-[10px] uppercase tracking-wider text-neutral-500">
                    <th className="text-left px-5 py-2.5 font-medium">Person</th>
                    <th className="text-left px-4 py-2.5 font-medium">Agency</th>
                    <th className="text-left px-4 py-2.5 font-medium">Last seen</th>
                    <th className="text-right px-4 py-2.5 font-medium">Quiet</th>
                    <th className="text-left px-4 py-2.5 font-medium">Last thing they did</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {driftUsers.map((d) => (
                    <DriftRow key={d.userId} d={d} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Cohort pointer */}
      <section>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs font-medium text-neutral-300">How many new sign-ups stick around</p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Week 1 / 2 / 4 / 8 / 12: how many are still active later, grouped by when they joined. Lives on Trends.
            </p>
          </div>
          <Link href="/command/growth" className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors shrink-0">
            Go to Trends →
          </Link>
        </div>
      </section>
    </div>
  );
}

function DriftRow({ d }: { d: DriftUser }) {
  const quietTone = d.daysQuiet >= 50 ? "text-red-400" : d.daysQuiet >= 40 ? "text-amber-500/90" : "text-neutral-300";
  return (
    <tr className="hover:bg-neutral-800/50 transition-colors">
      <td className="px-5 py-2.5 text-xs text-neutral-200">
        {d.name}
        {d.role && <span className="ml-1.5 text-[10px] text-neutral-600">{d.role}</span>}
      </td>
      <td className="px-4 py-2.5 text-xs text-neutral-400">{d.agencyName}</td>
      <td className="px-4 py-2.5 text-xs text-neutral-400">{fmtDate(d.lastSeen)}</td>
      <td className={`px-4 py-2.5 text-right text-xs tabular-nums ${quietTone}`}>{d.daysQuiet}d</td>
      <td className="px-4 py-2.5 text-xs text-neutral-300">
        {d.txId ? (
          <Link href={`/command/files?tx=${d.txId}`} className="text-neutral-300 hover:text-white underline decoration-neutral-700">
            {d.lastAction} →
          </Link>
        ) : (
          d.lastAction
        )}
      </td>
    </tr>
  );
}
