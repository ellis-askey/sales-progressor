import { getPortalAdoption, type AdoptionFunnel, type AdoptionCapabilities, type AdoptionPriority, type AgencyAdoptionRow, type GrowthWeek } from "@/lib/command/adoption";
import { AdoptionTable } from "@/components/command/AdoptionTable";
import InfoTip from "@/components/command/shared/InfoTip";

// Command Centre → App adoption. Notifications + PWA install + engagement for
// every client on a live file, per person and as a share of the whole. The
// table itself (with expandable per-client detail) lives in AdoptionTable.

export const dynamic = "force-dynamic";

export default async function AdoptionPage() {
  const { totalClients, funnel, capabilities, priority, byAgency, growth, clients } = await getPortalAdoption();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">App adoption</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Which clients on live files are actually opening their portal, and how equipped they are (app installed, push
          on). Use it to see where adoption drops off and which agencies to help. Open a row for the full picture.
        </p>
      </div>

      {/* Funnel + live-clients */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-3 items-stretch">
        <Stat label="Live clients" value={String(totalClients)} sub="buyers & sellers on a live file" />
        <Funnel funnel={funnel} />
      </div>

      {/* Capabilities */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <CapabilityStat
          label="App installed"
          value={capabilities.installed}
          total={totalClients}
          tip="Added the portal to their home screen. Not required to engage — many use it in the browser."
        />
        <CapabilityStat
          label="Notifications on"
          value={capabilities.notifications}
          total={totalClients}
          tip="Turned on push notifications. The lowest-friction way to pull a client back in."
        />
        <CapabilityStat
          label="Can't reach"
          value={capabilities.cantReach}
          total={totalClients}
          warn
          tip="No email on file, opted out, or their mail is bouncing. These can't be nudged by email."
        />
      </div>

      {/* Opportunity / what to do next */}
      <Opportunity priority={priority} />

      {/* Adoption by agency */}
      <ByAgencyTable rows={byAgency} />

      <GrowthChart growth={growth} />

      <AdoptionTable clients={clients} />

      <p className="text-[12px] text-neutral-600 leading-relaxed">
        Installed is recorded when a client opens the portal from their home screen, or on the browser install event.
        iOS fires no install event, so a home-screen open is how we know there. &ldquo;Visited&rdquo; is a last-visit
        stamp; &ldquo;Engaged&rdquo; needs time-tracking that went live later, so a very early visitor can count as
        visited without ever counting as engaged.
      </p>
    </div>
  );
}

