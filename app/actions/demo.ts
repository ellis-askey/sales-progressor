"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createDemoSale, removeDemoSale, DEMO_PRESET } from "@/lib/services/demo-sale";

// Return-value variant of addDemoSaleAction for the demo hero: builds the demo
// (or finds the existing one) and returns the id of the file to open WITHOUT
// redirecting, so the client owns the "Getting your demo ready" transition and
// navigates itself. Routes back to the star file (14 Beaumont Rise, the middle
// of the chain) rather than an arbitrary demo link.
export async function getOrCreateDemoSaleAction(): Promise<{ transactionId: string }> {
  const session = await requireSession();
  const agencyId = session.user.agencyId;
  if (!agencyId) throw new Error("Demo files are for agency accounts");

  const [realCount, star, anyDemo] = await Promise.all([
    prisma.propertyTransaction.count({ where: { agencyId, isDemo: false } }),
    prisma.propertyTransaction.findFirst({ where: { agencyId, isDemo: true, propertyAddress: DEMO_PRESET.address }, select: { id: true } }),
    prisma.propertyTransaction.findFirst({ where: { agencyId, isDemo: true }, select: { id: true } }),
  ]);
  if (realCount > 0) throw new Error("You already have a sale on this account");

  // One demo at a time: reuse the existing one, preferring the star file.
  const existing = star ?? anyDemo;
  if (existing) return { transactionId: existing.id };

  const txId = await createDemoSale({ agencyId, agentUserId: session.user.id });
  revalidatePath("/agent/hub");
  revalidatePath("/agent/transactions");
  return { transactionId: txId };
}

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

// Remove a demo file on request (the "Remove now" button on the demo banner).
// Guards demo + agency ownership inside removeDemoSale; a no-op if the file
// isn't a demo or isn't theirs. Returns them to the hub.
export async function removeDemoSaleAction(transactionId: string) {
  const session = await requireSession();
  const agencyId = session.user.agencyId;
  if (!agencyId) throw new Error("Not permitted");

  await removeDemoSale(transactionId, agencyId);
  revalidatePath("/agent/hub");
  revalidatePath("/agent/transactions");
  redirect("/agent/hub");
}
