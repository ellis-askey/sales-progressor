// Phase-2 PR 2 (TransactionDocument scoping). Two surfaces read documents
// for the live transaction — the file-detail Documents panel
// (components/transaction/DocumentsSection.tsx) and the agent API route
// (app/api/transactions/[id]/documents/route.ts). Both must apply the
// same OR filter to scope out fall-through buyer uploads while keeping
// file-level docs (MoS, agent uploads, vendor / solicitor / broker portal
// uploads — all with buyerRoundId NULL by design).
//
// Classification rule (locked by the Phase-2 plan, decisions log entry 5 +
// fall-through ledger audit findings):
//   - buyerRoundId IS NULL    → file-level. Always visible on the live tx.
//   - buyerRoundId = active   → current buyer's upload. Visible on live tx.
//   - buyerRoundId = archived → previous buyer's upload. Hidden on live tx,
//                               surfaced only inside the archived drawer.
//
// The archived drawer's own document fetcher
// (lib/services/archived-round.ts:getFileLevelDocumentsForArchive) is the
// other consumer; updated separately in this PR to combine file-level
// docs with THAT specific round's purchaser uploads, instead of dumping
// the entire file's documents into every drawer.

import { prisma } from "@/lib/prisma";
import { getSignedUrl } from "@/lib/supabase-storage";

export type LiveTransactionDocumentRow = {
  id: string;
  filename: string;
  storagePath: string;
  fileSize: number;
  mimeType: string;
  source: string;
  createdAt: Date;
  contact: { name: string; roleType: string } | null;
  signedUrl: string | null;
};

// Filter shape reused by the live-tx callers. The active round id is looked
// up once per call; for a tx with no active round (legacy / pre-Phase-1)
// the filter collapses to "buyerRoundId IS NULL only" — but in practice
// every active tx has an active round post-Phase-1 backfill.
function buildLiveScopeWhere(transactionId: string, activeBuyerRoundId: string | null) {
  if (activeBuyerRoundId === null) {
    // Defensive: no active round → only file-level docs are valid to show.
    // A live tx without an active round is the Phase-1 legacy case; the
    // backfill stamps it but until that lands, we err on hiding rather than
    // surfacing fall-through buyer rows.
    return { transactionId, buyerRoundId: null };
  }
  return {
    transactionId,
    OR: [
      { buyerRoundId: null },              // file-level (MoS, admin, non-purchaser portal)
      { buyerRoundId: activeBuyerRoundId } // active-round purchaser uploads
    ],
  };
}

export async function listLiveTransactionDocuments(
  transactionId: string,
): Promise<LiveTransactionDocumentRow[]> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { activeBuyerRoundId: true },
  });
  const where = buildLiveScopeWhere(transactionId, tx?.activeBuyerRoundId ?? null);
  const docs = await prisma.transactionDocument.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, filename: true, storagePath: true, fileSize: true,
      mimeType: true, source: true, createdAt: true,
      contact: { select: { name: true, roleType: true } },
    },
  });
  return Promise.all(
    docs.map(async (d) => ({
      ...d,
      signedUrl: await getSignedUrl(d.storagePath).catch(() => null),
    })),
  );
}
