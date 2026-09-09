import Link from "next/link";
import { getOpportunitiesBoard } from "@/lib/command/content/opportunities";
import { OpportunitiesList } from "@/components/command/content/OpportunitiesList";

// Brand opportunities (docs/active/content-brand/SPEC.md, Phase 2.1). The PR-
// consultant view: reputation-building moves beyond individual posts.
// Superadmin gating handled by the (protected) layout.

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Refresh calls Claude

export default async function OpportunitiesPage() {
  const board = await getOpportunitiesBoard();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Brand opportunities</h1>
          <p className="mt-1 max-w-xl text-[13px] text-neutral-500">
            Bigger moves that build your reputation, not just the next post: a position to establish, an article or
            series to start, a case study, a press or podcast angle. Grounded in your brand, never invented.
          </p>
        </div>
        <Link href="/command/content" className="shrink-0 text-xs text-neutral-500 transition-colors hover:text-neutral-300">
          ← Content
        </Link>
      </div>

      <OpportunitiesList
        board={{
          open: board.open.map(serialise),
          pursuing: board.pursuing.map(serialise),
          counts: board.counts,
        }}
      />
    </div>
  );
}

function serialise(o: {
  id: string; kind: string; title: string; rationale: string; suggestedAction: string;
  audience: string[]; effort: string | null; horizon: string | null; brandFit: string | null; claimClass: string; status: string;
}) {
  return {
    id: o.id,
    kind: o.kind,
    title: o.title,
    rationale: o.rationale,
    suggestedAction: o.suggestedAction,
    audience: o.audience,
    effort: o.effort,
    horizon: o.horizon,
    brandFit: o.brandFit,
    claimClass: o.claimClass,
    status: o.status,
  };
}
