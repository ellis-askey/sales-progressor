// /command/providers — directory of third-party service firms.
//
// Provider-quotes v1 lists surveyors only. ProviderKind will grow to cover
// electricians, gas engineers, etc. Each row links to a detail page for
// editing coverage / service types / logo.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";
import { getProviderLogoUrl } from "@/lib/supabase-storage";
import { NewProviderForm } from "./NewProviderForm";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CommandProvidersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) redirect("/dashboard");

  const firms = await commandDb.providerFirm.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { coverage: true, serviceTypes: true, quoteRequests: true } },
    },
  });

  const surveyorCount = firms.filter((f) => f.kind === "surveyor").length;
  const activeCount = firms.filter((f) => f.active).length;

  return (
    <div>
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-[20px] font-semibold text-[#fafafa] tracking-tight">
          Providers
        </h1>
        <Link
          href="/command/providers/service-types"
          className="text-[11px] text-[#737373] hover:text-[#d4d4d4] transition-colors"
        >
          Manage service types →
        </Link>
      </div>
      <p className="text-[13px] text-[#737373] mb-6">
        Third-party firms clients can request quotes from via the public
        <code className="mx-1 px-1 py-0.5 bg-[#1a1a1a] border border-[#262626] rounded text-[#a3a3a3] font-mono text-[11px]">/quote/[token]</code>
        page. Currently surveyors only; more kinds land later.
      </p>

      {/* Summary strip */}
      <div className="flex gap-3 mb-6">
        <SummaryTile label="Total firms" value={firms.length} />
        <SummaryTile label="Surveyors" value={surveyorCount} />
        <SummaryTile label="Active" value={activeCount} />
      </div>

      {/* Add new firm */}
      <section className="mb-8">
        <p className="text-[10px] font-bold text-[#404040] uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <Plus className="w-3 h-3" />
          Add firm
        </p>
        <NewProviderForm />
      </section>

      {/* Firm list */}
      <section>
        <p className="text-[10px] font-bold text-[#404040] uppercase tracking-widest mb-2">
          All firms ({firms.length})
        </p>
        {firms.length === 0 ? (
          <div className="px-3 py-6 rounded-md border border-dashed border-[#262626] bg-[#0f0f0f] text-center">
            <p className="text-[12px] text-[#737373]">
              No firms yet. Add your first surveyor above.
            </p>
          </div>
        ) : (
          <div className="border border-[#262626] rounded-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#111111] border-b border-[#262626]">
                <tr>
                  <th className="text-[10px] font-bold text-[#525252] uppercase tracking-widest px-3 py-2 text-left">Firm</th>
                  <th className="text-[10px] font-bold text-[#525252] uppercase tracking-widest px-3 py-2 text-left">Kind</th>
                  <th className="text-[10px] font-bold text-[#525252] uppercase tracking-widest px-3 py-2 text-right">Areas</th>
                  <th className="text-[10px] font-bold text-[#525252] uppercase tracking-widest px-3 py-2 text-right">Services</th>
                  <th className="text-[10px] font-bold text-[#525252] uppercase tracking-widest px-3 py-2 text-right">Quotes</th>
                  <th className="text-[10px] font-bold text-[#525252] uppercase tracking-widest px-3 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {firms.map((f) => {
                  const logoUrl = getProviderLogoUrl(f.logoPath);
                  return (
                    <tr
                      key={f.id}
                      className="border-b border-[#1a1a1a] last:border-0 hover:bg-[#111111] transition-colors"
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/command/providers/${f.id}`}
                          className="flex items-center gap-2.5 group"
                        >
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt=""
                              className="w-8 h-8 rounded object-cover flex-shrink-0 bg-[#1a1a1a]"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded bg-[#1a1a1a] border border-[#262626] flex items-center justify-center flex-shrink-0">
                              <span className="text-[11px] font-semibold text-[#525252]">
                                {f.name.slice(0, 1).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="text-[13px] text-[#fafafa] group-hover:text-[#93c5fd] transition-colors">
                              {f.name}
                            </p>
                            <p className="text-[11px] text-[#525252]">{f.email}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-[11px] text-[#a3a3a3] capitalize">
                        {f.kind}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-[#a3a3a3] text-right tabular-nums">
                        {f._count.coverage}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-[#a3a3a3] text-right tabular-nums">
                        {f._count.serviceTypes}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-[#a3a3a3] text-right tabular-nums">
                        {f._count.quoteRequests}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {f.active ? (
                          <span className="text-[10px] font-semibold text-[#86efac] bg-[#0c2418] px-2 py-0.5 rounded uppercase tracking-wide">
                            Active
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-[#737373] bg-[#1a1a1a] px-2 py-0.5 rounded uppercase tracking-wide">
                            Hidden
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 px-3 py-2.5 rounded-md border border-[#262626] bg-[#0f0f0f]">
      <p className="text-[10px] font-bold text-[#525252] uppercase tracking-widest mb-1">
        {label}
      </p>
      <p className="text-[20px] font-semibold text-[#fafafa] tabular-nums leading-none">
        {value}
      </p>
    </div>
  );
}
