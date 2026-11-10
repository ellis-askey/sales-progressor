import Link from "next/link";
import type { TrialClients } from "@/lib/command/trial-cockpit";
import { Section, KpiCard, FunnelBars, TableShell, Tr, Td, CardEmpty, fmtInt, fmtPct } from "@/components/command/ui/primitives";
import { fmtRelative } from "@/lib/command/format";

// Trial cockpit → Clients tab. What Boardwalk's customers experience: the
// portal funnel (invited → visited → engaged), buyer/seller split, app
// installs and notifications, visits and messages during the trial, their
// most engaged clients, and client-email deliverability. Reuses the Agency
// File's email summary (Law 4). Command-only (Law 8).

export function ClientsTab({ clients, agencyId }: { clients: TrialClients; agencyId: string }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiCard label="Clients on live files" value={fmtInt(clients.totalClients)} accent tip="Buyers and sellers across their live files." />
        <KpiCard label="Portal access" value={fmtInt(clients.funnel.invited)} tip="Clients with a portal link." />
        <KpiCard label="Visited" value={fmtInt(clients.funnel.visited)} tip="Opened their portal at least once." />
        <KpiCard label="Engaged" value={fmtInt(clients.funnel.engaged)} tip="Came back on 2+ days or spent 5+ real minutes." />
        <KpiCard label="Installed the app" value={fmtInt(clients.installed)} tip="Added the portal to their home screen." />
        <KpiCard label="Notifications on" value={fmtInt(clients.notifications)} tip="Clients receiving push notifications." />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Section title="Portal funnel" tip="Each stage is a strict subset of the one above, so the fall between bars is genuine drop-off.">
          {clients.funnel.invited === 0 ? (
            <CardEmpty>No clients have portal access yet.</CardEmpty>
          ) : (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-4">
              <FunnelBars
                stages={[
                  { label: "Invited", value: clients.funnel.invited },
                  { label: "Visited", value: clients.funnel.visited },
                  { label: "Engaged", value: clients.funnel.engaged },
                ]}
              />
            </div>
          )}
        </Section>

        <Section title="Buyers vs sellers" tip="The same funnel split by side of the sale.">
          <TableShell head={["Side", "Invited", "Visited", "Engaged", "Engage rate"]}>
            {([
              ["Buyers", clients.bySide.buyer],
              ["Sellers", clients.bySide.seller],
            ] as const).map(([label, f]) => (
              <Tr key={label}>
                <Td first>{label}</Td>
                <Td>{fmtInt(f.invited)}</Td>
                <Td>{fmtInt(f.visited)}</Td>
                <Td>{fmtInt(f.engaged)}</Td>
                <Td muted>{f.invited > 0 ? fmtPct((f.engaged / f.invited) * 100) : "—"}</Td>
              </Tr>
            ))}
          </TableShell>
        </Section>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Portal visits" value={fmtInt(clients.visitsTrial)} sub="during the trial" tip="Client visit-days since the trial start (one per client per day)." />
        <KpiCard label="Messages from clients" value={fmtInt(clients.messagesTrial)} sub="during the trial" tip="Portal messages clients sent since the trial start." />
        <KpiCard label="Emails opened" value={fmtPct(clients.email.openRatePct)} sub={`${fmtInt(clients.email.opened)} of ${fmtInt(clients.email.totalSent)} sent`} tip="Open rate across all client emails on their files (of sent, all time)." />
        <KpiCard label="Bounced or failed" value={fmtInt(clients.email.bouncedFailed)} sub={`${fmtInt(clients.email.delivered)} delivered · ${fmtInt(clients.email.clicked)} clicked`} tip="Client emails that never arrived. The full log lives on the Agency File." />
      </div>
      <p className="text-[11px] text-neutral-600 -mt-4">
        Full client-email log and reachability detail:{" "}
        <Link href={`/command/agency/${agencyId}`} className="text-blue-400 hover:text-blue-300 transition-colors">Agency File →</Link>
      </p>

      <Section title="Most engaged clients" tip="Ranked by visit-days, then real minutes in the portal.">
        {clients.topClients.length === 0 ? (
          <CardEmpty>No client has opened a portal yet.</CardEmpty>
        ) : (
          <TableShell head={["Client", "Side", "File", "Visit-days", "Minutes", "Last visit"]}>
            {clients.topClients.map((c) => (
              <Tr key={c.id}>
                <Td first>{c.name}</Td>
                <Td muted>{c.role}</Td>
                <Td muted>{c.address}</Td>
                <Td>{fmtInt(c.visits)}</Td>
                <Td>{fmtInt(c.minutes)}</Td>
                <Td muted>{c.lastVisited ? fmtRelative(c.lastVisited) : "—"}</Td>
              </Tr>
            ))}
          </TableShell>
        )}
      </Section>
    </div>
  );
}
