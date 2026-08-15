import Link from "next/link";
import { getUsageOverview, type AgentUsage, type AgencyUsage, type UsageStatus } from "@/lib/command/usage";
import { commandDb } from "@/lib/command/prisma";
import { AgencyFeeManager, type AgencyFeeRow } from "@/components/command/agencies/AgencyFeeManager";

function fmtDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m`;
}
function fmtHoursShort(seconds: number): string {
  const h = seconds / 3600;
  if (h >= 10) return `${Math.round(h)}h`;
  if (h >= 1) return `${h.toFixed(1)}h`;
  const m = Math.round(seconds / 60);
  return m > 0 ? `${m}m` : "0";
}
function fmtRelative(d: Date | null): string {
  if (!d) return "never";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days >= 2) return `${days} days ago`;
  if (days === 1) return "yesterday";
  const hrs = Math.floor((Date.now() - new Date(d).getTime()) / 3_600_000);
  if (hrs >= 1) return `${hrs}h ago`;
  return "just now";
}
function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}
const AV_COLORS = ["#8b9dff", "#34d399", "#e0a44a", "#f0716f", "#c084fc", "#38bdf8"];
function avColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}

const STATUS_STYLE: Record<UsageStatus, string> = {
  active: "text-emerald-400 bg-emerald-950/50 border-emerald-900",
  quiet: "text-amber-400 bg-amber-950/50 border-amber-900",
  dormant: "text-neutral-500 bg-neutral-800/60 border-neutral-700",
};
const STATUS_LABEL: Record<UsageStatus, string> = { active: "Active", quiet: "Quiet", dormant: "Dormant" };

function StatusPill({ status }: { status: UsageStatus }) {
  return (
    <span className={`text-[10px] font-mono uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function Sparkline({ weeks }: { weeks: number[] }) {
  const max = Math.max(1, ...weeks);
  return (
    <span className="inline-flex items-end gap-[2px] h-[22px]">
      {weeks.map((w, i) => {
        const zero = w === 0;
        const h = zero ? 2 : Math.max(4, Math.round((w / max) * 22));
        return (
          <i
            key={i}
            className="w-[5px] rounded-[1px]"
            style={{ height: `${h}px`, background: zero ? "#242428" : "#3b82f6", opacity: zero ? 1 : 0.85 }}
          />
        );
      })}
    </span>
  );
}

