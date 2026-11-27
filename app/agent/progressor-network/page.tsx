import { notFound } from "next/navigation";
import { BloomStage } from "@/components/agent/BloomStage";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/session";
import { isFounderEmail } from "@/lib/security/founder";
import { getProgressorNetwork } from "@/lib/services/progressor-network";
import { ProgressorNetwork } from "@/components/agent/progressor-network/ProgressorNetwork";

// Founder-gated while the network is proven out with Boardwalk + Annalise.
// The gate widens by editing FOUNDER_EMAILS in lib/security/founder.ts.
export const dynamic = "force-dynamic";

export default async function ProgressorNetworkPage() {
  const session = await requireSession();
  if (!isFounderEmail(session.user.email)) notFound();

  const { businesses } = await getProgressorNetwork(session.user.agencyId ?? null);

  return (
    <BloomStage className="px-4 md:px-8 py-2 md:py-4 space-y-4">
      <div data-bloom>
        <PageHeader
          title="Progressor Network"
          subtitle="Discover and connect with independent sales progression businesses."
        />
      </div>
      <ProgressorNetwork businesses={businesses} />
    </BloomStage>
  );
}
