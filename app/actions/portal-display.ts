"use server";

// Director controls for Account → Client portal: the agency-wide "what clients
// see on their portal" display defaults. All default true (today's behaviour).
// Directors only. Per-file override of key-dates lives in the file's Client
// settings drawer (setTransactionKeyDatesOverride, below).

import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";

type ActionResult = { ok: true } | { ok: false; error: string };

export type PortalDisplayField =
  | "showPortalKeyDates"
  | "showPortalCosts"
  | "showPortalProgressPercent"
  | "showPortalWelcomeSheet";

export async function setAgencyPortalDisplay(
  field: PortalDisplayField,
  value: boolean,
): Promise<ActionResult> {
  const session = await requireSession();
  if (session.user.role !== "director") {
    return { ok: false, error: "Only directors can change portal settings." };
  }
  const agencyId = session.user.agencyId;
  if (!agencyId) return { ok: false, error: "Missing agency context." };

  // Explicit per-field mapping keeps the Prisma update input strictly typed.
  const data =
    field === "showPortalKeyDates" ? { showPortalKeyDates: value }
    : field === "showPortalCosts" ? { showPortalCosts: value }
    : field === "showPortalProgressPercent" ? { showPortalProgressPercent: value }
    : { showPortalWelcomeSheet: value };

  await prisma.agency.update({ where: { id: agencyId }, data });
  revalidatePath("/agent/account/client-portal");
  return { ok: true };
}

// Per-file, PER-SIDE override of the agency's key-dates default, set in the
// file's Client settings drawer. null = follow the agency default, true = force
// show, false = force hide, for the given side (Seller / Buyer). Scoped to the
// caller's own files; audit fields record who/when (last change, either side).
export async function setTransactionKeyDatesOverride(
  transactionId: string,
  side: "vendor" | "purchaser",
  override: boolean | null,
): Promise<ActionResult> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) return { ok: false, error: "File not found." };

  const audit = { portalKeyDatesOverrideSetAt: new Date(), portalKeyDatesOverrideSetById: session.user.id };
  const data = side === "vendor"
    ? { portalKeyDatesOverrideVendor: override, ...audit }
    : { portalKeyDatesOverridePurchaser: override, ...audit };

  await prisma.propertyTransaction.update({ where: { id: tx.id }, data });
  revalidatePath(`/agent/transactions/${transactionId}`);
  return { ok: true };
}
