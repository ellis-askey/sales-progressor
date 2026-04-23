import { notFound } from "next/navigation";
import Link from "next/link";
import { getPortalData, getPortalMilestones } from "@/lib/services/portal";
import { P } from "@/components/portal/portal-ui";

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function fmtPrice(p: number) {
  return "£" + p.toLocaleString("en-GB");
}

type ChecklistItem = { text: string; sub?: string };

const VENDOR_CHECKLIST: ChecklistItem[] = [
  { text: "Read all utility meters",                  sub: "Gas, electricity, and water — take a photo of each meter as a record" },
  { text: "Leave all keys, fobs, and remotes",        sub: "Gate remotes, alarm codes, window/door keys — leave everything at the property" },
  { text: "Leave appliance manuals and warranties",   sub: "Boiler, kitchen appliances, and any installed systems" },
  { text: "Leave service and guarantee records",      sub: "Damp-proofing, window installation, FENSA certificates, boiler service history" },
  { text: "Clear the property completely",            sub: "Remove all personal items and rubbish — the buyer is entitled to vacant possession" },
];

const PURCHASER_CHECKLIST: ChecklistItem[] = [
  { text: "Collect keys from your agent",             sub: "Usually available from midday once your solicitor confirms completion — call ahead" },
  { text: "Read all utility meters immediately",      sub: "Gas, electricity, and water — take photos and note the readings on arrival" },
  { text: "Check buildings insurance is active",      sub: "This should have been arranged at exchange — confirm the policy is in force from today" },
  { text: "Check what's been left for you",           sub: "Manuals, warranties, and service records should be at the property" },
];

const VENDOR_BEFORE_CHECKLIST: ChecklistItem[] = [
  { text: "Confirm post redirect is in place",        sub: "Post Office redirect — covers anything sent to your old address" },
  { text: "Final packing and moving",                 sub: "Ensure the property will be fully cleared before completion time" },
  { text: "Cancel direct debits for this address",    sub: "Council tax, water rates, building insurance — check nothing is still being taken" },
];

const PURCHASER_BEFORE_CHECKLIST: ChecklistItem[] = [
  { text: "Transfer the remaining balance",           sub: "Your solicitor will tell you the exact amount and timing — allow a few days for clearing" },
  { text: "Confirm broadband is ordered",             sub: "If not already arranged, order it now — even a short delay can leave you without internet for weeks" },
  { text: "Check your address change list",           sub: "Bank, DVLA, HMRC, GP, employer, pension, subscriptions — notify them all" },
  { text: "Post Office redirect active",              sub: "Set this up if you haven't already — covers anything sent to your old address" },
];

const VENDOR_NEXT_STEPS = [
  {
    title: "Completion statement from your solicitor",
    body: "Your solicitor will send a completion statement showing the final sale price, their fees, mortgage redemption, and any other deductions. Net proceeds should arrive in your bank within a working day.",
  },
  {
    title: "Mortgage redemption confirmation",
    body: "Your lender will write to confirm your mortgage has been fully redeemed. Keep this letter — you may need it for tax or financial records.",
  },
  {
    title: "Capital gains tax (if applicable)",
    body: "If the property was not your primary residence, you may have a capital gains tax liability. Your solicitor or accountant can advise — any CGT must be reported to HMRC within 60 days of completion.",
  },
  {
    title: "Keep your paperwork",
    body: "Store your completion statement, transfer deed, and any other legal documents safely. You may need them years from now if questions arise about the property or for inheritance planning.",
  },
];

const PURCHASER_NEXT_STEPS = [
  {
    title: "Land Registry registration",
    body: "Your solicitor is registering your ownership at HM Land Registry. This can take several months but they manage it — you'll receive a copy of the official title register once complete.",
  },
  {
    title: "Stamp Duty Land Tax",
    body: "If SDLT applied to your purchase, your solicitor will have filed the return and paid any tax from completion funds. You'll receive a confirmation receipt — keep it with your records.",
  },
  {
    title: "Mortgage confirmation",
    body: "Your lender will send a welcome letter confirming your mortgage account is open and your first payment date. Check the amount and set up a direct debit if not already done.",
  },
  {
    title: "Council Tax registration",
    body: "Contact your local council to register for Council Tax at your new address. They'll also need to be told about any discounts (e.g. single person discount).",
  },
  {
    title: "Keep your paperwork",
    body: "Store your completion statement, mortgage offer, and title documents safely. These are important legal and financial records you may need for future remortgages or when you eventually sell.",
  },
];

