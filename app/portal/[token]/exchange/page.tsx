import { notFound } from "next/navigation";
import Link from "next/link";
import { getPortalData, getPortalMilestones } from "@/lib/services/portal";
import { P } from "@/components/portal/portal-ui";

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

type ChecklistItem = { text: string; sub?: string };
type InfoItem = { title: string; body: string };

const VENDOR_CHECKLIST: ChecklistItem[] = [
  { text: "Book your removal company",              sub: "Good firms fill up 2–3 weeks in advance — book now if you haven't already" },
  { text: "Notify utility providers of your moving date", sub: "Contact gas, electricity, water, and broadband with your completion date" },
  { text: "Give notice to your broadband provider", sub: "Arrange transfer or cancellation — most need at least 2 weeks notice" },
  { text: "Update your address",                    sub: "Bank, DVLA, HMRC, GP, employer, pension providers, and subscriptions" },
  { text: "Set up a Post Office mail redirect",     sub: "A safety net for anything you miss — set up at least a week before completion" },
  { text: "Prepare for meter readings",             sub: "Note down each meter's location — gas, electricity, and water — ready for moving day" },
  { text: "Confirm what's staying",                 sub: "Check your fixtures and fittings list with your solicitor — leave agreed items in place" },
  { text: "Start packing non-essentials",           sub: "Books, off-season clothes, anything you won't need before completion day" },
];

const PURCHASER_CHECKLIST: ChecklistItem[] = [
  { text: "Confirm buildings insurance is active",  sub: "Legal responsibility transferred to you at exchange — check your policy covers your completion date" },
  { text: "Book your removal company",              sub: "The best firms fill up fast — if you haven't booked, do it today" },
  { text: "Order broadband at your new address",    sub: "Most providers need 2+ weeks to get you connected — order now to avoid living without internet" },
  { text: "Arrange contents insurance",             sub: "Get contents insurance in place for your new home from completion day" },
  { text: "Set up a Post Office mail redirect",     sub: "Covers you for anything that gets sent to your old address after you move" },
  { text: "Start updating your address",            sub: "Bank, DVLA, HMRC, GP, employer, pension, subscriptions — start the list now" },
  { text: "Plan your moving day logistics",         sub: "Keys are usually available from midday — plan your arrival time accordingly" },
  { text: "Consider getting the locks changed",     sub: "Previous owners may have spare keys — a locksmith costs £100–200 and is worth it for peace of mind" },
];

const VENDOR_WHAT_TO_KNOW: InfoItem[] = [
  {
    title: "Your solicitor is preparing the completion statement",
    body: "This sets out the final sale price, their fees, the mortgage redemption amount, and your net proceeds. Review it carefully when it arrives.",
  },
  {
    title: "On completion day, stay available",
    body: "Your solicitor manages the transfer of funds electronically. Keep your phone on in case they need to reach you — completion can happen any time during business hours.",
  },
  {
    title: "You can't pull out without a financial penalty",
    body: "From exchange, if you withdraw from the sale you'll likely forfeit the buyer's deposit and may face a claim for damages. The completion date is binding.",
  },
  {
    title: "If the buyer requests a date change",
    body: "Any change to the completion date after exchange must be agreed by both sides through both solicitors. It requires a deed of variation and both parties must consent.",
  },
];

const PURCHASER_WHAT_TO_KNOW: InfoItem[] = [
  {
    title: "Your deposit is now in your solicitor's client account",
    body: "It will be transferred to the seller's solicitor on completion day. You'll need to transfer the remaining balance (purchase price minus deposit) shortly before completion.",
  },
  {
    title: "On completion day, keep your phone on",
    body: "Your solicitor will call you when they've received confirmation that funds have been transferred and completion has happened. Keys are usually available from midday.",
  },
  {
    title: "You can't pull out without a financial penalty",
    body: "From exchange, if you withdraw from the purchase you'll lose your deposit and may face a claim for damages. The completion date is fixed and binding.",
  },
  {
    title: "Transfer the remaining balance in good time",
    body: "Your solicitor will tell you exactly how much to send and when. Allow a few days for bank transfers — this must be cleared funds before completion day.",
  },
  {
    title: "Mortgage offer validity",
    body: "Check your mortgage offer has not expired. Most offers are valid for 6 months. If completion is close to expiry, contact your broker or lender immediately.",
  },
];

