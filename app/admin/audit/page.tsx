import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAuditLog, getAuditUsers } from "@/lib/services/audit";
import { countManualTasksDueToday } from "@/lib/services/manual-tasks";

const PAGE_SIZE = 50;

const KIND_STYLES: Record<string, { label: string; cls: string }> = {
  milestone: { label: "Milestone",   cls: "bg-blue-100 text-blue-700" },
  note:      { label: "Internal note", cls: "bg-slate-100 text-slate-600" },
  status:    { label: "Status change", cls: "bg-amber-100 text-amber-700" },
  comm:      { label: "Comms",        cls: "bg-emerald-100 text-emerald-700" },
};

function fmtDt(d: Date) {
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string; page?: string }>;
}) {
  const session = await requireSession();
  if (session.user.role !== "admin") redirect("/dashboard");

  const sp = await searchParams;
  const currentUserId = sp.userId ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const [{ entries, total }, users, todoCount] = await Promise.all([
    getAuditLog(session.user.agencyId, { userId: currentUserId || undefined, page, pageSize: PAGE_SIZE }),
    getAuditUsers(session.user.agencyId),
    countManualTasksDueToday(session.user.agencyId).catch(() => 0),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageLink(p: number) {
    const params = new URLSearchParams();
    if (currentUserId) params.set("userId", currentUserId);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/admin/audit${qs ? `?${qs}` : ""}`;
  }

  function userLink(uid: string) {
    const params = new URLSearchParams();
    if (uid) params.set("userId", uid);
    return `/admin/audit${params.toString() ? `?${params}` : ""}`;
  }

  return (
    <AppShell session={session} activePath="/admin" todoCount={todoCount}>
      <PageHeader
        title="Audit trail"
        subtitle={`${total} events across all files`}
        action={
          <Link href="/admin" className="text-sm text-white/60 hover:text-white transition-colors">
            ← Back to admin
          </Link>
        }
      />

      <div className="px-8 py-7 max-w-6xl space-y-5">
        {/* ── Filters ──────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Filter by user</span>
          <Link
            href={userLink("")}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              !currentUserId
                ? "bg-white/20 text-white"
                : "bg-white/8 text-white/50 hover:text-white/80 hover:bg-white/12"
            }`}
          >
            All users
          </Link>
          {users.map((u) => (
            <Link
              key={u.id}
              href={userLink(u.id)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                currentUserId === u.id
                  ? "bg-white/20 text-white"
                  : "bg-white/8 text-white/50 hover:text-white/80 hover:bg-white/12"
              }`}
            >
              {u.name}
            </Link>
          ))}
        </div>

        {/* ── Table ────────────────────────────────────────────── */}
        <div className="glass-card overflow-hidden" style={{ clipPath: "inset(0 round 20px)" }}>
          {entries.length === 0 ? (
            <div className="px-8 py-16 text-center">
              <p className="text-sm text-white/40">No audit events found.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/20 bg-white/10">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-900/40 whitespace-nowrap">Date / time</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-900/40">User</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-900/40">File</th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-slate-900/40">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-900/40">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {entries.map((e) => {
                  const kind = KIND_STYLES[e.kind] ?? KIND_STYLES.note;
                  return (
                    <tr key={e.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-900/50 whitespace-nowrap tabular-nums">
                        {fmtDt(e.at)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-900/70 whitespace-nowrap">
                        {e.actorName}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[200px]">
                        <Link
                          href={`/transactions/${e.transactionId}`}
                          className="text-blue-500 hover:text-blue-600 hover:underline truncate block"
                          title={e.address}
                        >
                          {e.address}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${kind.cls}`}>
                          {kind.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-900/70 max-w-xs">
                        <p className="line-clamp-2">{e.detail}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination ───────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/40">
              Page {page} of {totalPages} · {total} events
            </p>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <Link href={pageLink(page - 1)} className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors">
                  ← Previous
                </Link>
              )}
              {page < totalPages && (
                <Link href={pageLink(page + 1)} className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors">
                  Next →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
