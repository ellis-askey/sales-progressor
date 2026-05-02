import { commandDb } from "@/lib/command/prisma";
import { parseMode, parseAgencies, eventScope } from "@/lib/command/scope";

function fmtTs(d: Date): string {
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/London",
  });
}

const TYPE_BADGE: Record<string, string> = {
  user_logged_in:               "bg-blue-950 text-blue-400 border border-blue-900",
  milestone_confirmed:          "bg-emerald-950 text-emerald-400 border border-emerald-900",
  contracts_exchanged:          "bg-emerald-900 text-emerald-300 border border-emerald-800",
  sale_completed:               "bg-emerald-900 text-emerald-300 border border-emerald-800",
  chase_sent:                   "bg-amber-950 text-amber-400 border border-amber-900",
  chase_message_generated:      "bg-amber-950 text-amber-400 border border-amber-900",
  transaction_created:          "bg-purple-950 text-purple-400 border border-purple-900",
  feedback_submitted:           "bg-pink-950 text-pink-400 border border-pink-900",
};

function typeBadge(type: string): string {
  return TYPE_BADGE[type] ?? "bg-neutral-800 text-neutral-400";
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-100">Activity</h1>
        <a href={toggleHref} className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
          {internalOnly ? "Show all users" : "Internal users only"}
        </a>
      </div>

      <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider -mt-6">
        Last 7 days · {internalOnly ? "internal users" : "all users"}
      </p>

      {/* Event type breakdown */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">Event type breakdown</h2>
        {breakdown.length === 0 ? (
          <p className="text-sm text-neutral-600">No events in the last 7 days.</p>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-800/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-neutral-500">Event type</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-neutral-500">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {breakdown.map((b) => (
                  <tr key={b.type}>
                    <td className="px-5 py-2.5">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${typeBadge(b.type)}`}>
                        {b.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right text-xs tabular-nums text-neutral-200 font-medium">
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
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Recent events · latest {Math.min(recentEvents.length, 200)}
        </h2>
        {recentEvents.length === 0 ? (
          <p className="text-sm text-neutral-600">No events in the last 7 days.</p>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-800">
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
                        <span className="text-[10px] font-mono text-neutral-500 truncate max-w-[120px]">
                          {e.userId}
                        </span>
                      )}
                      {e.agencyId && (
                        <span className="text-[10px] text-neutral-600 truncate max-w-[100px]">
                          agency:{e.agencyId.slice(-6)}
                        </span>
                      )}
                      {e.entityType && (
                        <span className="text-[10px] text-neutral-600">{e.entityType}</span>
                      )}
                      {e.isInternalUser && (
                        <span className="text-[10px] bg-blue-950 text-blue-400 border border-blue-900 px-1 rounded">internal</span>
                      )}
                    </div>
                    {meta && Object.keys(meta).length > 0 && (
                      <p className="text-[10px] text-neutral-600 mt-0.5 truncate">
                        {Object.entries(meta).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-neutral-600 shrink-0 whitespace-nowrap">
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
