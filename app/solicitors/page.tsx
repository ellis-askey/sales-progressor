import Link from "next/link";
import { requireSession } from "@/lib/session";
import { getSolicitorDirectory } from "@/lib/services/solicitors";
import { getWorkQueueCounts } from "@/lib/services/tasks";
import { countManualTasksDueToday } from "@/lib/services/manual-tasks";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function SolicitorsPage() {
  const session = await requireSession();
  const [firms, taskCounts, todoCount] = await Promise.all([
    getSolicitorDirectory(session.user.agencyId),
    getWorkQueueCounts(session.user.agencyId, session.user.id).catch(() => null),
    countManualTasksDueToday(session.user.agencyId).catch(() => 0),
  ]);

  const totalContacts = firms.reduce((n, f) => n + f.contacts.length, 0);

  return (
    <AppShell session={session} activePath="/solicitors" taskCount={taskCounts?.pending ?? 0} todoCount={todoCount}>
      <div className="relative overflow-hidden"
           style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 60%, #1e3a5f 100%)" }}>
        <div className="absolute inset-0 opacity-[0.04]"
             style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="relative px-8 pt-6 pb-7 flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-500 mb-4 font-medium tracking-wide uppercase">Reference</p>
            <h1 className="text-2xl font-bold text-white tracking-tight">Solicitors</h1>
            <p className="text-sm text-slate-400 mt-0.5">All firms and handlers across your pipeline</p>
          </div>
          {firms.length > 0 && (
            <div className="mt-4 flex items-center gap-6">
              <div className="text-right">
                <p className="text-2xl font-semibold text-white">{firms.length}</p>
                <p className="text-xs text-slate-400">firms</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-white">{totalContacts}</p>
                <p className="text-xs text-slate-400">contacts</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-8 py-7 space-y-4">
        {firms.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#e4e9f0]" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <EmptyState
              title="No solicitor firms yet"
              description="Solicitor firms are added when you create or edit a transaction."
            />
          </div>
        ) : (
          firms.map((firm) => (
            <div key={firm.id} className="bg-white rounded-xl border border-[#e4e9f0] overflow-hidden"
                 style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              {/* Firm header */}
              <div className="px-5 py-4 border-b border-[#f0f4f8] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">{firm.name}</p>
                </div>
                {firm.totalActiveFiles > 0 && (
                  <span className="text-xs font-medium bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">
                    {firm.totalActiveFiles} active file{firm.totalActiveFiles !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Contacts */}
              {firm.contacts.length === 0 ? (
                <div className="px-5 py-4 text-sm text-gray-400 italic">No contacts recorded</div>
              ) : (
                <div className="divide-y divide-[#f0f4f8]">
                  {firm.contacts.map((contact) => (
                    <div key={contact.id} className="px-5 py-3.5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-700">{contact.name}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                            {contact.email && (
                              <a href={`mailto:${contact.email}`}
                                 className="text-xs text-blue-500 hover:text-blue-700 transition-colors">
                                {contact.email}
                              </a>
                            )}
                            {contact.phone && (
                              <a href={`tel:${contact.phone}`}
                                 className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                                {contact.phone}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {contact.activeFiles.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {contact.activeFiles.map((f) => (
                            <Link key={`${f.id}-${f.role}`} href={`/transactions/${f.id}`}
                                  className="inline-flex items-center gap-1 text-xs bg-gray-50 hover:bg-blue-50 border border-[#e4e9f0] hover:border-blue-200 text-gray-600 hover:text-blue-600 rounded-md px-2 py-0.5 transition-colors">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${f.role === "vendor" ? "bg-purple-400" : "bg-blue-400"}`} />
                              <span className="truncate max-w-[180px]">{f.propertyAddress}</span>
                              <span className="text-gray-300 capitalize">({f.role})</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
