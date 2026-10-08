import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getAccessScope } from "@/lib/security/access-scope";
import { listChainsForScope, listNoChainSalesForScope, listCheckInsForScope } from "@/lib/services/chains";
import { listExchangePushForScope } from "@/lib/services/exchange-push";
import { canSeeChains } from "@/lib/chain/chains-access";
import { agencyUserHasSelfManagedFiles } from "@/lib/agent/self-managed-nav";
import { isExternalProgressorViewer, isBusinessOwnerViewer, businessHasClients } from "@/lib/services/progression-clients";
import { PageHeader } from "@/components/layout/PageHeader";
import { ChainsWorkspace } from "@/components/chain/ChainsWorkspace";
import { PageReveal } from "@/components/agent/PageReveal";

export const dynamic = "force-dynamic";

// Chains workspace — the chains our sales sit in, and the live sales not yet in
// one. Scoped via getAccessScope so agency staff see their agency, a
// sales_progressor sees assigned files, and admin/superadmin see everything
// (in-house and outsourced alike). All editing happens in the ChainDrawer,
// opened per row.
export default async function AgentChainsPage() {
  const session = await requireSession();

  // Internal staff + self-managing agencies (+ named allowlist) may see the
  // chains workspace. Server guard mirrors the nav gate (both use canSeeChains)
  // so the route can't be reached by URL either.
  const hasSelfManagedFiles = await agencyUserHasSelfManagedFiles(
    session.user.role,
    session.user.id,
    session.user.agencyId,
  );
  if (!canSeeChains(session.user.role, session.user.email, hasSelfManagedFiles)) {
    redirect("/agent/hub");
  }

  const scope = getAccessScope(session);
  const isProgressor = session.user.role === "sales_progressor";
  const isAllScope = scope.kind === "all";

  const [chains, noChain, checkIns, exchangePush] = await Promise.all([
    listChainsForScope(scope),
    listNoChainSalesForScope(scope),
    listCheckInsForScope(scope),
    listExchangePushForScope(scope),
  ]);

  const subtitle = isAllScope
    ? "Chain positions across the platform, and what needs attention."
    : isProgressor
      ? "Chain position at a glance for your sales, and what needs your attention."
      : "See your chain position at a glance and spot what needs your attention.";

  // CTA on the empty chains state, for an EXTERNAL progression business only (agents
  // / TSP keep the unchanged empty state). Owner with no clients -> add a client;
  // otherwise (owner/member whose business has clients) -> add a sale; a team member
  // whose business has no clients can do neither, so no CTA.
  let emptyCta: { label: string; href: string } | null = null;
  if (await isExternalProgressorViewer(session)) {
    const hasClients = session.user.progressionBusinessId
      ? await businessHasClients(session.user.progressionBusinessId)
      : false;
    if (hasClients) {
      emptyCta = { label: "Add a new sale", href: "/agent/transactions/new" };
    } else if (await isBusinessOwnerViewer(session)) {
      emptyCta = { label: "Add a client", href: "/agent/clients" };
    }
  }

  return (
    <>
      <PageHeader title="Chains" subtitle={subtitle} />
      <PageReveal>
      <div className="px-4 md:px-8 py-2 md:py-4">
        <ChainsWorkspace
          chains={chains}
          noChain={noChain}
          checkIns={checkIns}
          exchangePush={exchangePush}
          currentUserId={session.user.id}
          currentUserRole={session.user.role}
          emptyCta={emptyCta}
        />
      </div>
      </PageReveal>
    </>
  );
}

// Perceived-performance (2026-09-18): let the client router reuse this
// page for 5 minutes after a visit — moving around a working burst never
// re-renders a page you just saw. Per-page opt-in rather than a global
// staleTimes so buyer/seller portal navigation keeps its default
// always-fresh behaviour. Every mutation still purges this via its
// revalidatePath calls, and the "As of" button force-refreshes.
export const unstable_dynamicStaleTime = 300;
