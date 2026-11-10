import type { TrialActions } from "@/lib/command/trial-cockpit";
import { Section, KpiCard, CardEmpty, fmtInt } from "@/components/command/ui/primitives";
import { LabelledBars } from "@/components/command/trials/charts";

// Trial cockpit → Actions tab. Are they WORKING the product, not just logging
// in: steps confirmed (and by whom), manual vs auto chasing, logged updates,
// to-dos, chains and enquiry loops — all trial-to-date. Command-only (Law 8).

const SPLIT_META: Array<{ key: keyof TrialActions["confirmSplit"]; label: string; cls: string }> = [
  { key: "agent", label: "Their team", cls: "bg-blue-600/70" },
  { key: "portal", label: "Clients via portal", cls: "bg-emerald-600/70" },
  { key: "solicitor", label: "Solicitors", cls: "bg-violet-600/70" },
  { key: "broker", label: "Brokers", cls: "bg-sky-600/70" },
  { key: "other", label: "Other", cls: "bg-neutral-600/70" },
];

const SPLIT_TEXT_CLS: Record<string, string> = {
  agent: "text-blue-300",
  portal: "text-emerald-400",
  solicitor: "text-violet-300",
  broker: "text-sky-300",
  other: "text-neutral-500",
};

export function ActionsTab({ actions }: { actions: TrialActions }) {
  const splitTotal = Object.values(actions.confirmSplit).reduce((s, v) => s + v, 0);
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Steps confirmed" value={fmtInt(actions.steps)} accent tip="Milestones confirmed on their files during the trial, by anyone. Mirrored and backfilled rows excluded." />
        <KpiCard label="Manual chases" value={fmtInt(actions.manualChases)} tip="Chase messages a person sent during the trial." />
        <KpiCard label="Auto chases" value={fmtInt(actions.autoChases)} tip="Chase messages the automation sent for them during the trial." />
        <KpiCard label="Updates logged" value={fmtInt(actions.updatesLogged)} tip="Notes and logged updates written by a person during the trial." />
        <KpiCard label="To-dos added" value={fmtInt(actions.todosAdded)} sub={`${fmtInt(actions.todosCompleted)} completed`} tip="Hand-made to-dos created during the trial, with how many were ticked off." />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Chains built" value={fmtInt(actions.chainsBuilt)} sub={`${fmtInt(actions.activeChains)} active now`} tip="Property chains created during the trial, and how many are live." />
        <KpiCard label="Open enquiry loops" value={fmtInt(actions.openEnquiries)} tip="Enquiry rounds currently open across their files." />
        <KpiCard label="Enquiries resolved" value={fmtInt(actions.enquiriesClosed)} sub="during the trial" tip="Enquiry loops closed since the trial start." />
        <KpiCard label="Chase automation share" value={actions.manualChases + actions.autoChases > 0 ? `${Math.round((actions.autoChases / (actions.manualChases + actions.autoChases)) * 100)}%` : "—"} tip="How much of the chasing the platform is doing for them. Higher = the product is carrying the load." />
      </div>

      <Section
        title="Who confirms steps"
        subtitle="Every step confirmed during the trial, by who did the confirming."
        tip="Client and solicitor confirms mean the platform is collecting progress without their staff lifting a finger — the strongest stickiness signal."
      >
        {splitTotal === 0 ? (
          <CardEmpty>No steps confirmed yet.</CardEmpty>
        ) : (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-4">
            <div className="h-3 w-full rounded-full bg-neutral-800 overflow-hidden flex">
              {SPLIT_META.map(({ key, cls }) => {
                const v = actions.confirmSplit[key];
                return v > 0 ? <div key={key} className={`h-full ${cls}`} style={{ width: `${(v / splitTotal) * 100}%` }} /> : null;
              })}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2.5 text-[11px] tabular-nums">
              {SPLIT_META.map(({ key, label }) => {
                const v = actions.confirmSplit[key];
                return v > 0 ? (
                  <span key={key} className={SPLIT_TEXT_CLS[key]}>
                    {label} · {fmtInt(v)} ({Math.round((v / splitTotal) * 100)}%)
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}
      </Section>

      <div className="grid md:grid-cols-2 gap-4">
        <Section title="Steps confirmed per week" tip="Week 1 is the first seven days of the trial.">
          {actions.weeklySteps.every((w) => w.value === 0) ? (
            <CardEmpty>No steps confirmed yet.</CardEmpty>
          ) : (
            <LabelledBars items={actions.weeklySteps} fmt={fmtInt} />
          )}
        </Section>
        <Section title="Manual chases per week" tip="Human-sent chases only — the automation's sends are in the KPI above.">
          {actions.weeklyManualChases.every((w) => w.value === 0) ? (
            <CardEmpty>No manual chases yet.</CardEmpty>
          ) : (
            <LabelledBars items={actions.weeklyManualChases} fmt={fmtInt} />
          )}
        </Section>
      </div>

      <Section title="Open to-dos by person" tip="Who is carrying the open to-do load right now.">
        {actions.openTodos.length === 0 ? (
          <CardEmpty>No open to-dos.</CardEmpty>
        ) : (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 divide-y divide-neutral-800/70 max-w-xl">
            {actions.openTodos.map((t) => (
              <div key={t.name} className="flex items-center justify-between py-2">
                <span className="text-sm text-neutral-200">{t.name}</span>
                <span className="text-sm font-semibold text-neutral-300 tabular-nums">{fmtInt(t.count)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
