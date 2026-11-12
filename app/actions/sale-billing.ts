"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { prisma } from "@/lib/prisma";

// Per-sale free grant for the outsourced-sunset model ("click which sales are
// free"). Under the flat £50-per-exchange model there is no automatic free; a
// sale is only free when deliberately granted here. It reuses
// PropertyTransaction.freeOnExchange, which the exchange trigger already honours
// (a freeOnExchange file exchanges but never bills), so granting a file simply
// means it won't be charged the £50 at exchange.
//
// Superadmin/admin only. Only a NOT-YET-BILLED file can change: once
// billedAtExchange is stamped the invoice decision is made, and crediting it back
// is the reversal path (lib/services/billing-reversal.ts), not this toggle — so we
// refuse rather than silently diverge the stamp from what was invoiced.
export async function setSaleFreeOnExchangeAction(input: {
  transactionId: string;
  free: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  if (!hasAdminPowers(session)) {
    return { ok: false, error: "Forbidden" };
  }

  const txn = await prisma.propertyTransaction.findUnique({
    where: { id: input.transactionId },
    select: { id: true, agencyId: true, billedAtExchange: true },
  });
  if (!txn) return { ok: false, error: "Sale not found." };
  if (txn.billedAtExchange) {
    return { ok: false, error: "This sale has already been billed. Credit it with a reversal instead." };
  }

  await prisma.propertyTransaction.update({
    where: { id: input.transactionId },
    data: { freeOnExchange: input.free },
  });

  if (txn.agencyId) revalidatePath(`/command/agency/${txn.agencyId}`, "page");
  return { ok: true };
}
