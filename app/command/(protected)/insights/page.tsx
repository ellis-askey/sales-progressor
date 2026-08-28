import { commandDb } from "@/lib/command/prisma";
import { AcknowledgeButton } from "@/components/command/AcknowledgeButton";
import { SignalActions } from "@/components/command/insights/SignalActions";
import { BulkAckButton } from "@/components/command/insights/BulkAckButton";
import { ExpandableBrief } from "@/components/command/insights/ExpandableBrief";
import InfoTip from "@/components/command/shared/InfoTip";
import { displayFor } from "@/lib/command/signal-display";
import type { Signal, SignalSeverity } from "@prisma/client";

const SEVERITY_BADGE: Record<string, string> = {
  critical:    "bg-red-950 text-red-400 border border-red-900",
  leak:        "bg-amber-950 text-amber-400 border border-amber-900",
  opportunity: "bg-emerald-950 text-emerald-400 border border-emerald-900",
  info:        "bg-neutral-800 text-neutral-400 border border-neutral-800",
};
const SEVERITY_RANK: Record<string, number> = { critical: 0, leak: 1, opportunity: 2, info: 3 };
const SEVERITY_MEANING: Record<string, string> = {
  critical: "Acting late has a real cost. Look today.",
  leak: "Money or momentum slipping. Worth a look this week.",
  opportunity: "Something going better than usual, worth leaning into.",
  info: "Context only. No action needed.",
};

