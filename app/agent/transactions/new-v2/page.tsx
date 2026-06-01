import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/PageHeader";
import { NewSaleFlow } from "@/components/transactions-v2/NewSaleFlow";
import { TrialExpiredModal } from "@/components/billing/TrialExpiredModal";

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
      select: { firstSubmissionAt: true, stripeCustomerId: true },
    });
    if (
      agency?.firstSubmissionAt &&
      !agency.stripeCustomerId &&
      Date.now() - agency.firstSubmissionAt.getTime() >= TRIAL_WINDOW_MS
    ) {
      const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
      return <TrialExpiredModal publishableKey={publishableKey} source="new-sale" />;
    }
  }

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
        />
      </div>
    </>
  );
}
