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
import { formatGBP } from "@/lib/command/revenue";
import InfoTip from "@/components/command/shared/InfoTip";
import { ChevronLeft } from "lucide-react";
import type { QuoteRequestStatus } from "@prisma/client";

const STALE_PENDING_DAYS = 7;

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

  const firmScope = firmId ? { providerId: firmId } : {};
  const staleBefore = new Date(Date.now() - STALE_PENDING_DAYS * 86_400_000);

  const [rows, counts, firmContext, referralWon, referralCollected, staleCount] = await Promise.all([
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
      where: firmScope,
      _count: { _all: true },
    }),
    firmId
      ? commandDb.providerFirm.findUnique({ where: { id: firmId }, select: { name: true } })
      : Promise.resolve(null),
    // Referral fees on won quotes (your cut).
    commandDb.quoteRequest.aggregate({
      where: { status: "won", ...firmScope },
      _sum: { referralFeePence: true },
    }),
    commandDb.quoteRequest.aggregate({
      where: { status: "won", referralFeeCollected: true, ...firmScope },
      _sum: { referralFeePence: true },
    }),
    // Pending quotes that have gone cold.
    commandDb.quoteRequest.count({ where: { status: "pending", submittedAt: { lt: staleBefore }, ...firmScope } }),
  ]);

  // Email deliverability for each request's send. Quote emails route through
  // OutboundEmailQueue (sourceId "quote:{id}", emailType PROVIDER_QUOTE) and
  // the SendGrid webhook stamps delivered/bounced/blocked there. One batched
  // read so the inbox can flag a silent bounce or send failure at a glance
  // (the failure mode behind the recent "surveyor quote emails silently
  // failed" fix) without opening each quote.
  const quoteSourceIds = rows.map((r) => `quote:${r.id}`);
  const emailLogs = quoteSourceIds.length
    ? await commandDb.outboundEmailQueue.findMany({
        where: { emailType: "PROVIDER_QUOTE", sourceId: { in: quoteSourceIds } },
        select: { sourceId: true, sentAt: true, deliveredAt: true, bouncedAt: true, blockedAt: true, errorAt: true },
      })
    : [];
  const emailBySource = new Map(emailLogs.map((e) => [e.sourceId, e]));

  const countByStatus = new Map(counts.map((c) => [c.status, c._count._all]));
  const n = (s: QuoteRequestStatus) => countByStatus.get(s) ?? 0;
  const wonN = n("won"), notChosenN = n("not_chosen"), lostN = n("lost"), bookedN = n("booked");
  const decidedN = wonN + notChosenN + lostN;
  const winRate = decidedN > 0 ? Math.round((wonN / decidedN) * 100) : null;
  const totalN = counts.reduce((sum, c) => sum + c._count._all, 0);
  const referralEarnedPence = referralWon._sum.referralFeePence ?? 0;
  const referralCollectedPence = referralCollected._sum.referralFeePence ?? 0;
  const referralOutstandingPence = referralEarnedPence - referralCollectedPence;

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

      {/* Win-rate + referral summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-5">
        <QuoteStat
          label="Win rate"
          value={winRate == null ? "—" : `${winRate}%`}
          sub={winRate == null ? "no decisions yet" : `${wonN} of ${decidedN} decided`}
          tip="Quotes won as a share of decided ones (won ÷ won + not chosen + lost). Pending, booked and expired don't count as decisions."
        />
        <QuoteStat
          label="Referral earned"
          value={formatGBP(referralEarnedPence)}
          sub={`${wonN} won quote${wonN === 1 ? "" : "s"}`}
          tip="Your referral cut (about 10%) across all won quotes. Recorded when you mark a quote won."
        />
        <QuoteStat label="Collected" value={formatGBP(referralCollectedPence)} sub="marked paid to you" />
        <QuoteStat
          label="Outstanding"
          value={formatGBP(referralOutstandingPence)}
          sub="won, not yet collected"
          tone={referralOutstandingPence > 0 ? "warn" : "default"}
          tip="Referral fees you've earned but not yet marked collected."
        />
        <QuoteStat
          label="Funnel"
          value={`${totalN} → ${bookedN + wonN} → ${wonN}`}
          sub="submitted → booked → won"
          tip="How many requests reached each stage. Booked+ counts anything that got booked, including those later won."
        />
      </div>

      {staleCount > 0 && (
        <div className="mb-4 px-3 py-2 rounded-md border border-[#3a2a10] bg-[#1a1305] text-[12px] text-[#fcd34d]">
          {staleCount} pending quote{staleCount === 1 ? "" : "s"} {staleCount === 1 ? "has" : "have"} gone quiet ({STALE_PENDING_DAYS}+ days). Chase the firm or update the status.
        </div>
      )}

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
                <th className="text-[10px] font-bold text-[#525252] uppercase tracking-widest px-3 py-2 text-right">Email</th>
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
                    <td className="px-3 py-2 text-[11px] text-right tabular-nums">
                      {(() => {
                        const isStale = r.status === "pending" && r.submittedAt < staleBefore;
                        const days = Math.floor((Date.now() - r.submittedAt.getTime()) / 86_400_000);
                        return (
                          <span className={isStale ? "text-[#fcd34d]" : "text-[#737373]"}>
                            {r.submittedAt.toISOString().slice(0, 10)}
                            {isStale && <span className="ml-1.5">· {days}d cold</span>}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2 text-right"><EmailDeliveryBadge log={emailBySource.get(`quote:${r.id}`)} /></td>
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

function QuoteStat({
  label,
  value,
  sub,
  tone = "default",
  tip,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "default" | "warn";
  tip?: string;
}) {
  return (
    <div className="px-3 py-2.5 rounded-md border border-[#262626] bg-[#0f0f0f]">
      <p className="text-[10px] font-bold text-[#525252] uppercase tracking-widest mb-1 flex items-center gap-1">
        {label}
        {tip && <InfoTip label={label}>{tip}</InfoTip>}
      </p>
      <p className={`text-[18px] font-semibold tabular-nums leading-none ${tone === "warn" && value !== "£0" ? "text-[#fcd34d]" : "text-[#fafafa]"}`}>{value}</p>
      <p className="text-[10px] text-[#525252] mt-1">{sub}</p>
    </div>
  );
}

// Delivery outcome of the quote-request email, read off the linked
// OutboundEmailQueue row. Failure states (send error / bounce / block) take
// precedence over delivered so a silent failure never hides behind a stale
// "delivered". No linked row means it sent inline before tracking, or wasn't
// emailed — shown as a quiet dash rather than a false negative.
function EmailDeliveryBadge({
  log,
}: {
  log?: { sentAt: Date | null; deliveredAt: Date | null; bouncedAt: Date | null; blockedAt: Date | null; errorAt: Date | null };
}) {
  if (!log) return <span className="text-[11px] text-[#525252]">—</span>;
  const state = log.errorAt
    ? { text: "Failed", bg: "#2a1010", fg: "#fca5a5" }
    : log.bouncedAt
    ? { text: "Bounced", bg: "#2a1010", fg: "#fca5a5" }
    : log.blockedAt
    ? { text: "Blocked", bg: "#2a1010", fg: "#fca5a5" }
    : log.deliveredAt
    ? { text: "Delivered", bg: "#0c2418", fg: "#86efac" }
    : log.sentAt
    ? { text: "Sent", bg: "#1a2540", fg: "#93c5fd" }
    : { text: "Queued", bg: "#1a1a1a", fg: "#a3a3a3" };
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide"
      style={{ background: state.bg, color: state.fg }}
    >
      {state.text}
    </span>
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
