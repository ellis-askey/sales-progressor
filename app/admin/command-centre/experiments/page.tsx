import { prisma } from "@/lib/prisma";
import { ExperimentActions } from "@/components/admin/command-centre/ExperimentActions";
import type { ExperimentStatus, ExperimentOutcome } from "@prisma/client";

const STATUS_BADGE: Record<ExperimentStatus, string> = {
  proposed:   "bg-white/10 text-white/60",
  active:     "bg-emerald-500/20 text-emerald-300",
  concluded:  "bg-blue-500/20 text-blue-300",
  abandoned:  "bg-white/8 text-white/30",
};

const OUTCOME_BADGE: Record<ExperimentOutcome, string> = {
  win:          "bg-emerald-500/20 text-emerald-300",
  loss:         "bg-red-500/20 text-red-300",
  inconclusive: "bg-amber-500/20 text-amber-300",
  mixed:        "bg-blue-500/20 text-blue-300",
};

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function MetricSnapshot({ data }: { data: unknown }) {
  if (!data || typeof data !== "object") return null;
  const snap = data as { metrics?: Record<string, unknown>; capturedAt?: string };
  if (!snap.metrics) return null;
  const entries = Object.entries(snap.metrics).filter(([k]) => k !== "windowDays");
  return (
    <dl className="grid grid-cols-3 gap-x-4 gap-y-0.5 mt-1">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-baseline gap-1">
          <dt className="text-[10px] text-white/30 shrink-0">{k}</dt>
          <dd className="text-[10px] text-white/60">{String(Math.round(Number(v) * 10) / 10)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function ExperimentsPage() {
  const experiments = await prisma.experiment.findMany({
    orderBy: [{ status: "asc" }, { proposedAt: "desc" }],
  });

  const groups: Array<{ label: string; statuses: ExperimentStatus[]; items: typeof experiments }> = [
    { label: "Active",    statuses: ["active"],              items: [] },
    { label: "Proposed",  statuses: ["proposed"],            items: [] },
    { label: "Concluded", statuses: ["concluded", "abandoned"], items: [] },
  ];

  for (const exp of experiments) {
    const group = groups.find((g) => g.statuses.includes(exp.status));
    if (group) group.items.push(exp);
  }

  return (
    <div className="space-y-8">
      {groups.filter((g) => g.items.length > 0).map((group) => (
        <section key={group.label}>
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-4">
            {group.label} · {group.items.length}
          </h2>
          <div className="space-y-3">
            {group.items.map((exp) => (
              <div key={exp.id} className="glass-card rounded-2xl px-5 py-4 space-y-2">
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
                      <h3 className="text-sm font-semibold text-white/90">{exp.name}</h3>
                    </div>
                    <p className="text-xs text-white/50 mt-1">{exp.hypothesis}</p>
                  </div>
                  <ExperimentActions experimentId={exp.id} status={exp.status} />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-xs text-white/50">
                  <div><span className="text-white/30">Primary metric </span>{exp.primaryMetric}</div>
                  {exp.guardrailMetrics.length > 0 && (
                    <div><span className="text-white/30">Guardrails </span>{exp.guardrailMetrics.join(", ")}</div>
                  )}
                  <div><span className="text-white/30">Proposed </span>{fmtDate(exp.proposedAt)}</div>
                  {exp.startedAt && <div><span className="text-white/30">Started </span>{fmtDate(exp.startedAt)}</div>}
                  {exp.concludedAt && <div><span className="text-white/30">Concluded </span>{fmtDate(exp.concludedAt)}</div>}
                  <div><span className="text-white/30">Windows </span>{exp.baselineWindowDays}d / {exp.resultWindowDays}d</div>
                </div>

                {exp.conclusionNote && (
                  <p className="text-xs text-white/40 italic">{exp.conclusionNote}</p>
                )}

                {(exp.baselineSnapshot || exp.resultSnapshot) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 border-t border-white/8">
                    {exp.baselineSnapshot && (
                      <div>
                        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wide mb-0.5">Baseline snapshot</p>
                        <MetricSnapshot data={exp.baselineSnapshot} />
                      </div>
                    )}
                    {exp.resultSnapshot && (
                      <div>
                        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wide mb-0.5">Result snapshot</p>
                        <MetricSnapshot data={exp.resultSnapshot} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {experiments.length === 0 && (
        <p className="text-sm text-white/30">No experiments yet. Create one via the API to track a hypothesis.</p>
      )}
    </div>
  );
}