// The biggest, most actionable levers, framed as a to-do rather than a filter.
function Opportunity({ priority }: { priority: AdoptionPriority }) {
  const items = [
    { n: priority.notificationsOff, label: "reachable clients have notifications off", hint: "the biggest untapped lever" },
    { n: priority.neverVisited, label: "reachable clients have never opened the portal", hint: "re-invite" },
    { n: priority.visitedNotEngaged, label: "reachable clients glanced once but didn't come back", hint: "nudge" },
  ].filter((i) => i.n > 0);

  if (items.length === 0) {
    return null;
  }
  return (
    <div className="bg-[#1a1305] border border-[#3a2a10] rounded-xl px-5 py-4">
      <p className="text-[11px] uppercase tracking-wider text-[#fcd34d] mb-2 flex items-center gap-1.5">
        Where to move the needle
        <InfoTip label="Opportunity">Counts only clients we can email right now (not opted-out, bouncing, or paused).</InfoTip>
      </p>
      <ul className="space-y-1.5">
        {items.map((i) => (
          <li key={i.label} className="text-[13px] text-neutral-300">
            <span className="text-[#fcd34d] font-semibold tabular-nums">{i.n}</span> {i.label}
            <span className="text-neutral-600"> · {i.hint}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Per-agency adoption — worst-engaged first, so the ones to help are up top.
function ByAgencyTable({ rows }: { rows: AgencyAdoptionRow[] }) {
  const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100));
  const rateColor = (r: number) => (r >= 60 ? "text-emerald-400" : r >= 30 ? "text-amber-400" : "text-red-400");
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800 flex items-center gap-1.5">
        <p className="text-[11px] uppercase tracking-wider text-neutral-500">Adoption by agency</p>
        <InfoTip label="By agency">Which agencies' clients engage and which don't. Lowest engagement first, so the agencies to help are at the top.</InfoTip>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-neutral-600 text-center">No clients in scope.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="bg-neutral-950/40 border-b border-neutral-800">
                <th className="text-left px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Agency</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Clients</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Visited</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Engaged</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Push on</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {rows.map((r) => {
                const eng = pct(r.engaged, r.total);
                return (
                  <tr key={r.agencyId} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="px-4 py-2.5 text-neutral-200 text-xs">{r.agencyName}</td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-neutral-300">{r.total}</td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-neutral-400">{pct(r.visited, r.total)}%</td>
                    <td className={`px-3 py-2.5 text-right text-xs tabular-nums font-semibold ${rateColor(eng)}`}>{eng}%</td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-400">{pct(r.notifications, r.total)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CapabilityStat({ label, value, total, tip, warn }: { label: string; value: number; total: number; tip?: string; warn?: boolean }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className={`bg-neutral-900 border rounded-xl px-4 py-3 ${warn && value > 0 ? "border-[#5a3f2c]" : "border-neutral-800"}`}>
      <p className="text-[11px] uppercase tracking-wider text-neutral-500 flex items-center gap-1">{label}{tip && <InfoTip label={label}>{tip}</InfoTip>}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${warn && value > 0 ? "text-[#f6b17a]" : "text-neutral-100"}`}>
        {value}<span className="text-sm text-neutral-600 font-normal"> · {pct}%</span>
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
    { label: "Engaged", value: funnel.engaged },
  ];
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
        Engagement funnel
        <InfoTip label="Engagement funnel">
          A true nested funnel: everyone invited, how many opened the portal, how many came back or spent real time.
          Each step is a subset of the one above, so the fall between them is genuine drop-off. Installed and push are
          separate (you can engage without either).
        </InfoTip>
      </p>
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

// Weekly growth trend. Two bars per week: new clients invited and clients whose
// first visit fell that week. Honest by design: with little data the chart is
// near-empty, so an all-zero window shows a plain "not enough data yet" note
// rather than a flat misleading baseline.
function GrowthChart({ growth }: { growth: GrowthWeek[] }) {
  const max = Math.max(1, ...growth.map((w) => Math.max(w.invited, w.activated)));
  const hasData = growth.some((w) => w.invited > 0 || w.activated > 0);
  const fmtWeek = (d: Date) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-neutral-500">New clients over time</p>
        <div className="flex items-center gap-3 text-[11px] text-neutral-500">
          <span className="flex items-center gap-1.5"><i className="inline-block w-2.5 h-2.5 rounded-sm bg-[#2563eb]/70" />Invited</span>
          <span className="flex items-center gap-1.5"><i className="inline-block w-2.5 h-2.5 rounded-sm bg-[#6ee7b7]/70" />First visit</span>
        </div>
      </div>

      {hasData ? (
        <div className="mt-3 flex items-end gap-1.5 h-24">
          {growth.map((w, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`Week of ${fmtWeek(w.weekStart)}: ${w.invited} invited, ${w.activated} first visits`}>
              <div className="w-full flex items-end justify-center gap-0.5 h-full">
                <div className="w-1/2 max-w-[10px] bg-[#2563eb]/70 rounded-sm" style={{ height: `${(w.invited / max) * 100}%` }} aria-hidden />
                <div className="w-1/2 max-w-[10px] bg-[#6ee7b7]/70 rounded-sm" style={{ height: `${(w.activated / max) * 100}%` }} aria-hidden />
              </div>
              <span className="text-[9px] text-neutral-600 tabular-nums">
                {i % 3 === 0 || i === growth.length - 1 ? fmtWeek(w.weekStart) : ""}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-neutral-600">
          Not enough data yet. New clients and their first visits will chart here as they come in.
        </p>
      )}
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
