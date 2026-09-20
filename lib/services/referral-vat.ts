// Resolve the VAT treatment to snapshot onto a file for each referral income,
// from the agency's Partners defaults. Referral income for a VAT-registered
// agency is always VATable, so the only question is how the figure was keyed —
// `plus` (ex VAT, added on top) or `inc` (already includes VAT). We fall back to
// `plus` (the common +VAT convention) when no default is stored.
//
// The snapshot is taken at write time (create / referral edit) so a later change
// to a firm's default never silently restates a file that was already saved.

import { prisma } from "@/lib/prisma";
import type { FeeVatTreatment } from "@prisma/client";

export async function resolveSolicitorReferralVat(
  agencyId: string,
  solicitorFirmId: string | null | undefined,
): Promise<FeeVatTreatment> {
  if (!solicitorFirmId) return "plus";
  const rec = await prisma.agencyRecommendedSolicitor.findFirst({
    where: { agencyId, solicitorFirmId },
    select: { defaultReferralFeeVat: true },
  });
  return rec?.defaultReferralFeeVat ?? "plus";
}

// Broker default is agency-level (one preferred broker per agency), so it isn't
// keyed by firm — the buyer and onward-broker referrals share it.
export async function resolveBrokerReferralVat(agencyId: string): Promise<FeeVatTreatment> {
  const pref = await prisma.agencyPreferredBroker.findUnique({
    where: { agencyId },
    select: { defaultReferralFeeVat: true },
  });
  return pref?.defaultReferralFeeVat ?? "plus";
}