export default async function PortalExchangePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPortalData(token);
  if (!data) notFound();

  const { contact, transaction } = data;
  const side = contact.roleType === "vendor" ? "vendor" : "purchaser";
  const milestones = await getPortalMilestones(transaction.id, side);

  const hasExchanged = milestones.some(
    (m) => (m.code === "VM12" || m.code === "PM16") && m.isComplete
  );
  if (!hasExchanged) {
    return (
      <div className="text-center py-16 px-4">
        <p className="text-[15px]" style={{ color: P.textSecondary }}>
          This guide will be available once contracts have been exchanged.
        </p>
        <Link href={`/portal/${token}`} className="block mt-4 text-[14px] font-semibold" style={{ color: P.primary }}>
          Back to overview
        </Link>
      </div>
    );
  }

  const isVendor = side === "vendor";
  const saleWord = isVendor ? "sale" : "purchase";
  const checklist = isVendor ? VENDOR_CHECKLIST : PURCHASER_CHECKLIST;
  const whatToKnow = isVendor ? VENDOR_WHAT_TO_KNOW : PURCHASER_WHAT_TO_KNOW;

  const completionDate = transaction.completionDate;
  const days = completionDate
    ? Math.round((new Date(completionDate).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="space-y-5">

      {/* ── Banner ────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl px-5 py-6"
        style={{ background: P.heroGradient, boxShadow: P.heroGlow }}
      >
        <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-white/70 mb-2">
          Exchange guide
        </p>
        <h1 className="text-[24px] font-bold text-white leading-tight mb-1">
          {transaction.propertyAddress}
        </h1>
        <p className="text-[14px] text-white/80">
          Contracts exchanged — your {saleWord} is legally committed
        </p>
        {completionDate && days !== null && (
          <div
            className="mt-4 rounded-xl px-4 py-3 flex items-center justify-between"
            style={{ background: "rgba(255,255,255,0.18)" }}
          >
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">Completion date</p>
              <p className="text-[15px] font-semibold text-white mt-0.5">{fmtDate(completionDate)}</p>
            </div>
            {days >= 0 && (
              <div className="text-right">
                {days === 0 ? (
                  <p className="text-[20px] font-bold text-white">Today!</p>
                ) : (
                  <>
                    <p className="text-[32px] font-black text-white leading-none tabular-nums">{days}</p>
                    <p className="text-[11px] text-white/70 font-semibold uppercase tracking-wide">
                      {days === 1 ? "day to go" : "days to go"}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Checklist ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: P.cardBg, boxShadow: P.shadowMd }}>
        <div className="px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${P.border}` }}>
          <p className="text-[16px] font-bold" style={{ color: P.textPrimary }}>
            Things to do before completion
          </p>
          <p className="text-[13px] mt-0.5" style={{ color: P.textMuted }}>
            Do these as soon as possible — don't leave them to the last minute
          </p>
        </div>
        {checklist.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-4 px-5 py-4"
            style={{ borderBottom: i < checklist.length - 1 ? `1px solid ${P.border}` : undefined }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: P.primaryBg }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={P.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold leading-snug" style={{ color: P.textPrimary }}>
                {item.text}
              </p>
              {item.sub && (
                <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: P.textMuted }}>
                  {item.sub}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── What to know ──────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: P.cardBg, boxShadow: P.shadowSm }}>
        <div className="px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${P.border}` }}>
          <p className="text-[16px] font-bold" style={{ color: P.textPrimary }}>What to know</p>
          <p className="text-[13px] mt-0.5" style={{ color: P.textMuted }}>
            Key things about the period between exchange and completion
          </p>
        </div>
        {whatToKnow.map((item, i) => (
          <div
            key={i}
            className="px-5 py-4"
            style={{ borderBottom: i < whatToKnow.length - 1 ? `1px solid ${P.border}` : undefined }}
          >
            <p className="text-[14px] font-semibold mb-1" style={{ color: P.textPrimary }}>
              {item.title}
            </p>
            <p className="text-[13px] leading-relaxed" style={{ color: P.textSecondary }}>
              {item.body}
            </p>
          </div>
        ))}
      </div>

      {/* ── Back ──────────────────────────────────────────────────────── */}
      <Link
        href={`/portal/${token}`}
        className="flex items-center justify-center gap-2 py-4 rounded-2xl text-[14px] font-semibold"
        style={{ background: P.cardBg, boxShadow: P.shadowSm, color: P.accent }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Back to overview
      </Link>

    </div>
  );
}
