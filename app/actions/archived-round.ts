"use server";

// Server actions for the archived-round (previous-sale) drawer.
//
// getArchivedDocumentUrl mints a FRESH signed URL for a document on demand, so
// the drawer's Download links keep working even when the drawer has been open
// long enough that the URL minted at load time has expired.

import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { getSignedUrl } from "@/lib/supabase-storage";

export async function getArchivedDocumentUrl(
  transactionId: string,
  documentId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  // Caller must be able to see the file the document belongs to.
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) return { ok: false, error: "Not found." };

  const doc = await prisma.transactionDocument.findFirst({
    where: { id: documentId, transactionId },
    select: { storagePath: true },
  });
  if (!doc) return { ok: false, error: "That document is no longer on this file." };

  const url = await getSignedUrl(doc.storagePath).catch(() => null);
  if (!url) return { ok: false, error: "Couldn't open this document. Try again." };
  return { ok: true, url };
}
