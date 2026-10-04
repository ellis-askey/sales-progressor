import { specimenIndex } from "@/lib/command/email-catalogue/registry";
import { allContentHashes } from "@/lib/command/email-catalogue/review";
import { coverageReport } from "@/lib/command/email-catalogue/coverage";
import { getAllBucketStates } from "@/lib/email/bucket-toggles";
import { prisma } from "@/lib/prisma";
import { EmailCatalogue, type ReviewInfo } from "./EmailCatalogue";

export const dynamic = "force-dynamic";

// Command Centre Email Catalogue — every email the portal can send, rendered
// from the real builders under a selectable scenario. Superadmin-gated by the
// /command/(protected) layout. Review state is stored in the database (shared +
// auditable), and re-flags an email for review if its copy later changes.
// See docs/active/email-catalogue/SPEC.md.
export default async function CommandEmailsPage() {
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
