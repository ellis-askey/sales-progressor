import { getPortalAdoption } from "@/lib/command/adoption";
import { AdoptionTable } from "@/components/command/AdoptionTable";

// Command Centre → App adoption. Notifications + PWA install + engagement for
// every client on a live file, per person and as a share of the whole. The
// table itself (with expandable per-client detail) lives in AdoptionTable.

export const dynamic = "force-dynamic";

function pct(n: number, total: number) {
  if (total === 0) return "—";
  return Math.round((n / total) * 100) + "%";
}

export default async function AdoptionPage() {
  const { totalClients, notificationsCount, installedCount, visitedCount, cantReachCount, clients } =
    await getPortalAdoption();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">App adoption</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Which clients on live files have turned on notifications, added the app to their home screen, and are
          actually opening their portal. Open a row for the full picture on that client.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Live clients" value={String(totalClients)} />
        <Stat label="Notifications on" value={pct(notificationsCount, totalClients)} sub={`${notificationsCount} of ${totalClients}`} />
        <Stat label="App installed" value={pct(installedCount, totalClients)} sub={`${installedCount} of ${totalClients}`} />
        <Stat label="Have visited" value={pct(visitedCount, totalClients)} sub={`${visitedCount} of ${totalClients}`} />
        <Stat label="Can't reach" value={String(cantReachCount)} sub="no email, opted out or bouncing" warn={cantReachCount > 0} />
      </div>

      <AdoptionTable clients={clients} />

      <p className="text-[12px] text-neutral-600 leading-relaxed">
        Installed is recorded when a client opens the portal from their home screen, or on the browser install event.
        iOS fires no install event, so a home-screen open is how we know there.
      </p>
    </div>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`bg-neutral-900 border rounded-xl px-4 py-3 ${warn ? "border-[#5a3f2c]" : "border-neutral-800"}`}>
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${warn ? "text-[#f6b17a]" : "text-neutral-100"}`}>{value}</p>
      {sub && <p className="text-[11px] text-neutral-600 mt-0.5">{sub}</p>}
    </div>
  );
}
