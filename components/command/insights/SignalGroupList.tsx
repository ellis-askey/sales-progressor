import { SignalActions } from "@/components/command/insights/SignalActions";
import { BulkAckButton } from "@/components/command/insights/BulkAckButton";
import InfoTip from "@/components/command/shared/InfoTip";
import { displayFor, SEVERITY_BADGE } from "@/lib/command/signal-display";
import type { Signal } from "@prisma/client";

// Shared signal feed: one card per detector group, each row a single ongoing
// situation with its confidence, age and actions. Used by both the founder
// Briefing and the Operations Attention queue so the two never drift.

const CONF_COLOR = (c: number): string =>
  c >= 0.8 ? "text-neutral-100" : c >= 0.5 ? "text-neutral-300" : "text-neutral-500";

function daysSince(d: Date): number {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
}

export function SignalGroupList({ groups }: { groups: [string, Signal[]][] }) {
  return (
    <div className="space-y-4">
      {groups.map(([detectorName, rows]) => {
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
  );
}
