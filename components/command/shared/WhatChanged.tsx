import { cache } from "react";
import { commandDb } from "@/lib/command/prisma";

const SEVERITY_COLORS: Record<string, string> = {
  critical:    "bg-red-950 text-red-400",
  leak:        "bg-amber-950 text-amber-400",
  opportunity: "bg-emerald-950 text-emerald-400",
  info:        "bg-neutral-800 text-neutral-400",
};

const STATUS_COLORS: Record<string, string> = {
  active:    "bg-blue-950 text-blue-400",
  proposed:  "bg-neutral-800 text-neutral-400",
  concluded: "bg-neutral-800 text-neutral-500",
};

const fetchWindowContext = cache(async (startMs: number, endMs: number) => {
  const gte = new Date(startMs);
  const lte = new Date(endMs);
  const [signals, experiments, deployments] = await Promise.all([
    commandDb.signal.findMany({
      where: { windowStart: { gte, lte } },
      orderBy: [{ severity: "desc" }, { confidence: "desc" }],
      take: 8,
    }),
    commandDb.experiment.findMany({
      where: {
        OR: [
          { startedAt: { gte, lte } },
          { status: "active", startedAt: { lte } },
        ],
      },
      orderBy: { proposedAt: "desc" },
      take: 6,
    }),
    commandDb.deployment.findMany({
      where: { deployedAt: { gte, lte }, environment: "production" },
      orderBy: { deployedAt: "desc" },
      take: 5,
    }),
  ]);
  return { signals, experiments, deployments };
});

export default async function WhatChanged({
  windowStart,
  windowEnd,
  metric,
}: {
  windowStart: Date;
  windowEnd: Date;
  metric?: string;
}) {
  const { signals, experiments, deployments } = await fetchWindowContext(
    windowStart.getTime(),
    windowEnd.getTime()
  );

  const relExperiments = metric
    ? experiments.filter((e) => e.primaryMetric === metric)
    : experiments;

  const total = signals.length + relExperiments.length + deployments.length;
  if (total === 0) return null;

  const parts = [
    signals.length > 0 && `${signals.length} signal${signals.length !== 1 ? "s" : ""}`,
    relExperiments.length > 0 && `${relExperiments.length} exp`,
    deployments.length > 0 && `${deployments.length} deploy${deployments.length !== 1 ? "s" : ""}`,
  ].filter(Boolean).join(" · ");

  return (
    <details className="mt-2 group">
      <summary className="text-[11px] text-neutral-500 hover:text-neutral-400 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center gap-1">
        <span className="transition-transform group-open:rotate-90 inline-block text-[9px] leading-none">▶</span>
        {parts}
      </summary>
      <div className="mt-2 space-y-1.5 pt-1.5 border-t border-neutral-800/60">
        {signals.map((s) => {
          const payload = s.payload as Record<string, unknown>;
          const summary = typeof payload.summary === "string" ? payload.summary : null;
          return (
            <div key={s.id} className="flex items-start gap-1.5">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 uppercase ${SEVERITY_COLORS[s.severity] ?? "bg-neutral-800 text-neutral-400"}`}>
                {s.severity.slice(0, 4)}
              </span>
              <span className="text-[11px] text-neutral-400 leading-snug">
                {summary ?? s.detectorName.replace(/_/g, " ")}
              </span>
            </div>
          );
        })}
        {relExperiments.map((e) => (
          <div key={e.id} className="flex items-start gap-1.5">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${STATUS_COLORS[e.status] ?? "bg-neutral-800 text-neutral-400"}`}>
              EXP
            </span>
            <span className="text-[11px] text-neutral-400 leading-snug">{e.name}</span>
          </div>
        ))}
        {deployments.map((d) => (
          <div key={d.id} className="flex items-start gap-1.5">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 bg-violet-950 text-violet-400">
              DEP
            </span>
            <span className="text-[11px] text-neutral-400 leading-snug font-mono">{d.version}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