export default async function PortalCompletePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPortalData(token);
  if (!data) notFound();

  const { contact, transaction } = data;
  const side     = contact.roleType === "vendor" ? "vendor" : "purchaser";
  const milestones = await getPortalMilestones(transaction.id, side);

  const completionMilestone = milestones.find(
    (m) => (m.code === "VM13" || m.code === "PM17") && m.isComplete
  );
  if (!completionMilestone) {
    // Not yet complete — redirect home
    return (
      <div className="text-center py-16 px-4">
        <p className="text-[15px]" style={{ color: P.textSecondary }}>
          This page will be available once your transaction completes.
        </p>
        <Link href={`/portal/${token}`} className="block mt-4 text-[14px] font-semibold" style={{ color: P.primary }}>
          Back to overview
        </Link>
      </div>
    );
  }

  const isVendor      = side === "vendor";
  const checklist     = isVendor ? VENDOR_CHECKLIST : PURCHASER_CHECKLIST;
  const beforeList    = isVendor ? VENDOR_BEFORE_CHECKLIST : PURCHASER_BEFORE_CHECKLIST;
  const nextSteps     = isVendor ? VENDOR_NEXT_STEPS : PURCHASER_NEXT_STEPS;
  const saleWord   = isVendor ? "sale" : "purchase";
  const completionDate = completionMilestone.eventDate ?? completionMilestone.completedAt;

  return (
    <div className="space-y-5">

      {/* ── Banner ──────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl px-5 py-6"
        style={{
          background: "linear-gradient(135deg, #10B981 0%, #34D399 100%)",
          boxShadow: "0 8px 32px rgba(16,185,129,0.30)",
        }}
      >
        <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-white/70 mb-2">
          {isVendor ? "Sale complete" : "Purchase complete"}
        </p>
        <h1 className="text-[26px] font-bold text-white leading-tight mb-1">
          {transaction.propertyAddress}
        </h1>
        {completionDate && (
          <p className="text-[14px] text-white/80">
            Completed {fmtDate(completionDate)}
          </p>
        )}
        {transaction.purchasePrice && (
          <div
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl"
            style={{ background: "rgba(255,255,255,0.18)" }}
          >
            <span className="text-[13px] text-white/70 font-medium">
              {isVendor ? "Sale price" : "Purchase price"}
            </span>
            <span className="text-[15px] font-bold text-white">
              {fmtPrice(transaction.purchasePrice)}
            </span>
          </div>
        )}
      </div>

      {/* ── Before completion checklist ─────────────────────────────── */}
      {beforeList.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: P.cardBg, boxShadow: P.shadowMd }}>
          <div className="px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${P.border}` }}>
            <p className="text-[16px] font-bold" style={{ color: P.textPrimary }}>
              Last things to check
            </p>
            <p className="text-[13px] mt-0.5" style={{ color: P.textMuted }}>
              These should have been set up after exchange — confirm they're in place
            </p>
          </div>
          {beforeList.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-4 px-5 py-4"
              style={{ borderBottom: i < beforeList.length - 1 ? `1px solid ${P.border}` : undefined }}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: P.warningBg }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={P.warning} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold leading-snug" style={{ color: P.textPrimary }}>{item.text}</p>
                {item.sub && <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: P.textMuted }}>{item.sub}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Day-of checklist ────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: P.cardBg, boxShadow: P.shadowMd }}>
        <div className="px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${P.border}` }}>
          <p className="text-[16px] font-bold" style={{ color: P.textPrimary }}>
            {isVendor ? "On the day — before you hand over the keys" : "On the day — when you pick up the keys"}
          </p>
        </div>
        {checklist.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-4 px-5 py-4"
            style={{ borderBottom: i < checklist.length - 1 ? `1px solid ${P.border}` : undefined }}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: P.successBg }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={P.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold leading-snug" style={{ color: P.textPrimary }}>{item.text}</p>
              {item.sub && <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: P.textMuted }}>{item.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* ── What happens next ────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: P.cardBg, boxShadow: P.shadowSm }}>
        <div className="px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${P.border}` }}>
          <p className="text-[16px] font-bold" style={{ color: P.textPrimary }}>What happens next</p>
          <p className="text-[13px] mt-0.5" style={{ color: P.textMuted }}>
            After completion, your solicitor handles these automatically
          </p>
        </div>
        {nextSteps.map((step, i) => (
          <div
            key={i}
            className="px-5 py-4"
            style={{ borderBottom: i < nextSteps.length - 1 ? `1px solid ${P.border}` : undefined }}
          >
            <p className="text-[14px] font-semibold mb-1" style={{ color: P.textPrimary }}>
              {step.title}
            </p>
            <p className="text-[13px] leading-relaxed" style={{ color: P.textSecondary }}>
              {step.body}
            </p>
          </div>
        ))}
      </div>

      {/* ── Key info strip ───────────────────────────────────────────── */}
      <div
        className="rounded-2xl px-5 py-4"
        style={{ background: P.primaryBg, border: `1px solid rgba(255,107,74,0.15)` }}
      >
        <p className="text-[13px] font-semibold mb-1" style={{ color: P.primaryText }}>
          Keep this portal bookmarked
        </p>
        <p className="text-[13px] leading-relaxed" style={{ color: P.textSecondary }}>
          Your full transaction timeline — every milestone, update, and message from your team — is saved here.
          You can always come back to review it.
        </p>
      </div>

      {/* ── Back link ───────────────────────────────────────────────── */}
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
