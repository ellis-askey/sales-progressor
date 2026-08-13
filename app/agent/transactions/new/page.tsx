import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/PageHeader";
import { NewSaleFlow } from "@/components/transactions-v2/NewSaleFlow";
import { TrialExpiredModal } from "@/components/billing/TrialExpiredModal";
import { getActiveTermsVersion, hasAcknowledged } from "@/lib/billing/acknowledgement";
import { applyAgencyTermsOverrides } from "@/lib/billing/terms-sections";
import { deriveDefaultProgressedBy } from "@/lib/agency/default-progressed-by";
import { listAssignableAgentsForAgency } from "@/lib/services/agency-team";

// 14 days, same window used by stampTrialState to decide freeOnExchange.
// Past this point new sales cost money; if no card is on file the
// director hits the trial-expired modal instead of the form.
const TRIAL_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export default async function AgentNewSaleV2Page() {
  const session = await requireSession();

  // Trial-expired gate. Only blocks directors. Negotiators never set up
  // billing (they get BillingNegotiatorModal via the dropdown route).
  // Internal staff (admin / SP) bypass entirely. The modal renders in
  // place of the form so the page only fetches data the modal needs.
  if (session.user.role === "director" && session.user.agencyId) {
    const agency = await prisma.agency.findUnique({
      where: { id: session.user.agencyId },
      select: {
        firstSubmissionAt: true,
        stripeCustomerId: true,
        feeTier: true,
        legacyOutsourcedFeePence: true,
      },
    });
    // Legacy agencies don't get a 14-day trial — they're on a fixed fee
    // per their pre-existing contract and should be on billing from sale 1.
    // For them the gate fires immediately on no-card. Standard-tier
    // agencies keep the 14-day onboarding runway.
    const isLegacy = agency?.feeTier === "legacy";
    const noCard = agency && !agency.stripeCustomerId;
    const trialElapsed =
      !!agency?.firstSubmissionAt &&
      Date.now() - agency.firstSubmissionAt.getTime() >= TRIAL_WINDOW_MS;
    if (agency && noCard && (isLegacy || trialElapsed)) {
      // Server component — reads the unprefixed key (matches lib/stripe.ts
      // + the settings billing page + the Vercel env var the founder set
      // up). The earlier NEXT_PUBLIC_ variant drifted from that
      // convention and resolved to "" at runtime, tripping
      // CardCaptureForm's empty-key guard.
      const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY ?? "";
      // Pre-resolve pricing-terms state so the modal can render the
      // terms step inline before CardCaptureForm tries to fetch the
      // SetupIntent (which would 409 with "Pricing terms not yet
      // acknowledged" otherwise).
      const activeTerms = await getActiveTermsVersion();
      const termsAcknowledged = activeTerms
        ? await hasAcknowledged(session.user.agencyId, activeTerms.id)
        : false;
      // Legacy agencies see their fixed fee in the Charges section instead
      // of the public sliding scale. No-op for sliding tier.
      const sections = applyAgencyTermsOverrides(
        activeTerms?.sections ?? [],
        agency,
      );
      return (
        <TrialExpiredModal
          publishableKey={publishableKey}
          source="new-sale"
          termsAcknowledged={termsAcknowledged}
          termsVersionId={activeTerms?.id ?? null}
          termsVersionTag={activeTerms?.versionTag ?? null}
          termsSections={sections}
        />
      );
    }
  }

  // Per-agency default for the "progressed by" toggle. The legacy
  // progressor-managed agencies (Meldone / Oplah / Akeman / Via) default
  // to "send to us"; everyone else defaults to "self-progress". The
  // toggle still works in both directions — only the starting state
  // flips for those agencies.
  const agencyRow = session.user.agencyId
    ? await prisma.agency.findUnique({
        where: { id: session.user.agencyId },
        select: { name: true, modeProfile: true },
      })
    : null;
  const defaultProgressedBy = deriveDefaultProgressedBy(
    agencyRow?.name,
    agencyRow?.modeProfile,
  );

  // Portal-invite prompt is a one-shot: only shown on the agent's very
  // first ADDED sale AND only until they've clicked "I won't be using the
  // portal". After either condition flips, the prompt is gone forever —
  // avoids the "click just to dismiss" annoyance once they're past the
  // first add. Claimed sales (via chain invite) don't count as "adding" —
  // the agent didn't originate them, so they haven't seen the prompt yet.
  const [agentAddedSaleCount, currentUserRow] = await Promise.all([
    prisma.propertyTransaction.count({
      where: {
        agentUserId: session.user.id,
        status: { not: "draft" as never },
        // Exclude sales the user got by claiming a chain link — those
        // arrived via the claim flow, not the new-sale form.
        NOT: { chainLink: { claimedByUserId: session.user.id } },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { portalInviteSkipCount: true },
    }),
  ]);
  const showPortalPrompt =
    agentAddedSaleCount === 0 && (currentUserRow?.portalInviteSkipCount ?? 0) === 0;

  const isDirector = session.user.role === "director";
  const assignableAgents = isDirector && session.user.agencyId
    ? await listAssignableAgentsForAgency(session.user.agencyId).catch(() => [])
    : [];

  const [recommendedFirms, preferredBrokerRow, drafts, allMilestoneDefinitions] = await Promise.all([
    Promise.resolve().then(() =>
      db.agencyRecommendedSolicitor?.findMany({ where: { agencyId: session.user.agencyId }, select: { solicitorFirmId: true, defaultReferralFeePence: true } }) ?? Promise.resolve([])
    ).then((rows: { solicitorFirmId: string; defaultReferralFeePence: number | null }[]) =>
      rows.map((r) => ({ id: r.solicitorFirmId, defaultReferralFeePence: r.defaultReferralFeePence }))
    ).catch(() => []),
    Promise.resolve().then(() =>
      prisma.agencyPreferredBroker.findUnique({
        where: { agencyId: session.user.agencyId },
        select: {
          defaultReferralFeePence: true,
          brokerFirm: { select: { id: true, name: true } },
        },
      })
    ).catch(() => null),
    prisma.propertyTransaction.findMany({
      where: { agencyId: session.user.agencyId, agentUserId: session.user.id, status: "draft" as never },
      select: {
        id: true, propertyAddress: true, tenure: true, purchaseType: true,
        purchasePrice: true, createdAt: true,
        notes: true,
        agentFeeAmount: true, agentFeePercent: true, agentFeeIsVatInclusive: true,
        vendorSolicitorFirmId: true, vendorSolicitorContactId: true,
        vendorSolicitorFirm: { select: { name: true } },
        vendorSolicitorContact: { select: { name: true, phone: true, email: true } },
        purchaserSolicitorFirmId: true, purchaserSolicitorContactId: true,
        purchaserSolicitorFirm: { select: { name: true } },
        purchaserSolicitorContact: { select: { name: true, phone: true, email: true } },
        referredFirmId: true, referralFee: true,
        progressedBy: true,
        contacts: { select: { name: true, phone: true, email: true, roleType: true } },
        documents: { where: { source: "mos" }, select: { storagePath: true, fileSize: true, mimeType: true, filename: true }, take: 1 },
        chainLink: {
          select: {
            position: true,
            chain: {
              select: {
                links: {
                  orderBy: { position: "asc" },
                  select: { position: true, transactionId: true, stubPropertyAddress: true, stubAgencyName: true, stubAgentName: true, stubAgentEmail: true, stubAgentPhone: true, stubNotes: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }).then((rows) => rows.map((r) => {
      const originatorPos = r.chainLink?.position ?? -1;
      const chainStubs = r.chainLink?.chain?.links
        .filter((l: { transactionId: string | null }) => l.transactionId === null)
        .map((l: { position: number; stubPropertyAddress: string | null; stubAgencyName: string | null; stubAgentName: string | null; stubAgentEmail: string | null; stubAgentPhone: string | null; stubNotes: string | null }) => ({
          id: Math.random().toString(36).slice(2),
          direction: (l.position < originatorPos ? "above" : "below") as "above" | "below",
          stubPropertyAddress: l.stubPropertyAddress ?? "",
          stubAgencyName: l.stubAgencyName ?? "",
          stubAgentName: l.stubAgentName ?? "",
          stubAgentEmail: l.stubAgentEmail ?? "",
          stubAgentPhone: l.stubAgentPhone ?? "",
          stubNotes: l.stubNotes ?? "",
        })) ?? [];
      const mosDocs = r.documents ?? [];
      const mosDoc = mosDocs[0] ?? null;
      const vendorContacts = r.contacts.filter((c: { roleType: string }) => c.roleType === "vendor");
      const purchaserContacts = r.contacts.filter((c: { roleType: string }) => c.roleType === "purchaser");
      const vendorSol = r.vendorSolicitorFirmId && r.vendorSolicitorFirm
        ? { firmId: r.vendorSolicitorFirmId, firmName: r.vendorSolicitorFirm.name, contactId: r.vendorSolicitorContactId ?? null, contactName: r.vendorSolicitorContact?.name ?? null, phone: r.vendorSolicitorContact?.phone ?? null, email: r.vendorSolicitorContact?.email ?? null }
        : null;
      const purchaserSol = r.purchaserSolicitorFirmId && r.purchaserSolicitorFirm
        ? { firmId: r.purchaserSolicitorFirmId, firmName: r.purchaserSolicitorFirm.name, contactId: r.purchaserSolicitorContactId ?? null, contactName: r.purchaserSolicitorContact?.name ?? null, phone: r.purchaserSolicitorContact?.phone ?? null, email: r.purchaserSolicitorContact?.email ?? null }
        : null;
      return {
        id: r.id,
        propertyAddress: r.propertyAddress,
        tenure: r.tenure as string | null,
        purchaseType: r.purchaseType as string | null,
        purchasePrice: r.purchasePrice ?? null,
        createdAt: r.createdAt.toISOString(),
        notes: r.notes ?? null,
        agentFeeAmount: r.agentFeeAmount ?? null,
        agentFeePercent: r.agentFeePercent != null ? Number(r.agentFeePercent) : null,
        agentFeeIsVatInclusive: r.agentFeeIsVatInclusive ?? null,
        vendors: vendorContacts.map((c: { name: string; phone: string | null; email: string | null }) => ({ name: c.name, phone: c.phone, email: c.email })),
        purchasers: purchaserContacts.map((c: { name: string; phone: string | null; email: string | null }) => ({ name: c.name, phone: c.phone, email: c.email })),
        vendorSolicitor: vendorSol,
        purchaserSolicitor: purchaserSol,
        referredFirmId: r.referredFirmId ?? null,
        referralFee: r.referralFee ?? null,
        mosStoragePath: mosDoc?.storagePath ?? null,
        mosFileSize: mosDoc?.fileSize ?? null,
        mosMimeType: mosDoc?.mimeType ?? null,
        mosFilename: mosDoc?.filename ?? null,
        progressedBy: (r.progressedBy as string | null) ?? "agent",
        chainStubs,
      };
    })).catch(() => []),
    prisma.milestoneDefinition.findMany({
      select: { id: true, code: true, name: true, side: true, orderIndex: true },
      orderBy: { orderIndex: "asc" },
    }).catch(() => []),
  ]);

  return (
    <>
      <PageHeader title="New sale" subtitle="Drop your memo of sale to get started, or fill in manually." />

      <div className="px-4 md:px-8 pt-2 pb-8">
        <NewSaleFlow
          recommendedFirms={recommendedFirms}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          preferredBroker={(preferredBrokerRow as any)?.brokerFirm ? { firmId: (preferredBrokerRow as any).brokerFirm.id, firmName: (preferredBrokerRow as any).brokerFirm.name, contactId: null, contactName: null, phone: null, email: null } : null}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          preferredBrokerDefaultFee={(preferredBrokerRow as any)?.defaultReferralFeePence ?? null}
          initialDrafts={drafts}
          allMilestoneDefinitions={allMilestoneDefinitions}
          showPortalPrompt={showPortalPrompt}
          defaultProgressedBy={defaultProgressedBy}
          isDirector={isDirector}
          currentUserId={session.user.id}
          assignableAgents={assignableAgents}
        />
      </div>
    </>
  );
}
