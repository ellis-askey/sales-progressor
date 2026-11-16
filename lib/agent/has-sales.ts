import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeTransactionWhere } from "@/lib/security/access-scope";
import type { Session } from "next-auth";

// Does this user's world contain any real (non-draft) sale? Used to decide
// whether the quick-action dock's New note / New email are usable — before the
// first sale there's nothing to attach a note or email to, so the dock disables
// them with a hint rather than opening an empty "no sales match" picker. Scoped
// through the access-scope helper, so it's multi-tenant safe for every audience.
export async function userHasAnySale(session: Session): Promise<boolean> {
  try {
    const scope = getAccessScope(session);
    const count = await prisma.propertyTransaction.count({
      where: { AND: [scopeTransactionWhere(scope), { status: { not: "draft" } }] },
    });
    return count > 0;
  } catch {
    return true; // fail open — never disable the dock on a read hiccup
  }
}
