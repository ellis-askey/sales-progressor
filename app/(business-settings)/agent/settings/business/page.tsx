// /agent/settings/business — the owner's business identity (name + short name).
// Owner-gated (layout + here). Email branding + sender identity land on their own
// tab in PR3; this tab is the business's core identity.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { prisma } from "@/lib/prisma";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { BusinessIdentityForm } from "@/components/progression/BusinessIdentityForm";
import { BusinessVatForm } from "@/components/progression/BusinessVatForm";
import { BusinessBillingPointForm } from "@/components/progression/BusinessBillingPointForm";

export default async function BusinessIdentityPage() {
  if (!progressionBusinessesEnabled()) notFound();
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) notFound();

  const business = await prisma.progressionBusiness.findUnique({
    where: { id: owner.businessId },
    select: { name: true, shortName: true, vatRegisteredAt: true, vatRateBps: true, vatNumber: true, billAtCompletion: true },
  });
  if (!business) notFound();

  return (
    <>
      <AccountPageHeader
        title="Business"
        subtitle="Your business name and how it appears to clients."
        backLabel="Back to progression"
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <BusinessIdentityForm
          initialName={business.name}
          initialShortName={business.shortName ?? ""}
        />
        <BusinessVatForm
          initialRegistered={business.vatRegisteredAt != null}
          initialVatNumber={business.vatNumber ?? ""}
          initialRatePercent={business.vatRateBps != null ? String(business.vatRateBps / 100) : "20"}
        />
        <BusinessBillingPointForm initialBillAtCompletion={business.billAtCompletion} />
      </div>
    </>
  );
}
