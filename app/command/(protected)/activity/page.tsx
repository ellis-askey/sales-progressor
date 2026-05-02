import { commandDb } from "@/lib/command/prisma";
import { parseMode, parseAgencies, eventScope } from "@/lib/command/scope";

function fmtTs(d: Date): string {
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/London",
  });
}

const TYPE_BADGE: Record<string, string> = {
  user_logged_in:               "bg-blue-500/15 text-blue-300",
  milestone_confirmed:          "bg-emerald-500/15 text-emerald-300",
  contracts_exchanged:          "bg-emerald-500/25 text-emerald-200",
  sale_completed:               "bg-emerald-500/25 text-emerald-200",
  chase_sent:                   "bg-amber-500/15 text-amber-300",
  chase_message_generated:      "bg-amber-500/15 text-amber-300",
  transaction_created:          "bg-purple-500/15 text-purple-300",
  feedback_submitted:           "bg-pink-500/15 text-pink-300",
};

function typeBadge(type: string): string {
  return TYPE_BADGE[type] ?? "bg-white/8 text-white/50";
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; agency?: string; internal?: string }>;
}) {
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  const agencyIds = parseAgencies(sp.agency);
  const internalOnly = sp.internal === "1";

  const since7 = new Date();
  since7.setUTCDate(since7.getUTCDate() - 7);

  // Resolve mode → agencyIds for event filtering
  let resolvedAgencyIds = agencyIds;
  if (agencyIds.length === 0 && mode !== "combined") {
    const modeProfile = mode === "sp" ? "self_progressed" : "progressor_managed";
    const modeAgencies = await commandDb.agency.findMany({
      where: { modeProfile },
      select: { id: true },
    });
    resolvedAgencyIds = modeAgencies.map((a) => a.id);
  }

  const agencyFilter = eventScope(resolvedAgencyIds);
  const baseWhere = {
    occurredAt: { gte: since7 },
    ...agencyFilter,
    ...(internalOnly ? { isInternalUser: true } : {}),
  };

  const [breakdown, recentEvents] = await Promise.all([
    commandDb.event.groupBy({
      by: ["type"],
      where: baseWhere,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    commandDb.event.findMany({
      where: baseWhere,
      orderBy: { occurredAt: "desc" },
      take: 200,
    }),
  ]);

  const baseParams = new URLSearchParams();
  if (mode !== "combined") baseParams.set("mode", mode);
  if (agencyIds.length > 0) baseParams.set("agency", agencyIds.join(","));
  if (!internalOnly) baseParams.set("internal", "1");
  const toggleHref = `/command/activity${baseParams.toString() ? `?${baseParams}` : ""}`;

  return (
    <div className="space-y-8">

      {/* Filter + toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wide">
          Last 7 days · {internalOnly ? "internal users" : "all users"}
        </h2>
        <a href={toggleHref} className="text-xs text-white/40 hover:text-white/70 transition-colors">
          {internalOnly ? "Show all users" : "Internal users only"}
        </a>
      </div>

      {/* Event type breakdown */}
      <section>
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-4">Event type breakdown</h2>
        {breakdown.length === 0 ? (
          <p className="text-sm text-white/30">No events in the last 7 days.</p>
        ) : (
          <div className="glass-card rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left px-5 py-3 text-xs font-medium text-white/40">Event type</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-white/40">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {breakdown.map((b) => (
                  <tr key={b.type}>
                    <td className="px-5 py-2.5">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${typeBadge(b.type)}`}>
                        {b.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right text-xs tabular-nums text-white/70 font-medium">
                      {b._count.id.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent event feed */}
      <section>
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-4">
          Recent events · latest {Math.min(recentEvents.length, 200)}
        </h2>
        {recentEvents.length === 0 ? (
          <p className="text-sm text-white/30">No events in the last 7 days.</p>
        ) : (
          <div className="glass-card rounded-2xl overflow-hidden divide-y divide-white/5">
            {recentEvents.map((e) => {
              const meta = e.metadata as Record<string, unknown> | null;
              return (
                <div key={e.id} className="px-4 py-3 flex items-start gap-3">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${typeBadge(e.type)}`}>
                    {e.type.replace(/_/g, " ")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      {e.userId && (
                        <span className="text-[10px] font-mono text-white/40 truncate max-w-[120px]">
                          {e.userId}
                        </span>
                      )}
                      {e.agencyId && (
                        <span className="text-[10px] text-white/25 truncate max-w-[100px]">
                          agency:{e.agencyId.slice(-6)}
                        </span>
                      )}
                      {e.entityType && (
                        <span className="text-[10px] text-white/25">{e.entityType}</span>
                      )}
                      {e.isInternalUser && (
                        <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1 rounded">internal</span>
                      )}
                    </div>
                    {meta && Object.keys(meta).length > 0 && (
                      <p className="text-[10px] text-white/30 mt-0.5 truncate">
                        {Object.entries(meta).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-white/25 shrink-0 whitespace-nowrap">
                    {fmtTs(e.occurredAt)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}
