import { commandDb } from "@/lib/command/prisma";
import { AcknowledgeButton } from "@/components/command/AcknowledgeButton";
import { SignalGroupList } from "@/components/command/insights/SignalGroupList";
import InfoTip from "@/components/command/shared/InfoTip";
import {
  displayFor, isOperationalDetector,
  SEVERITY_MEANING, SEVERITY_BADGE, SEVERITY_RANK,
} from "@/lib/command/signal-display";
import type { Signal, SignalSeverity } from "@prisma/client";

// Operations workspace → Attention. The per-file / per-client operational signal
// queue (chases not landing, clients gone quiet, solicitor steps stuck, quotes
// aging, revenue to invoice) — relocated here off the founder Briefing, where it
// was noise. This is where the team actually works the list.

const BASE = "/command/operations?tab=attention";

function fmtDate(d: Date): string {
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
  });
}

export async function AttentionTab({ sev, ack }: { sev?: string; ack?: string }) {
  const sevFilter = sev as SignalSeverity | undefined;
  const showAcked = ack === "1";
  const now = new Date();
  const notSnoozed = { OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }] };

  const [activeRaw, snoozedRaw, dealtRaw] = await Promise.all([
    commandDb.signal.findMany({
      where: { acknowledged: false, resolvedAt: null, ...notSnoozed, ...(sevFilter ? { severity: sevFilter } : {}) },
      orderBy: [{ severity: "desc" }, { confidence: "desc" }, { lastSeenAt: "desc" }],
      take: 500,
    }),
    commandDb.signal.findMany({
      where: { acknowledged: false, resolvedAt: null, snoozedUntil: { gte: now } },
      select: { detectorName: true },
      take: 500,
    }),
    showAcked
      ? commandDb.signal.findMany({
          where: { OR: [{ acknowledged: true }, { resolvedAt: { not: null } }], ...(sevFilter ? { severity: sevFilter } : {}) },
          orderBy: { lastSeenAt: "desc" },
          take: 80,
        })
      : Promise.resolve([] as Signal[]),
  ]);

  // Operational only (the founder-altitude ones live on the Briefing).
  const active = activeRaw.filter((s) => isOperationalDetector(s.detectorName));
  const snoozedCount = snoozedRaw.filter((r) => isOperationalDetector(r.detectorName)).length;
  const dealtWith = dealtRaw.filter((s) => isOperationalDetector(s.detectorName));

  const openTally = { critical: 0, leak: 0, opportunity: 0, info: 0 } as Record<string, number>;
  for (const s of active) openTally[s.severity] = (openTally[s.severity] ?? 0) + 1;

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
  const sevLink = (s: string) => {
    const p = new URLSearchParams({ tab: "attention" });
    if (s) p.set("sev", s);
    if (showAcked) p.set("ack", "1");
    return `/command/operations?${p}`;
  };
  const ackToggle = () => {
    const p = new URLSearchParams({ tab: "attention" });
    if (sevFilter) p.set("sev", sevFilter);
    if (!showAcked) p.set("ack", "1");
    return `/command/operations?${p}`;
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-neutral-400">
        The operational queue — per-file situations the team works. Each is one ongoing situation; it clears itself when
        resolved. The founder-level read lives on the Briefing.
      </p>

      {/* Legend + open tally */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["critical", "leak", "opportunity", "info"] as const).map((s) => (
          <span key={s} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium ${SEVERITY_BADGE[s]}`}>
            <span className="tabular-nums font-bold">{openTally[s] ?? 0}</span>
            {s}
            <InfoTip label={`What ${s} means`}>{SEVERITY_MEANING[s]}</InfoTip>
          </span>
        ))}
      </div>

      {/* Priority filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-neutral-500">Priority</span>
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
        <p className="text-sm text-neutral-600">Nothing in the operational queue right now.</p>
      ) : (
        <SignalGroupList groups={orderedGroups} />
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
    </div>
  );
}
