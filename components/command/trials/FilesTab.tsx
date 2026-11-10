import Link from "next/link";
import type { TrialFiles } from "@/lib/command/trial-cockpit";
import { Section, KpiCard, TableShell, Tr, Td, CardEmpty, fmtInt } from "@/components/command/ui/primitives";
import { fmtRelative } from "@/lib/command/format";
import { LabelledBars } from "@/components/command/trials/charts";

// Trial cockpit → Files tab. Their book: the migrated base, new instructions
// week by week, live pipeline by stage and service, exchanges/completions in
// the trial, and every live file with progress + chase health. Reuses the
// Agency File's getAgencySales rows (Law 4). Command-only (Law 8).

function StagePill({ stage }: { stage: string }) {
  const cls =
    stage === "Onboarding" ? "text-sky-300 border-sky-900/60 bg-sky-950/30"
    : stage === "Conveyancing" ? "text-blue-300 border-blue-900/60 bg-blue-950/30"
    : stage === "Pre-exchange" ? "text-violet-300 border-violet-900/60 bg-violet-950/30"
    : "text-emerald-300 border-emerald-900/60 bg-emerald-950/30";
  return <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{stage}</span>;
}

export function FilesTab({ files }: { files: TrialFiles }) {
  const live = files.sales.length;
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiCard label="Live files" value={fmtInt(live)} accent tip="Active and on-hold files right now." />
        <KpiCard label="New instructions" value={fmtInt(files.newSinceTrial)} sub="since trial start" tip="Files created since the trial began. Migrated and demo files excluded." />
        <KpiCard label="Exchanged" value={fmtInt(files.exchangedTrial)} sub="during the trial" tip="Contracts-exchanged events since the trial start." />
        <KpiCard label="Completed" value={fmtInt(files.completedTrial)} sub="during the trial" tip="Sale-completed events since the trial start." />
        <KpiCard label="Withdrawn" value={fmtInt(files.withdrawnTrial)} sub="during the trial" tip="Files withdrawn since the trial start." />
        <KpiCard label="Migrated book" value={fmtInt(files.migrated)} tip="The imported book they arrived with. Never counted as adoption." />
      </div>

      <Section
        title="New instructions, week by week"
        subtitle="Week 1 is the first seven days of the trial."
        tip="The single best adoption signal: are they putting NEW business through the platform?"
      >
        {files.weeklyNew.every((w) => w.value === 0) ? (
          <CardEmpty>No new instructions yet. The migrated book does not count here.</CardEmpty>
        ) : (
          <LabelledBars items={files.weeklyNew} fmt={fmtInt} />
        )}
      </Section>

      <div className="grid md:grid-cols-2 gap-4">
        <Section title="Live pipeline by stage" tip="Every live file placed in its conveyancing stage.">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-4 space-y-2.5">
            {files.stageCounts.map((s) => {
              const max = Math.max(1, ...files.stageCounts.map((x) => x.count));
              return (
                <div key={s.stage} className="flex items-center gap-3">
                  <div className="w-28 shrink-0"><StagePill stage={s.stage} /></div>
                  <div className="flex-1 h-5 rounded bg-neutral-800/60 overflow-hidden">
                    <div className="h-full bg-blue-600/50 border-r border-blue-500/60" style={{ width: `${Math.round((s.count / max) * 100)}%`, minWidth: s.count > 0 ? "2px" : "0" }} />
                  </div>
                  <div className="w-10 shrink-0 text-right text-sm font-semibold text-neutral-200 tabular-nums">{fmtInt(s.count)}</div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="Who runs them" tip="Self-managed files are progressed by their own team (incl. their in-house progressors); outsourced files are progressed for them.">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-4">
            {live === 0 ? (
              <p className="text-sm text-neutral-600">No live files.</p>
            ) : (
              <>
                <div className="h-3 w-full rounded-full bg-neutral-800 overflow-hidden flex">
                  <div className="h-full bg-blue-600/70" style={{ width: `${Math.round((files.selfManagedLive / live) * 100)}%` }} />
                  <div className="h-full bg-violet-600/70" style={{ width: `${Math.round((files.outsourcedLive / live) * 100)}%` }} />
                </div>
                <div className="flex justify-between mt-2.5 text-[11px] tabular-nums">
                  <span className="text-blue-300">Self-managed · {fmtInt(files.selfManagedLive)}</span>
                  <span className="text-violet-300">Outsourced · {fmtInt(files.outsourcedLive)}</span>
                </div>
              </>
            )}
          </div>
        </Section>
      </div>

      <Section
        title={`Every live file · ${live}`}
        subtitle="Most recently worked first."
        tip="Progress is steps done out of the steps that currently count. Chases shows pending, with escalated and overdue called out. Idle is days since real work."
      >
        {live === 0 ? (
          <CardEmpty>No live files.</CardEmpty>
        ) : (
          <TableShell head={["File", "Stage", "Progress", "Service", "Chases", "Idle", "Last worked"]}>
            {files.sales.map((s) => (
              <Tr key={s.transactionId}>
                <Td first>
                  <Link href={`/command/files?tx=${s.transactionId}`} className="hover:text-blue-300 transition-colors">
                    {s.propertyAddress}
                    {s.onHold && <span className="ml-1.5 text-[10px] text-amber-400 uppercase">on hold</span>}
                  </Link>
                </Td>
                <Td><StagePill stage={s.stage} /></Td>
                <Td>
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block w-16 h-1.5 rounded-full bg-neutral-800 overflow-hidden align-middle">
                      <span className="block h-full rounded-full bg-blue-600" style={{ width: `${s.percent}%` }} />
                    </span>
                    <span className="text-[11px] text-neutral-400">{s.stepsDone}/{s.stepsLive}</span>
                  </span>
                </Td>
                <Td muted>{s.serviceType === "self_managed" ? "Self" : s.serviceType === "outsourced" ? "Outsourced" : "—"}</Td>
                <Td>
                  {s.pendingChases === 0 ? (
                    <span className="text-neutral-700">0</span>
                  ) : (
                    <span>
                      {fmtInt(s.pendingChases)}
                      {s.escalatedChases > 0 && <span className="text-red-400 text-[11px]"> · {s.escalatedChases} esc</span>}
                      {s.overdueChases > 0 && <span className="text-amber-400 text-[11px]"> · {s.overdueChases} over</span>}
                    </span>
                  )}
                </Td>
                <Td>{s.idleDays != null && s.idleDays >= 14 ? <span className="text-amber-400">{s.idleDays}d</span> : s.idleDays != null && s.idleDays > 0 ? <span className="text-neutral-500">{s.idleDays}d</span> : <span className="text-neutral-700">—</span>}</Td>
                <Td muted>{s.lastActivityAt ? fmtRelative(s.lastActivityAt) : "never"}</Td>
              </Tr>
            ))}
          </TableShell>
        )}
      </Section>
    </div>
  );
}
