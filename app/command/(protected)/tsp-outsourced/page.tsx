import Link from "next/link";
import { getTspOutsourcedHub } from "@/lib/command/tsp-outsourced";
import { formatGBP } from "@/lib/command/revenue";
import InfoTip from "@/components/command/shared/InfoTip";
import AutoRefresh from "@/components/command/shared/AutoRefresh";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London",
  });
}

function modeBadge(modeProfile: string): { label: string; cls: string } {
  if (modeProfile === "progressor_managed") return { label: "fully outsourced", cls: "bg-violet-950 text-violet-300 border border-violet-900" };
  if (modeProfile === "mixed") return { label: "mixed", cls: "bg-neutral-800 text-neutral-300" };
  return { label: modeProfile, cls: "bg-neutral-800 text-neutral-400" };
}

function Tile({ value, label, tone }: { value: string | number; label: string; tone?: "amber" | "red" | "emerald" }) {
  const color =
    tone === "amber" ? (Number(value) > 0 ? "text-amber-400" : "text-neutral-100")
    : tone === "red" ? (Number(value) > 0 ? "text-red-400" : "text-neutral-100")
    : tone === "emerald" ? "text-emerald-400"
    : "text-neutral-100";
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-4">
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{typeof value === "number" ? value.toLocaleString() : value}</p>
      <p className="text-[11px] text-neutral-500 mt-0.5">{label}</p>
    </div>
  );
}

export default async function TspOutsourcedPage() {
  const hub = await getTspOutsourcedHub();
  const { counts, revenue, book, bookTotal, supplying, progressors } = hub;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">TSP Outsourced</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Sales our own team progresses on behalf of agencies. This is the only place our outsourced book lives.
          </p>
        </div>
        <AutoRefresh intervalMs={60000} />
      </div>

      {/* Summary */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          The book now
          <InfoTip label="What counts as our outsourced book">
            Live files an agency has handed to our team to run (outsourced), excluding
            files owned by external progression businesses, plus demo, migrated and
            internal files. Figures are live, not from the nightly rollup.
          </InfoTip>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Tile value={counts.active} label="live files" />
          <Tile value={counts.overdue} label="past expected exchange" tone="amber" />
          <Tile value={counts.unassigned} label="unassigned" tone="red" />
          <Tile value={counts.exchangedNotCompleted} label="exchanged, completing" />
          <Tile value={counts.completed} label="completed to date" tone="emerald" />
          <Tile value={counts.supplyingAgencies} label="supplying agencies" />
        </div>
      </section>

      {/* Revenue */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          Fees
          <InfoTip label="Pipeline vs banked">
            Pipeline is an estimate — what we&rsquo;d charge if every live file exchanged
            at today&rsquo;s sale price, using the current fee model. Banked is the sum of
            outsourced fees already invoiced on our files (frozen amounts).
          </InfoTip>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
            <p className="text-2xl font-bold tabular-nums text-neutral-100">{formatGBP(revenue.pipelinePence)}</p>
            <p className="text-[11px] text-neutral-500 mt-0.5">pipeline (estimated, {counts.active} live files)</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
            <p className="text-2xl font-bold tabular-nums text-emerald-400">{formatGBP(revenue.bankedPence)}</p>
            <p className="text-[11px] text-neutral-500 mt-0.5">banked (outsourced fees invoiced to date)</p>
          </div>
        </div>
      </section>

      {/* Supplying agencies + progressor workload */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section>
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
            Supplying agencies
          </h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            {supplying.length === 0 ? (
              <p className="px-5 py-6 text-sm text-neutral-600">No agencies are feeding our team right now.</p>
            ) : (
              <div className="divide-y divide-neutral-800 max-h-80 overflow-y-auto">
                {supplying.map((a) => {
                  const b = modeBadge(a.modeProfile);
                  return (
                    <Link
                      key={a.id}
                      href={`/command/agency/${a.id}`}
                      className="flex items-center gap-3 px-5 py-2.5 text-xs hover:bg-neutral-800/40 transition-colors"
                    >
                      <span className="flex-1 min-w-0 truncate text-neutral-200 font-medium">{a.name}</span>
                      <span className={`shrink-0 text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 ${b.cls}`}>{b.label}</span>
                      <span className="shrink-0 tabular-nums text-neutral-300 font-bold">{a.count}</span>
                      <span className="shrink-0 text-neutral-600">→</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
            Progressor workload
          </h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            {progressors.length === 0 ? (
              <p className="px-5 py-6 text-sm text-neutral-600">No live files to carry.</p>
            ) : (
              <div className="divide-y divide-neutral-800 max-h-80 overflow-y-auto">
                {progressors.map((p) => (
                  <div
                    key={p.id ?? "__unassigned__"}
                    className="flex items-center gap-3 px-5 py-2.5 text-xs"
                  >
                    <span className={`flex-1 min-w-0 truncate font-medium ${p.id === null ? "text-amber-400" : "text-neutral-200"}`}>
                      {p.name}
                    </span>
                    <span className={`shrink-0 tabular-nums font-bold ${p.id === null ? "text-amber-400" : "text-neutral-300"}`}>{p.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* The book */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          Live files — longest outstanding first
          <InfoTip label="The live book">
            Every live outsourced file our team is running, oldest first by when it
            became outsourced. Silent means days since the last confirmed milestone.
            Open any file in the Command Centre file view.
          </InfoTip>
        </h2>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          {book.length === 0 ? (
            <p className="px-5 py-8 text-sm text-neutral-600">No live outsourced files.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-neutral-500 border-b border-neutral-800">
                    <th className="font-medium px-5 py-2.5">Property</th>
                    <th className="font-medium px-3 py-2.5">Agency</th>
                    <th className="font-medium px-3 py-2.5">Progressor</th>
                    <th className="font-medium px-3 py-2.5 text-right tabular-nums">Outsourced</th>
                    <th className="font-medium px-3 py-2.5">Expected exchange</th>
                    <th className="font-medium px-5 py-2.5 text-right tabular-nums">Silent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {book.map((f) => (
                    <tr key={f.id} className="hover:bg-neutral-800/40 transition-colors">
                      <td className="px-5 py-2.5">
                        <Link href={`/command/files?tx=${f.id}`} className="text-neutral-200 font-medium hover:text-white">
                          {f.address}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-neutral-400 max-w-[12rem] truncate">{f.agencyName ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        {f.progressorName
                          ? <span className="text-neutral-400">{f.progressorName}</span>
                          : <span className="text-amber-400">unassigned</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-neutral-400">{f.daysOutsourced}d</td>
                      <td className="px-3 py-2.5">
                        <span className={f.overdue ? "text-amber-400" : "text-neutral-400"}>
                          {fmtDate(f.expectedExchangeDate)}{f.overdue ? " · overdue" : ""}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        <span className={f.daysSilent >= 14 ? "text-amber-400" : "text-neutral-500"}>
                          {f.lastMilestoneAt ? `${f.daysSilent}d` : `${f.daysSilent}d, none`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bookTotal > book.length && (
                <p className="px-5 py-2.5 text-[11px] text-neutral-600 border-t border-neutral-800">
                  Showing the {book.length} longest-outstanding. {bookTotal - book.length} more not shown.
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
