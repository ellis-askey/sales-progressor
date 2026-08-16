// Client-portal Documents tab data (Batch 2, 2026-08-17).
//
// Returns the documents this client may see: file-level papers (the MOS + agent
// uploads), their own-side uploads, and anything the OTHER side has chosen to
// share. Purchasers are scoped to their own buyer round, mirroring the timeline.

import { prisma } from "@/lib/prisma";
import { docLabel, docCategoryLabel, readyToAddKeys, type DocRole } from "@/lib/portal-documents";

export type PortalDoc = {
  id: string;
  filename: string;
  docType: string | null;
  label: string;
  category: string | null;
  createdAt: Date;
  url: string | null;
  mine: boolean;
  shared: boolean;
  fromOtherSide: boolean;
  isMos: boolean;
};

export type PortalDocumentsData = {
  role: DocRole;
  tenure: "freehold" | "leasehold";
  documents: PortalDoc[];
  readyToAdd: { key: string; label: string; category: string | null }[];
};

export async function getPortalDocuments(token: string): Promise<PortalDocumentsData | null> {
  const contact = await prisma.contact.findUnique({
    where: { portalToken: token },
    select: { id: true, roleType: true, buyerRoundId: true, propertyTransactionId: true },
  });
  if (!contact) return null;

  const side = contact.roleType === "vendor" ? "vendor" : "purchaser";
  const role: DocRole = side === "vendor" ? "seller" : "buyer";

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: contact.propertyTransactionId },
    select: { tenure: true },
  });
  const tenure = tx?.tenure === "leasehold" ? "leasehold" : "freehold";

  const ownWhere =
    side === "purchaser"
      ? { contact: { roleType: "purchaser" as const }, buyerRoundId: contact.buyerRoundId }
      : { contact: { roleType: "vendor" as const } };
  const otherShared =
    side === "purchaser"
      ? { contact: { roleType: "vendor" as const }, sharedWithOtherSide: true }
      : { contact: { roleType: "purchaser" as const }, sharedWithOtherSide: true };

  const rows = await prisma.transactionDocument.findMany({
    where: {
      transactionId: contact.propertyTransactionId,
      OR: [{ contactId: null }, ownWhere, otherShared],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      docType: true,
      sharedWithOtherSide: true,
      storagePath: true,
      createdAt: true,
      contact: { select: { id: true, roleType: true } },
    },
  });

  const { getSignedUrl } = await import("@/lib/supabase-storage");
  const documents: PortalDoc[] = await Promise.all(
    rows.map(async (d) => {
      const isMos = d.docType === "mos" || d.filename.trim().toLowerCase() === "memorandum of sale";
      return {
        id: d.id,
        filename: d.filename,
        docType: d.docType,
        label: isMos ? "Memorandum of Sale" : docLabel(d.docType),
        category: isMos ? "Sale & legal" : docCategoryLabel(d.docType),
        createdAt: d.createdAt,
        url: await getSignedUrl(d.storagePath, 3600).catch(() => null),
        mine: d.contact?.id === contact.id,
        shared: d.sharedWithOtherSide,
        fromOtherSide: !!d.contact && d.contact.roleType !== side,
        isMos,
      };
    }),
  );

  // MOS floats to the top; the rest stay newest-first.
  documents.sort((a, b) => (a.isMos === b.isMos ? 0 : a.isMos ? -1 : 1));

  const presentTypes = new Set(
    documents.map((d) => (d.isMos ? "mos" : d.docType)).filter((x): x is string => !!x),
  );
  const readyToAdd = readyToAddKeys(role, tenure)
    .filter((k) => !presentTypes.has(k))
    .map((k) => ({ key: k, label: docLabel(k), category: docCategoryLabel(k) }));

  return { role, tenure, documents, readyToAdd };
}
