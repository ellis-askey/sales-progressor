import { commandDb } from "@/lib/command/prisma";
import Link from "next/link";

const PAGE_SIZE = 100;

function fmtTs(d: Date): string {
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZone: "Europe/London",
  });
}

function actionBadgeColor(action: string): string {
  if (action.includes("viewed") || action.includes("read")) return "bg-white/8 text-white/40";
  if (action.includes("created") || action.includes("approved")) return "bg-emerald-500/15 text-emerald-300";
  if (action.includes("deleted") || action.includes("removed")) return "bg-red-500/15 text-red-300";
  if (action.includes("updated") || action.includes("changed")) return "bg-amber-500/15 text-amber-300";
  return "bg-blue-500/10 text-blue-300";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    action?: string; target?: string; admin?: string;
    from?: string; to?: string; page?: string;
  }>;
}) {
  const sp = await searchParams;
  const actionFilter = sp.action?.trim() ?? "";
  const targetFilter = sp.target?.trim() ?? "";
  const adminFilter = sp.admin?.trim() ?? "";
  const dateFrom = sp.from ? new Date(sp.from) : null;
  const dateTo = sp.to ? new Date(`${sp.to}T23:59:59.999Z`) : null;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  const where: Record<string, unknown> = {};
  if (actionFilter) where.action = { contains: actionFilter, mode: "insensitive" };
  if (targetFilter) {
    where.OR = [
      { targetType: { contains: targetFilter, mode: "insensitive" } },
      { targetId: { contains: targetFilter, mode: "insensitive" } },
    ];
  }
  if (adminFilter) where.adminUserId = adminFilter;
  if (dateFrom || dateTo) {
    where.occurredAt = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };
  }

  const [logs, total] = await Promise.all([
    commandDb.adminAuditLog.findMany({
      where: where as never,
      orderBy: { occurredAt: "desc" },
      take: PAGE_SIZE,
      skip,
    }),
    commandDb.adminAuditLog.count({ where: where as never }),
  ]);

  // Resolve admin user names
  const adminIds = [...new Set(logs.map((l) => l.adminUserId))];
  const admins = adminIds.length > 0
    ? await commandDb.user.findMany({
        where: { id: { in: adminIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const adminMap = Object.fromEntries(admins.map((u) => [u.id, u.name ?? u.email]));

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildUrl(extra: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const forward = { action: sp.action, target: sp.target, admin: sp.admin, from: sp.from, to: sp.to, page: sp.page };
    for (const [k, v] of Object.entries({ ...forward, ...extra })) {
      if (v) p.set(k, v);
    }
    return `/command/audit?${p.toString()}`;
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <form method="GET" action="/command/audit" className="glass-card rounded-2xl px-6 py-4">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="text-[10px] font-semibold text-white/30 uppercase tracking-wide block mb-1.5">
              Action
            </label>
            <input
              name="action"
              defaultValue={actionFilter}
              placeholder="e.g. outbound_message.viewed"
              className="text-xs bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-white/60 placeholder:text-white/20 focus:outline-none focus:border-white/30 w-56"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-white/30 uppercase tracking-wide block mb-1.5">
              Target type / ID
            </label>
            <input
              name="target"
              defaultValue={targetFilter}
              placeholder="OutboundMessage, clxyz…"
              className="text-xs bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-white/60 placeholder:text-white/20 focus:outline-none focus:border-white/30 w-48"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-white/30 uppercase tracking-wide block mb-1.5">
              Date range
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                name="from"
                defaultValue={sp.from ?? ""}
                className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white/60 focus:outline-none focus:border-white/30"
              />
              <span className="text-white/20">–</span>
              <input
                type="date"
                name="to"
                defaultValue={sp.to ?? ""}
                className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white/60 focus:outline-none focus:border-white/30"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 self-end">
            <button
              type="submit"
              className="text-xs px-3.5 py-1.5 bg-white/10 hover:bg-white/15 text-white/70 rounded transition-colors"
            >
              Filter
            </button>
            <Link
              href="/command/audit"
              className="text-xs px-3 py-1.5 text-white/30 hover:text-white/60 transition-colors"
            >
              Clear
            </Link>
          </div>
        </div>
        {total > 0 && (
          <p className="text-[10px] text-white/25 mt-3">
            {total.toLocaleString()} record{total !== 1 ? "s" : ""}
            {actionFilter || targetFilter || adminFilter || dateFrom || dateTo
              ? " matching filters"
              : " total"}
          </p>
        )}
      </form>

      {/* Log table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {logs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-white/30">No audit records match these filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  {["Time", "Admin", "Action", "Target", "Reason"].map((h) => (
                    <th
                      key={h}
                      className="text-left text-[10px] font-semibold text-white/25 uppercase tracking-wide px-4 py-2.5"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                    <td className="px-4 py-2.5 text-white/35 whitespace-nowrap font-mono text-[11px]">
                      {fmtTs(log.occurredAt)}
                    </td>
                    <td className="px-4 py-2.5 text-white/50 whitespace-nowrap">
                      {adminMap[log.adminUserId] ?? log.adminUserId.slice(-8)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${actionBadgeColor(log.action)}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-white/40">
                      {log.targetType && (
                        <span className="font-medium text-white/50">{log.targetType}</span>
                      )}
                      {log.targetId && (
                        <span className="ml-1.5 font-mono text-[10px] text-white/25">
                          {log.targetId.slice(-10)}
                        </span>
                      )}
                      {!log.targetType && !log.targetId && (
                        <span className="text-white/20">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-white/35 max-w-xs truncate">
                      {log.reason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
            <p className="text-[10px] text-white/25">
              Page {page} of {totalPages.toLocaleString()}
            </p>
            <div className="flex items-center gap-3">
              {page > 1 && (
                <Link
                  href={buildUrl({ page: String(page - 1) })}
                  className="text-xs text-white/40 hover:text-white/70 transition-colors"
                >
                  ← Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={buildUrl({ page: String(page + 1) })}
                  className="text-xs text-white/40 hover:text-white/70 transition-colors"
                >
                  Next →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
