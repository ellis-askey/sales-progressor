import { requireSession } from "@/lib/session";
import { getAccessScope } from "@/lib/security/access-scope";
import { listChainsForScope, listNoChainSalesForScope } from "@/lib/services/chains";
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
  const scope = getAccessScope(session);
  const isProgressor = session.user.role === "sales_progressor";
  const isAllScope = scope.kind === "all";

  const [chains, noChain] = await Promise.all([
    listChainsForScope(scope),
    listNoChainSalesForScope(scope),
  ]);

  const subtitle = isAllScope
    ? "The chains across the platform, and the sales not yet in one."
    : isProgressor
      ? "The chains your assigned sales sit in, and the ones not yet in a chain."
      : "The chains your sales sit in, and the sales not yet in a chain.";

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