export default async function AgenciesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const view = sp.view === "agency" ? "agency" : "agent";
  const q = (sp.q ?? "").trim().toLowerCase();

  const { agents, agencies, summary } = await getUsageOverview();

  // Agency fee settings (moved here from the retired /agent/admin page).
  const feeAgencies = await commandDb.agency.findMany({
    where: { isInternal: false },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      feeTier: true,
      legacyOutsourcedFeePence: true,
      stripeCustomerId: true,
      _count: { select: { transactions: true } },
    },
  });
  const feeRows: AgencyFeeRow[] = feeAgencies.map((a) => ({
    id: a.id,
    name: a.name,
    feeTier: a.feeTier,
    legacyOutsourcedFeePence: a.legacyOutsourcedFeePence,
    hasActiveCard: a.stripeCustomerId != null,
    transactionCount: a._count.transactions,
  }));
  const legacyFeeCount = feeRows.filter((a) => a.feeTier === "legacy").length;

  const agentRows: AgentUsage[] = q
    ? agents.filter((a) => a.name.toLowerCase().includes(q) || a.agencyName.toLowerCase().includes(q))
    : agents;
  const agencyRows: AgencyUsage[] = q ? agencies.filter((a) => a.agencyName.toLowerCase().includes(q)) : agencies;

  const tab = (v: "agent" | "agency") => `/command/agencies?${new URLSearchParams({ view: v, ...(q ? { q: sp.q ?? "" } : {}) }).toString()}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">Agencies &amp; agents</h1>
        <p className="text-sm text-neutral-400 mt-1">Who&rsquo;s actually using the platform, how often, and who&rsquo;s gone quiet.</p>
      </div>

      {/* summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { k: "Active this week", v: String(summary.activeAgents7d), d: "agents with a session", warn: false },
          { k: "Hours logged · 7d", v: fmtHoursShort(summary.hoursSeconds7d), d: "real engaged time", warn: false },
          { k: "Logins · 7d", v: String(summary.logins7d), d: "across all agents", warn: false },
          { k: "Gone quiet", v: String(summary.goneQuiet), d: "not seen in 14+ days", warn: summary.goneQuiet > 0 },
        ].map((t) => (
          <div key={t.k} className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
            <div className="text-[10.5px] font-mono uppercase tracking-wider text-neutral-500">{t.k}</div>
            <div className={`text-2xl font-semibold tracking-tight mt-1 tabular-nums ${t.warn ? "text-amber-400" : "text-neutral-100"}`}>{t.v}</div>
            <div className="text-[11.5px] text-neutral-500 mt-0.5">{t.d}</div>
          </div>
        ))}
      </div>

      {/* search + toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <form method="GET" className="flex-1 min-w-[220px] flex items-center gap-2.5 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2">
          <input type="hidden" name="view" value={view} />
          <svg className="w-4 h-4 text-neutral-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Search an agent or agency…" className="flex-1 bg-transparent outline-none text-[13.5px] text-neutral-100 placeholder:text-neutral-600" />
        </form>
        <div className="flex bg-neutral-900 border border-neutral-800 rounded-lg p-[3px]">
          <Link href={tab("agent")} className={`text-[12.5px] font-semibold px-3 py-1.5 rounded-md ${view === "agent" ? "bg-blue-950/50 text-blue-200 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.4)]" : "text-neutral-400"}`}>By agent</Link>
          <Link href={tab("agency")} className={`text-[12.5px] font-semibold px-3 py-1.5 rounded-md ${view === "agency" ? "bg-blue-950/50 text-blue-200 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.4)]" : "text-neutral-400"}`}>By agency</Link>
        </div>
      </div>

      {/* table */}
      <div className="overflow-x-auto border border-neutral-800 rounded-xl bg-neutral-900">
        {view === "agent" ? (
          <table className="w-full border-collapse text-[13px] min-w-[720px]">
            <thead>
              <tr className="bg-neutral-950/60">
                {["Agent", "Agency", "Last active", "Logins · 7d", "Hours · 7d", "Files", "Activity · 12wk", "Status"].map((h, i) => (
                  <th key={h} className={`text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-semibold px-3.5 py-2.5 border-b border-neutral-800 whitespace-nowrap ${i >= 3 && i <= 5 ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agentRows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-neutral-500">{q ? "No agents match that search." : "No agent activity yet."}</td></tr>
              ) : (
                agentRows.map((a) => (
                  <tr key={a.userId} className="border-b border-neutral-800 last:border-b-0">
                    <td className="px-3.5 py-2.5">
                      <Link href={`/command/agencies/${a.userId}`} className="flex items-center gap-2.5 group">
                        {a.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.image} alt="" className="w-[26px] h-[26px] rounded-full object-cover shrink-0" style={{ objectPosition: `${a.imageFocusX}% ${a.imageFocusY}%` }} />
                        ) : (
                          <span className="w-[26px] h-[26px] rounded-full shrink-0 flex items-center justify-center text-[10.5px] font-bold text-neutral-950" style={{ background: avColor(a.name) }}>{initials(a.name)}</span>
                        )}
                        <div>
                          <div className="font-semibold text-neutral-100 group-hover:text-blue-300 transition-colors">{a.name}</div>
                          <div className="text-[11px] text-neutral-500 capitalize">{a.role}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3.5 py-2.5 text-neutral-400 whitespace-nowrap">{a.agencyName}</td>
                    <td className="px-3.5 py-2.5 text-neutral-400 whitespace-nowrap">{fmtRelative(a.lastActive)}</td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums text-neutral-200">{a.logins7d}</td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums text-neutral-200">{fmtDuration(a.seconds7d)}</td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums text-neutral-200">{a.filesTouched7d}</td>
                    <td className="px-3.5 py-2.5"><Sparkline weeks={a.weeks} /></td>
                    <td className="px-3.5 py-2.5"><StatusPill status={a.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full border-collapse text-[13px] min-w-[680px]">
            <thead>
              <tr className="bg-neutral-950/60">
                {["Agency", "Agents", "Active", "Logins · 7d", "Hours · 7d", "Files", "Last active", "Status"].map((h, i) => (
                  <th key={h} className={`text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-semibold px-3.5 py-2.5 border-b border-neutral-800 whitespace-nowrap ${i >= 1 && i <= 5 ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agencyRows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-neutral-500">{q ? "No agencies match that search." : "No agency activity yet."}</td></tr>
              ) : (
                agencyRows.map((a) => (
                  <tr key={a.agencyId} className="border-b border-neutral-800 last:border-b-0">
                    <td className="px-3.5 py-2.5 font-semibold text-neutral-100 whitespace-nowrap">{a.agencyName}</td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums text-neutral-200">{a.agentCount}</td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums text-neutral-200">{a.activeCount}</td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums text-neutral-200">{a.logins7d}</td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums text-neutral-200">{fmtDuration(a.seconds7d)}</td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums text-neutral-200">{a.filesTouched7d}</td>
                    <td className="px-3.5 py-2.5 text-neutral-400 whitespace-nowrap">{fmtRelative(a.lastActive)}</td>
                    <td className="px-3.5 py-2.5"><StatusPill status={a.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[11.5px] text-neutral-600">
        Active = a session in the last 7 days · Quiet = 7&ndash;14 days · Dormant = 14+ days. Hours and files come from the same engaged-time tracking as the Files tab; logins and last-active from the event log.
      </p>

      {/* Agency fees (relocated from /agent/admin) */}
      <div className="pt-2">
        <AgencyFeeManager agencies={feeRows} legacyCount={legacyFeeCount} totalCount={feeRows.length} />
      </div>
    </div>
  );
}
