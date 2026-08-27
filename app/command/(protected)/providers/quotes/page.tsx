// /command/providers/quotes — inbox of client-submitted quote requests.
//
// Filter by status (?status=pending|won|lost|expired) or by firm
// (?firmId=xxx). Default: pending, newest first.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";
import { getProviderLogoUrl } from "@/lib/supabase-storage";
import { ChevronLeft } from "lucide-react";
import type { QuoteRequestStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_TABS: { key: QuoteRequestStatus | "all"; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "booked", label: "Booked" },
  { key: "won", label: "Won" },
  { key: "not_chosen", label: "Not chosen" },
  { key: "lost", label: "Lost" },
  { key: "expired", label: "Expired" },
  { key: "all", label: "All" },
];

const ALL_STATUSES: QuoteRequestStatus[] = ["pending", "booked", "won", "not_chosen", "lost", "expired"];

function isStatus(s: string): s is QuoteRequestStatus {
  return (ALL_STATUSES as string[]).includes(s);
}

export default async function QuoteInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; firmId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) redirect("/dashboard");

  const params = await searchParams;
  const activeStatus = params.status && (isStatus(params.status) || params.status === "all")
    ? params.status
    : "pending";
  const firmId = params.firmId || undefined;

  const where = {
    ...(activeStatus !== "all" && isStatus(activeStatus) ? { status: activeStatus } : {}),
    ...(firmId ? { providerId: firmId } : {}),
  };

  const [rows, counts, firmContext] = await Promise.all([
    commandDb.quoteRequest.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      take: 100,
      include: {
        provider: { select: { id: true, name: true, logoPath: true } },
        serviceType: { select: { label: true } },
        // A survey quote from a vendor contact is for their onward purchase
        // (sellers don't survey the property they're selling) — flag it.
        contact: { select: { roleType: true } },
      },
    }),
    commandDb.quoteRequest.groupBy({
      by: ["status"],
      where: firmId ? { providerId: firmId } : {},
      _count: { _all: true },
    }),
    firmId
      ? commandDb.providerFirm.findUnique({ where: { id: firmId }, select: { name: true } })
      : Promise.resolve(null),
  ]);

  const countByStatus = new Map(counts.map((c) => [c.status, c._count._all]));

  return (
    <div>
      <Link
        href="/command/providers"
        className="inline-flex items-center gap-1 text-[11px] text-[#525252] hover:text-[#a3a3a3] transition-colors mb-3"
      >
        <ChevronLeft className="w-3 h-3" /> All providers
      </Link>

      <h1 className="text-[20px] font-semibold text-[#fafafa] tracking-tight mb-1">
        Quote requests {firmContext && <span className="text-[#737373] font-normal">· {firmContext.name}</span>}
      </h1>
      <p className="text-[13px] text-[#737373] mb-5">
        Client-submitted requests routed to the firm's email + Ellis. Update
        status here to fuel win-rate and referral-fee tracking.
      </p>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 border-b border-[#1f1f1f]">
        {STATUS_TABS.map((t) => {
          const isActive = t.key === activeStatus;
          const count = t.key === "all"
            ? counts.reduce((sum, c) => sum + c._count._all, 0)
            : (countByStatus.get(t.key as QuoteRequestStatus) ?? 0);
          const params = new URLSearchParams();
          params.set("status", t.key);
          if (firmId) params.set("firmId", firmId);
          return (
            <Link
              key={t.key}
              href={`/command/providers/quotes?${params.toString()}`}
              className={`px-3 py-2 text-[12px] font-semibold transition-colors border-b-2 -mb-px ${
                isActive
                  ? "text-[#93c5fd] border-[#2563eb]"
                  : "text-[#525252] border-transparent hover:text-[#a3a3a3]"
              }`}
            >
              {t.label} <span className="ml-1 text-[11px] tabular-nums opacity-70">{count}</span>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="px-3 py-8 rounded-md border border-dashed border-[#262626] bg-[#0f0f0f] text-center">
          <p className="text-[12px] text-[#737373]">
            No {activeStatus === "all" ? "" : activeStatus} quote requests{firmContext && ` for ${firmContext.name}`}.
          </p>
        </div>
      ) : (
        <div className="border border-[#262626] rounded-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#111111] border-b border-[#262626]">
              <tr>
                <th className="text-[10px] font-bold text-[#525252] uppercase tracking-widest px-3 py-2 text-left">Client</th>
                <th className="text-[10px] font-bold text-[#525252] uppercase tracking-widest px-3 py-2 text-left">Firm</th>
                <th className="text-[10px] font-bold text-[#525252] uppercase tracking-widest px-3 py-2 text-left">Service</th>
                <th className="text-[10px] font-bold text-[#525252] uppercase tracking-widest px-3 py-2 text-left">Postcode</th>
                <th className="text-[10px] font-bold text-[#525252] uppercase tracking-widest px-3 py-2 text-left">Urgency</th>
                <th className="text-[10px] font-bold text-[#525252] uppercase tracking-widest px-3 py-2 text-right">Submitted</th>
                <th className="text-[10px] font-bold text-[#525252] uppercase tracking-widest px-3 py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const logoUrl = getProviderLogoUrl(r.provider.logoPath);
                return (
                  <tr key={r.id} className="border-b border-[#1a1a1a] last:border-0 hover:bg-[#111111] transition-colors">
                    <td className="px-3 py-2">
                      <Link href={`/command/providers/quotes/${r.id}`} className="block">
                        <p className="text-[12px] text-[#fafafa] hover:text-[#93c5fd] transition-colors">{r.clientName}</p>
                        <p className="text-[10px] text-[#525252]">{r.clientEmail}</p>
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {logoUrl ? (
                          <img src={logoUrl} alt="" className="w-5 h-5 rounded object-cover bg-[#1a1a1a] flex-shrink-0" />
                        ) : (
                          <div className="w-5 h-5 rounded bg-[#1a1a1a] border border-[#262626] flex items-center justify-center flex-shrink-0">
                            <span className="text-[9px] font-semibold text-[#525252]">{r.provider.name.slice(0, 1).toUpperCase()}</span>
                          </div>
                        )}
                        <span className="text-[11px] text-[#d4d4d4]">{r.provider.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-[#a3a3a3]">{r.serviceType.label}</td>
                    <td className="px-3 py-2 text-[11px] font-mono text-[#a3a3a3]">
                      <span>{r.propertyPostcode}</span>
                      {r.contact?.roleType === "vendor" && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-sans font-semibold uppercase tracking-wide bg-[#1e3a8a]/40 text-[#93c5fd] align-middle">
                          Onward
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-[#a3a3a3] capitalize">{r.urgency.replace("_", " ")}</td>
                    <td className="px-3 py-2 text-[11px] text-[#737373] text-right tabular-nums">
                      {r.submittedAt.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-3 py-2 text-right"><StatusBadge status={r.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length === 100 && (
        <p className="text-[11px] text-[#525252] mt-2 text-center">Showing latest 100. Refine with filters.</p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: QuoteRequestStatus }) {
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
