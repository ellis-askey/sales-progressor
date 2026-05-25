// app/agent/polish/billing-hub/page.tsx
//
// Stage 2 polish test page for the billing hub redesign. Real data, real
// PDF generation, real Stripe Elements — proven on the polish route before
// transplant onto the production /agent/billing flow.
//
// State toggle (?state=...) swaps which seeded agency the page renders
// against. Five canonical states from the brief:
//   populated      → Hartwell & Partners (VAT-on, rich data, trial + credit)
//   empty          → Marlow & Co (£59 once, otherwise empty)
//   brand-new      → Tidy & Co (no exchanges, still in trial)
//   vat-off        → Marlow & Co (non-VAT, used as the VAT-off comparison)
//   payment-failed → Beacon Estates (blocked state)
//
// All states render against real DB data — toggle via the pill row at top.

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/PageHeader";
import { getCurrentMonthRunningTotal } from "@/lib/billing/running-total";
import { getLifetimeMetrics } from "@/lib/billing/lifetime";
import { getTrialState } from "@/lib/billing/trial-state";
import { getActiveTermsVersion } from "@/lib/billing/acknowledgement";
import { getPaymentBlockState } from "@/lib/billing/payment-block";
import { POLISH_STATES, StateToggle, type PolishStateKey } from "@/components/billing/hub/StateToggle";
import { MetricsBand } from "@/components/billing/hub/MetricsBand";
import { BuildingInvoice } from "@/components/billing/hub/BuildingInvoice";
import { InvoiceHistory } from "@/components/billing/hub/InvoiceHistory";
import { PaymentMethodPanel } from "@/components/billing/hub/PaymentMethodPanel";
import { PlanTermsPanel } from "@/components/billing/hub/PlanTermsPanel";
import { RedesignedDisclosure } from "@/components/billing/hub/RedesignedDisclosure";
import { PaymentBlockBanner } from "@/components/billing/PaymentBlockBanner";
import { billingMonthRange } from "@/lib/billing/period";

function isValidState(s: string): s is PolishStateKey {
  return POLISH_STATES.some((x) => x.key === s);
}

function monthLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", month: "long", year: "numeric",
  }).format(d);
}

