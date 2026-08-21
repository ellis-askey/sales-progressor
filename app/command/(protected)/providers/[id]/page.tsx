// /command/providers/[id] — edit a single provider firm.
//
// Fields (name/email/phone/website/notes/active), coverage (outward codes),
// service-type joins, and logo upload/delete are each their own sub-section.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";
import { getProviderLogoUrl } from "@/lib/supabase-storage";
import { ProviderFirmEditor } from "./ProviderFirmEditor";
import { CoverageEditor } from "./CoverageEditor";
import { ServiceTypeSelector } from "./ServiceTypeSelector";
import { LogoUploader } from "./LogoUploader";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CommandProviderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) redirect("/dashboard");

  const { id } = await params;

  const firm = await commandDb.providerFirm.findUnique({
    where: { id },
    include: {
      coverage: { orderBy: { outwardCode: "asc" } },
      serviceTypes: { include: { serviceType: true } },
      quoteRequests: {
        orderBy: { submittedAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          submittedAt: true,
          clientName: true,
          propertyPostcode: true,
        },
      },
      _count: { select: { quoteRequests: true } },
    },
  });

  if (!firm) notFound();

  const allServiceTypes = await commandDb.providerServiceType.findMany({
    where: { kind: firm.kind, active: true },
    orderBy: { sortOrder: "asc" },
  });

  const selectedServiceTypeIds = new Set(
    firm.serviceTypes.map((s) => s.serviceTypeId),
  );

  const logoUrl = getProviderLogoUrl(firm.logoPath);

  return (
    <div>
      <Link
        href="/command/providers"
        className="inline-flex items-center gap-1 text-[11px] text-[#525252] hover:text-[#a3a3a3] transition-colors mb-3"
      >
        <ChevronLeft className="w-3 h-3" /> All providers
      </Link>

      <div className="flex items-start gap-4 mb-6">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="w-14 h-14 rounded-md object-cover flex-shrink-0 bg-[#1a1a1a]"
          />
        ) : (
          <div className="w-14 h-14 rounded-md bg-[#1a1a1a] border border-[#262626] flex items-center justify-center flex-shrink-0">
            <span className="text-[20px] font-semibold text-[#525252]">
              {firm.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-[20px] font-semibold text-[#fafafa] tracking-tight">
              {firm.name}
            </h1>
            {firm.active ? (
              <span className="text-[10px] font-semibold text-[#86efac] bg-[#0c2418] px-2 py-0.5 rounded uppercase tracking-wide">
                Active
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-[#737373] bg-[#1a1a1a] px-2 py-0.5 rounded uppercase tracking-wide">
                Hidden
              </span>
            )}
          </div>
          <p className="text-[12px] text-[#737373] capitalize">
            {firm.kind} · {firm._count.quoteRequests} quote request{firm._count.quoteRequests === 1 ? "" : "s"} to date
          </p>
        </div>
      </div>

      {/* Two-column layout on wider screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Section title="Firm details">
            <ProviderFirmEditor
              id={firm.id}
              initial={{
                kind: firm.kind,
                name: firm.name,
                email: firm.email,
                phone: firm.phone,
                website: firm.website,
                notes: firm.notes,
                active: firm.active,
                ricsRegulated: firm.ricsRegulated,
                establishedYear: firm.establishedYear,
                turnaround: firm.turnaround,
                tspDefault: firm.tspDefault,
              }}
            />
          </Section>

          <Section title="Logo">
            <LogoUploader
              id={firm.id}
              currentLogoUrl={logoUrl}
              currentLogoPath={firm.logoPath}
            />
          </Section>
        </div>

        <div className="space-y-6">
          <Section
            title={`Coverage (${firm.coverage.length} outward code${firm.coverage.length === 1 ? "" : "s"})`}
          >
            <CoverageEditor
              providerId={firm.id}
              rows={firm.coverage.map((c) => ({ id: c.id, outwardCode: c.outwardCode }))}
            />
          </Section>

          <Section
            title={`Service types (${selectedServiceTypeIds.size} selected)`}
          >
            <ServiceTypeSelector
              providerId={firm.id}
              allServiceTypes={allServiceTypes.map((s) => ({
                id: s.id,
                label: s.label,
                description: s.description,
              }))}
              selectedIds={Array.from(selectedServiceTypeIds)}
            />
          </Section>
        </div>
      </div>

      {/* Recent quotes for this firm */}
      {firm.quoteRequests.length > 0 && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-[10px] font-bold text-[#404040] uppercase tracking-widest">
              Recent quote requests
            </p>
            <Link
              href={`/command/providers/quotes?firmId=${firm.id}`}
              className="text-[11px] text-[#737373] hover:text-[#d4d4d4] transition-colors"
            >
              See all →
            </Link>
          </div>
          <div className="border border-[#262626] rounded-md overflow-hidden">
            {firm.quoteRequests.map((q) => (
              <Link
                key={q.id}
                href={`/command/providers/quotes/${q.id}`}
                className="flex items-center justify-between px-3 py-2 border-b border-[#1a1a1a] last:border-0 hover:bg-[#111111] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={q.status} />
                  <div>
                    <p className="text-[12px] text-[#fafafa]">{q.clientName}</p>
                    <p className="text-[11px] text-[#525252]">{q.propertyPostcode}</p>
                  </div>
                </div>
                <p className="text-[11px] text-[#737373] tabular-nums">
                  {q.submittedAt.toISOString().slice(0, 10)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="text-[10px] font-bold text-[#404040] uppercase tracking-widest mb-2">
        {title}
      </p>
      <div className="border border-[#262626] rounded-md bg-[#0f0f0f] p-3">
        {children}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: "pending" | "booked" | "won" | "not_chosen" | "lost" | "expired" }) {
  const map = {
    pending: { text: "Pending", bg: "#1a2540", fg: "#93c5fd" },
    booked: { text: "Booked", bg: "#2a2410", fg: "#fcd34d" },
    won: { text: "Won", bg: "#0c2418", fg: "#86efac" },
    not_chosen: { text: "Not chosen", bg: "#1a1a1a", fg: "#a3a3a3" },
    lost: { text: "Lost", bg: "#2a1010", fg: "#fca5a5" },
    expired: { text: "Expired", bg: "#1a1a1a", fg: "#737373" },
  }[status];
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide"
      style={{ background: map.bg, color: map.fg }}
    >
      {map.text}
    </span>
  );
}
