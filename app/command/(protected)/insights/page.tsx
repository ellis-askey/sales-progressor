import { commandDb } from "@/lib/command/prisma";
import Link from "next/link";
import { AcknowledgeButton } from "@/components/command/AcknowledgeButton";
import { SignalActions } from "@/components/command/insights/SignalActions";
import { BulkAckButton } from "@/components/command/insights/BulkAckButton";
import { SignalGroupList } from "@/components/command/insights/SignalGroupList";
import { ExpandableBrief } from "@/components/command/insights/ExpandableBrief";
import InfoTip from "@/components/command/shared/InfoTip";
import {
  displayFor, isOperationalDetector,
  SEVERITY_BADGE, SEVERITY_RANK,
} from "@/lib/command/signal-display";
import type { Signal } from "@prisma/client";

// The founder Briefing. Three reads, in priority order:
//   1. the plain-English AI brief (daily + weekly),
//   2. what MOVED this week (the trend hero) + any decision waiting on you,
//   3. the handful of other founder-altitude situations.
// The per-file operational queue (chases, quiet clients, stuck solicitors) is NOT
// here — it lives in Operations → Attention. See lib/command/signal-display.ts.

const pstr = (p: Record<string, unknown>, k: string): string => (p[k] == null ? "" : String(p[k]));
const pnum = (p: Record<string, unknown>, k: string): number =>
  typeof p[k] === "number" ? (p[k] as number) : Number(p[k]) || 0;

