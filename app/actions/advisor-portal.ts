"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { signAdvisorToken } from "@/lib/advisor-confirm/token";

// Mints the mortgage advisor's private portal link for a file so an agent can
// share it now (before the Phase 3 chase sends it automatically). Buyer side
// only in Phase 1. Access-scoped (Law 7): the caller must be able to see the file.
export async function getAdvisorPortalLinkAction(
  transactionId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: "Not signed in" };

  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) return { ok: false, error: "File not found" };

  const base = process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";
  const token = signAdvisorToken(tx.id, "purchaser");
  return { ok: true, url: `${base}/a/${token}` };
}
