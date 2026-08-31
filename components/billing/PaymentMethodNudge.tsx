// components/billing/PaymentMethodNudge.tsx
//
// Hub card nudging directors to add a payment method — but ONLY when there is
// a real outsourced charge to pay. Pricing migration (2026-08): self-progress
// is free and there is no trial, so a self-progressing agency is never nudged.
//
// Trigger:
//   - role = director (checked at the call site)
//   - Agency has no stripeCustomerId (no card on file)
//   - AND the agency has at least one outsourced sale that has actually billed
//     (billedAtExchange set) and is NOT the free first outsourced file — i.e.
//     money is genuinely owed. (feeTier="free" comped agencies are never nudged.)
//   - Hides itself otherwise (server-component, returns null)
//
// The client child TrialBannerWithModal owns the banner JSX, the open-modal
// state, and the embedded card-capture modal.

import { prisma } from "@/lib/prisma";
import { TrialBannerWithModal } from "./TrialBannerWithModal";
import { getActiveTermsVersion, hasAcknowledged } from "@/lib/billing/acknowledgement";
import { applyAgencyTermsOverrides } from "@/lib/billing/terms-sections";

export async function PaymentMethodNudge({ agencyId }: { agencyId: string }) {
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      stripeCustomerId: true,
      // Drives the per-agency Charges-section override on the modal's
      // terms step (legacy fixed fee vs canonical sliding scale).
      feeTier: true,
      legacyOutsourcedFeePence: true,
    },
  });
  if (!agency) return null;
  if (agency.feeTier === "free") return null;      // comped plan — never nudge for a card
  if (agency.stripeCustomerId) return null;        // card already on file

  // Only nudge when there's a genuine outsourced charge with no card to pay it:
  // an outsourced sale that has billed and is not the free first file.
  const billableOutsourced = await prisma.propertyTransaction.count({
    where: {
      agencyId,
      serviceType: "outsourced",
      billedAtExchange: { not: null },
      firstOutsourcedFree: false,
      isDemo: false,
    },
  });
  if (billableOutsourced === 0) return null;       // nothing billable yet — no nudge

  // Pre-resolve pricing-terms state so the modal can render the terms
  // step inline (instead of letting CardCaptureForm hit a 409 from the
  // SetupIntent endpoint and surfacing the bare "Pricing terms not yet
  // acknowledged" error).
  const activeTerms = await getActiveTermsVersion();
  const termsAcknowledged = activeTerms
    ? await hasAcknowledged(agencyId, activeTerms.id)
    : false;
  const sections = applyAgencyTermsOverrides(
    activeTerms?.sections ?? [],
    agency,
  );

  // Server component — reads the unprefixed key (matches lib/stripe.ts +
  // the settings billing page + the Vercel env var the founder set up).
  // The earlier NEXT_PUBLIC_ variant drifted from that convention and
  // resolved to "" at runtime, tripping CardCaptureForm's empty-key guard.
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY ?? "";
  return (
    <TrialBannerWithModal
      publishableKey={publishableKey}
      termsAcknowledged={termsAcknowledged}
      termsVersionId={activeTerms?.id ?? null}
      termsVersionTag={activeTerms?.versionTag ?? null}
      termsSections={sections}
    />
  );
}