function fmtDate(d: Date): string {
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
  });
}
function fmtDateShort(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
}
function daysSince(d: Date): number {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ ack?: string }>;
}) {
  const sp = await searchParams;
  const showAcked = sp.ack === "1";
  const now = new Date();
  const notSnoozed = { OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }] };

  const [latestBrief, latestReview, activeRaw, dealtRaw, proposedExperiments] = await Promise.all([
    commandDb.outboundMessage.findFirst({
      where: { purpose: "digest", aiModel: { contains: "haiku" } },
      orderBy: { createdAt: "desc" },
    }),
    commandDb.outboundMessage.findFirst({
      where: { purpose: "digest", aiModel: { contains: "opus" } },
      orderBy: { createdAt: "desc" },
    }),
    commandDb.signal.findMany({
      where: { acknowledged: false, resolvedAt: null, ...notSnoozed },
      orderBy: [{ severity: "desc" }, { confidence: "desc" }, { lastSeenAt: "desc" }],
      take: 500,
    }),
    showAcked
      ? commandDb.signal.findMany({
          where: { OR: [{ acknowledged: true }, { resolvedAt: { not: null } }] },
          orderBy: { lastSeenAt: "desc" },
          take: 50,
        })
      : Promise.resolve([] as Signal[]),
    commandDb.experiment.findMany({
      where: { status: "proposed" },
      orderBy: { proposedAt: "asc" },
      take: 6,
      select: { id: true, name: true, proposedAt: true },
    }),
  ]);

  // Founder-altitude vs operational, then split the founder set into its three
  // distinct reads.
  const founder = activeRaw.filter((s) => !isOperationalDetector(s.detectorName));
  const operational = activeRaw.filter((s) => isOperationalDetector(s.detectorName));
  const dealtWith = dealtRaw.filter((s) => !isOperationalDetector(s.detectorName));

  const metricMoves = founder
    .filter((s) => s.detectorName === "metric_delta")
    .sort((a, b) => Math.abs(pnum(b.payload as Record<string, unknown>, "deltaPercent")) - Math.abs(pnum(a.payload as Record<string, unknown>, "deltaPercent")));
  const silentAgencies = founder
    .filter((s) => s.detectorName === "silent_agency")
    .sort((a, b) => pnum(b.payload as Record<string, unknown>, "daysSilent") - pnum(a.payload as Record<string, unknown>, "daysSilent"));
  const otherFounder = founder.filter((s) => s.detectorName !== "metric_delta" && s.detectorName !== "silent_agency");

  // Remaining founder signals, grouped for the shared feed.
  const otherGroups = new Map<string, Signal[]>();
  for (const s of otherFounder) {
    const arr = otherGroups.get(s.detectorName) ?? [];
    arr.push(s);
    otherGroups.set(s.detectorName, arr);
  }
  const otherOrdered = Array.from(otherGroups.entries()).sort((a, b) => {
    const ra = Math.min(...a[1].map((s) => SEVERITY_RANK[s.severity] ?? 9));
    const rb = Math.min(...b[1].map((s) => SEVERITY_RANK[s.severity] ?? 9));
    if (ra !== rb) return ra - rb;
    return b[1].length - a[1].length;
  });

  // Operational queue summary (a pointer, not a list).
  const opCounts = new Map<string, number>();
  for (const s of operational) opCounts.set(s.detectorName, (opCounts.get(s.detectorName) ?? 0) + 1);
  const opSummary = Array.from(opCounts.entries())
    .map(([name, count]) => ({ group: displayFor(name).group, count }))
    .sort((a, b) => b.count - a.count);

  const SILENT_SHOWN = 5;
  const silentWorst = silentAgencies.slice(0, SILENT_SHOWN);
  const silent60 = silentAgencies.filter((s) => pnum(s.payload as Record<string, unknown>, "daysSilent") >= 60).length;

  const nothingAtAll =
    metricMoves.length === 0 && silentAgencies.length === 0 && otherFounder.length === 0 &&
    proposedExperiments.length === 0 && operational.length === 0;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Briefing</h1>
          <p className="text-sm text-neutral-400 mt-1">A plain-English read on the platform, and the few things that need your call.</p>
        </div>
        <Link
          href={showAcked ? "/command/insights" : "/command/insights?ack=1"}
          className="shrink-0 text-xs text-neutral-500 hover:text-neutral-300 transition-colors mt-1"
        >
          {showAcked ? "Hide dealt-with" : "Show dealt-with"}
        </Link>
      </div>

      {/* AI briefs */}
      <section>
        <h2 className="text-xs font-semibold text-neutral-400 mb-4 flex items-center gap-1.5">
          Today&rsquo;s briefing
          <InfoTip label="Where the briefing comes from">
            Written each morning from your real weekly numbers plus the open situations below. The daily brief and
            weekly review are also emailed to you.
          </InfoTip>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ExpandableBrief
            title="Latest daily brief"
            subject={latestBrief?.subject}
            content={latestBrief?.content}
            sentAt={latestBrief ? fmtDateShort(latestBrief.createdAt) : null}
            empty="No daily brief sent yet. Runs at 06:00 UTC."
          />
          <ExpandableBrief
            title="Latest weekly review"
            subject={latestReview?.subject}
            content={latestReview?.content}
            sentAt={latestReview ? fmtDateShort(latestReview.createdAt) : null}
            empty="No weekly review sent yet. Runs Monday at 07:00 UTC."
          />
        </div>
      </section>

      {/* What moved — the trend hero */}
      {metricMoves.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-neutral-400 mb-4 flex items-center gap-1.5">
            What moved this week
            <InfoTip label="What this shows">
              Platform-wide numbers that shifted more than 10% versus the week before. Green is up, red is down.
            </InfoTip>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {metricMoves.map((s) => {
              const p = s.payload as Record<string, unknown>;
              const delta = pnum(p, "deltaPercent");
              const up = delta >= 0;
              return (
                <div key={s.id} className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 flex flex-col">
                  <p className="text-xs text-neutral-400">{pstr(p, "label") || "a metric"}</p>
                  <p className={`text-2xl font-bold tabular-nums mt-1.5 ${up ? "text-emerald-400" : "text-red-400"}`}>
                    {up ? "↑" : "↓"} {Math.abs(delta)}%
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    {pnum(p, "current").toLocaleString()} vs {pnum(p, "previous").toLocaleString()} the week before
                  </p>
                  <div className="mt-3 pt-3 border-t border-neutral-800">
                    <SignalActions signalId={s.id} href={displayFor(s.detectorName).href(p)} experimentable />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Decisions waiting on you */}
      {proposedExperiments.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-neutral-400 mb-4 flex items-center gap-1.5">
            Decisions waiting on you
            <InfoTip label="What this is">
              Growth experiments that have been proposed but not started. Each needs a go / no-go from you.
            </InfoTip>
          </h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-800">
            {proposedExperiments.map((e) => (
              <Link
                key={e.id}
                href="/command/growth?tab=experiments&view=tests"
                className="flex items-center gap-3 px-5 py-3 hover:bg-neutral-800/40 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-200 truncate">{e.name}</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">proposed {daysSince(e.proposedAt)}d ago</p>
                </div>
                <span className="shrink-0 text-xs text-blue-400 group-hover:text-blue-300">Review →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Agencies drifting — synthesised, not 12 rows */}
      {silentAgencies.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-neutral-400 mb-4 flex items-center gap-1.5">
            Agencies drifting
            <InfoTip label="What counts as drifting">
              An agency that was active once but hasn&rsquo;t done anything on the platform for 14+ days. They may be
              leaving. The worst are shown; the rest are on the Agencies page.
            </InfoTip>
          </h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-neutral-800 flex items-center gap-2 bg-neutral-900/60">
              <p className="text-sm text-neutral-200">
                <span className="font-semibold tabular-nums">{silentAgencies.length}</span> drifting
                {silent60 > 0 && <span className="text-amber-400"> · {silent60} silent 60+ days</span>}
              </p>
              <span className="ml-auto"><BulkAckButton detectorName="silent_agency" count={silentAgencies.length} /></span>
            </div>
            <div className="divide-y divide-neutral-800">
              {silentWorst.map((s) => {
                const p = s.payload as Record<string, unknown>;
                const days = pnum(p, "daysSilent");
                return (
                  <div key={s.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-200 truncate">{pstr(p, "agencyName") || "An agency"}</p>
                      <p className={`text-[11px] mt-0.5 ${days >= 60 ? "text-amber-400" : "text-neutral-500"}`}>silent {days} days</p>
                    </div>
                    <SignalActions signalId={s.id} href={displayFor(s.detectorName).href(p)} experimentable={false} />
                  </div>
                );
              })}
            </div>
            {silentAgencies.length > SILENT_SHOWN && (
              <Link
                href="/command/agencies"
                className="block px-5 py-2.5 text-[11px] text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/40 transition-colors border-t border-neutral-800"
              >
                {silentAgencies.length - SILENT_SHOWN} more on the Agencies page →
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Anything else founder-level */}
      {otherFounder.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-neutral-400 mb-4">Also worth a look</h2>
          <SignalGroupList groups={otherOrdered} />
        </section>
      )}

      {/* Operational queue — a pointer, not a list. */}
      {operational.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-neutral-400 mb-4 flex items-center gap-1.5">
            Operational queue
            <InfoTip label="Why this isn't a list here">
              These are per-file tasks the team works (chases, quiet clients, stuck solicitor steps, quotes to action).
              They don&rsquo;t need a founder decision, so they live in Operations rather than cluttering your briefing.
            </InfoTip>
          </h2>
          <Link
            href="/command/operations?tab=attention"
            className="block group bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 hover:bg-neutral-800/40 hover:border-neutral-700 transition-colors"
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl font-bold tabular-nums text-neutral-100">{operational.length}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-neutral-300 font-medium">
                  situations the team is working
                  <span className="text-neutral-600 group-hover:text-neutral-400 transition-colors"> ›</span>
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5 truncate">
                  {opSummary.map((o) => `${o.group} ${o.count}`).join("  ·  ")}
                </p>
              </div>
              <span className="shrink-0 text-neutral-600">→</span>
            </div>
          </Link>
        </section>
      )}

      {nothingAtAll && <p className="text-sm text-neutral-600">Nothing needs a look right now.</p>}

      {/* Dealt with */}
      {showAcked && dealtWith.length > 0 && (
        <section>
          <p className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider mb-3">Dealt with · {dealtWith.length}</p>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-800 opacity-60">
            {dealtWith.map((s) => {
              const d = displayFor(s.detectorName);
              return (
                <div key={s.id} className="px-4 py-2.5 flex items-start gap-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${SEVERITY_BADGE[s.severity]}`}>
                    {s.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-neutral-300">{d.title(s.payload as Record<string, unknown>)}</p>
                    <p className="text-[10px] text-neutral-600">
                      {s.resolvedAt ? `resolved ${fmtDate(s.resolvedAt)}` : s.acknowledgedAt ? `dealt with ${fmtDate(s.acknowledgedAt)}` : ""}
                    </p>
                  </div>
                  {!s.acknowledged && <AcknowledgeButton signalId={s.id} />}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
