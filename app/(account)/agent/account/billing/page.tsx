// app/(account)/agent/account/billing/page.tsx
//
// Production Billing tab inside the Account area. Re-houses the v2
// polish presentation (/agent/polish/billing-hub-v2) on the real,
// authenticated director's agency — no state toggle, no polish footer.
// Same v2 components, same data flow as /agent/billing — just composed
// onto the Account-shell canvas instead of the working-app glass cards.
//
// The legacy /agent/billing route still serves its v1 glass-card hub
// untouched (Stage 4 retire flips it to a redirect after the rest of
// the Account migration lands).
//
// Role gate: layout (resolveDirectorSession) already ensures only
// directors reach this surface, so no extra check here.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getCurrentMonthRunningTotal } from "@/lib/billing/running-total";
import { getLifetimeMetrics } from "@/lib/billing/lifetime";
import { getTrialState } from "@/lib/billing/trial-state";
import { getActiveTermsVersion } from "@/lib/billing/acknowledgement";
import { billingMonthRange } from "@/lib/billing/period";
import { PaymentBlockBanner } from "@/components/billing/PaymentBlockBanner";
import { RedesignedDisclosure } from "@/components/billing/hub/RedesignedDisclosure";
import { MetricsStrip } from "@/components/billing/v2/MetricsStrip";
import { BuildingInvoiceHero } from "@/components/billing/v2/BuildingInvoiceHero";
import { InvoiceHistoryLines } from "@/components/billing/v2/InvoiceHistoryLines";
import { PaymentMethodPlain } from "@/components/billing/v2/PaymentMethodPlain";
import { PlanTermsCollapsed } from "@/components/billing/v2/PlanTermsCollapsed";

function monthLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    month: "long",
    year: "numeric",
  }).format(d);
}

export default async function AccountBillingPage() {
  const session = await requireSession();
  // Director gate is enforced by the (account) layout, but defence in
  // depth — if a future refactor relaxes the layout gate, this page
  // still 404s for non-directors.
  if (session.user.role !== "director") notFound();
  const agencyId = session.user.agencyId;
  if (!agencyId) notFound();

  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { id: true, name: true, stripeCustomerId: true },
  });
  if (!agency) notFound();

  const [runningTotal, lifetime, trialState, terms, historyRows, trialFilesThisMonth] =
    await Promise.all([
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
      card: { brand: "visa", last4: "····", expMonth: 12, expYear: 2030 },
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
      <PaymentBlockBanner agencyId={agency.id} />

      <MetricsStrip
        thisMonthPence={runningTotal.totalPence}
        exchangesThisMonth={runningTotal.lines.length}
        inHouseThisMonth={runningTotal.inHouseCount}
        outsourcedThisMonth={runningTotal.outsourcedCount}
        savedViaTrialLifetimePence={lifetime.savedViaTrialLifetimePence}
        trialExchangeCountLifetime={lifetime.trialExchangeCountLifetime}
        billedLifetimePence={lifetime.billedLifetimePence}
      />

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
      {/* id used for /agent/billing/payment-method deep-link anchor when
          the legacy route redirects (Stage 4). */}
      <div id="payment-method">
        <PaymentMethodPlain {...paymentPanelProps} />
      </div>

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
    </div>
  );
}
