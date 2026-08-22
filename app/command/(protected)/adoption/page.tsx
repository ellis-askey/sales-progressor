import { getPortalAdoption, type AdoptionFunnel } from "@/lib/command/adoption";
import { AdoptionTable } from "@/components/command/AdoptionTable";

// Command Centre → App adoption. Notifications + PWA install + engagement for
// every client on a live file, per person and as a share of the whole. The
// table itself (with expandable per-client detail) lives in AdoptionTable.

export const dynamic = "force-dynamic";

export default async function AdoptionPage() {
  const { totalClients, cantReachCount, funnel, clients } = await getPortalAdoption();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">App adoption</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Which clients on live files have turned on notifications, added the app to their home screen, and are
          actually opening their portal. Open a row for the full picture on that client.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-3 items-stretch">
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
          <Stat label="Live clients" value={String(totalClients)} sub="on a live file" />
          <Stat label="Can't reach" value={String(cantReachCount)} sub="no email, opted out or bouncing" warn={cantReachCount > 0} />
        </div>
        <Funnel funnel={funnel} />
      </div>

      <AdoptionTable clients={clients} />

      <p className="text-[12px] text-neutral-600 leading-relaxed">
        Installed is recorded when a client opens the portal from their home screen, or on the browser install event.
        iOS fires no install event, so a home-screen open is how we know there.
      </p>
    </div>
  );
}

// Adoption funnel. Each stage is a horizontal bar scaled to its share of the
// invited total, with the count, that share, and the drop-off from the stage
// above. Reads top-to-bottom as "how far down the ladder do clients get."
function Funnel({ funnel }: { funnel: AdoptionFunnel }) {
  const total = funnel.invited;
  const stages: { label: string; value: number }[] = [
    { label: "Invited", value: funnel.invited },
    { label: "Visited", value: funnel.visited },
    { label: "Installed", value: funnel.installed },
    { label: "Notifications", value: funnel.notifications },
    { label: "Engaged", value: funnel.engaged },
  ];
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">Adoption funnel</p>
      <div className="mt-2 space-y-1.5">
        {stages.map((s, i) => {
          const share = total === 0 ? 0 : Math.round((s.value / total) * 100);
          const prev = i === 0 ? null : stages[i - 1].value;
          const dropped = prev != null ? prev - s.value : 0;
          return (
            <div key={s.label} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-[12px] text-neutral-400">{s.label}</span>
              <div className="flex-1 h-5 rounded bg-neutral-800/60 overflow-hidden">
                <div
                  className="h-full bg-[#2563eb]/70 rounded"
                  style={{ width: `${share}%` }}
                  aria-hidden
                />
              </div>
              <span className="w-14 shrink-0 text-right text-[12px] text-neutral-200 tabular-nums">
                {s.value}
                <span className="text-neutral-600"> ({share}%)</span>
              </span>
              <span className="w-16 shrink-0 text-right text-[11px] text-neutral-600 tabular-nums">
                {prev != null && dropped > 0 ? `-${dropped}` : ""}
              </span>
            </div>
          );
        })}
      </div>
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
