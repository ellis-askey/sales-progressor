import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getAccessScope } from "@/lib/security/access-scope";
import { listChainsForScope, listNoChainSalesForScope } from "@/lib/services/chains";
import { canSeeChains } from "@/lib/chain/chains-access";
import { PageHeader } from "@/components/layout/PageHeader";
import { ChainsWorkspace } from "@/components/chain/ChainsWorkspace";

export const dynamic = "force-dynamic";

// Chains workspace — the chains our sales sit in, and the live sales not yet in
// one. Scoped via getAccessScope so agency staff see their agency, a
// sales_progressor sees assigned files, and admin/superadmin see everything
// (in-house and outsourced alike). All editing happens in the ChainDrawer,
// opened per row.
export default async function AgentChainsPage() {
  const session = await requireSession();

  // Controlled rollout: only internal staff + a named email allowlist may see
  // the chains workspace. Server guard mirrors the nav gate (both use
  // canSeeChains) so the route can't be reached by URL either.
  if (!canSeeChains(session.user.role, session.user.email)) {
    redirect("/agent/hub");
  }

  const scope = getAccessScope(session);
  const isProgressor = session.user.role === "sales_progressor";
  const isAllScope = scope.kind === "all";

  const [chains, noChain] = await Promise.all([
    listChainsForScope(scope),
    listNoChainSalesForScope(scope),
  ]);

  const subtitle = isAllScope
    ? "Chain positions across the platform, and what needs attention."
    : isProgressor
      ? "Chain position at a glance for your assigned sales, and what needs your attention."
      : "See your chain position at a glance and spot what needs your attention.";

  return (
    <>
      <PageHeader title="Chains" subtitle={subtitle} />
      <div className="px-4 md:px-8 py-2 md:py-4">
        <ChainsWorkspace
          chains={chains}
          noChain={noChain}
          currentUserId={session.user.id}
          currentUserRole={session.user.role}
        />
      </div>
    </>
  );
}
