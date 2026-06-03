// components/billing/PaymentMethodNudge.tsx
//
// Hub card nudging directors to add a payment method once their trial window
// has had time to pass naturally. Designed to be unobtrusive: not modal,
// not flashy, not waved-in-face on day one.
//
// Trigger (all must be true):
//   - role = director (negotiators get the modal flow instead; both checked
//     at the call site)
//   - Agency has no stripeCustomerId yet (no card on file)
//   - Agency has a firstSubmissionAt, i.e. has submitted at least one file
//   - >= 21 days have elapsed since firstSubmissionAt (past the 14-day trial
//     plus another week of grace before we start mentioning billing setup
//   - Hides itself otherwise (server-component, returns null)
//
// Server side does the condition check and decides whether to render. The
// client child TrialBannerWithModal owns the banner JSX, the open-modal
// state, and the embedded TrialExpiredModal. This keeps the agency-state
// fetch on the server while letting the trigger live in a client island.

import { prisma } from "@/lib/prisma";
import { TrialBannerWithModal } from "./TrialBannerWithModal";
import { getActiveTermsVersion, hasAcknowledged } from "@/lib/billing/acknowledgement";

const NUDGE_THRESHOLD_MS = 21 * 24 * 60 * 60 * 1000;

export async function PaymentMethodNudge({ agencyId }: { agencyId: string }) {
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { firstSubmissionAt: true, stripeCustomerId: true },
  });
  if (!agency) return null;
  if (agency.stripeCustomerId) return null;       // card already on file
  if (!agency.firstSubmissionAt) return null;     // never submitted; too early to nudge
  const elapsed = Date.now() - agency.firstSubmissionAt.getTime();
  if (elapsed < NUDGE_THRESHOLD_MS) return null;  // inside trial + 7d grace

  // Pre-resolve pricing-terms state so the modal can render the terms
  // step inline (instead of letting CardCaptureForm hit a 409 from the
  // SetupIntent endpoint and surfacing the bare "Pricing terms not yet
  // acknowledged" error).
  const activeTerms = await getActiveTermsVersion();
  const termsAcknowledged = activeTerms
    ? await hasAcknowledged(agencyId, activeTerms.id)
    : false;

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
      termsSections={activeTerms?.sections ?? []}
    />
  );
}
