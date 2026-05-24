// Throwaway audit / review page for the agent-app icon system overhaul.
//
// Lists every icon currently in use across the agent surfaces, shows it
// rendered in its real-world context (sidebar row / banner replica /
// button replica / etc), proposes changes where applicable, and
// introduces new universal icons for the ContactRole concepts
// (vendor / purchaser / solicitor / broker / other).
//
// Lives under /agent/audit/* alongside the existing overlays + before-after
// review pages. NOT linked from nav — direct URL only. Delete the
// directory once the swap follow-up PR has shipped.
//
// No production icons change in this PR — this page is purely for review.

import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/session";
import { IconAuditView } from "./IconAuditView";

export default async function IconAuditPage() {
  await requireSession();
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Icon audit"
        subtitle="Every icon currently in use across the agent app, rendered in its real-world context. Reviewable surface for the overhaul — nothing in production changes from this page."
      />
      <IconAuditView />
    </div>
  );
}
