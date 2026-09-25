// File-detail — Steps tab (route segment). Renders only when this tab is open.
import { loadFilePageContext } from "@/lib/services/file-page-context";
import { StepsPanel } from "@/components/transaction/StepsPanel";
import { buildPartyNameContext } from "@/lib/milestones/step-name";

export const unstable_dynamicStaleTime = 300;

export default async function StepsTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, transaction } = await loadFilePageContext(id);
  // Real party names for the Steps-tab labels (firm + seller/buyer names, titles
  // stripped, active buyer round only). Falls back to generic wording per slot.
  const partyNames = buildPartyNameContext(
    transaction.contacts,
    transaction.vendorSolicitorFirm?.name ?? null,
    transaction.purchaserSolicitorFirm?.name ?? null,
    transaction.activeBuyerRound?.id ?? null,
  );
  return (
    <StepsPanel
      transactionId={transaction.id}
      agencyId={session.user.agencyId}
      purchaseType={transaction.purchaseType ?? null}
      buyerNames={transaction.contacts.filter((c) => c.roleType === "purchaser").map((c) => c.name)}
      partyNames={partyNames}
    />
  );
}
