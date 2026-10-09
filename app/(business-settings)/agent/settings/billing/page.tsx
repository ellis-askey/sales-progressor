// /agent/settings/billing — what the progression business pays TSP for the
// platform: £59 base + £39 per extra team member + £5 per completed sale.
//
// DARK by design (founder, 2026-10-03): this shows the bill but no money is taken
// yet — collection (the Stripe subscription + charging) lands behind a billing
// switch, exactly like the agency billing. The copy makes that clear so a pilot
// owner isn't surprised. Owner-gated.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { progressionBusinessesEnabled, progressionBillingCollectEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { businessBillingActive, getBusinessFirstChargePreview, getBusinessPlanSchedule } from "@/lib/progression/business-stripe";
import { getBusinessBillingSummary } from "@/lib/progression/business-billing";
import { getBusinessPaymentState } from "@/lib/progression/business-dunning";
import { getDefaultCard } from "@/lib/stripe";
import { fmtCurrencyPence } from "@/lib/utils";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { Receipt, CreditCard } from "@phosphor-icons/react/dist/ssr";
import { BusinessPaymentMethod } from "@/components/progression/BusinessPaymentMethod";
import { CancelPlanButton } from "@/components/progression/CancelPlanButton";
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
  // The saved card (brand + last4) once billing is active, so we show it rather
  // than an empty entry form.
  const savedCard = hasCard
    ? await (async () => {
        const biz = await prisma.progressionBusiness.findUnique({ where: { id: owner.businessId }, select: { stripeCustomerId: true } });
        return biz?.stripeCustomerId ? getDefaultCard(biz.stripeCustomerId) : null;
      })()
    : null;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY ?? "";
  // Returned from a 3-D Secure card save (Stripe appends redirect_status to the
  // return URL). The card is already saved; BusinessCardCapture then starts the
  // subscription on mount instead of re-showing the empty form.
  const sp = await searchParams;
  const justReturned = sp.saved === "1" && sp.redirect_status !== "failed";
  // Returned from a 3-D Secure attempt that FAILED — show a "try again" message
  // rather than a silent empty form.
  const authFailed = sp.saved === "1" && sp.redirect_status === "failed";
  // Is the plan scheduled to end (owner hit Cancel)? Read live from Stripe so the
  // page reflects the cancellation rather than still reading "live".
  const planSchedule = collecting && hasCard ? await getBusinessPlanSchedule(owner.businessId) : null;
  const endingLabel = planSchedule?.cancelAtPeriodEnd && planSchedule.endsAt
    ? planSchedule.endsAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" })
    : null;
  // Dunning: once a card is on file, is a payment failing? (grace / blocked)
  const paymentState = collecting && hasCard ? await getBusinessPaymentState(owner.businessId) : ({ kind: "ok" } as const);
  const paymentFailing = paymentState.kind === "warning" || paymentState.kind === "blocked";
  const graceDate =
    paymentState.kind === "warning"
      ? paymentState.gracePeriodEndsAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Europe/London" })
      : null;
  // The two charge moments this card shows are NOT one bill: the subscription is
  // taken on the 1st; the £5-per-sale lines accrue now and ride the NEXT invoice
  // (the 1st of next month). monthEnd is midnight on the 1st of next month (London).
  const nextChargeLabel = s.monthEnd.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Europe/London" });
  const nextMonthLabel = s.monthEnd.toLocaleDateString("en-GB", { month: "long", timeZone: "Europe/London" });
  const subscriptionPence = s.basePence + s.seatsPence;
  const subscriptionLines = s.lines.filter((l) => l.kind !== "per_sale");

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
        ) : paymentState.kind === "blocked" ? (
          <SettingsNote
            tone="danger"
            title="Adding sales is paused"
            body="A payment is overdue. Update your card below to start adding sales again. Files already in progress keep running as normal."
          />
        ) : paymentState.kind === "warning" ? (
          <SettingsNote
            tone="warning"
            title="We couldn't take your last payment"
            body={`Update your card by ${graceDate} to keep adding sales. We'll keep retrying it in the meantime.`}
          />
        ) : endingLabel ? (
          <SettingsNote
            tone="warning"
            title={`Your plan ends on ${endingLabel}`}
            body="You'll keep access until then, and we won't charge you again after that. Changed your mind? Keep your plan below."
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
          {preview ? (
            // No card yet: the first charge is pro-rated for the rest of the month —
            // this genuinely IS one amount, taken the moment they add a card.
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "11px 0" }}>
                <span style={{ fontSize: 13, color: "var(--agent-text-secondary)" }}>
                  Subscription, pro-rated for {preview.daysLeft} {preview.daysLeft === 1 ? "day" : "days"} of {preview.monthLabel}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                  {fmtCurrencyPence(preview.dueTodayPence)}
                </span>
              </div>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                padding: "13px 0 2px", marginTop: 4, borderTop: "1px solid var(--agent-border-default, rgba(0,0,0,0.12))",
              }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>Due when you add a card</span>
                <span style={{ fontSize: 17, fontWeight: 820, color: "var(--agent-text-primary)", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>
                  {fmtCurrencyPence(preview.dueTodayPence)}
                </span>
              </div>
              <p style={{ margin: "14px 0 0", fontSize: 11.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
                This is your first, partial month. From {preview.nextPaymentLabel} it&apos;s £59 on the 1st of each month, plus £5 per sale and £39 per extra team member added that month.
              </p>
            </div>
          ) : (
            // Live plan: two SEPARATE charge moments, shown apart so the page never
            // implies one combined bill. Subscription comes out on the 1st; the £5
            // per-sale lines accrue now and ride the next invoice.
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Subscription — charged on the 1st */}
              <div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>Subscription</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)" }}>{hasCard ? "Taken on the 1st" : "Billed on the 1st"}</span>
                </div>
                {subscriptionLines.map((line, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "9px 0", borderTop: i === 0 ? "none" : "0.5px solid var(--agent-border-subtle)" }}>
                    <span style={{ fontSize: 13, color: "var(--agent-text-secondary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line.description}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{fmtCurrencyPence(line.amountPence)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "10px 0 0", marginTop: 2, borderTop: "1px solid var(--agent-border-default, rgba(0,0,0,0.12))" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>{hasCard ? "Already taken this month" : "Per month"}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "var(--agent-text-primary)", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>{fmtCurrencyPence(subscriptionPence)}</span>
                </div>
              </div>

              {/* Per-sale — accrues now, charged on the next invoice */}
              <div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>Sales added this month</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)" }}>On your {nextMonthLabel} invoice</span>
                </div>
                {s.saleCount === 0 ? (
                  <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
                    No sales added yet this month. Each sale is £5 and will appear here when added.
                  </p>
                ) : (
                  <>
                    {s.lines.filter((l) => l.kind === "per_sale").map((line, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "9px 0", borderTop: i === 0 ? "none" : "0.5px solid var(--agent-border-subtle)" }}>
                        <span style={{ fontSize: 13, color: "var(--agent-text-secondary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line.description}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{fmtCurrencyPence(line.amountPence)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "10px 0 0", marginTop: 2, borderTop: "1px solid var(--agent-border-default, rgba(0,0,0,0.12))" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>{s.saleCount} {s.saleCount === 1 ? "sale" : "sales"} · added {nextChargeLabel}</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: "var(--agent-text-primary)", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>{fmtCurrencyPence(s.perSalePence)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </AccountCard>

        {/* Payment method — only once collection is live (C1). Until then the
            page is display-only and the notice above explains no card is asked for. */}
        {collecting && (
          <AccountCard
            icon={<CreditCard size={18} weight="bold" />}
            title="Payment method"
            subtitle={savedCard ? "The card we charge each month for your subscription and any sales you add." : "Add the card we'll charge each month for your subscription and any sales you add."}
          >
            <BusinessPaymentMethod card={savedCard} active={hasCard} failed={paymentFailing} publishableKey={publishableKey} justReturned={justReturned} authFailed={authFailed} addSaleHref="/agent/transactions/new" />
          </AccountCard>
        )}

        {/* Cancel plan — only when there's an active plan to cancel. No remove-card;
            cancelling collects accrued £5s then stops at period-end. */}
        {hasCard && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <CancelPlanButton scheduledToCancel={!!endingLabel} />
          </div>
        )}
      </div>
    </>
  );
}
