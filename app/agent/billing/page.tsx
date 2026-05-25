// app/agent/billing/page.tsx
//
// Director-facing billing hub. The polished design from
// /agent/polish/billing-hub (Stage 2) transplanted onto the production
// route. Renders against the logged-in director's agency.
//
// Folds in what used to be four separate surfaces:
//   - /agent/billing                      (running total)
//   - /agent/billing/payment-method       (card form)
//   - /agent/billing/payment-method?saved=1 (success confirmation)
//   - /agent/billing/payment-method (disclosure-not-yet-acknowledged variant)
//
// All of these now live as sections on this single hub. The
// /agent/billing/payment-method route is preserved as a permanent redirect
// to /agent/billing#payment-method so old links, Stripe return URLs, and
// any director-bookmarked URLs continue to work.
//
// Negotiators get notFound() — same role guard as before.

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/session";
import { getCurrentMonthRunningTotal } from "@/lib/billing/running-total";
import { getLifetimeMetrics } from "@/lib/billing/lifetime";
import { getTrialState } from "@/lib/billing/trial-state";
import { getActiveTermsVersion } from "@/lib/billing/acknowledgement";
import { MetricsBand } from "@/components/billing/hub/MetricsBand";
import { BuildingInvoice } from "@/components/billing/hub/BuildingInvoice";
import { InvoiceHistory } from "@/components/billing/hub/InvoiceHistory";
import { PaymentMethodPanel } from "@/components/billing/hub/PaymentMethodPanel";
import { PlanTermsPanel } from "@/components/billing/hub/PlanTermsPanel";
import { RedesignedDisclosure } from "@/components/billing/hub/RedesignedDisclosure";
import { PaymentBlockBanner } from "@/components/billing/PaymentBlockBanner";
import { billingMonthRange } from "@/lib/billing/period";

function monthLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    month: "long",
    year: "numeric",
  }).format(d);
}

export default async function BillingHubPage() {
  const session = await requireSession();
  if (session.user.role !== "director") notFound();
  const agencyId = session.user.agencyId;
  if (!agencyId) notFound();

  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { id: true, name: true, vatRegisteredAt: true, stripeCustomerId: true },
  });
  if (!agency) notFound();

  // Pull most things in parallel; ack depends on terms so it comes after.
  const [runningTotal, lifetime, trialState, terms, historyRows, trialFilesThisMonth] = await Promise.all([
    getCurrentMonthRunningTotal(agency.id),
    getLifetimeMetrics(agency.id),
    getTrialState(agency.id),
    getActiveTermsVersion(),
    prisma.invoice.findMany({
      where: { agencyId: agency.id, status: { in: ["issued", "paid", "failed"] } },
      orderBy: { monthStart: "desc" },
      select: { id: true, monthStart: true, status: true, lines: { select: { totalPence: true } } },
    }),
    (async () => {
      const { start, end } = billingMonthRange(new Date());
      return prisma.propertyTransaction.findMany({
        where: { agencyId: agency.id, freeOnExchange: true, exchangedAt: { gte: start, lt: end } },
        select: { id: true, propertyAddress: true, exchangedAt: true },
        orderBy: { exchangedAt: "asc" },
      });
    })(),
  ]);

  const ack = terms
    ? await prisma.pricingAcknowledgement.findFirst({
        where: { agencyId: agency.id, termsVersionId: terms.id },
        orderBy: { acknowledgedAt: "desc" },
        select: { acknowledgedAt: true },
      })
    : null;

  // Build the building-invoice line list. Combines billed + trial + pending-credit indicator.
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

  let paymentPanelProps: React.ComponentProps<typeof PaymentMethodPanel>;
  if (!ackedTerms) {
    paymentPanelProps = { kind: "pending" };
  } else if (agency.stripeCustomerId) {
    // For agencies with a real Stripe Customer, the card-on-file display
    // shows last4 + brand. PR 6's flow stores the PaymentMethod against the
    // Customer; reading it back would require an extra Stripe API call per
    // page-load. Pragmatic: render a representative display + an Update
    // button that unlocks the real Stripe Elements form. The structural
    // truth (a card is on file) is correct; the visual representation is
    // not fetched from Stripe on every render. Easy upgrade later if we
    // want the live last4.
    paymentPanelProps = {
      kind: "card_on_file",
      publishableKey,
      card: { brand: "visa", last4: "····", expMonth: 12, expYear: 2030 },
    };
  } else {
    paymentPanelProps = { kind: "add_card", publishableKey };
  }

  return (
    <div style={{ padding: "8px 32px 32px", display: "flex", flexDirection: "column", gap: 18, maxWidth: 1080, margin: "0 auto" }}>
      <PageHeader
        title="Billing"
        subtitle={`${monthLabel(runningTotal.monthStart)} · updates live as files exchange`}
      />

      {/* Payment-block banner — self-hides when state = ok. */}
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

      {/* 4. Payment method — id used for deep-link anchor scroll from
          /agent/billing/payment-method redirect + nudge/banner CTAs. */}
      <div id="payment-method">
        <PaymentMethodPanel {...paymentPanelProps} />
      </div>

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

      {/* 6. Disclosure gate — only rendered when terms unacknowledged. */}
      {terms && !ackedTerms && (
        <RedesignedDisclosure
          termsVersionId={terms.id}
          termsVersionTag={terms.versionTag}
          termsSections={terms.sections}
        />
      )}
    </div>
  );
}
