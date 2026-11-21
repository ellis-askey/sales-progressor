import { specimenIndex } from "@/lib/command/email-catalogue/registry";
import { allContentHashes } from "@/lib/command/email-catalogue/review";
import { coverageReport } from "@/lib/command/email-catalogue/coverage";
import { getAllBucketStates } from "@/lib/email/bucket-toggles";
import { prisma } from "@/lib/prisma";
import { EmailCatalogue, type ReviewInfo } from "@/app/command/(protected)/emails/EmailCatalogue";

// Platform workspace → Emails → Catalogue view. Verbatim from /command/emails
// (consolidation): every email the portal can send, rendered from the real
// builders, with DB-backed review state. Read + review only (the EmailCatalogue
// client component owns its own review-tick action — unchanged). Loaders
// identical; the ./EmailCatalogue import is made absolute. No email delivery
// touched.
export async function CatalogueView() {
  const specimens = specimenIndex();
  const hashes = allContentHashes();
  const rows = await prisma.emailCatalogueReview.findMany({
    select: { specimenId: true, reviewedAt: true, reviewedByEmail: true, contentHash: true },
  });

  const reviews: Record<string, ReviewInfo> = {};
  for (const r of rows) {
    const current = hashes[r.specimenId];
    reviews[r.specimenId] = {
      reviewedAt: r.reviewedAt.toISOString(),
      by: r.reviewedByEmail,
      // "Needs re-review": ticked, but the email renders differently now.
      stale: current != null && current !== r.contentHash,
    };
  }

  const bucketStates = await getAllBucketStates();
  const coverage = coverageReport();

  return <EmailCatalogue specimens={specimens} initialReviews={reviews} bucketStates={bucketStates} coverage={coverage} />;
}
