// /command/providers/quotes/[id] — full detail of a client-submitted quote
// request. Shows the request, the linked sale, the email sent, and the
// status controls (won / lost / expired / reopen + referral fee tracking).

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { commandDb } from "@/lib/command/prisma";
import { getProviderLogoUrl } from "@/lib/supabase-storage";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { StatusControls } from "./StatusControls";

export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) redirect("/dashboard");

  const { id } = await params;

  const quote = await commandDb.quoteRequest.findUnique({
    where: { id },
    include: {
      provider: true,
      serviceType: true,
      transaction: { select: { id: true, propertyAddress: true, agencyId: true } },
      statusChangedBy: { select: { name: true, email: true } },
    },
  });

  if (!quote) notFound();

  const logoUrl = getProviderLogoUrl(quote.provider.logoPath);

  const emailLog = quote.emailMessageId
    ? await commandDb.outboundEmailQueue.findFirst({
        where: { sourceId: `quote:${quote.id}` },
        select: { sentAt: true, deliveredAt: true, bouncedAt: true, blockedAt: true, errorAt: true, errorMessage: true, recipientEmail: true },
      })
    : null;

  return (
    <div>
      <Link
        href="/command/providers/quotes"
        className="inline-flex items-center gap-1 text-[11px] text-[#525252] hover:text-[#a3a3a3] transition-colors mb-3"
      >
        <ChevronLeft className="w-3 h-3" /> Quote inbox
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[20px] font-semibold text-[#fafafa] tracking-tight">
            {quote.clientName}
          </h1>
          <p className="text-[13px] text-[#737373] mt-0.5">
            {quote.propertyAddress}
          </p>
          <p className="text-[11px] text-[#525252] mt-0.5 tabular-nums">
            Submitted {quote.submittedAt.toISOString().slice(0, 16).replace("T", " ")}
          </p>
        </div>
        <StatusBadge status={quote.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          <Section title="Request">
            <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 text-[12px]">
              <Row label="Service type" value={quote.serviceType.label} />
              <Row label="Urgency" value={quote.urgency.replace("_", " ")} />
              <Row label="Contact by" value={quote.contactMethod} />
              <Row label="Best time" value={quote.contactWindow} />
              <Row label="Postcode" value={quote.propertyPostcode} mono />
              <Row label="Outward" value={quote.propertyOutwardCode} mono />
            </dl>
            {quote.notes && (
              <div className="mt-3 pt-3 border-t border-[#1f1f1f]">
                <p className="text-[10px] font-semibold text-[#525252] uppercase tracking-widest mb-1">Client notes</p>
                <p className="text-[13px] text-[#d4d4d4] whitespace-pre-wrap">{quote.notes}</p>
              </div>
            )}
          </Section>

          <Section title="Client contact">
            <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 text-[12px]">
              <Row label="Name" value={quote.clientName} />
              <Row label="Email" value={quote.clientEmail} mono />
              {quote.clientPhone && <Row label="Phone" value={quote.clientPhone} mono />}
            </dl>
            <p className="text-[10px] text-[#525252] mt-3">
              Snapshotted at submit time. Contact record may have changed since.
            </p>
          </Section>

          <Section title="Linked sale">
            <Link
              href={`/agent/transactions/${quote.transaction.id}`}
              className="inline-flex items-center gap-1.5 text-[13px] text-[#93c5fd] hover:text-[#bfdbfe] transition-colors"
            >
              {quote.transaction.propertyAddress}
              <ExternalLink className="w-3 h-3" />
            </Link>
          </Section>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Section title="Firm">
            <div className="flex items-start gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="w-12 h-12 rounded object-cover bg-[#1a1a1a] flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded bg-[#1a1a1a] border border-[#262626] flex items-center justify-center flex-shrink-0">
                  <span className="text-[14px] font-semibold text-[#525252]">{quote.provider.name.slice(0, 1).toUpperCase()}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <Link
                  href={`/command/providers/${quote.provider.id}`}
                  className="text-[13px] font-semibold text-[#fafafa] hover:text-[#93c5fd] transition-colors"
                >
                  {quote.provider.name}
                </Link>
                <p className="text-[11px] text-[#a3a3a3] font-mono">{quote.provider.email}</p>
                {quote.provider.phone && <p className="text-[11px] text-[#737373]">{quote.provider.phone}</p>}
              </div>
            </div>
          </Section>

          <Section title="Email delivery">
            {emailLog ? (
              <dl className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-1.5 text-[12px]">
                <Row label="To" value={emailLog.recipientEmail} mono />
                {emailLog.sentAt && <Row label="Sent" value={emailLog.sentAt.toISOString().slice(0, 16).replace("T", " ")} />}
                {emailLog.deliveredAt && <Row label="Delivered" value={emailLog.deliveredAt.toISOString().slice(0, 16).replace("T", " ")} good />}
                {emailLog.bouncedAt && <Row label="Bounced" value={emailLog.bouncedAt.toISOString().slice(0, 16).replace("T", " ")} bad />}
                {emailLog.blockedAt && <Row label="Blocked" value={emailLog.blockedAt.toISOString().slice(0, 16).replace("T", " ")} bad />}
                {emailLog.errorAt && <Row label="Error" value={emailLog.errorMessage ?? "Unknown"} bad />}
              </dl>
            ) : (
              <p className="text-[12px] text-[#737373] italic">No email log row found (may have sent inline).</p>
            )}
          </Section>

          <Section title="Status">
            <StatusControls
              id={quote.id}
              status={quote.status}
              saleFeePence={quote.saleFeePence}
              referralFeePence={quote.referralFeePence}
              referralFeeCollected={quote.referralFeeCollected}
              statusReason={quote.statusReason}
              statusChangedAt={quote.statusChangedAt}
              statusChangedByName={quote.statusChangedBy?.name ?? null}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="text-[10px] font-bold text-[#404040] uppercase tracking-widest mb-2">{title}</p>
      <div className="border border-[#262626] rounded-md bg-[#0f0f0f] p-3">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  mono,
  good,
  bad,
}: {
  label: string;
  value: string;
  mono?: boolean;
  good?: boolean;
  bad?: boolean;
}) {
  return (
    <>
      <dt className="text-[#525252] uppercase text-[10px] tracking-widest font-semibold">{label}</dt>
      <dd
        className={`${good ? "text-[#86efac]" : bad ? "text-[#fca5a5]" : "text-[#fafafa]"} ${mono ? "font-mono text-[11.5px]" : ""} capitalize-none`}
      >
        {value}
      </dd>
    </>
  );
}

function StatusBadge({ status }: { status: "pending" | "won" | "lost" | "expired" }) {
  const map = {
    pending: { text: "Pending", bg: "#1a2540", fg: "#93c5fd" },
    won: { text: "Won", bg: "#0c2418", fg: "#86efac" },
    lost: { text: "Lost", bg: "#2a1010", fg: "#fca5a5" },
    expired: { text: "Expired", bg: "#1a1a1a", fg: "#737373" },
  }[status];
  return (
    <span
      className="text-[10px] font-semibold px-2.5 py-1 rounded uppercase tracking-wide flex-shrink-0"
      style={{ background: map.bg, color: map.fg }}
    >
      {map.text}
    </span>
  );
}