const CONF_COLOR = (c: number): string =>
  c >= 0.8 ? "text-neutral-100" : c >= 0.5 ? "text-neutral-300" : "text-neutral-500";

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
  searchParams: Promise<{ sev?: string; ack?: string }>;
}) {
  const sp = await searchParams;
  const sevFilter = sp.sev as SignalSeverity | undefined;
  const showAcked = sp.ack === "1";
  const now = new Date();

  const notSnoozed = { OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }] };

  const [latestBrief, latestReview, active, snoozedCount, dealtWith] = await Promise.all([
    commandDb.outboundMessage.findFirst({
      where: { purpose: "digest", aiModel: { contains: "haiku" } },
      orderBy: { createdAt: "desc" },
    }),
    commandDb.outboundMessage.findFirst({
      where: { purpose: "digest", aiModel: { contains: "opus" } },
      orderBy: { createdAt: "desc" },
    }),
    commandDb.signal.findMany({
      where: {
        acknowledged: false,
        resolvedAt: null,
        ...notSnoozed,
        ...(sevFilter ? { severity: sevFilter } : {}),
      },
      orderBy: [{ severity: "desc" }, { confidence: "desc" }, { lastSeenAt: "desc" }],
      take: 300,
    }),
    commandDb.signal.count({
      where: { acknowledged: false, resolvedAt: null, snoozedUntil: { gte: now } },
    }),
    showAcked
      ? commandDb.signal.findMany({
          where: {
            OR: [{ acknowledged: true }, { resolvedAt: { not: null } }],
            ...(sevFilter ? { severity: sevFilter } : {}),
          },
          orderBy: { lastSeenAt: "desc" },
          take: 50,
        })
      : Promise.resolve([] as Signal[]),
  ]);

  // Active severity tally (open right now — distinct from the Overview page's
  // last-7-days counts).
  const openTally = { critical: 0, leak: 0, opportunity: 0, info: 0 } as Record<string, number>;
  for (const s of active) openTally[s.severity] = (openTally[s.severity] ?? 0) + 1;

  // Group the feed by detector so duplicates of a kind collapse under one heading.
  const groups = new Map<string, Signal[]>();
  for (const s of active) {
    const arr = groups.get(s.detectorName) ?? [];
    arr.push(s);
    groups.set(s.detectorName, arr);
  }
  const orderedGroups = Array.from(groups.entries()).sort((a, b) => {
    const ra = Math.min(...a[1].map((s) => SEVERITY_RANK[s.severity] ?? 9));
    const rb = Math.min(...b[1].map((s) => SEVERITY_RANK[s.severity] ?? 9));
    if (ra !== rb) return ra - rb;
    return b[1].length - a[1].length;
  });

  const sevOptions = [
    { value: "", label: "All" },
    { value: "critical", label: "Critical" },
    { value: "leak", label: "Leak" },
    { value: "opportunity", label: "Opportunity" },
    { value: "info", label: "Info" },
  ];
  function sevLink(sev: string): string {
    const p = new URLSearchParams();
    if (sev) p.set("sev", sev);
    if (showAcked) p.set("ack", "1");
    return `/command/insights${p.toString() ? `?${p}` : ""}`;
  }
  function ackToggle(): string {
    const p = new URLSearchParams();
    if (sevFilter) p.set("sev", sevFilter);
    if (!showAcked) p.set("ack", "1");
    return `/command/insights${p.toString() ? `?${p}` : ""}`;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-neutral-100">Briefing</h1>
      <p className="text-sm text-neutral-400 -mt-4">A plain-English read on the platform, and anything worth a look.</p>

      {/* AI Briefs */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
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

      {/* Signal feed */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          What needs your attention
          <InfoTip label="How this feed works">
            Each item is one ongoing situation, not one row per night. It clears itself when the situation resolves.
            Snooze hides it for a bit; &ldquo;Not useful&rdquo; clears it for good.
          </InfoTip>
        </h2>

        {/* Legend + open tally */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {(["critical", "leak", "opportunity", "info"] as const).map((sev) => (
            <span key={sev} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium ${SEVERITY_BADGE[sev]}`}>
              <span className="tabular-nums font-bold">{openTally[sev] ?? 0}</span>
              {sev}
              <InfoTip label={`What ${sev} means`}>{SEVERITY_MEANING[sev]}</InfoTip>
            </span>
          ))}
          <span className="text-[11px] text-neutral-600 inline-flex items-center gap-1">
            confidence
            <InfoTip label="What the % means">
              How sure the detector is. 80%+ is close to a fact; lower means it&rsquo;s a softer inference worth a glance.
            </InfoTip>
          </span>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap mb-5">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Priority</span>
          {sevOptions.map((o) => (
            <a
              key={o.value}
              href={sevLink(o.value)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                (sevFilter ?? "") === o.value
                  ? "bg-neutral-700 text-white"
                  : "bg-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700"
              }`}
            >
              {o.label}
            </a>
          ))}
          <span className="ml-auto flex items-center gap-3">
            {snoozedCount > 0 && <span className="text-[11px] text-neutral-600">{snoozedCount} snoozed</span>}
            <a href={ackToggle()} className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
              {showAcked ? "Hide dealt-with" : "Show dealt-with"}
            </a>
          </span>
        </div>

        {active.length === 0 ? (
          <p className="text-sm text-neutral-600">Nothing needs a look right now.</p>
        ) : (
          <div className="space-y-4">
            {orderedGroups.map(([detectorName, rows]) => {
              const d = displayFor(detectorName);
              return (
                <div key={detectorName} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-neutral-800 flex items-center gap-2 bg-neutral-900/60">
                    <p className="text-xs font-semibold text-neutral-200">{d.group}</p>
                    <span className="text-[11px] text-neutral-500 tabular-nums">· {rows.length}</span>
                    <InfoTip label={`What ${d.group} means`}>{d.whatItMeans}</InfoTip>
                    <span className="ml-auto">
                      <BulkAckButton detectorName={detectorName} count={rows.length} />
                    </span>
                  </div>
                  <div className="divide-y divide-neutral-800">
                    {rows.map((s) => {
                      const payload = s.payload as Record<string, unknown>;
                      const ongoing = daysSince(s.detectedAt);
                      return (
                        <div key={s.id} className="px-4 py-3 flex items-start gap-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${SEVERITY_BADGE[s.severity]}`}>
                            {s.severity}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-neutral-200">{d.title(payload)}</p>
                            <p className="text-[11px] text-neutral-600 mt-0.5 flex items-center gap-2">
                              <span className={CONF_COLOR(s.confidence)}>{Math.round(s.confidence * 100)}%</span>
                              <span>·</span>
                              <span>{ongoing === 0 ? "first seen today" : `ongoing ${ongoing}d`}</span>
                              {s.occurrences > 1 && <span>· seen {s.occurrences}×</span>}
                            </p>
                          </div>
                          <SignalActions signalId={s.id} href={d.href(payload)} experimentable={d.experimentable} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Dealt with */}
        {showAcked && dealtWith.length > 0 && (
          <div className="mt-6">
            <p className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider mb-3">
              Dealt with · {dealtWith.length}
            </p>
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
    </div>
  );
}
