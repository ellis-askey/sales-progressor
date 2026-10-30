// Person-tie for the onward portal mirror (docs/active/onward-portal-mirror.md).
//
// Each portal token opens ONE contact on ONE file, and confirmations run through
// that token. So to let someone confirm their neighbour file's steps from their
// sale link, we resolve THEIR OWN contact + token on that neighbour file and
// render its real steps under it — fully legitimate, no new auth model.
//
// Phase 1 ties by unambiguous email match (a strong signal). Where there's no
// confident match (missing emails, name-only), we return null and the side tab
// falls back to read-only (see spec). Phase 2 adds an agent-confirmed stored tie
// for the no-email case.

import { prisma } from "@/lib/prisma";

export type TwinContact = { contactId: string; portalToken: string | null };

const normEmail = (e: string | null | undefined): string | null => {
  const v = e?.trim().toLowerCase();
  return v ? v : null;
};

// Pure matcher: the same person on the neighbour file, by unambiguous email.
// Returns the single candidate whose email matches the source, or null when
// there's no email to match on, no hit, or more than one (ambiguous).
export function matchTwinByEmail(
  sourceEmail: string | null,
  candidates: { id: string; email: string | null; portalToken: string | null }[],
): TwinContact | null {
  const src = normEmail(sourceEmail);
  if (!src) return null;
  const hits = candidates.filter((c) => normEmail(c.email) === src);
  if (hits.length !== 1) return null;
  return { contactId: hits[0].id, portalToken: hits[0].portalToken };
}

// DB wrapper: resolve the twin of `sourceContactId` on `neighbourFileId`.
export async function resolveTwinContactOnFile(
  sourceContactId: string,
  neighbourFileId: string,
): Promise<TwinContact | null> {
  const source = await prisma.contact.findUnique({
    where: { id: sourceContactId },
    select: { email: true },
  });
  if (!source?.email) return null;
  const candidates = await prisma.contact.findMany({
    where: { propertyTransactionId: neighbourFileId },
    select: { id: true, email: true, portalToken: true },
  });
  return matchTwinByEmail(source.email, candidates);
}
