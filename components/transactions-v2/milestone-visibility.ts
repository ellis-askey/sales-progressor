import type { FormFields } from "@/components/transactions-v2/form/types";

// Which milestones a sale will actually track, given its tenure / purchase
// type. Freehold sales auto-NR the leasehold milestones; cash purchases
// auto-NR the mortgage ones. Used by the new-sale earnings card's "we'll track
// this through N steps" preview.

export type MilestoneDefinitionSlim = {
  id: string;
  code: string;
  name: string;
  side: string;
  orderIndex: number;
};

const NR_FREEHOLD = new Set(["VM8", "VM9", "PM12"]);
const NR_CASH = new Set(["PM5", "PM6", "PM11"]);

function isCash(purchaseType: string) {
  return purchaseType === "cash_buyer" || purchaseType === "cash_from_proceeds";
}

export function getVisibleMilestones(defs: MilestoneDefinitionSlim[], fields: FormFields) {
  return defs.filter((d) => {
    if (fields.tenure === "freehold" && NR_FREEHOLD.has(d.code)) return false;
    if (isCash(fields.purchaseType) && NR_CASH.has(d.code)) return false;
    return true;
  });
}