export default async function BillingHubPolishPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const params = await searchParams;
  const stateKey: PolishStateKey = params.state && isValidState(params.state) ? params.state : "populated";
  const stateConfig = POLISH_STATES.find((s) => s.key === stateKey)!;

  const agency = await prisma.agency.findFirst({
    where: { name: stateConfig.agency },
    select: { id: true, name: true, vatRegisteredAt: true, stripeCustomerId: true },
  });
  if (!agency) {
    return notFound();
  }

  // Pull most things in parallel; ack depends on terms so it comes after.
  const [runningTotal, lifetime, trialState, terms, _blockState, historyRows, trialFilesThisMonth] = await Promise.all([
    getCurrentMonthRunningTotal(agency.id),
    getLifetimeMetrics(agency.id),
    getTrialState(agency.id),
    getActiveTermsVersion(),
    getPaymentBlockState(agency.id),
    prisma.invoice.findMany({
      where: { agencyId: agency.id, status: { in: ["issued", "paid", "failed"] } },
      orderBy: { monthStart: "desc" },
      select: { id: true, monthStart: true, status: true, lines: { select: { totalPence: true } } },
    }),
    (async () => {
      const { start, end } = billingMonthRange(new Date());
      return prisma.propertyTransaction.findMany({
        where: { agencyId: agency.id, freeOnExchange: true, exchangedAt: { gte: start, lt: end } },
        select: { id: true, propertyAddress: true, exchangedAt: true, serviceType: true, purchasePrice: true, priceAtExchange: true },
        orderBy: { exchangedAt: "asc" },
      });
    })(),
  ]);
  void _blockState; // banner self-fetches; we just need to know it's resolved for SSR consistency

  const ack = terms
    ? await prisma.pricingAcknowledgement.findFirst({
        where: { agencyId: agency.id, termsVersionId: terms.id },
        orderBy: { acknowledgedAt: "desc" },
        select: { acknowledgedAt: true },
      })
    : null;

  // Build the line list for BuildingInvoice (combines billed + trial + credit indicator).
  const buildingLines = [
    ...runningTotal.lines.map((l) => ({
      transactionId: l.transactionId,
      exchangedAt: l.exchangedAt,
      address: l.propertyAddress,
      service: l.bandLabel,
      totalPence: l.totalPence,
      variant: "normal" as const,
    })),
    ...trialFilesThisMonth.map((t) => ({
      transactionId: t.id,
      exchangedAt: t.exchangedAt!,
      address: t.propertyAddress,
      service: "Free — trial",
      totalPence: 0,
      variant: "trial" as const,
    })),
    ...(runningTotal.pendingCreditPence > 0
      ? [{
          transactionId: "_credit_",
          exchangedAt: new Date(),
          address: "Pending credit (applies next month)",
          service: "Credit",
          totalPence: -runningTotal.pendingCreditPence,
          variant: "credit" as const,
        }]
      : []),
  ];

  const historyRowsForUI = historyRows.map((r) => ({
    id: r.id,
    monthLabel: monthLabel(r.monthStart),
    status: r.status as "issued" | "paid" | "failed" | "void",
    totalPence: r.lines.reduce((s, l) => s + l.totalPence, 0),
  }));

  // Payment-method panel state derivation:
  //   - terms unknown / not acknowledged → "pending" (disclosure renders separately)
  //   - acknowledged + no card → "add_card" (real Stripe Elements via existing CardCaptureForm)
  //   - acknowledged + stripeCustomerId set → "card_on_file" with representative display
  // The polish page uses a demo card-on-file representation (Visa ····4242) for
  // agencies whose stripeCustomerId is a seeded fake — we don't hit Stripe API
  // for the display state on every page load. The "Update" button on card_on_file
  // unlocks the real Stripe Elements form, so the actual write-path is fully wired.
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY ?? "";
  const ackedTerms = ack !== null;

  let paymentPanelProps: React.ComponentProps<typeof PaymentMethodPanel>;
  if (!ackedTerms) {
    paymentPanelProps = { kind: "pending" };
  } else if (agency.stripeCustomerId) {
    paymentPanelProps = {
      kind: "card_on_file",
      publishableKey,
      card: { brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 },
    };
  } else {
    paymentPanelProps = { kind: "add_card", publishableKey };
  }

  return (
    <>
      <PageHeader
        title="Billing"
        subtitle={`${monthLabel(runningTotal.monthStart)} · updates live as files exchange`}
      />
      <div className="px-4 md:px-8 py-2 md:py-4" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* State toggle — polish page only. Above the content so the
          reviewer always sees what state they're looking at. */}
      <StateToggle activeKey={stateKey} />

      {/* Payment-block banner — only shown when in warning/blocked state.
          Self-hides when ok. */}
      <PaymentBlockBanner agencyId={agency.id} />

      {/* 1. Metrics band */}
      <MetricsBand
        thisMonthPence={runningTotal.totalPence}
        exchangesThisMonth={runningTotal.lines.length}
        inHouseThisMonth={runningTotal.inHouseCount}
        outsourcedThisMonth={runningTotal.outsourcedCount}
        savedViaTrialLifetimePence={lifetime.savedViaTrialLifetimePence}
        trialExchangeCountLifetime={lifetime.trialExchangeCountLifetime}
        billedLifetimePence={lifetime.billedLifetimePence}
      />

      {/* 2. The building invoice — centrepiece */}
      <BuildingInvoice
        periodLabel={monthLabel(runningTotal.monthStart)}
        status="building"
        lines={buildingLines}
        subtotalPence={runningTotal.subtotalPence}
        vatPence={runningTotal.vatPence}
        vatActive={runningTotal.vatActive}
        creditsAppliedPence={runningTotal.pendingCreditPence}
        totalPence={runningTotal.totalPence - runningTotal.pendingCreditPence}
        hidePreviewButton={buildingLines.length === 0}
      />

      {/* 3. Invoice history */}
      <InvoiceHistory rows={historyRowsForUI} />

      {/* 4. Payment method */}
      <PaymentMethodPanel {...paymentPanelProps} />

      {/* 5. Plan & terms */}
      <PlanTermsPanel
        vatActive={runningTotal.vatActive}
        trialState={trialState}
        agreed={
          terms
            ? {
                versionTag: terms.versionTag,
                sections: terms.sections,
                acknowledgedAt: ack?.acknowledgedAt ?? null,
              }
            : null
        }
      />

      {/* 6. Disclosure gate — shown ONLY when terms unacknowledged. Replaces
          the standalone /agent/billing/payment-method "needs ack" state. */}
      {terms && !ackedTerms && (
        <RedesignedDisclosure
          termsVersionId={terms.id}
          termsVersionTag={terms.versionTag}
          termsSections={terms.sections}
        />
      )}

      <p style={{ fontSize: 11, color: "var(--agent-text-muted)", textAlign: "center", marginTop: 8 }}>
        Polish test page · Stage 2 · do not transplant to /agent/billing until walked
      </p>
      </div>
    </>
  );
}
