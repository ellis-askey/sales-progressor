import { commandDb } from "@/lib/command/prisma";
import { ExperimentActions } from "@/components/command/ExperimentActions";
import { ExperimentSuggestions } from "@/components/command/ExperimentSuggestions";
import { NewExperimentForm } from "@/components/command/NewExperimentForm";
import { ProposedHypothesisEditor } from "@/components/command/ProposedHypothesisEditor";
import { getExperimentSuggestions } from "@/lib/command/experiment-suggestions";
import { METRIC_DEFS, metricLabel } from "@/lib/command/experiment-metric-defs";
import InfoTip from "@/components/command/shared/InfoTip";
import type { ExperimentStatus, ExperimentOutcome } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<ExperimentStatus, string> = {
  proposed:   "bg-neutral-800 text-neutral-400",
  active:     "bg-emerald-950 text-emerald-400 border border-emerald-900",
  concluded:  "bg-blue-950 text-blue-400 border border-blue-900",
  abandoned:  "bg-neutral-800 text-neutral-500",
};

const OUTCOME_BADGE: Record<ExperimentOutcome, string> = {
  win:          "bg-emerald-950 text-emerald-400 border border-emerald-900",
  loss:         "bg-red-950 text-red-400 border border-red-900",
  inconclusive: "bg-amber-950 text-amber-400 border border-amber-900",
  mixed:        "bg-blue-950 text-blue-400 border border-blue-900",
};

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Read the primary-metric before/after out of the frozen snapshots, in plain
// English. Returns null when we don't have both snapshots yet.
function readResult(exp: { primaryMetric: string; baselineSnapshot: unknown; resultSnapshot: unknown }) {
  const base = (exp.baselineSnapshot as { metrics?: Record<string, number> } | null)?.metrics?.[exp.primaryMetric];
  const res = (exp.resultSnapshot as { metrics?: Record<string, number> } | null)?.metrics?.[exp.primaryMetric];
  if (base == null || res == null) return null;
  const higherIsBetter = (METRIC_DEFS as Record<string, { higherIsBetter: boolean }>)[exp.primaryMetric]?.higherIsBetter ?? true;
  const deltaPct = base === 0 ? (res > 0 ? 100 : 0) : Math.round(((res - base) / base) * 100);
  const moved = res - base;
  const good = moved === 0 ? null : higherIsBetter ? moved > 0 : moved < 0;
  return { label: metricLabel(exp.primaryMetric), base, res, deltaPct, good };
}

