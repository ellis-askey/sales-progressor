// lib/progression/business-sale-gate.ts
//
// Resolves what (if anything) blocks a progression-business member from adding a
// sale right now, server-side where we know owner-vs-teammate. One of:
//   - needsCard: the OWNER has no card → show the add-a-card form.
//   - salesNotice: a message instead of a form — a TEAMMATE (who can't manage
//     billing) is told to ask the owner, or the plan is PAUSED (overdue) and the
//     owner is told to update the card.
// Nothing blocks when collection is off, or the plan is active and in good standing.

import { prisma } from "@/lib/prisma";
import { progressionBillingCollectEnabled } from "./flags";
import { businessBillingActive } from "./business-stripe";
import { getBusinessPaymentState } from "./business-dunning";
import { extractFirstName } from "@/lib/contacts/displayName";

export type BusinessSaleGate = {
  needsCard: boolean;
  salesNotice: { title: string; body: string; actionLabel?: string; actionHref?: string } | null;
};

export async function resolveBusinessSaleGate(businessId: string, isOwner: boolean): Promise<BusinessSaleGate> {
  if (!progressionBillingCollectEnabled()) return { needsCard: false, salesNotice: null };

  // No card on file yet.
  if (!(await businessBillingActive(businessId))) {
    if (isOwner) return { needsCard: true, salesNotice: null };
    return {
      needsCard: false,
      salesNotice: {
        title: "Billing needs setting up",
        body: `Your business needs a payment card on file before you can add sales. Please ask ${await ownerFirstName(businessId)} to set one up.`,
      },
    };
  }

  // Card on file but a payment is overdue past the grace window.
  const state = await getBusinessPaymentState(businessId);
  if (state.kind === "blocked") {
    if (isOwner) {
      return {
        needsCard: false,
        salesNotice: {
          title: "Adding sales is paused",
          body: "A payment is overdue. Update your card to start adding sales again.",
          actionLabel: "Update card",
          actionHref: "/agent/settings/billing",
        },
      };
    }
    return {
      needsCard: false,
      salesNotice: {
        title: "Adding sales is paused",
        body: `A payment is overdue. Please ask ${await ownerFirstName(businessId)} to update the card.`,
      },
    };
  }

  return { needsCard: false, salesNotice: null };
}

async function ownerFirstName(businessId: string): Promise<string> {
  const owner = await prisma.user.findFirst({
    where: { progressionBusinessId: businessId, progressionBusinessRole: "owner" },
    select: { name: true },
  });
  return extractFirstName(owner?.name ?? "") || owner?.name || "your account owner";
}
