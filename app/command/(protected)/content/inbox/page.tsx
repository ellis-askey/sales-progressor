import Link from "next/link";
import { getInboxBoard } from "@/lib/command/content/inbox";
import { InboxList } from "@/components/command/content/InboxList";

// Content inbox (docs/active/content-brand/SPEC.md, Phase 1.3). Real things
// worth talking about, sourced from anonymised TSP signals + activity topics +
// saved thoughts, then AI-enriched. Superadmin gating handled by the (protected)
// layout.

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Refresh enriches candidates via Claude

export default async function InboxPage() {
  const board = await getInboxBoard();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">Content inbox</h1>
          <p className="mt-1 max-w-xl text-[13px] text-neutral-500">
            Real things worth talking about, pulled from your data, your activity and your saved thoughts. Each comes
            with why it&rsquo;s interesting and a few different angles. Nothing here is a finished post. Pick what you
            agree is worth saying.
          </p>
        </div>
        <Link href="/command/content" className="shrink-0 text-xs text-neutral-500 transition-colors hover:text-neutral-300">
          ← Content
        </Link>
      </div>

      <InboxList
        board={{
          fresh: board.fresh.map(serialise),
          saved: board.saved.map(serialise),
          counts: board.counts,
        }}
      />
    </div>
  );
}

function serialise(it: {
  id: string; sourceType: string; observation: string; whyInteresting: string; brandFit: string | null;
  reachReason: string | null; claimClass: string; likelyAudience: string[];
  suggestedAngles: { angle: string; point: string }[]; evidence: Record<string, unknown> | null; freshnessAt: Date; status: string;
}) {
  return {
    id: it.id,
    sourceType: it.sourceType,
    observation: it.observation,
    whyInteresting: it.whyInteresting,
    brandFit: it.brandFit,
    reachReason: it.reachReason,
    claimClass: it.claimClass,
    likelyAudience: it.likelyAudience,
    suggestedAngles: it.suggestedAngles,
    evidence: it.evidence,
    freshnessAt: it.freshnessAt.toISOString(),
    status: it.status,
  };
}
