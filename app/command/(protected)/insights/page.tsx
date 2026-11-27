import { commandDb } from "@/lib/command/prisma";
import Link from "next/link";
import { AcknowledgeButton } from "@/components/command/AcknowledgeButton";
import { SignalGroupList } from "@/components/command/insights/SignalGroupList";
import { ExpandableBrief } from "@/components/command/insights/ExpandableBrief";
import InfoTip from "@/components/command/shared/InfoTip";
import {
  displayFor, isOperationalDetector,
  SEVERITY_MEANING, SEVERITY_BADGE, SEVERITY_RANK,
} from "@/lib/command/signal-display";
import type { Signal, SignalSeverity } from "@prisma/client";

// The founder Briefing. Two jobs only:
//   1. the plain-English AI read (daily brief + weekly review),
//   2. the handful of FOUNDER-altitude situations that need your call.
// The per-file operational queue (chases, quiet clients, stuck solicitors) is NOT
// here — it lives in Operations → Attention, where the team works it. See
// lib/command/signal-display.ts `altitude`.

function fmtDate(d: Date): string {
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
  });
}
function fmtDateShort(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ sev?: string; ack?: string }>;
}) {
  const sp = await searchParams;
  const sevFilter = sp.sev as SignalSeverity | undefined;
  const showAcked = sp.ack === "1";
  const now = new Date();
  const notSnoozed = { OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }] };

  const [latestBrief, latestReview, activeRaw, dealtRaw] = await Promise.all([
    commandDb.outboundMessage.findFirst({
      where: { purpose: "digest", aiModel: { contains: "haiku" } },
      orderBy: { createdAt: "desc" },
    }),
    commandDb.outboundMessage.findFirst({
      where: { purpose: "digest", aiModel: { contains: "opus" } },
      orderBy: { createdAt: "desc" },
    }),
    commandDb.signal.findMany({
      where: { acknowledged: false, resolvedAt: null, ...notSnoozed, ...(sevFilter ? { severity: sevFilter } : {}) },
      orderBy: [{ severity: "desc" }, { confidence: "desc" }, { lastSeenAt: "desc" }],
      take: 500,
    }),
    showAcked
      ? commandDb.signal.findMany({
          where: { OR: [{ acknowledged: true }, { resolvedAt: { not: null } }], ...(sevFilter ? { severity: sevFilter } : {}) },
          orderBy: { lastSeenAt: "desc" },
          take: 50,
        })
      : Promise.resolve([] as Signal[]),
  ]);

  // Founder-altitude vs operational.
  const founder = activeRaw.filter((s) => !isOperationalDetector(s.detectorName));
  const operational = activeRaw.filter((s) => isOperationalDetector(s.detectorName));
  const dealtWith = dealtRaw.filter((s) => !isOperationalDetector(s.detectorName));

  // Founder tally + groups (metric moves first — that's the "what changed" read).
  const openTally = { critical: 0, leak: 0, opportunity: 0, info: 0 } as Record<string, number>;
  for (const s of founder) openTally[s.severity] = (openTally[s.severity] ?? 0) + 1;

  const groups = new Map<string, Signal[]>();
  for (const s of founder) {
    const arr = groups.get(s.detectorName) ?? [];
    arr.push(s);
    groups.set(s.detectorName, arr);
  }
  const founderGroups = Array.from(groups.entries()).sort((a, b) => {
    // Metric moves lead; then by worst severity, then by size.
    if (a[0] === "metric_delta" && b[0] !== "metric_delta") return -1;
    if (b[0] === "metric_delta" && a[0] !== "metric_delta") return 1;
    const ra = Math.min(...a[1].map((s) => SEVERITY_RANK[s.severity] ?? 9));
    const rb = Math.min(...b[1].map((s) => SEVERITY_RANK[s.severity] ?? 9));
    if (ra !== rb) return ra - rb;
    return b[1].length - a[1].length;
  });

  // Operational queue summary — a single pointer to Operations, not a list.
  const opCounts = new Map<string, number>();
  for (const s of operational) opCounts.set(s.detectorName, (opCounts.get(s.detectorName) ?? 0) + 1);
  const opSummary = Array.from(opCounts.entries())
    .map(([name, count]) => ({ group: displayFor(name).group, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">Briefing</h1>
        <p className="text-sm text-neutral-400 mt-1">A plain-English read on the platform, and the few things that need your call.</p>
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

      {/* Founder signals */}
      <section>
        <h2 className="text-xs font-semibold text-neutral-400 mb-4 flex items-center gap-1.5">
          What needs your attention
          <InfoTip label="What shows here">
            Business-level situations only: a number that moved, an agency drifting away, a shift in the funnel. The
            per-file work (chases, quiet clients, stuck solicitors) lives in Operations, not here.
          </InfoTip>
        </h2>

        {/* Open tally + dealt-with toggle */}
        <div className="flex items-center gap-2 flex-wrap mb-5">
          {(["critical", "leak", "opportunity", "info"] as const).map((sev) => (
            <span key={sev} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium ${SEVERITY_BADGE[sev]}`}>
              <span className="tabular-nums font-bold">{openTally[sev] ?? 0}</span>
              {sev}
              <InfoTip label={`What ${sev} means`}>{SEVERITY_MEANING[sev]}</InfoTip>
            </span>
          ))}
          <span className="ml-auto flex items-center gap-3">
            {sevFilter && (
              <Link href="/command/insights" className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors">
                showing {sevFilter} · show all
              </Link>
            )}
            <Link
              href={showAcked ? "/command/insights" : "/command/insights?ack=1"}
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              {showAcked ? "Hide dealt-with" : "Show dealt-with"}
            </Link>
          </span>
        </div>

        {founder.length === 0 ? (
          <p className="text-sm text-neutral-600">Nothing at your level needs a look right now.</p>
        ) : (
          <SignalGroupList groups={founderGroups} />
        )}

        {showAcked && dealtWith.length > 0 && (
          <div className="mt-6">
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
          </div>
        )}
      </section>

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
    </div>
  );
}
