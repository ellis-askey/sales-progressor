"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createDemoSale } from "@/lib/services/demo-sale";

// Stand up the demo showcase file for the caller's agency, then open it.
// Guarded to agency users with no real sales and no existing demo (one demo at
// a time). See lib/services/demo-sale.ts and docs/active/demo-sale/SPEC.md.
export async function addDemoSaleAction() {
  const session = await requireSession();
  const agencyId = session.user.agencyId;
  if (!agencyId) throw new Error("Demo files are for agency accounts");

  const [realCount, existingDemo] = await Promise.all([
    prisma.propertyTransaction.count({ where: { agencyId, isDemo: false } }),
    prisma.propertyTransaction.findFirst({ where: { agencyId, isDemo: true }, select: { id: true } }),
  ]);
  if (realCount > 0) throw new Error("You already have a sale on this account");
  // One demo at a time: if they already have one, just open it.
  if (existingDemo) redirect(`/agent/transactions/${existingDemo.id}`);

  const txId = await createDemoSale({ agencyId, agentUserId: session.user.id });
  revalidatePath("/agent/hub");
  revalidatePath("/agent/transactions");
  redirect(`/agent/transactions/${txId}`);
}
