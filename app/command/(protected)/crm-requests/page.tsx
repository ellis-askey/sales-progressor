// /command/crm-requests — CRM connection demand (critique #289). Superadmin
// (gated by the (protected) layout). Shows the ranked league table so we build
// the most-wanted CRM first, plus the recent feed so we can follow up the
// agencies that asked. Reads via commandDb (lib/command/crm-requests.ts).

import { ArrowLeftRight, TrendingUp } from "lucide-react";
import { getCrmDemand } from "@/lib/command/crm-requests";
import { isOtherKey } from "@/lib/crm/catalogue";

export const dynamic = "force-dynamic";

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="text-2xl font-semibold text-neutral-100 mt-1 truncate">{value}</p>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-neutral-800 px-4 py-8 text-center text-sm text-neutral-500">{children}</div>;
}

export default async function CrmRequestsPage() {
  const { demand, recent, total } = await getCrmDemand();

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-3">
        <ArrowLeftRight className="w-6 h-6 text-neutral-300" />
        <div>
          <h1 className="text-xl font-semibold text-neutral-100">CRM requests</h1>
          <p className="text-sm text-neutral-400">Which CRMs agencies want connected. Build the most-requested first.</p>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Total requests" value={total} />
        <Kpi label="CRMs wanted" value={demand.length} />
        <Kpi label="Most wanted" value={demand[0]?.crmName ?? "None yet"} />
      </div>

      <section>
        <h2 className="text-sm font-semibold text-neutral-300 mb-3">Demand</h2>
        {demand.length === 0 ? (
          <Empty>No requests yet. They&rsquo;ll appear here as agencies ask.</Empty>
        ) : (
          <div className="rounded-xl border border-neutral-800 overflow-hidden">
            {demand.map((d, i) => (
              <div key={d.crmKey} className="flex items-center gap-4 px-4 py-3 border-b border-neutral-800 last:border-0 bg-neutral-900/40">
                <span className="w-6 text-neutral-500 tabular-nums text-sm">{i + 1}</span>
                <span className="flex-1 text-neutral-100 font-medium truncate">
                  {d.crmName}
                  {isOtherKey(d.crmKey) && <span className="ml-2 text-[11px] text-neutral-500">(not listed)</span>}
                </span>
                {d.newThisWeek > 0 && (
                  <span className="text-[11px] text-emerald-400 inline-flex items-center gap-1 flex-shrink-0"><TrendingUp className="w-3 h-3" />+{d.newThisWeek} this week</span>
                )}
                <span className="text-neutral-300 tabular-nums w-28 text-right flex-shrink-0">{d.total} {d.total === 1 ? "agency" : "agencies"}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-300 mb-3">Recent requests</h2>
        {recent.length === 0 ? (
          <Empty>Nothing yet.</Empty>
        ) : (
          <div className="rounded-xl border border-neutral-800 overflow-hidden">
            {recent.map((r) => (
              <div key={r.id} className="flex items-center gap-4 px-4 py-3 border-b border-neutral-800 last:border-0 bg-neutral-900/40 text-sm">
                <span className="flex-1 text-neutral-200 truncate">
                  <b className="font-medium text-neutral-100">{r.agencyName ?? "An agency"}</b> wants <b className="font-medium text-neutral-100">{r.crmName}</b>
                </span>
                {r.requestedByName && <span className="text-neutral-500 truncate flex-shrink-0 hidden sm:inline">{r.requestedByName}</span>}
                <span className="text-neutral-500 w-28 text-right flex-shrink-0">{fmtDate(r.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
