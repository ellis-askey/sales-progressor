// components/billing/PaymentMethodNudge.tsx
//
// Hub card nudging directors to add a payment method once their trial window
// has had time to pass naturally. Designed to be unobtrusive: not modal,
// not flashy, not waved-in-face on day one.
//
// Trigger:
//   - role = director (negotiators get the modal flow instead; both checked
//     at the call site)
//   - Agency has no stripeCustomerId yet (no card on file)
//   - AND ONE OF:
//       * standard-tier agency: has firstSubmissionAt AND >= 21 days have
//         elapsed (past the 14-day trial plus a week of grace before we
//         start mentioning billing setup), OR
//       * legacy-tier agency: no trial period for them — gate fires
//         immediately on no-card, even before any submission.
//   - Hides itself otherwise (server-component, returns null)
//
// Server side does the condition check and decides whether to render. The
// client child TrialBannerWithModal owns the banner JSX, the open-modal
// state, and the embedded TrialExpiredModal. This keeps the agency-state
// fetch on the server while letting the trigger live in a client island.

import { prisma } from "@/lib/prisma";
import { TrialBannerWithModal } from "./TrialBannerWithModal";
import { getActiveTermsVersion, hasAcknowledged } from "@/lib/billing/acknowledgement";
import { applyAgencyTermsOverrides } from "@/lib/billing/terms-sections";

const NUDGE_THRESHOLD_MS = 21 * 24 * 60 * 60 * 1000;

export async function PaymentMethodNudge({ agencyId }: { agencyId: string }) {
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      firstSubmissionAt: true,
      stripeCustomerId: true,
      // Drives the per-agency Charges-section override on the modal's
      // terms step (legacy fixed fee vs canonical sliding scale).
      feeTier: true,
      legacyOutsourcedFeePence: true,
    },
  });
  if (!agency) return null;
  if (agency.feeTier === "free") return null;      // free plan — never nudge for a card
  if (agency.stripeCustomerId) return null;       // card already on file

  // Legacy agencies skip the trial-elapsed gate — they're billable from
  // sale 1 per their pre-existing contract, so the moment they have no
  // card on file we want them to see the nudge.
  if (agency.feeTier !== "legacy") {
    if (!agency.firstSubmissionAt) return null;     // never submitted; too early to nudge
    const elapsed = Date.now() - agency.firstSubmissionAt.getTime();
    if (elapsed < NUDGE_THRESHOLD_MS) return null;  // inside trial + 7d grace
  }

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
