import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/PageHeader";
import { NewSaleFlow } from "@/components/transactions-v2/NewSaleFlow";
import { deriveDefaultProgressedBy } from "@/lib/agency/default-progressed-by";
import { listAssignableAgentsForAgency } from "@/lib/services/agency-team";

// The "Add a demo" server action (posted to this route) builds a rich 3-file
// chain and takes ~10s, so give this route generous headroom over the default.
export const maxDuration = 60;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export default async function AgentNewSaleV2Page() {
  const session = await requireSession();

  // Pricing migration (2026-08): there is no trial gate any more. Self-progress
  // is free, so a self-progressing agency is never blocked from adding a sale.
  // A card is needed only for billable outsourcing (beyond the free first file),
  // and that is captured via the hub payment nudge, not by walling off this form.

  // Per-agency default for the "progressed by" toggle. The legacy
  // progressor-managed agencies (Meldone / Oplah / Akeman / Via) default
  // to "send to us"; everyone else defaults to "self-progress". The
  // toggle still works in both directions — only the starting state
  // flips for those agencies.
  const agencyRow = session.user.agencyId
    ? await prisma.agency.findUnique({
        where: { id: session.user.agencyId },
        select: { name: true, modeProfile: true, feeTier: true, legacyOutsourcedFeePence: true },
      })
    : null;
  const defaultProgressedBy = deriveDefaultProgressedBy(
    agencyRow?.name,
    agencyRow?.modeProfile,
  );
  // Earnings-builder fee config. Under the 2026-08 model, sending a sale to us
  // is free when it would be the agency's FIRST outsourced file (D3) — i.e. no
  // prior outsourced sale has exchanged yet. (feeTier="free" comped agencies are
  // handled inside the earnings builder via feeTier.) The prop keeps the name
  // `withinTrial` for now; its meaning is now "your next outsourced sale is free".
  const feeTier = agencyRow?.feeTier ?? "standard";
  const legacyOutsourcedFeePence = agencyRow?.legacyOutsourcedFeePence ?? null;
  const priorExchangedOutsourced = session.user.agencyId
    ? await prisma.propertyTransaction.count({
        where: { agencyId: session.user.agencyId, serviceType: "outsourced", exchangedAt: { not: null }, isMigrated: false },
      })
    : 0;
  const withinTrial = priorExchangedOutsourced === 0;

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

  // Demo hero: shown to an agency user while they have no genuine sales. The
  // "See how it works" CTA stands up the demo (or reopens the existing one, one
  // at a time), so it stays available even after the demo has been created —
  // it's their way back into it. See lib/services/demo-sale.ts and
  // components/transactions-v2/DemoHeroCard.tsx.
  // Drafts don't count as a real sale — the hero stays until they actually
  // submit one (drop a memo / fill in manually), matching where drafts appear.
  const showDemoHero = session.user.agencyId
    ? (await prisma.propertyTransaction.count({ where: { agencyId: session.user.agencyId, isDemo: false, status: { not: "draft" as never } } })) === 0
    : false;

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
          brokerFirm: {
            select: {
              id: true,
              name: true,
              // First contact so the saved-broker card can show details once the
              // agent confirms a broker is involved.
              handlers: { take: 1, select: { id: true, name: true, phone: true, email: true } },
            },
          },
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
      <PageHeader title="New sale" subtitle="Drop in your memo of sale to get started, or add the details manually." />

      <div className="px-4 md:px-8 pt-2 pb-8">
        <NewSaleFlow
          recommendedFirms={recommendedFirms}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          preferredBroker={(preferredBrokerRow as any)?.brokerFirm ? { firmId: (preferredBrokerRow as any).brokerFirm.id, firmName: (preferredBrokerRow as any).brokerFirm.name, contactId: (preferredBrokerRow as any).brokerFirm.handlers?.[0]?.id ?? null, contactName: (preferredBrokerRow as any).brokerFirm.handlers?.[0]?.name ?? null, phone: (preferredBrokerRow as any).brokerFirm.handlers?.[0]?.phone ?? null, email: (preferredBrokerRow as any).brokerFirm.handlers?.[0]?.email ?? null } : null}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          preferredBrokerDefaultFee={(preferredBrokerRow as any)?.defaultReferralFeePence ?? null}
          initialDrafts={drafts}
          allMilestoneDefinitions={allMilestoneDefinitions}
          showPortalPrompt={showPortalPrompt}
          defaultProgressedBy={defaultProgressedBy}
          isDirector={isDirector}
          currentUserId={session.user.id}
          assignableAgents={assignableAgents}
          showDemoHero={showDemoHero}
          feeTier={feeTier}
          legacyOutsourcedFeePence={legacyOutsourcedFeePence}
          withinTrial={withinTrial}
        />
      </div>
    </>
  );
}
