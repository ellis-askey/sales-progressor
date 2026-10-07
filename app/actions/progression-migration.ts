"use server";

// "Bring in an existing sale" — a progression business importing a sale that is
// already underway for one of its client agencies. Unlike a normal add-sale:
//   - the file is tagged isMigrated = true, so TSP's £5 is NOT charged at add;
//     it's charged only if the sale reaches exchange (lib/services/billing-trigger).
//   - the business picks which past milestones are already done; we reconcile them
//     onto the file via the same path used when an agent claims an in-progress sale.
//   - it's time-boxed to a 48h window from the first migration (anti-gaming), and
//     once collection is live a card must be on file (same gate as adding a sale).
//
// Flag- and member-gated. Owner-or-member, scoped to one of the actor's clients.

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import type { Tenure, PurchaseType } from "@prisma/client";
import { progressionBusinessesEnabled, progressionBillingCollectEnabled } from "@/lib/progression/flags";
import { resolveBusinessMember } from "@/lib/services/progression-clients";
import { parseFeeModel } from "@/lib/progression/client-fees";
import { businessBillingActive } from "@/lib/progression/business-stripe";
import { getMigrationWindow } from "@/lib/progression/business-migration";
import { createTransaction } from "@/lib/services/transactions";
import { reconcileClaimMilestonesAction } from "@/app/actions/milestones";
import { normaliseAddressString } from "@/lib/utils/address";

export type MigrateSaleResult =
  | { ok: true; transactionId: string }
  | { ok: false; error: string; needsCard?: boolean; windowClosed?: boolean };

export async function migrateSaleAction(input: {
  clientAgencyId: string;
  propertyAddress: string;
  purchasePrice: number | null;
  tenure: Tenure;
  purchaseType: PurchaseType;
  // The past milestones the business has marked as already done.
  completions: Array<{ milestoneDefinitionId: string; eventDate?: string | null }>;
}): Promise<MigrateSaleResult> {
  if (!progressionBusinessesEnabled()) return { ok: false, error: "This feature isn't enabled yet." };
  const session = await requireSession();
  const member = await resolveBusinessMember(session);
  if (!member) return { ok: false, error: "Only a progression-business member can bring in a sale." };

  if (!input.propertyAddress.trim()) return { ok: false, error: "Enter the property address." };

  // Must be one of the actor's clients, with a fee set (so a brought-in sale can be
  // invoiced to the agency later — same rule as adding a sale for a client).
  const link = await prisma.progressionBusinessClient.findUnique({
    where: { progressionBusinessId_agencyId: { progressionBusinessId: member.businessId, agencyId: input.clientAgencyId } },
    select: { feeModel: true },
  });
  if (!link) return { ok: false, error: "That agency is not one of your clients." };
  if (!parseFeeModel(link.feeModel)) return { ok: false, error: "Set your fee for this client before bringing in a sale." };

  // Card gate (go-live): once collection is live, a card must be on file to bring in
  // a sale, just like adding one. Dark until the collect flag is on.
  if (progressionBillingCollectEnabled() && !(await businessBillingActive(member.businessId))) {
    return { ok: false, needsCard: true, error: "Add a payment card to bring in a sale." };
  }

  // 48h window (anti-gaming): opens on the first migration, then closes.
  const window = await getMigrationWindow(member.businessId);
  if (!window.open) {
    return { ok: false, windowClosed: true, error: "Your migration window has closed. Contact support to bring in more sales." };
  }

  // Attribute the client-agency side to its director (like the create-for-client
  // path). Assign the file to the actor so the reconcile step below (which runs as
  // this session) passes its ownership check; the owner can reassign afterwards.
  const director = await prisma.user.findFirst({
    where: { agencyId: input.clientAgencyId, role: "director" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  const tx = await createTransaction({
    propertyAddress: normaliseAddressString(input.propertyAddress),
    agencyId: input.clientAgencyId,
    progressionBusinessId: member.businessId,
    assignedUserId: session.user.id,
    agentUserId: director?.id ?? null,
    progressedBy: "progressor",
    purchasePrice: input.purchasePrice,
    tenure: input.tenure,
    isShareOfFreehold: false,
    purchaseType: input.purchaseType,
    isMigrated: true,
  });

  // Reconcile the past milestones onto the new file (best-effort, like claim).
  if (input.completions.length > 0) {
    await reconcileClaimMilestonesAction({ transactionId: tx.id, completions: input.completions }).catch((err) =>
      console.error("[migrate] reconcile failed:", err),
    );
  }

  console.log(`[AUDIT] business_migrated_sale businessId=${member.businessId} txId=${tx.id} agencyId=${input.clientAgencyId} by=${session.user.id}`);
  revalidatePath("/agent/clients");
  return { ok: true, transactionId: tx.id };
}
