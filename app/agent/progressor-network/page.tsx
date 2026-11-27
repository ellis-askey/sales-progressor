import { notFound } from "next/navigation";
import { BloomStage } from "@/components/agent/BloomStage";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/session";
import { isFounderEmail } from "@/lib/security/founder";
import { prisma } from "@/lib/prisma";
import { getProgressorNetwork } from "@/lib/services/progressor-network";
import { getAgencyProgressorRelationshipStats, getHandoverableSales } from "@/lib/services/progressor-network-relationship";
import { ProgressorNetwork } from "@/components/agent/progressor-network/ProgressorNetwork";

// Founder-gated while the network is proven out with Boardwalk + Annalise.
// The gate widens by editing FOUNDER_EMAILS in lib/security/founder.ts.
export const dynamic = "force-dynamic";

export default async function ProgressorNetworkPage() {
  const session = await requireSession();
  if (!isFounderEmail(session.user.email)) notFound();

  const agencyId = session.user.agencyId ?? null;
  const [{ businesses }, agency, handoverableSales] = await Promise.all([
    getProgressorNetwork(agencyId),
    agencyId ? prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true } }) : Promise.resolve(null),
    agencyId ? getHandoverableSales(agencyId) : Promise.resolve([]),
  ]);
  const agencyName = agency?.name ?? "Your agency";

  // Per-connected-business relationship counts (sales this agency has with each),
  // keyed for the component as a plain record. Only connected businesses need it.
  const connectedIds = businesses.filter((b) => b.connectionStatus === "connected").map((b) => b.id);
  const relStats = agencyId
    ? await getAgencyProgressorRelationshipStats(agencyId, connectedIds)
    : new Map();
  const relationships = Object.fromEntries(relStats);

  return (
    <BloomStage className="px-4 md:px-8 py-2 md:py-4 space-y-4">
      <div data-bloom>
        <PageHeader
          title="Progressor Network"
          subtitle="Discover and connect with independent sales progression businesses."
        />
      </div>
      <ProgressorNetwork
        businesses={businesses}
        agencyName={agencyName}
        relationships={relationships}
        handoverableSales={handoverableSales}
      />
    </BloomStage>
  );
}
