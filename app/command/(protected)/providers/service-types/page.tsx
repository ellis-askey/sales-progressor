// /command/providers/service-types — master list of provider service types.
//
// Kind-scoped. Adding an "electrician" kind later means adding an enum value
// + seeding rows here. Clients pick from active rows on the public quote
// page. Firms opt in per-row on the firm detail page.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";
import { ChevronLeft } from "lucide-react";
import { ServiceTypeList } from "./ServiceTypeList";
import { NewServiceTypeForm } from "./NewServiceTypeForm";

export const dynamic = "force-dynamic";

export default async function ServiceTypesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) redirect("/dashboard");

  const rows = await commandDb.providerServiceType.findMany({
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    include: {
      _count: { select: { firms: true, quoteRequests: true } },
    },
  });

  const byKind = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byKind.get(r.kind) ?? [];
    list.push(r);
    byKind.set(r.kind, list);
  }

  return (
    <div>
      <Link
        href="/command/providers"
        className="inline-flex items-center gap-1 text-[11px] text-[#525252] hover:text-[#a3a3a3] transition-colors mb-3"
      >
        <ChevronLeft className="w-3 h-3" /> All providers
      </Link>

      <h1 className="text-[20px] font-semibold text-[#fafafa] tracking-tight mb-1">
        Service types
      </h1>
      <p className="text-[13px] text-[#737373] mb-6">
        The master list clients pick from on the public quote page. One row per
        service (e.g. Level 2 HomeBuyer report). Firms opt in per row on their
        detail page.
      </p>

      <section className="mb-8">
        <p className="text-[10px] font-bold text-[#404040] uppercase tracking-widest mb-2">
          Add new
        </p>
        <NewServiceTypeForm />
      </section>

      {Array.from(byKind.entries()).map(([kind, list]) => (
        <section key={kind} className="mb-8">
          <p className="text-[10px] font-bold text-[#404040] uppercase tracking-widest mb-2">
            {kind} ({list.length})
          </p>
          <ServiceTypeList
            rows={list.map((r) => ({
              id: r.id,
              kind: r.kind,
              label: r.label,
              description: r.description,
              sortOrder: r.sortOrder,
              active: r.active,
              firmCount: r._count.firms,
              quoteRequestCount: r._count.quoteRequests,
            }))}
          />
        </section>
      ))}
    </div>
  );
}
