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
import { getActiveTermsVersion } from "@/lib/billing/acknowledgement";
import { applyAgencyTermsOverrides } from "@/lib/billing/terms-sections";
import { billingMonthRange } from "@/lib/billing/period";
import { PaymentBlockBanner } from "@/components/billing/PaymentBlockBanner";
import { RedesignedDisclosure } from "@/components/billing/hub/RedesignedDisclosure";
import { MetricsStrip } from "@/components/billing/v2/MetricsStrip";
import { BuildingInvoiceHero } from "@/components/billing/v2/BuildingInvoiceHero";
import { InvoiceHistoryLines } from "@/components/billing/v2/InvoiceHistoryLines";
import { PaymentMethodPlain } from "@/components/billing/v2/PaymentMethodPlain";
import { PlanTermsCollapsed } from "@/components/billing/v2/PlanTermsCollapsed";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { getDefaultCard } from "@/lib/stripe";
import { getSignedUrlMap } from "@/lib/supabase-storage";
import { getProgressorsForAgency } from "@/lib/progression/inviting";
import type { ClientFeeModel } from "@/lib/progression/client-fees";

// A progression company's rate card as a short one-line label for the billing
// plan card. They bill the agency off-platform at their own rate, not TSP's.
function describeFeeModel(m: ClientFeeModel | null): string {
  if (!m) return "Rate not set";
  if (m.type === "flat") return `£${Math.round(m.pence / 100)} per sale`;
  if (m.type === "percent") {
    const pct = m.bps / 100;
    return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}% of the sale`;
  }
  if (m.type === "tenure") {
    return `£${Math.round(m.freeholdPence / 100)} freehold / £${Math.round(m.leaseholdPence / 100)} leasehold`;
  }
  const fees = m.bands.map((b) => b.pence).filter((p) => p > 0);
  if (!fees.length) return "Rate not set";
  const min = Math.round(Math.min(...fees) / 100);
  const max = Math.round(Math.max(...fees) / 100);
  return min === max ? `£${min} per sale` : `£${min}–£${max} by band`;
}

function monthLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    month: "long",
    year: "numeric",
  }).format(d);
}

// Split a fee bandLabel ("Outsourced — up to £349,999") into the service
// name + a muted sub-descriptor ("Outsourced" / "Up to £349,999"), matching
// the invoice-content mock. Also drops the em-dash from the displayed string.
function splitService(kind: string, bandLabel: string): { label: string; sub?: string } {
  if (/self-progress/i.test(bandLabel)) return { label: "Self-progress", sub: "Free" };
  const label = kind === "in_house_fee" ? "In-house" : "Outsourced";
  const dash = bandLabel.indexOf("—");
  let sub = dash >= 0 ? bandLabel.slice(dash + 1).trim() : bandLabel;
  sub = sub.charAt(0).toUpperCase() + sub.slice(1);
  return { label, sub };
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
    select: {
      id: true,
      name: true,
      stripeCustomerId: true,
      // Used by applyAgencyTermsOverrides to swap the Charges section text
      // for legacy agencies on their fixed fee.
      feeTier: true,
      legacyOutsourcedFeePence: true,
    },
  });
  if (!agency) notFound();

  // External progression companies this agency works with. When present, the
  // plan card shows their rate(s) instead of TSP's own outsourcing price, and
  // (if they've never been billed by TSP) we drop the "add a card" nudge.
  const progressorLinks = await getProgressorsForAgency(agencyId);
  const progressors = progressorLinks.map((p) => ({ name: p.name, rate: describeFeeModel(p.feeModel) }));

  const [runningTotal, lifetime, terms, historyRows, trialFilesThisMonth] =
    await Promise.all([
      getCurrentMonthRunningTotal(agency.id),
      getLifetimeMetrics(agency.id),
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

  // Apply the agency-tier override on the Charges section. Legacy agencies
  // see their fixed fee; sliding-tier agencies see the canonical scale.
  const termsSectionsForAgency = terms
    ? applyAgencyTermsOverrides(terms.sections, agency)
    : [];

  const ack = terms
    ? await prisma.pricingAcknowledgement.findFirst({
        where: { agencyId: agency.id, termsVersionId: terms.id },
        orderBy: { acknowledgedAt: "desc" },
        select: { acknowledgedAt: true },
      })
    : null;

  // Per-line file metadata for the address popover (property photo + added date).
  const lineTxIds = runningTotal.lines.map((l) => l.transactionId);
  const lineMetaRows = lineTxIds.length
    ? await prisma.propertyTransaction.findMany({
        where: { id: { in: lineTxIds } },
        select: { id: true, createdAt: true, photoStoragePath: true },
      })
    : [];
  const linePhotoMap = await getSignedUrlMap(lineMetaRows.map((m) => m.photoStoragePath));
  const lineMetaById = new Map(
    lineMetaRows.map((m) => [
      m.id,
      { addedAt: m.createdAt, photoUrl: m.photoStoragePath ? linePhotoMap.get(m.photoStoragePath) ?? null : null },
    ]),
  );

  const buildingLines = [
    ...runningTotal.lines.map((l) => {
      const s = splitService(l.kind, l.bandLabel);
      return {
        transactionId: l.transactionId,
        exchangedAt: l.exchangedAt,
        address: l.propertyAddress,
        serviceLabel: s.label,
        serviceSub: s.sub,
        totalPence: l.totalPence,
        variant: "normal" as const,
        fileHref: `/agent/transactions/${l.transactionId}`,
        addedAt: lineMetaById.get(l.transactionId)?.addedAt ?? null,
        photoUrl: lineMetaById.get(l.transactionId)?.photoUrl ?? null,
      };
    }),
    ...trialFilesThisMonth.map((t) => ({
      transactionId: t.id,
      exchangedAt: t.exchangedAt!,
      address: t.propertyAddress,
      serviceLabel: "Trial",
      serviceSub: "Free",
      totalPence: 0,
      variant: "trial" as const,
    })),
    ...(runningTotal.pendingCreditPence > 0
      ? [{
          transactionId: "_credit_",
          exchangedAt: new Date(),
          address: "Pending credit (applies next month)",
          serviceLabel: "Credit",
          serviceSub: undefined,
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

  // No card is needed for an agency that only self-progresses (free) and sends
  // its other files to external progression companies (billed by them, not TSP):
  // they can never generate a TSP invoice to fail. Show a reassuring note rather
  // than an "add a card" nudge, unless they've actually been billed by TSP or
  // already hold a card.
  const showNoCardNeeded =
    ackedTerms &&
    progressors.length > 0 &&
    lifetime.billedLifetimePence === 0 &&
    !agency.stripeCustomerId;

  let paymentPanelProps: React.ComponentProps<typeof PaymentMethodPlain>;
  if (!ackedTerms) {
    paymentPanelProps = { kind: "pending" };
  } else if (agency.stripeCustomerId) {
    // Read the real card from Stripe; null when Stripe isn't configured here
    // (shows "Card on file" rather than fabricated placeholder digits).
    const realCard = await getDefaultCard(agency.stripeCustomerId);
    paymentPanelProps = { kind: "card_on_file", publishableKey, card: realCard };
  } else {
    paymentPanelProps = { kind: "add_card", publishableKey };
  }

  return (
    <>
      <AccountPageHeader
        title="Billing"
        subtitle="Manage your charges, invoices and payment method."
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <PaymentBlockBanner agencyId={agency.id} />

        <MetricsStrip
          thisMonthPence={runningTotal.totalPence}
          exchangesThisMonth={runningTotal.lines.length}
          inHouseThisMonth={runningTotal.inHouseCount}
          outsourcedThisMonth={runningTotal.outsourcedCount}
          savedViaTrialLifetimePence={lifetime.savedViaTrialLifetimePence}
          trialExchangeCountLifetime={lifetime.trialExchangeCountLifetime}
          billedLifetimePence={lifetime.billedLifetimePence}
          invoiceCount={historyRowsForUI.length}
        />

        <AccountCard>
          <BuildingInvoiceHero
            periodLabel={monthLabel(runningTotal.monthStart)}
            lines={buildingLines}
            subtotalPence={runningTotal.subtotalPence}
            creditsAppliedPence={runningTotal.pendingCreditPence}
            totalPence={runningTotal.totalPence - runningTotal.pendingCreditPence}
            hidePreviewButton={buildingLines.length === 0}
          />
        </AccountCard>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, alignItems: "start" }}>
          {/* id used for /agent/billing/payment-method deep-link anchor. */}
          <div id="payment-method">
            <AccountCard>
              {showNoCardNeeded ? (
                <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>Payment method</h2>
                  <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                    No payment method needed. Sales you progress yourself are free, and sales handled by an independent progression company are billed directly by them.
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", lineHeight: 1.55 }}>
                    You&apos;ll only need to add a card if you choose to send a sale to TSP&apos;s own progression team.
                  </p>
                </section>
              ) : (
                <PaymentMethodPlain {...paymentPanelProps} />
              )}
            </AccountCard>
          </div>
          <AccountCard>
            <PlanTermsCollapsed
              progressors={progressors}
              agreed={
                terms
                  ? {
                      versionTag: terms.versionTag,
                      sections: termsSectionsForAgency,
                      acknowledgedAt: ack?.acknowledgedAt ?? null,
                    }
                  : null
              }
            />
          </AccountCard>
        </div>

        <AccountCard>
          <InvoiceHistoryLines rows={historyRowsForUI} />
        </AccountCard>

        {terms && !ackedTerms && (
          <AccountCard>
            <RedesignedDisclosure
              termsVersionId={terms.id}
              termsVersionTag={terms.versionTag}
              termsSections={termsSectionsForAgency}
            />
          </AccountCard>
        )}
      </div>
    </>
  );
}
