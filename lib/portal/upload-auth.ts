// Shared portal-token auth for document uploads (2026-08-21). Both the mint
// endpoint and the finalize endpoint need the same check: resolve the contact
// from their portal token and enforce the dead-round guard (a purchaser whose
// round no longer matches the file's active round can't write). Extracted so
// the two endpoints can't drift apart.

import { prisma } from "@/lib/prisma";

export type PortalUploadContact = {
  contactId: string;
  transactionId: string;
  roleType: string;
  buyerRoundId: string | null;
};

export async function resolvePortalUploadContact(
  token: string | null,
): Promise<PortalUploadContact | null> {
  if (!token) return null;

  const contact = await prisma.contact.findUnique({
    where: { portalToken: token },
    select: { id: true, propertyTransactionId: true, roleType: true, buyerRoundId: true },
  });
  if (!contact) return null;

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: contact.propertyTransactionId },
    select: { activeBuyerRoundId: true },
  });
  if (!tx) return null;

  // Dead-round guard — a purchaser pinned to a superseded round cannot upload.
  if (
    contact.roleType === "purchaser" &&
    contact.buyerRoundId != null &&
    contact.buyerRoundId !== tx.activeBuyerRoundId
  ) {
    return null;
  }

  return {
    contactId: contact.id,
    transactionId: contact.propertyTransactionId,
    roleType: contact.roleType,
    buyerRoundId: contact.buyerRoundId,
  };
}