function MetricSnapshot({ data }: { data: unknown }) {
  if (!data || typeof data !== "object") return null;
  const snap = data as { metrics?: Record<string, unknown> };
  if (!snap.metrics) return null;
  const entries = Object.entries(snap.metrics).filter(([k]) => k !== "windowDays");
  return (
    <dl className="grid grid-cols-3 gap-x-4 gap-y-0.5 mt-1">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-baseline gap-1">
          <dt className="text-[10px] text-neutral-600 shrink-0">{metricLabel(k)}</dt>
          <dd className="text-[10px] text-neutral-400">{String(Math.round(Number(v) * 10) / 10)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function ExperimentsPage() {
  const [experiments, suggestions] = await Promise.all([
    commandDb.experiment.findMany({ orderBy: [{ status: "asc" }, { proposedAt: "desc" }] }),
    getExperimentSuggestions(),
  ]);

  const groups: Array<{ label: string; statuses: ExperimentStatus[]; items: typeof experiments }> = [
    { label: "Active",    statuses: ["active"],                 items: [] },
    { label: "Proposed",  statuses: ["proposed"],               items: [] },
    { label: "Concluded", statuses: ["concluded", "abandoned"], items: [] },
  ];
  for (const exp of experiments) {
    const group = groups.find((g) => g.statuses.includes(exp.status));
    if (group) group.items.push(exp);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">Growth tests</h1>
        <p className="text-sm text-neutral-400 mt-1">Ideas for what to test next, grounded in your own data, and the tests you have running.</p>
      </div>

      {/* Primer */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl px-5 py-3">
        <p className="text-[11px] text-neutral-500 leading-relaxed">
          <span className="text-neutral-300 font-medium">How a test works. </span>
          Propose an idea, then <span className="text-neutral-300">Start</span> it to freeze a before-picture of the numbers. Let the change run, then <span className="text-neutral-300">Conclude</span> it to freeze an after-picture and compare. It measures the whole platform before vs after, so read a result as a strong signal, not lab-grade proof.
        </p>
      </div>

      {/* Ideas */}
      <ExperimentSuggestions initial={suggestions} />

      {/* Manual */}
      <div>
        <NewExperimentForm />
      </div>

      {experiments.length === 0 && (
        <p className="text-sm text-neutral-600">No tests yet. Propose one from an idea above, or add your own.</p>
      )}

      {groups.filter((g) => g.items.length > 0).map((group) => (
        <section key={group.label}>
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
            {group.label} · {group.items.length}
          </h2>
          <div className="space-y-3">
            {group.items.map((exp) => {
              const result = exp.status === "concluded" ? readResult(exp) : null;
              return (
                <div key={exp.id} className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[exp.status]}`}>
                          {exp.status}
                        </span>
                        {exp.outcome && (
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${OUTCOME_BADGE[exp.outcome]}`}>
                            {exp.outcome}
                          </span>
                        )}
                        <h3 className="text-sm font-semibold text-neutral-100">{exp.name}</h3>
                      </div>
                      {exp.status === "proposed" ? (
                        <ProposedHypothesisEditor experimentId={exp.id} hypothesis={exp.hypothesis} />
                      ) : (
                        <p className="text-xs text-neutral-400 mt-1">{exp.hypothesis}</p>
                      )}
                    </div>
                    <ExperimentActions experimentId={exp.id} status={exp.status} />
                  </div>

                  {/* Plain-English result readout */}
                  {result && (
                    <div className="flex items-center gap-2 text-xs bg-neutral-950/50 border border-neutral-800 rounded-lg px-3 py-2">
                      <span className="text-neutral-500">{result.label}</span>
                      <span className="text-neutral-300 tabular-nums">{result.base} → {result.res}</span>
                      <span className={`tabular-nums font-medium ${result.good == null ? "text-neutral-500" : result.good ? "text-emerald-400" : "text-red-400"}`}>
                        {result.deltaPct >= 0 ? `+${result.deltaPct}` : result.deltaPct}%
                      </span>
                      <span className="text-neutral-600">before vs after</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-xs text-neutral-400">
                    <div><span className="text-neutral-600">Watching </span>{metricLabel(exp.primaryMetric)}</div>
                    {exp.guardrailMetrics.length > 0 && (
                      <div><span className="text-neutral-600">Guardrails </span>{exp.guardrailMetrics.map(metricLabel).join(", ")}</div>
                    )}
                    <div><span className="text-neutral-600">Proposed </span>{fmtDate(exp.proposedAt)}</div>
                    {exp.startedAt && <div><span className="text-neutral-600">Started </span>{fmtDate(exp.startedAt)}</div>}
                    {exp.concludedAt && <div><span className="text-neutral-600">Concluded </span>{fmtDate(exp.concludedAt)}</div>}
                    <div><span className="text-neutral-600">Windows </span>{exp.baselineWindowDays}d / {exp.resultWindowDays}d<span className="ml-1"><InfoTip label="Windows">The before-picture covers this many days up to Start; the after-picture covers this many days up to Conclude.</InfoTip></span></div>
                  </div>

                  {exp.conclusionNote && (
                    <p className="text-xs text-neutral-500 italic">{exp.conclusionNote}</p>
                  )}

                  {(exp.baselineSnapshot || exp.resultSnapshot) && (
                    <details className="pt-1 border-t border-neutral-800">
                      <summary className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider cursor-pointer hover:text-neutral-400">All metrics before/after</summary>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        {exp.baselineSnapshot && (
                          <div>
                            <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-0.5">Before</p>
                            <MetricSnapshot data={exp.baselineSnapshot} />
                          </div>
                        )}
                        {exp.resultSnapshot && (
                          <div>
                            <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider mb-0.5">After</p>
                            <MetricSnapshot data={exp.resultSnapshot} />
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
