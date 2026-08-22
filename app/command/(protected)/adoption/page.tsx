import { getPortalAdoption, type CommsStatus } from "@/lib/command/adoption";

// Command Centre → App adoption. Notifications + PWA install + engagement for
// every client on a live file, per person and as a share of the whole.

export const dynamic = "force-dynamic";

function pct(n: number, total: number) {
  if (total === 0) return "—";
  return Math.round((n / total) * 100) + "%";
}
function fmtWhen(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
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
          actually opening their portal.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Live clients" value={String(totalClients)} />
        <Stat label="Notifications on" value={pct(notificationsCount, totalClients)} sub={`${notificationsCount} of ${totalClients}`} />
        <Stat label="App installed" value={pct(installedCount, totalClients)} sub={`${installedCount} of ${totalClients}`} />
        <Stat label="Have visited" value={pct(visitedCount, totalClients)} sub={`${visitedCount} of ${totalClients}`} />
        <Stat label="Can't reach" value={String(cantReachCount)} sub="no email, opted out or bouncing" warn={cantReachCount > 0} />
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-neutral-600">
                <Th>Client</Th>
                <Th>Agency</Th>
                <Th>Side</Th>
                <Th>Comms</Th>
                <Th>Notifications</Th>
                <Th>Installed</Th>
                <Th>Last opened</Th>
                <Th>Last visit</Th>
                <Th>Engaged</Th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-[13px] text-neutral-500">No live-file clients yet.</td>
                </tr>
              ) : (
                clients.map((c, i) => (
                  <tr key={i}>
                    <Td className="text-neutral-200 font-medium">
                      {c.name}
                      <div className="text-[11px] text-neutral-500 font-normal">{c.address}</div>
                    </Td>
                    <Td className="text-neutral-400 text-[12px]">{c.agencyName}</Td>
                    <Td className="text-neutral-400 text-[12px]">{c.role}</Td>
                    <Td><CommsChip comms={c.comms} /></Td>
                    <Td><YesNo on={c.notifications} /></Td>
                    <Td><YesNo on={c.installed} /></Td>
                    <Td className="text-neutral-400 text-[12px]">{fmtWhen(c.lastOpened)}</Td>
                    <Td className="text-neutral-400 text-[12px]">{fmtWhen(c.lastVisited)}</Td>
                    <Td className="text-neutral-400 text-[12px] tabular-nums">{c.engagedMinutes > 0 ? `${c.engagedMinutes}m` : "—"}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 border-b border-neutral-800/70 text-[13px] ${className}`}>{children}</td>;
}
// Colour-coded comms status. Green = we can reach them; amber = a temporary or
// intentional pause; red = we can't reach them at all (no email / opted out /
// bouncing). Keeps the base row light: one chip carries the whole picture.
function CommsChip({ comms }: { comms: CommsStatus }) {
  const map: Record<CommsStatus["kind"], { label: string; cls: string }> = {
    reachable: { label: "Reachable", cls: "bg-[#14352a] text-[#6ee7b7] border-[#2c5a3f]" },
    no_email: { label: "No email", cls: "bg-[#3a1f1f] text-[#f8a4a4] border-[#5a2c2c]" },
    opted_out: { label: "Opted out", cls: "bg-[#3a1f1f] text-[#f8a4a4] border-[#5a2c2c]" },
    bouncing: { label: "Bouncing", cls: "bg-[#3a1f1f] text-[#f8a4a4] border-[#5a2c2c]" },
    agent_paused: { label: "Agent paused", cls: "bg-[#352c14] text-[#f6d17a] border-[#5a4f2c]" },
    client_paused: {
      label: comms.pausedUntil ? `Paused til ${fmtWhen(comms.pausedUntil)}` : "Paused",
      cls: "bg-[#352c14] text-[#f6d17a] border-[#5a4f2c]",
    },
  };
  const { label, cls } = map[comms.kind];
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>;
}
function YesNo({ on }: { on: boolean }) {
  return on ? (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-[#14352a] text-[#6ee7b7] border-[#2c5a3f]">On</span>
  ) : (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-neutral-800 text-neutral-600 border-neutral-700">—</span>
  );
}
