// app/(billing-chrome)/agent/polish/billing-hub-v2/page.tsx
//
// Stage 2 polish, v2 reframe. Same content and data as v1
// (/agent/polish/billing-hub) — re-housed onto the near-document
// environment via the (billing-chrome) route group, which escapes the
// working-app shell. Compare side-by-side with v1.
//
// State toggle (?state=...) preserved from v1 — same five seeded
// agencies. v1 is left intact and untouched at its original URL.

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentMonthRunningTotal } from "@/lib/billing/running-total";
import { getLifetimeMetrics } from "@/lib/billing/lifetime";
import { getTrialState } from "@/lib/billing/trial-state";
import { getActiveTermsVersion } from "@/lib/billing/acknowledgement";
import { getPaymentBlockState } from "@/lib/billing/payment-block";
import { billingMonthRange } from "@/lib/billing/period";
import { POLISH_STATES, StateToggle, type PolishStateKey } from "@/components/billing/hub/StateToggle";
import { PaymentBlockBanner } from "@/components/billing/PaymentBlockBanner";
import { RedesignedDisclosure } from "@/components/billing/hub/RedesignedDisclosure";
import { MetricsStrip } from "@/components/billing/v2/MetricsStrip";
import { BuildingInvoiceHero } from "@/components/billing/v2/BuildingInvoiceHero";
import { InvoiceHistoryLines } from "@/components/billing/v2/InvoiceHistoryLines";
import { PaymentMethodPlain } from "@/components/billing/v2/PaymentMethodPlain";
import { PlanTermsCollapsed } from "@/components/billing/v2/PlanTermsCollapsed";

function isValidState(s: string): s is PolishStateKey {
  return POLISH_STATES.some((x) => x.key === s);
}

function monthLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    month: "long",
    year: "numeric",
  }).format(d);
}

export default async function BillingHubV2PolishPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const params = await searchParams;
  const stateKey: PolishStateKey =
    params.state && isValidState(params.state) ? params.state : "populated";
  const stateConfig = POLISH_STATES.find((s) => s.key === stateKey)!;

  const agency = await prisma.agency.findFirst({
    where: { name: stateConfig.agency },
    select: { id: true, name: true, stripeCustomerId: true },
  });
  if (!agency) return notFound();

  const [runningTotal, lifetime, trialState, terms, _blockState, historyRows, trialFilesThisMonth] =
    await Promise.all([
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
          select: {
            id: true,
            propertyAddress: true,
            exchangedAt: true,
            serviceType: true,
            purchasePrice: true,
            priceAtExchange: true,
          },
          orderBy: { exchangedAt: "asc" },
        });
      })(),
    ]);
  void _blockState;

  const ack = terms
    ? await prisma.pricingAcknowledgement.findFirst({
        where: { agencyId: agency.id, termsVersionId: terms.id },
        orderBy: { acknowledgedAt: "desc" },
        select: { acknowledgedAt: true },
      })
    : null;

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

  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY ?? "";
  const ackedTerms = ack !== null;

  let paymentPanelProps: React.ComponentProps<typeof PaymentMethodPlain>;
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

  const HAIRLINE = "0.5px solid rgba(0,0,0,0.08)";

  return (
    <div
      style={{
        maxWidth: 880,
        margin: "0 auto",
        padding: "32px 24px 64px",
        display: "flex",
        flexDirection: "column",
        gap: 40,
      }}
    >
      {/* Polish-only state toggle */}
      <StateToggle activeKey={stateKey} />

      {/* Conditional payment-block banner */}
      <PaymentBlockBanner agencyId={agency.id} />

      {/* Metrics strip — light, context-not-hero */}
      <MetricsStrip
        thisMonthPence={runningTotal.totalPence}
        exchangesThisMonth={runningTotal.lines.length}
        inHouseThisMonth={runningTotal.inHouseCount}
        outsourcedThisMonth={runningTotal.outsourcedCount}
        savedViaTrialLifetimePence={lifetime.savedViaTrialLifetimePence}
        trialExchangeCountLifetime={lifetime.trialExchangeCountLifetime}
        billedLifetimePence={lifetime.billedLifetimePence}
      />

      {/* THE hero — building invoice with felt liveness */}
      <BuildingInvoiceHero
        periodLabel={monthLabel(runningTotal.monthStart)}
        lines={buildingLines}
        subtotalPence={runningTotal.subtotalPence}
        creditsAppliedPence={runningTotal.pendingCreditPence}
        totalPence={runningTotal.totalPence - runningTotal.pendingCreditPence}
        hidePreviewButton={buildingLines.length === 0}
      />

      <div style={{ borderTop: HAIRLINE }} />
      <InvoiceHistoryLines rows={historyRowsForUI} />

      <div style={{ borderTop: HAIRLINE }} />
      <PaymentMethodPlain {...paymentPanelProps} />

      <div style={{ borderTop: HAIRLINE }} />
      <PlanTermsCollapsed
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

      {terms && !ackedTerms && (
        <>
          <div style={{ borderTop: HAIRLINE }} />
          <RedesignedDisclosure
            termsVersionId={terms.id}
            termsVersionTag={terms.versionTag}
            termsSections={terms.sections}
          />
        </>
      )}

      <p
        style={{
          fontSize: 11,
          color: "#9ca3af",
          textAlign: "center",
          marginTop: 12,
        }}
      >
        Polish test page · v2 reframe · do not transplant to /agent/billing until walked
      </p>
    </div>
  );
}
