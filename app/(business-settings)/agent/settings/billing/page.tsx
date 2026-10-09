// /agent/settings/billing — what the progression business pays TSP for the
// platform: £59 base + £39 per extra team member + £5 per completed sale.
//
// DARK by design (founder, 2026-10-03): this shows the bill but no money is taken
// yet — collection (the Stripe subscription + charging) lands behind a billing
// switch, exactly like the agency billing. The copy makes that clear so a pilot
// owner isn't surprised. Owner-gated.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled, progressionBillingCollectEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { businessBillingActive } from "@/lib/progression/business-stripe";
import { getBusinessBillingSummary, getBusinessFirstChargePreview } from "@/lib/progression/business-billing";
import { fmtCurrencyPence } from "@/lib/utils";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { Receipt, CreditCard } from "@phosphor-icons/react/dist/ssr";
import { BusinessCardCapture } from "@/components/progression/BusinessCardCapture";
import { SettingsNote } from "@/components/ui/SettingsNote";

export default async function BusinessBillingPage({ searchParams }: { searchParams: Promise<{ saved?: string; redirect_status?: string }> }) {
  if (!progressionBusinessesEnabled()) notFound();
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) notFound();

  const s = await getBusinessBillingSummary(owner.businessId);
  // monthStart is the UTC instant for midnight-on-the-1st in London, which is
  // the previous calendar day in UTC during BST — so render the label in London
  // time or it reads a month early (e.g. "September" on 1–25 October).
  const month = s.monthStart.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "Europe/London" });
  const collecting = progressionBillingCollectEnabled();
  // "Plan is live" is only true once a card is actually on file (a Stripe
  // subscription exists). Collecting-on with no card is NOT live — it still needs a
  // card, so the notice must say so rather than claim it's charging.
  const hasCard = await businessBillingActive(owner.businessId);
  // Before a card is on file, the first charge is pro-rated for the rest of the
  // month (not the full £59) — so show that honestly instead of the flat monthly.
  const preview = collecting && !hasCard ? await getBusinessFirstChargePreview(owner.businessId) : null;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY ?? "";
  // Returned from a 3-D Secure card save (Stripe appends redirect_status to the
  // return URL). The card is already saved; BusinessCardCapture then starts the
  // subscription on mount instead of re-showing the empty form.
  const sp = await searchParams;
  const justReturned = sp.saved === "1" && sp.redirect_status !== "failed";

  return (
    <>
      <AccountPageHeader
        title="Billing"
        subtitle="What your business pays for using Sales Progressor."
        backLabel="Back to progression"
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Billing-status notice — three states: not collecting yet, collecting but
            no card (needs one), or live (card on file). */}
        {!collecting ? (
          <SettingsNote
            tone="info"
            title="No payment yet"
            body="This is what your plan currently works out to. We'll let you know and ask you to add a card before billing begins."
          />
        ) : hasCard ? (
          <SettingsNote
            tone="success"
            title="Your plan is live"
            body="We'll charge the card on file each month for your subscription and any sales added during that billing period."
          />
        ) : (
          <SettingsNote
            tone="warning"
            title="Add a card to activate your plan"
            body="Your plan isn't active yet. Add a card below and we'll start it. You can't add sales until a card is on file."
          />
        )}

        <AccountCard
          icon={<Receipt size={18} weight="bold" />}
          title={`This month · ${month}`}
          subtitle="£59 for your account, £39 for each additional team member, plus £5 per sale added."
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            {preview ? (
              // No card yet: the first charge is pro-rated for the rest of the month.
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "11px 0",
              }}>
                <span style={{ fontSize: 13, color: "var(--agent-text-secondary)" }}>
                  Subscription — pro-rated for {preview.daysLeft} {preview.daysLeft === 1 ? "day" : "days"} of {preview.monthLabel}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                  {fmtCurrencyPence(preview.dueTodayPence)}
                </span>
              </div>
            ) : (
              s.lines.map((line, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                  padding: "11px 0", borderTop: i === 0 ? "none" : "0.5px solid var(--agent-border-subtle)",
                }}>
                  <span style={{ fontSize: 13, color: "var(--agent-text-secondary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {line.description}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                    {fmtCurrencyPence(line.amountPence)}
                  </span>
                </div>
              ))
            )}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
              padding: "13px 0 2px", marginTop: 4, borderTop: "1px solid var(--agent-border-default, rgba(0,0,0,0.12))",
            }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>
                {preview ? "Due when you add a card" : "Total this month"}
              </span>
              <span style={{ fontSize: 17, fontWeight: 820, color: "var(--agent-text-primary)", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>
                {fmtCurrencyPence(preview ? preview.dueTodayPence : s.totalPence)}
              </span>
            </div>
          </div>
          <p style={{ margin: "14px 0 0", fontSize: 11.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
            {preview
              ? `This is your first, partial month. From ${preview.nextPaymentLabel} it's £59 on the 1st of each month, plus £5 per sale and £39 per extra team member added that month.`
              : s.saleCount === 0
                ? "No sales added yet this month. Each sale is £5 and will appear here when added."
                : `${s.saleCount} ${s.saleCount === 1 ? "sale" : "sales"} added this month · £5 each`}
          </p>
        </AccountCard>

        {/* Payment method — only once collection is live (C1). Until then the
            page is display-only and the notice above explains no card is asked for. */}
        {collecting && (
          <AccountCard
            icon={<CreditCard size={18} weight="bold" />}
            title="Payment method"
            subtitle="Add the card we'll charge each month for your subscription and any sales you add."
          >
            <BusinessCardCapture publishableKey={publishableKey} justReturned={justReturned} />
          </AccountCard>
        )}
      </div>
    </>
  );
}
