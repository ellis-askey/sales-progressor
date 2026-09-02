// Async server component for the Chase Timeline tab on the file-detail page.
// Fetches the merged chase view (client + manual tracks) and hands it to the
// client component for the scannable list + progressive-disclosure detail.
// See docs/active/chase-timeline-SPEC.md.

import { getChaseTimeline } from "@/lib/services/chase-timeline";
import { ChaseTimeline } from "@/components/transaction/ChaseTimeline";

export async function ChaseTimelinePanel({
  transactionId,
  agencyId,
}: {
  transactionId: string;
  agencyId: string;
}) {
  const timeline = await getChaseTimeline(transactionId, agencyId).catch(() => null);

  if (!timeline || timeline.threads.length === 0) {
    return (
      <div
        className="rounded-2xl px-6 py-10 text-center"
        style={{ background: "var(--agent-surface-elevated)", border: "0.5px solid var(--agent-border-subtle)" }}
      >
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>No chases on this file yet</p>
        <p style={{ fontSize: 13, color: "var(--agent-text-muted)", marginTop: 4 }}>
          Chase threads appear here as milestones become due. Nothing is being chased right now.
        </p>
      </div>
    );
  }

  return <ChaseTimeline stats={timeline.stats} threads={timeline.threads} transactionId={transactionId} pause={timeline.pause} />;
}
