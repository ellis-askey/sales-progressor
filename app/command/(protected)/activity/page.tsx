import { commandDb } from "@/lib/command/prisma";
import { parseMode, parseAgencies, eventScope } from "@/lib/command/scope";
import AutoRefresh from "@/components/command/shared/AutoRefresh";

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

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; agency?: string; internal?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  const agencyIds = parseAgencies(sp.agency);
  const internalOnly = sp.internal === "1";
  const sortBy = sp.sort === "milestones" ? "milestones" : sp.sort === "logins" ? "logins" : "total";

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

  // Heatmap raw SQL — hour × DOW counts in London time
  type HeatCell = { dow: number; hour: number; cnt: bigint };

  const [breakdown, recentEvents, heatmapRaw, perUserRaw] = await Promise.all([
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
    // Heatmap is a global pattern view — agency filter is approximate; exclude internal users
    resolvedAgencyIds.length > 0
      ? commandDb.$queryRaw<HeatCell[]>`
          SELECT
            EXTRACT(DOW FROM "occurredAt" AT TIME ZONE 'Europe/London')::int AS dow,
            EXTRACT(HOUR FROM "occurredAt" AT TIME ZONE 'Europe/London')::int AS hour,
            COUNT(*)::bigint AS cnt
          FROM "Event"
          WHERE "occurredAt" >= ${since7}
            AND "isInternalUser" = ${internalOnly}
            AND "agencyId" = ANY(${resolvedAgencyIds})
          GROUP BY dow, hour
          ORDER BY dow, hour
        `
      : commandDb.$queryRaw<HeatCell[]>`
          SELECT
            EXTRACT(DOW FROM "occurredAt" AT TIME ZONE 'Europe/London')::int AS dow,
            EXTRACT(HOUR FROM "occurredAt" AT TIME ZONE 'Europe/London')::int AS hour,
            COUNT(*)::bigint AS cnt
          FROM "Event"
          WHERE "occurredAt" >= ${since7}
            AND "isInternalUser" = ${internalOnly}
          GROUP BY dow, hour
          ORDER BY dow, hour
        `,
    // Per-user activity breakdown
    commandDb.event.groupBy({
      by: ["userId"],
      where: { ...baseWhere, userId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 30,
    }),
  ]);

  // Fetch user display data for per-user table
  const userIds = perUserRaw.map((r) => r.userId).filter((id): id is string => id !== null);
  const userRecords = userIds.length > 0
    ? await commandDb.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, role: true },
      })
    : [];
  const userMap = Object.fromEntries(userRecords.map((u) => [u.id, u]));

  // Per-user milestone and login counts
  const [userMilestones, userLogins] = userIds.length > 0
    ? await Promise.all([
        commandDb.event.groupBy({
          by: ["userId"],
          where: { ...baseWhere, type: "milestone_confirmed", userId: { in: userIds } },
          _count: { id: true },
        }),
        commandDb.event.groupBy({
          by: ["userId"],
          where: { ...baseWhere, type: "user_logged_in", userId: { in: userIds } },
          _count: { id: true },
        }),
      ])
    : [[], []];

  const msMap     = Object.fromEntries(userMilestones.map((r) => [r.userId, r._count.id]));
  const loginMap  = Object.fromEntries(userLogins.map((r)    => [r.userId, r._count.id]));

  // Build per-user rows and sort
  const perUserRows = perUserRaw
    .filter((r) => r.userId !== null)
    .map((r) => ({
      userId:     r.userId as string,
      total:      r._count.id,
      milestones: msMap[r.userId!] ?? 0,
      logins:     loginMap[r.userId!] ?? 0,
      user:       userMap[r.userId!],
    }))
    .sort((a, b) => {
      if (sortBy === "milestones") return b.milestones - a.milestones;
      if (sortBy === "logins")     return b.logins     - a.logins;
      return b.total - a.total;
    });

  // Build heatmap grid — 7 rows (DOW 0=Sun…6=Sat) × 24 cols (hour)
  const heatGrid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const cell of heatmapRaw) {
    heatGrid[cell.dow][cell.hour] = Number(cell.cnt);
  }
  const maxHeat = Math.max(1, ...heatmapRaw.map((c) => Number(c.cnt)));

  const baseParams = new URLSearchParams();
  if (mode !== "combined") baseParams.set("mode", mode);
  if (agencyIds.length > 0) baseParams.set("agency", agencyIds.join(","));
  if (!internalOnly) baseParams.set("internal", "1");
  const toggleHref = `/command/activity${baseParams.toString() ? `?${baseParams}` : ""}`;

  function sortHref(s: string): string {
    const p = new URLSearchParams(baseParams);
    p.set("sort", s);
    return `/command/activity?${p}`;
  }

  function heatColor(n: number): string {
    const intensity = n / maxHeat;
    if (intensity === 0) return "bg-neutral-800/30";
    if (intensity < 0.2) return "bg-[#FF6B4A]/15";
    if (intensity < 0.4) return "bg-[#FF6B4A]/30";
    if (intensity < 0.6) return "bg-[#FF6B4A]/50";
    if (intensity < 0.8) return "bg-[#FF6B4A]/65";
    return "bg-[#FF6B4A]/80";
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-100">Activity</h1>
        <div className="flex items-center gap-3">
          <AutoRefresh intervalMs={30000} />
          <a href={toggleHref} className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
            {internalOnly ? "Show all users" : "Internal users only"}
          </a>
        </div>
      </div>

      <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider -mt-6">
        Last 7 days · {internalOnly ? "internal users" : "all users"}
      </p>

      {/* 24h × 7d heatmap */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Activity heatmap — hour × day (London time)
        </h2>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Hour labels */}
            <div className="flex mb-1 ml-9">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="flex-1 text-center">
                  {h % 6 === 0 && (
                    <span className="text-[9px] text-neutral-600">{String(h).padStart(2, "0")}</span>
                  )}
                </div>
              ))}
            </div>
            {/* Grid rows */}
            {DOW_LABELS.map((dayLabel, dow) => (
              <div key={dow} className="flex items-center gap-0.5 mb-0.5">
                <span className="text-[10px] text-neutral-600 w-8 shrink-0 text-right pr-1">{dayLabel}</span>
                {heatGrid[dow].map((cnt, hour) => (
                  <div
                    key={hour}
                    className={`flex-1 h-4 rounded-[2px] ${heatColor(cnt)}`}
                    title={`${dayLabel} ${String(hour).padStart(2, "0")}:00 — ${cnt} events`}
                  />
                ))}
              </div>
            ))}
            {/* Scale hint */}
            <div className="flex items-center gap-1.5 mt-2 justify-end">
              <span className="text-[9px] text-neutral-600">Low</span>
              {[0.1, 0.3, 0.55, 0.7, 1].map((v) => (
                <div
                  key={v}
                  className="w-4 h-3 rounded-[2px]"
                  style={{ backgroundColor: `rgba(255,107,74,${v * 0.8})` }}
                />
              ))}
              <span className="text-[9px] text-neutral-600">High</span>
            </div>
          </div>
        </div>
      </section>

      {/* Per-user sortable table */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Top users — last 7 days
        </h2>
        {perUserRows.length === 0 ? (
          <p className="text-sm text-neutral-600">No user activity.</p>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-800/50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-neutral-500">User</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-neutral-500">Role</th>
                    <th className="text-right px-4 py-3">
                      <a href={sortHref("total")} className={`text-xs font-medium transition-colors ${sortBy === "total" ? "text-white" : "text-neutral-500 hover:text-neutral-300"}`}>
                        Total {sortBy === "total" && "↓"}
                      </a>
                    </th>
                    <th className="text-right px-4 py-3">
                      <a href={sortHref("milestones")} className={`text-xs font-medium transition-colors ${sortBy === "milestones" ? "text-white" : "text-neutral-500 hover:text-neutral-300"}`}>
                        Milestones {sortBy === "milestones" && "↓"}
                      </a>
                    </th>
                    <th className="text-right px-4 py-3">
                      <a href={sortHref("logins")} className={`text-xs font-medium transition-colors ${sortBy === "logins" ? "text-white" : "text-neutral-500 hover:text-neutral-300"}`}>
                        Logins {sortBy === "logins" && "↓"}
                      </a>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {perUserRows.map((row) => (
                    <tr key={row.userId} className="hover:bg-neutral-800/50 transition-colors">
                      <td className="px-5 py-2.5">
                        {row.user ? (
                          <div>
                            <p className="text-xs text-neutral-200">{row.user.name}</p>
                            <p className="text-[10px] text-neutral-600">{row.user.email}</p>
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono text-neutral-500">{row.userId.slice(0, 12)}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-neutral-500 capitalize">
                        {row.user?.role.replace(/_/g, " ") ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-white font-medium">{row.total}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-300">{row.milestones}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-neutral-300">{row.logins}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

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
